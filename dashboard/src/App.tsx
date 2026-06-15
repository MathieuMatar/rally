import { useState } from 'react';
import type { Role } from '@rally/shared';
import { LoginScreen } from './LoginScreen';
import { Scoreboard } from './Scoreboard';
import { useLiveTeams } from './useLiveTeams';

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

  return (
    <div className="dashboard">
      <header>
        <h1>Live It — Scoreboard</h1>
        <span className="role">{session.role}</span>
      </header>
      <Scoreboard {...live} />
    </div>
  );
}
