import { useState } from 'react';
import type { Role } from '@rally/shared';
import { AlertsBanner } from './AlertsBanner';
import { BroadcastPanel } from './BroadcastPanel';
import { exportResultsCsv } from './api';
import { IncomingCallPanel } from './IncomingCallPanel';
import { LoginScreen } from './LoginScreen';
import { MapView } from './MapView';
import { Scoreboard } from './Scoreboard';
import { TeamDetail } from './TeamDetail';
import { useAlerts } from './useAlerts';
import { useIncomingCall } from './useIncomingCall';
import { useLiveTeams } from './useLiveTeams';
import { useStations } from './useStations';

type View = 'scoreboard' | 'map' | 'team';

interface Session {
  token: string;
  role: Exclude<Role, 'team'>;
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return <LoginScreen onLogin={(token, role) => setSession({ token, role })} />;
  }

  return <Dashboard session={session} />;
}

function Dashboard({ session }: { session: Session }) {
  const live = useLiveTeams(session.token);
  const { alerts, resolve } = useAlerts(session.token);
  const stations = useStations(session.token);
  const call = useIncomingCall(session.token);
  const [view, setView] = useState<View>('scoreboard');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const selectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    setView('team');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportResultsCsv(session.token);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'rally-export.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // The user can retry the export from the toolbar.
    } finally {
      setExporting(false);
    }
  };

  const selectedTeam = selectedTeamId ? live.teams.find((t) => t.team.id === selectedTeamId) : undefined;

  return (
    <div className="dashboard">
      <header>
        <h1>Live It — Scoreboard</h1>
        <span className="role">{session.role}</span>
      </header>
      <IncomingCallPanel call={call} />
      <AlertsBanner alerts={alerts} teams={live.teams} onResolve={resolve} />
      <BroadcastPanel token={session.token} teams={live.teams} />
      <nav className="tabs">
        <button className={view === 'scoreboard' ? 'tab selected' : 'tab'} onClick={() => setView('scoreboard')}>
          Scoreboard
        </button>
        <button className={view === 'map' ? 'tab selected' : 'tab'} onClick={() => setView('map')}>
          Map
        </button>
        <button className="tab" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </nav>
      {view === 'team' && selectedTeam ? (
        <TeamDetail
          token={session.token}
          team={selectedTeam}
          stations={stations}
          onBack={() => setView('scoreboard')}
          onChanged={live.refresh}
        />
      ) : view === 'map' ? (
        <MapView token={session.token} teams={live.teams} />
      ) : (
        <Scoreboard {...live} token={session.token} onSelectTeam={selectTeam} />
      )}
    </div>
  );
}
