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

/** Live feed of `alert` socket pushes (help_request, sos). Resolving alerts is handled in M8. */
export function AlertsBanner({ alerts, teams }: { alerts: Alert[]; teams: AdminTeamSummary[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="alerts-banner">
      {alerts.map((alert) => (
        <div key={alert.id} className={`alert alert-${alert.type}`}>
          <strong>{alertLabel(alert.type)}</strong> — {teamName(teams, alert.teamId)} at {formatTime(alert.at)}
          {alert.lat != null && alert.lng != null ? ` (${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)})` : ''}
        </div>
      ))}
    </div>
  );
}
