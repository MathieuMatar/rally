import { useEffect, useRef, useState } from 'react';
import type { AdminTeamSummary, MapCommand, MapHostMessage, MapPin, MapStationInput, Station } from '@rally/shared';
import { buildMapHtml } from '@rally/shared';
import { fetchStations } from './api';
import { SERVER_URL } from './config';
import { useLiveLocations } from './useLiveLocations';

// Pre-downloaded tiles are served by the backend (§M9) and layered over the OSM CDN so the
// map keeps rendering Gharzouz if the venue's internet drops.
const MAP_HTML = buildMapHtml({ localTileUrl: `${SERVER_URL}/tiles` });

function teamTrail(team: AdminTeamSummary): string[] {
  return team.progress
    .filter((p) => p.endedAt != null)
    .sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0))
    .map((p) => p.stationId);
}

export function MapView({ token, teams }: { token: string; teams: AdminTeamSummary[] }) {
  const [stations, setStations] = useState<Station[] | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const locations = useLiveLocations(token);

  useEffect(() => {
    fetchStations(token)
      .then(setStations)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load stations.'));
  }, [token]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      let data: unknown = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if ((data as Partial<MapHostMessage> | null)?.type === 'ready') setReady(true);
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  function post(command: MapCommand) {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(command), '*');
  }

  useEffect(() => {
    if (!ready || !stations) return;
    const stationInputs: MapStationInput[] = stations.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      lat: s.lat,
      lng: s.lng,
    }));
    post({ type: 'init', stations: stationInputs });
  }, [ready, stations]);

  useEffect(() => {
    if (!ready) return;
    const pins: MapPin[] = teams
      .map((team): MapPin | null => {
        const loc = locations[team.team.id];
        if (!loc) return null;
        return { id: team.team.id, lat: loc.lat, lng: loc.lng, color: team.team.color, label: team.team.name };
      })
      .filter((pin): pin is MapPin => pin !== null);
    post({ type: 'pins', pins });
  }, [ready, teams, locations]);

  useEffect(() => {
    if (!ready || !selectedTeamId) return;
    const team = teams.find((t) => t.team.id === selectedTeamId);
    if (!team) return;
    post({ type: 'trail', stationIds: teamTrail(team), color: team.team.color });
  }, [ready, selectedTeamId, teams]);

  return (
    <div className="map-view">
      <div className="map-frame">
        <iframe ref={iframeRef} title="Rally map" srcDoc={MAP_HTML} className="map-iframe" />
      </div>
      <div className="map-legend">
        {error ? <p className="error">{error}</p> : null}
        <h2>Teams</h2>
        <ul>
          {teams.map((team) => (
            <li key={team.team.id}>
              <button
                className={selectedTeamId === team.team.id ? 'team-button selected' : 'team-button'}
                onClick={() => setSelectedTeamId(team.team.id === selectedTeamId ? null : team.team.id)}
              >
                <span className="swatch" style={{ backgroundColor: team.team.color }} />
                {team.team.name}
              </button>
            </li>
          ))}
        </ul>
        <p className="map-hint">Click a team to highlight its trail of visited stations.</p>
      </div>
    </div>
  );
}
