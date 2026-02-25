import { useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import JitsiCall from './JitsiCall';
import { useAuth } from '../../context/AuthContext';

export default function IncomingCallModal() {
  const { incomingCall, setIncomingCall, socket } = useSocket();
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState(null);

  if (activeCall) {
    return (
      <JitsiCall
        roomName={activeCall.roomName}
        displayName={user?.username}
        onClose={() => {
          socket?.emit('call:end', { to: activeCall.from });
          setActiveCall(null);
          setIncomingCall(null);
        }}
      />
    );
  }

  if (!incomingCall) return null;

  const accept = () => {
    socket?.emit('call:accept', { to: incomingCall.from, roomName: incomingCall.roomName });
    setActiveCall(incomingCall);
  };

  const reject = () => {
    socket?.emit('call:reject', { to: incomingCall.from });
    setIncomingCall(null);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal} className="fade-in">
        <div style={styles.ring}>📹</div>
        <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>Incoming Call</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
          <strong style={{ color: 'var(--accent-secondary)' }}>{incomingCall.fromUsername}</strong> is calling you
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-danger" onClick={reject} style={{ flex: 1 }}>
            ✕ Decline
          </button>
          <button className="btn btn-primary" onClick={accept} style={{ flex: 1, background: 'var(--online-green)' }}>
            ✓ Accept
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' },
  modal: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '32px', width: '100%', maxWidth: '320px', textAlign: 'center', boxShadow: '0 0 40px rgba(108,99,255,0.3)' },
  ring: { fontSize: '48px', marginBottom: '16px', animation: 'spin 1s ease-in-out infinite alternate' },
};
