import { useState } from 'react';
import type { Role } from '@rally/shared';
import { LoginScreen } from './LoginScreen';
import { MapView } from './MapView';
import { Scoreboard } from './Scoreboard';
import { useLiveTeams } from './useLiveTeams';

type View = 'scoreboard' | 'map';

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
  const [view, setView] = useState<View>('scoreboard');

  return (
    <div className="dashboard">
      <header>
        <h1>Live It — Scoreboard</h1>
        <span className="role">{session.role}</span>
      </header>
      <nav className="tabs">
        <button className={view === 'scoreboard' ? 'tab selected' : 'tab'} onClick={() => setView('scoreboard')}>
          Scoreboard
        </button>
        <button className={view === 'map' ? 'tab selected' : 'tab'} onClick={() => setView('map')}>
          Map
        </button>
      </nav>
      {view === 'scoreboard' ? <Scoreboard {...live} /> : <MapView token={session.token} teams={live.teams} />}
    </div>
  );
}
