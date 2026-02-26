import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';
import WebRTCCall from './WebRTCCall';

export default function IncomingCallModal() {
  const { incomingCall, setIncomingCall, socket } = useSocket();
  const [active,   setActive]   = useState(null);
  const ringRef    = useRef(null);
  const timeoutRef = useRef(null);
  // Use a counter so re-calling the same person re-triggers the effect
  const callKeyRef = useRef(0);
  const [callKey,  setCallKey]  = useState(0);

  // Every time incomingCall changes to a new call (non-null), bump the key
  // This ensures the effect always re-runs even if same caller calls again
  const prevCallRef = useRef(null);
  useEffect(() => {
    if (incomingCall && incomingCall !== prevCallRef.current) {
      prevCallRef.current = incomingCall;
      callKeyRef.current++;
      setCallKey(callKeyRef.current);
    }
    if (!incomingCall) {
      prevCallRef.current = null;
    }
  }, [incomingCall]);

  const stopRing = () => {
    if (ringRef.current) {
      ringRef.current.stop();
      ringRef.current = null;
    }
  };

  const startRing = () => {
    stopRing();
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // iOS/Android: must resume context
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      let alive = true;

      const tick = () => {
        if (!alive) return;
        const tones = [{ freq: 480, from: 0, to: 0.4 }, { freq: 440, from: 0.45, to: 0.85 }];
        tones.forEach(({ freq, from, to }) => {
          try {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine'; osc.frequency.value = freq;
            gain.gain.setValueAtTime(0,    ctx.currentTime + from);
            gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + from + 0.05);
            gain.gain.setValueAtTime(0.4,  ctx.currentTime + to - 0.05);
            gain.gain.linearRampToValueAtTime(0,   ctx.currentTime + to);
            osc.start(ctx.currentTime + from);
            osc.stop(ctx.currentTime  + to);
          } catch {}
        });
        if (alive) setTimeout(tick, 2200);
      };
      tick();
      ringRef.current = {
        stop: () => {
          alive = false;
          // Immediately close context — stops all queued audio instantly
          try { ctx.close(); } catch {}
        },
      };
    } catch {}
  };

  // Re-run whenever callKey changes (new call arrived)
  useEffect(() => {
    if (!incomingCall) return;
    startRing();

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(
          `📞 Incoming ${incomingCall.callType === 'voice' ? 'Voice' : 'Video'} Call`,
          { body: `${incomingCall.fromUsername} is calling you`, icon: '/favicon.ico' }
        );
      } catch {}
    }

    // Auto-reject after 35s
    timeoutRef.current = setTimeout(() => {
      socket?.emit('call:reject', { to: incomingCall.from });
      stopRing();
      setIncomingCall(null);
    }, 35000);

    return () => {
      clearTimeout(timeoutRef.current);
      stopRing();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callKey]); // keyed on callKey, not incomingCall reference

  // Callee accepted — show call screen
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
    stopRing();
    socket?.emit('call:accept', { to: incomingCall.from });
    setActive({ ...incomingCall }); // copy so it persists after setIncomingCall(null)
    setIncomingCall(null);
  };

  const reject = () => {
    clearTimeout(timeoutRef.current);
    stopRing();
    socket?.emit('call:reject', { to: incomingCall.from });
    setIncomingCall(null);
  };

  // Full-screen modal — covers everything including nav bar
  // Uses very high z-index to ensure it shows on top on Android
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      width: '100vw',
      height: '100dvh',
      background: 'linear-gradient(160deg, #0a0a1a 0%, #1a0a2e 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,        // maximum z-index — above everything
      padding: 24,

    }}>
      {/* Pulsing rings */}
      <div style={{ position: 'relative', width: 120, height: 120, marginBottom: 32 }}>
        {[0, 0.5, 1.0].map(d => (
          <div key={d} style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2px solid rgba(108,99,255,.4)',
            animation: `callRing 2s ${d}s ease-out infinite`,
          }} />
        ))}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6c63ff, #a29bfe)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 48, boxShadow: '0 0 40px rgba(108,99,255,.7)',
          zIndex: 1,
        }}>
          {incomingCall.callType === 'voice' ? '📞' : '📹'}
        </div>
      </div>

      <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, marginBottom: 8, letterSpacing: 1 }}>
        INCOMING {(incomingCall.callType || 'VIDEO').toUpperCase()} CALL
      </div>
      <div style={{ color: '#fff', fontSize: 30, fontWeight: 800, marginBottom: 60, textAlign: 'center' }}>
        {incomingCall.fromUsername}
      </div>

      {/* Accept / Reject buttons — large for easy mobile tapping */}
      <div style={{ display: 'flex', gap: 60, alignItems: 'center' }}>
        {/* Reject */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button onClick={reject}
            style={{
              width: 80, height: 80, borderRadius: '50%', border: 'none',
              background: '#e53e3e', fontSize: 34, cursor: 'pointer', color: '#fff',
              boxShadow: '0 8px 32px rgba(229,62,62,.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              // Large touch target for Android
              WebkitTapHighlightColor: 'transparent',
            }}>
            📵
          </button>
          <span style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, fontWeight: 600 }}>Decline</span>
        </div>

        {/* Accept */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button onClick={accept}
            style={{
              width: 80, height: 80, borderRadius: '50%', border: 'none',
              background: '#38a169', fontSize: 34, cursor: 'pointer', color: '#fff',
              boxShadow: '0 8px 32px rgba(56,161,105,.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
            }}>
            {incomingCall.callType === 'voice' ? '📞' : '📹'}
          </button>
          <span style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, fontWeight: 600 }}>Accept</span>
        </div>
      </div>

      <style>{`
        @keyframes callRing {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0;   }
        }
      `}</style>
    </div>
  );
}
