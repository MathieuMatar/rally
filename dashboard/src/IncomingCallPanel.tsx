import type { IncomingCallHook } from './useIncomingCall';

interface Props {
  call: IncomingCallHook;
}

export function IncomingCallPanel({ call }: Props) {
  if (call.callState === 'idle') return null;

  const { incomingCall, callState, muted, accept, reject, hangUp, toggleMute } = call;
  const label = incomingCall?.callType === 'emergency' ? '🚨 EMERGENCY' : 'HQ Call';
  const teamLabel = incomingCall?.teamName ?? 'Unknown team';

  if (callState === 'ringing') {
    return (
      <div className="call-panel call-panel--ringing">
        <div className="call-info">
          <span className="call-label">{label}</span>
          <span className="call-team">{teamLabel} is calling…</span>
        </div>
        <div className="call-actions">
          <button className="call-btn call-btn--accept" onClick={() => void accept()}>
            Accept
          </button>
          <button className="call-btn call-btn--reject" onClick={reject}>
            Reject
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="call-panel call-panel--active">
      <div className="call-info">
        <span className="call-label">{label}</span>
        <span className="call-team">In call with {teamLabel}</span>
      </div>
      <div className="call-actions">
        <button className={`call-btn call-btn--mute${muted ? ' active' : ''}`} onClick={toggleMute}>
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <button className="call-btn call-btn--reject" onClick={hangUp}>
          Hang up
        </button>
      </div>
    </div>
  );
}
