import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';
import WebRTCCall from './WebRTCCall';

// More realistic ringtone using Web Audio API
function createRingtone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let playing = true;

    const ring = () => {
      if (!playing) return;
      // Two-tone phone ring
      const tones = [
        { freq: 480, start: 0,    stop: 0.4 },
        { freq: 440, start: 0.45, stop: 0.85 },
      ];
      tones.forEach(({ freq, start, stop }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + start + 0.05);
        gain.gain.setValueAtTime(0.4, ctx.currentTime + stop - 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + stop);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + stop);
      });
      if (playing) setTimeout(ring, 2200);
    };
    ring();
    return { stop: () => { playing = false; setTimeout(() => { try { ctx.close(); } catch {} }, 500); } };
  } catch { return { stop: () => {} }; }
}

export default function IncomingCallModal() {
  const { incomingCall, setIncomingCall, socket } = useSocket();
  const [active, setActive] = useState(null);
  const ringRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!incomingCall) return;

    // Start ringtone
    ringRef.current = createRingtone();

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`📞 Incoming ${incomingCall.callType === 'voice' ? 'Voice' : 'Video'} Call`, {
        body: `${incomingCall.fromUsername} is calling you`,
        icon: '/favicon.ico',
      });
    }

    // Auto-reject after 35s
    timeoutRef.current = setTimeout(() => {
      socket?.emit('call:reject', { to: incomingCall.from });
      ringRef.current?.stop();
      setIncomingCall(null);
    }, 35000);

    return () => {
      clearTimeout(timeoutRef.current);
      ringRef.current?.stop();
    };
  }, [incomingCall]);

  if (active) {
    return (
      <WebRTCCall
        peerId={active.from}
        peerUsername={active.fromUsername}
        callType={active.callType || 'video'}
        isCaller={false}
        onClose={() => {
          socket?.emit('call:end', { to: active.from });
          setActive(null);
          setIncomingCall(null);
        }}
      />
    );
  }

  if (!incomingCall) return null;

  const accept = () => {
    clearTimeout(timeoutRef.current);
    ringRef.current?.stop();
    socket?.emit('call:accept', { to: incomingCall.from });
    setActive(incomingCall);
  };

  const reject = () => {
    clearTimeout(timeoutRef.current);
    ringRef.current?.stop();
    socket?.emit('call:reject', { to: incomingCall.from });
    setIncomingCall(null);
  };

  return (
    <div style={m.overlay}>
      <div style={m.card}>
        {/* Pulsing rings */}
        <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 24px' }}>
          {[0, 0.4, 0.8].map(delay => (
            <div key={delay} style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(108,99,255,.2)',
              animation: `ring 1.8s ${delay}s ease-out infinite`,
            }} />
          ))}
          <div style={m.avatar}>
            {incomingCall.callType === 'voice' ? '📞' : '📹'}
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
          Incoming {incomingCall.callType === 'voice' ? 'Voice' : 'Video'} Call
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 36 }}>
          {incomingCall.fromUsername}
        </div>

        <div style={{ display: 'flex', gap: 40, justifyContent: 'center' }}>
          <BtnCircle onClick={reject} bg="#e53e3e" icon="📵" label="Decline" />
          <BtnCircle onClick={accept} bg="#38a169"
            icon={incomingCall.callType === 'voice' ? '📞' : '📹'} label="Accept" />
        </div>
      </div>
      <style>{`@keyframes ring{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.5);opacity:0}}`}</style>
    </div>
  );
}

function BtnCircle({ onClick, bg, icon, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <button onClick={onClick} style={{
        width: 72, height: 72, borderRadius: '50%', border: 'none',
        background: bg, fontSize: 30, cursor: 'pointer', color: '#fff',
        boxShadow: `0 6px 24px ${bg}90`, transition: 'transform .15s',
      }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {icon}
      </button>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
    </div>
  );
}

const m = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, padding: 20 },
  card:    { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 28, padding: '44px 40px', width: '100%', maxWidth: 320, textAlign: 'center', boxShadow: '0 0 100px rgba(108,99,255,.3)' },
  avatar:  { width: 100, height: 100, borderRadius: '50%', background: 'linear-gradient(135deg,#6c63ff,#a29bfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42, position: 'relative', zIndex: 1, boxShadow: '0 0 30px rgba(108,99,255,.5)' },
};
