import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as RNAppState, type AppStateStatus } from 'react-native';
import type { BroadcastMessage, EventConfig, Station } from '@rally/shared';
import { AuthError, authTeam } from '../api/client';
import { DEFAULT_SERVER_URL } from '../config';
import {
  buildExitEvent,
  buildHelpRequestEvent,
  buildScanEndEvent,
  buildScanStartEvent,
  buildSosEvent,
  buildStationResultEvent,
} from '../core/outboxEvents';
import {
  advance,
  createRouteState,
  getCurrentStation,
  isCrossingCategory,
  isFinished,
  type RouteState,
} from '../core/routeEngine';
import { evaluateScan, type ScanResult } from '../core/scan';
import { generateUuid } from '../core/uuid';
import { recordAlert, recordHelpRequest } from '../db/contact';
import { recordExit } from '../db/exits';
import { enqueue } from '../db/outbox';
import { getCompletedCount, getStartedAt, recordScanEnd, recordScanStart } from '../db/progress';
import { loadRoute, saveRoute, saveStations } from '../db/route';
import { getSetting, setSettings } from '../db/settings';
import { LocationTracker } from '../location/locationTracker';
import { LocationSocket } from '../realtime/locationSocket';
import { SyncWorker } from '../sync/syncWorker';

const MIN_EXIT_AWAY_SEC = 2;

export type AppStatus = 'loading' | 'logged_out' | 'ready';

interface AppState {
  status: AppStatus;
  event: EventConfig | null;
  team: { id: string; name: string; color: string } | null;
  score: number;
  hintsRemaining: number;
  clueOverride: string | undefined;
  broadcasts: BroadcastMessage[];
  routeState: RouteState | null;
  stationStartedAt: number | null;
  lastLocation: { lat: number; lng: number } | null;
  sosAckedAt: number | null;
  error: string | null;
}

export interface AppContextValue extends AppState {
  currentStation: Station | null;
  crossingCategory: boolean;
  finished: boolean;
  login(code: string): Promise<boolean>;
  scanStart(rawCode: string): ScanResult;
  scanEnd(rawCode: string): ScanResult;
  requestHelp(): void;
  sendSos(): void;
  markExpectingCall(): void;
}

const INITIAL_STATE: AppState = {
  status: 'loading',
  event: null,
  team: null,
  score: 0,
  hintsRemaining: 0,
  clueOverride: undefined,
  broadcasts: [],
  routeState: null,
  stationStartedAt: null,
  lastLocation: null,
  sosAckedAt: null,
  error: null,
};

const AppContext = createContext<AppContextValue | null>(null);

function loadEventConfig(): EventConfig {
  return {
    name: getSetting('event_name') ?? '',
    town: getSetting('town') ?? '',
    eventStartIso: getSetting('event_start_iso') ?? '',
    durationMinutes: Number(getSetting('duration_min') ?? '0'),
    hqPhone: getSetting('hq_phone') ?? '',
    emergencyPhone: getSetting('emergency_phone') ?? '',
    helpHintsPerTeam: Number(getSetting('help_hints_per_team') ?? '0'),
    serverUrl: getSetting('server_url') ?? DEFAULT_SERVER_URL,
    qrPayloadFormat: getSetting('qr_payload_format') ?? '',
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  // Cold start: rebuild everything from local SQLite — never from the network.
  useEffect(() => {
    const teamId = getSetting('team_id');
    if (!teamId) {
      setState((s) => ({ ...s, status: 'logged_out' }));
      return;
    }

    const route = loadRoute();
    const currentIndex = getCompletedCount();
    const routeState = createRouteState(route, currentIndex);
    const current = getCurrentStation(routeState);
    const stationStartedAt = current ? getStartedAt(current.id) : null;

    setState({
      status: 'ready',
      event: loadEventConfig(),
      team: {
        id: teamId,
        name: getSetting('team_name') ?? '',
        color: getSetting('color') ?? '#000000',
      },
      score: Number(getSetting('score') ?? '0'),
      hintsRemaining: Number(getSetting('hints_remaining') ?? '0'),
      clueOverride: undefined,
      broadcasts: [],
      routeState,
      stationStartedAt,
      lastLocation: null,
      sosAckedAt: null,
      error: null,
    });
  }, []);

  // While the team is logged in, drain the local outbox to /sync every ~15s.
  const syncWorkerRef = useRef<SyncWorker | null>(null);
  useEffect(() => {
    if (state.status !== 'ready') return undefined;

    const worker = new SyncWorker((syncState) => {
      setSettings({
        score: String(syncState.score),
        hints_remaining: String(syncState.hintsRemaining),
      });
      setState((s) => ({
        ...s,
        score: syncState.score,
        hintsRemaining: syncState.hintsRemaining,
        clueOverride: syncState.clueOverride,
        broadcasts: syncState.broadcasts,
      }));
    });
    syncWorkerRef.current = worker;
    worker.start();

    return () => {
      worker.stop();
      syncWorkerRef.current = null;
    };
  }, [state.status]);

  // While the team is logged in, push throttled GPS updates to organizers over Socket.IO and
  // listen for hint grants / SOS acknowledgements pushed back to this team.
  useEffect(() => {
    if (state.status !== 'ready') return undefined;

    const serverUrl = getSetting('server_url');
    const token = getSetting('token');
    if (!serverUrl || !token) return undefined;

    const socket = new LocationSocket(serverUrl, token, {
      onHelpGranted: (hintsRemaining) => {
        setSettings({ hints_remaining: String(hintsRemaining) });
        setState((s) => ({ ...s, hintsRemaining }));
      },
      onSosAck: () => {
        setState((s) => ({ ...s, sosAckedAt: Date.now() }));
      },
      onBroadcast: (message) => {
        setState((s) => ({ ...s, broadcasts: [...s.broadcasts, message] }));
      },
      onClueOverride: (text) => {
        setState((s) => ({ ...s, clueOverride: text }));
      },
    });
    socket.connect();

    const tracker = new LocationTracker((lat, lng) => {
      setState((s) => ({ ...s, lastLocation: { lat, lng } }));
      socket.sendLocation(lat, lng);
    });
    void tracker.start();

    return () => {
      tracker.stop();
      socket.disconnect();
    };
  }, [state.status]);

  // Exit tracking (anti-cheat signal, §M6): log time spent away from the app while a round
  // is in progress. Suppress the false "exit" caused by the app's own call buttons via
  // markExpectingCall(), and ignore ultra-short transitions.
  const expectingCallRef = useRef(false);
  useEffect(() => {
    if (state.status !== 'ready') return undefined;

    let leftAt: number | null = null;

    const handleAppStateChange = (next: AppStateStatus) => {
      if (next !== 'active') {
        if (leftAt === null) leftAt = Date.now();
        return;
      }
      if (leftAt === null) return;

      const returnedAt = Date.now();
      const recordedLeftAt = leftAt;
      const awaySec = Math.round((returnedAt - recordedLeftAt) / 1000);
      const wasExpectingCall = expectingCallRef.current;
      expectingCallRef.current = false;
      leftAt = null;

      if (awaySec < MIN_EXIT_AWAY_SEC || wasExpectingCall) return;

      const uuid = generateUuid();
      recordExit(uuid, recordedLeftAt, returnedAt, awaySec);
      enqueue(buildExitEvent(uuid, returnedAt, recordedLeftAt, returnedAt));
      syncWorkerRef.current?.triggerNow();
    };

    const subscription = RNAppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [state.status]);

  const login = useCallback(async (code: string): Promise<boolean> => {
    try {
      const res = await authTeam(DEFAULT_SERVER_URL, code);

      setSettings({
        team_id: res.team.id,
        team_name: res.team.name,
        color: res.team.color,
        token: res.token,
        server_url: res.event.serverUrl,
        event_name: res.event.name,
        town: res.event.town,
        event_start_iso: res.event.eventStartIso,
        duration_min: String(res.event.durationMinutes),
        hq_phone: res.event.hqPhone,
        emergency_phone: res.event.emergencyPhone,
        help_hints_per_team: String(res.event.helpHintsPerTeam),
        qr_payload_format: res.event.qrPayloadFormat,
        hints_remaining: String(res.team.hintsRemaining),
        score: String(res.team.score),
        role: 'team',
      });
      saveRoute(res.route);
      saveStations(res.stations);

      setState({
        status: 'ready',
        event: res.event,
        team: { id: res.team.id, name: res.team.name, color: res.team.color },
        score: res.team.score,
        hintsRemaining: res.team.hintsRemaining,
        clueOverride: undefined,
        broadcasts: [],
        routeState: createRouteState(res.route, 0),
        stationStartedAt: null,
        lastLocation: null,
        sosAckedAt: null,
        error: null,
      });
      return true;
    } catch (err) {
      const message = err instanceof AuthError ? err.message : 'Something went wrong. Try again.';
      setState((s) => ({ ...s, error: message }));
      return false;
    }
  }, []);

  const scanStart = useCallback(
    (rawCode: string): ScanResult => {
      if (!state.routeState) {
        return { ok: false, reason: 'finished' };
      }
      const result = evaluateScan(state.routeState, 'START', rawCode);
      if (result.ok) {
        const uuid = generateUuid();
        const now = Date.now();
        recordScanStart(uuid, result.station.id, now);
        enqueue(buildScanStartEvent(uuid, now, result.station.id));
        syncWorkerRef.current?.triggerNow();
        setState((s) => ({ ...s, stationStartedAt: now }));
      }
      return result;
    },
    [state.routeState],
  );

  const scanEnd = useCallback(
    (rawCode: string): ScanResult => {
      if (!state.routeState) {
        return { ok: false, reason: 'finished' };
      }
      const result = evaluateScan(state.routeState, 'END', rawCode);
      if (result.ok) {
        const now = Date.now();
        const startedAt = getStartedAt(result.station.id) ?? state.stationStartedAt ?? now;
        const durationSec = Math.max(0, Math.round((now - startedAt) / 1000));

        const scanUuid = generateUuid();
        const resultUuid = generateUuid();
        recordScanEnd(scanUuid, result.station.id, now, durationSec, 'completed');
        enqueue(buildScanEndEvent(scanUuid, now, result.station.id, durationSec));
        enqueue(buildStationResultEvent(resultUuid, now, result.station.id, 'completed'));
        syncWorkerRef.current?.triggerNow();

        setState((s) => ({
          ...s,
          routeState: s.routeState ? advance(s.routeState) : null,
          stationStartedAt: null,
        }));
      }
      return result;
    },
    [state.routeState, state.stationStartedAt],
  );

  // "I'm stuck": writes a help_request; the radio call to HQ is the actual help channel.
  const requestHelp = useCallback(() => {
    const uuid = generateUuid();
    const now = Date.now();
    const currentStation = state.routeState ? getCurrentStation(state.routeState) : null;
    const stationId = currentStation?.id ?? null;
    recordHelpRequest(uuid, stationId, now);
    enqueue(buildHelpRequestEvent(uuid, now, stationId ?? ''));
    syncWorkerRef.current?.triggerNow();
  }, [state.routeState]);

  // Emergency: logs an sos alert with the last known GPS fix; the server emits `alert` to
  // organizers and replies `sos_ack`.
  const sendSos = useCallback(() => {
    const uuid = generateUuid();
    const now = Date.now();
    const lat = state.lastLocation?.lat ?? null;
    const lng = state.lastLocation?.lng ?? null;
    recordAlert(uuid, 'sos', lat, lng, now);
    enqueue(buildSosEvent(uuid, now, lat, lng));
    syncWorkerRef.current?.triggerNow();
  }, [state.lastLocation]);

  // Call HQ/Call Emergency call this right before dialing so the next background transition
  // (the call itself) isn't logged as an exit.
  const markExpectingCall = useCallback(() => {
    expectingCallRef.current = true;
  }, []);

  const value = useMemo<AppContextValue>(() => {
    const currentStation = state.routeState ? getCurrentStation(state.routeState) : null;
    return {
      ...state,
      currentStation,
      crossingCategory: state.routeState ? isCrossingCategory(state.routeState) : false,
      finished: state.routeState ? isFinished(state.routeState) : false,
      login,
      scanStart,
      scanEnd,
      requestHelp,
      sendSos,
      markExpectingCall,
    };
  }, [state, login, scanStart, scanEnd, requestHelp, sendSos, markExpectingCall]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}
