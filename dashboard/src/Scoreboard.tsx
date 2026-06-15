import { useState } from 'react';
import type { AdminTeamSummary } from '@rally/shared';
import { sendHint } from './api';
import type { LiveTeams } from './useLiveTeams';

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function lastStationLabel(team: AdminTeamSummary): string {
  if (!team.lastStation) return '—';
  const entry = team.progress.find((p) => p.stationId === team.lastStation);
  if (!entry?.endedAt) return team.lastStation;
  return `${team.lastStation} (${formatTime(entry.endedAt)})`;
}

function completedCount(team: AdminTeamSummary): number {
  return team.progress.filter((p) => p.endedAt != null).length;
}

function totalAwaySec(team: AdminTeamSummary): number {
  return team.exits.reduce((sum, exit) => sum + (exit.awaySec ?? 0), 0);
}

interface ScoreboardProps extends LiveTeams {
  token: string;
  onSelectTeam: (teamId: string) => void;
}

export function Scoreboard({ teams, connected, error, refresh, token, onSelectTeam }: ScoreboardProps) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);

  const handleHint = async (teamId: string) => {
    setPendingTeamId(teamId);
    try {
      await sendHint(token, teamId, -1);
      refresh();
    } catch {
      // The next poll/refresh will reconcile the hint count.
    } finally {
      setPendingTeamId(null);
    }
  };

  return (
    <div className="scoreboard">
      <div className="status-bar">
        <span className={connected ? 'status-live' : 'status-polling'}>
          {connected ? '● Live' : '○ Polling'}
        </span>
        {error ? <span className="error">{error}</span> : null}
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>Score</th>
            <th>Hints left</th>
            <th>Stations done</th>
            <th>Last station</th>
            <th>Exits</th>
            <th>Hint</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((team, i) => (
            <tr key={team.team.id}>
              <td>{i + 1}</td>
              <td>
                <button className="team-link" onClick={() => onSelectTeam(team.team.id)}>
                  <span className="swatch" style={{ backgroundColor: team.team.color }} />
                  {team.team.name}
                </button>
              </td>
              <td>{team.score}</td>
              <td>{team.hintsRemaining}</td>
              <td>{completedCount(team)} / 11</td>
              <td>{lastStationLabel(team)}</td>
              <td>
                {team.exits.length} ({totalAwaySec(team)}s)
              </td>
              <td>
                {team.hintsRemaining === 0 ? <span className="no-hints">No hints left</span> : null}
                <button
                  className="hint-button"
                  disabled={pendingTeamId === team.team.id}
                  onClick={() => handleHint(team.team.id)}
                >
                  Give hint
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
