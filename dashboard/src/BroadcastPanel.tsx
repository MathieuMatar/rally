import { useState, type FormEvent } from 'react';
import type { AdminTeamSummary } from '@rally/shared';
import { sendBroadcast } from './api';

interface BroadcastPanelProps {
  token: string;
  teams: AdminTeamSummary[];
}

/** Pushes a banner/notification to one team or every team via `/admin/broadcast`. */
export function BroadcastPanel({ token, teams }: BroadcastPanelProps) {
  const [target, setTarget] = useState('all');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    setSending(true);
    setStatus(null);
    try {
      await sendBroadcast(token, target, trimmed);
      setMessage('');
      setStatus('Sent.');
    } catch {
      setStatus('Failed to send.');
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="broadcast-panel" onSubmit={submit}>
      <select value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="all">All teams</option>
        {teams.map((team) => (
          <option key={team.team.id} value={team.team.id}>
            {team.team.name}
          </option>
        ))}
      </select>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Broadcast message"
        className="broadcast-input"
      />
      <button type="submit" disabled={sending || !message.trim()}>
        {sending ? 'Sending…' : 'Send'}
      </button>
      {status ? <span className="broadcast-status">{status}</span> : null}
    </form>
  );
}
