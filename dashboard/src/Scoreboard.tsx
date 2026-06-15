import type { AdminTeamSummary } from '@rally/shared';
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

export function Scoreboard({ teams, connected, error }: LiveTeams) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);

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
          </tr>
        </thead>
        <tbody>
          {sorted.map((team, i) => (
            <tr key={team.team.id}>
              <td>{i + 1}</td>
              <td>
                <span className="swatch" style={{ backgroundColor: team.team.color }} />
                {team.team.name}
              </td>
              <td>{team.score}</td>
              <td>{team.hintsRemaining}</td>
              <td>{completedCount(team)} / 11</td>
              <td>{lastStationLabel(team)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
