import type { AdminTeamSummary, Alert } from '@rally/shared';

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function teamName(teams: AdminTeamSummary[], teamId: string): string {
  return teams.find((t) => t.team.id === teamId)?.team.name ?? teamId;
}

function alertLabel(type: string): string {
  return type === 'sos' ? 'SOS' : 'Help requested';
}

interface AlertsBannerProps {
  alerts: Alert[];
  teams: AdminTeamSummary[];
  onResolve: (alertId: number) => void;
}

/** Live feed of open `alert`s (help_request, sos), with a resolve action per alert. */
export function AlertsBanner({ alerts, teams, onResolve }: AlertsBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="alerts-banner">
      {alerts.map((alert) => (
        <div key={alert.id} className={`alert alert-${alert.type}`}>
          <span>
            <strong>{alertLabel(alert.type)}</strong> — {teamName(teams, alert.teamId)} at {formatTime(alert.at)}
            {alert.lat != null && alert.lng != null ? ` (${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)})` : ''}
          </span>
          <button className="resolve-button" onClick={() => onResolve(alert.id)}>
            Resolve
          </button>
        </div>
      ))}
    </div>
  );
}
