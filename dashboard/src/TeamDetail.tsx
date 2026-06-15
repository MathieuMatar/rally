import { useEffect, useMemo, useState } from 'react';
import type { AdminTeamSummary, Station } from '@rally/shared';
import { sendClueOverride, sendScore } from './api';

interface TeamDetailProps {
  token: string;
  team: AdminTeamSummary;
  stations: Station[];
  onBack: () => void;
  onChanged: () => void;
}

function formatTime(ms: number | null): string {
  if (ms == null) return '—';
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function stationName(stations: Station[], stationId: string): string {
  return stations.find((s) => s.id === stationId)?.name ?? stationId;
}

/** Per-team admin tools (§M8): per-station times/points, exits, score override, clue override. */
export function TeamDetail({ token, team, stations, onBack, onChanged }: TeamDetailProps) {
  const progressByStation = useMemo(() => new Map(team.progress.map((p) => [p.stationId, p])), [team.progress]);

  const [stationId, setStationId] = useState(stations[0]?.id ?? '');
  const [points, setPoints] = useState('');
  const [saving, setSaving] = useState(false);
  const [scoreStatus, setScoreStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!stationId && stations[0]) setStationId(stations[0].id);
  }, [stations, stationId]);

  useEffect(() => {
    const existing = progressByStation.get(stationId);
    const station = stations.find((s) => s.id === stationId);
    setPoints(String(existing?.points ?? station?.basePoints ?? 0));
  }, [stationId, progressByStation, stations]);

  const saveScore = async () => {
    const parsed = Number(points);
    if (!Number.isFinite(parsed) || !stationId) return;

    setSaving(true);
    setScoreStatus(null);
    try {
      await sendScore(token, team.team.id, stationId, Math.round(parsed));
      onChanged();
      setScoreStatus('Saved.');
    } catch {
      setScoreStatus('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const [clueText, setClueText] = useState('');
  const [clueSending, setClueSending] = useState(false);
  const [clueStatus, setClueStatus] = useState<string | null>(null);

  const sendClue = async () => {
    const trimmed = clueText.trim();
    if (!trimmed) return;

    setClueSending(true);
    setClueStatus(null);
    try {
      await sendClueOverride(token, team.team.id, trimmed);
      setClueStatus('Sent.');
    } catch {
      setClueStatus('Failed to send.');
    } finally {
      setClueSending(false);
    }
  };

  const sortedProgress = [...team.progress].sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0));

  return (
    <div className="team-detail">
      <button className="back-button" onClick={onBack}>
        ← Back to scoreboard
      </button>
      <h2>
        <span className="swatch" style={{ backgroundColor: team.team.color }} />
        {team.team.name}
      </h2>
      <p className="team-summary">
        Score: <strong>{team.score}</strong> · Hints left: <strong>{team.hintsRemaining}</strong> · Exits:{' '}
        <strong>{team.exits.length}</strong>
      </p>

      <h3>Stations</h3>
      <table>
        <thead>
          <tr>
            <th>Station</th>
            <th>Started</th>
            <th>Ended</th>
            <th>Duration</th>
            <th>Result</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {sortedProgress.length === 0 ? (
            <tr>
              <td colSpan={6}>No stations started yet.</td>
            </tr>
          ) : (
            sortedProgress.map((p) => (
              <tr key={p.stationId}>
                <td>{stationName(stations, p.stationId)}</td>
                <td>{formatTime(p.startedAt)}</td>
                <td>{formatTime(p.endedAt)}</td>
                <td>{p.durationSec != null ? `${p.durationSec}s` : '—'}</td>
                <td>{p.result ?? '—'}</td>
                <td>{p.points ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h3>Exits</h3>
      {team.exits.length === 0 ? (
        <p className="map-hint">No exits logged.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Left</th>
              <th>Returned</th>
              <th>Away</th>
            </tr>
          </thead>
          <tbody>
            {team.exits.map((exit, i) => (
              <tr key={i}>
                <td>{formatTime(exit.leftAt)}</td>
                <td>{formatTime(exit.returnedAt)}</td>
                <td>{exit.awaySec != null ? `${exit.awaySec}s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Adjust score</h3>
      <div className="adjust-row">
        <select value={stationId} onChange={(e) => setStationId(e.target.value)}>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} className="points-input" />
        <button onClick={saveScore} disabled={saving}>
          {saving ? 'Saving…' : 'Save points'}
        </button>
        {scoreStatus ? <span className="adjust-status">{scoreStatus}</span> : null}
      </div>

      <h3>Clue override</h3>
      <div className="adjust-row">
        <input
          value={clueText}
          onChange={(e) => setClueText(e.target.value)}
          placeholder="Override text for this team's next clue"
          className="clue-input"
        />
        <button onClick={sendClue} disabled={clueSending || !clueText.trim()}>
          {clueSending ? 'Sending…' : 'Send override'}
        </button>
        {clueStatus ? <span className="adjust-status">{clueStatus}</span> : null}
      </div>
    </div>
  );
}
