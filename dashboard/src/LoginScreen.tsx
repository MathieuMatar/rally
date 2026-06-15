import { useState, type FormEvent } from 'react';
import type { Role } from '@rally/shared';
import { ApiError, authOrganizer } from './api';

interface LoginScreenProps {
  onLogin(token: string, role: Exclude<Role, 'team'>): void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authOrganizer(code.trim());
      onLogin(res.token, res.role);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <h1>Live It — HQ Dashboard</h1>
      <form onSubmit={submit}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Organizer or admin code"
          autoFocus
        />
        <button type="submit" disabled={loading || !code.trim()}>
          {loading ? 'Checking…' : 'Log in'}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </div>
  );
}
