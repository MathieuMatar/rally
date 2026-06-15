import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { BroadcastMessage, EventConfig, Station } from '@rally/shared';
import { AuthError, authTeam } from '../api/client';
import { DEFAULT_SERVER_URL } from '../config';
import { buildScanEndEvent, buildScanStartEvent, buildStationResultEvent } from '../core/outboxEvents';
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
import { enqueue } from '../db/outbox';
import { getCompletedCount, getStartedAt, recordScanEnd, recordScanStart } from '../db/progress';
import { loadRoute, saveRoute, saveStations } from '../db/route';
import { getSetting, setSettings } from '../db/settings';
import { LocationTracker } from '../location/locationTracker';
import { LocationSocket } from '../realtime/locationSocket';
import { SyncWorker } from '../sync/syncWorker';

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
  error: string | null;
}

export interface AppContextValue extends AppState {
  currentStation: Station | null;
  crossingCategory: boolean;
  finished: boolean;
  login(code: string): Promise<boolean>;
  scanStart(rawCode: string): ScanResult;
  scanEnd(rawCode: string): ScanResult;
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

  // While the team is logged in, push throttled GPS updates to organizers over Socket.IO.
  useEffect(() => {
    if (state.status !== 'ready') return undefined;

    const serverUrl = getSetting('server_url');
    const token = getSetting('token');
    if (!serverUrl || !token) return undefined;

    const socket = new LocationSocket(serverUrl, token);
    socket.connect();

    const tracker = new LocationTracker((lat, lng) => socket.sendLocation(lat, lng));
    void tracker.start();

    return () => {
      tracker.stop();
      socket.disconnect();
    };
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
    };
  }, [state, login, scanStart, scanEnd]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
}
