import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../context/SocketContext';
import WebRTCCall from './WebRTCCall';

export default function IncomingCallModal() {
  const { incomingCall, setIncomingCall, socket } = useSocket();
  const [active,   setActive]   = useState(null);
  const ringRef    = useRef(null);  // { ctx, stop }
  const timeoutRef = useRef(null);

  // Create and play ringtone
  const startRing = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume().catch(() => {}); // needed on iOS
      let alive = true;

      const tick = () => {
        if (!alive) return;
        const tones = [
          { freq: 480, from: 0,    to: 0.4  },
          { freq: 440, from: 0.45, to: 0.85 },
        ];
        tones.forEach(({ freq, from, to }) => {
          try {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'sine'; osc.frequency.value = freq;
            gain.gain.setValueAtTime(0,   ctx.currentTime + from);
            gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + from + 0.05);
            gain.gain.setValueAtTime(0.4, ctx.currentTime + to - 0.05);
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
          // Schedule close after last note fades
          setTimeout(() => { try { ctx.close(); } catch {} }, 600);
          ringRef.current = null;
        },
      };
    } catch {}
  };

  const stopRing = () => {
    ringRef.current?.stop();
    ringRef.current = null;
  };

  useEffect(() => {
    if (!incomingCall) return;

    // Start ringtone — triggered by socket event which may not be a user gesture on iOS.
    // We try anyway; worst case it fails silently and the visual modal still shows.
    startRing();

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(
        `📞 Incoming ${incomingCall.callType === 'voice' ? 'Voice' : 'Video'} Call`,
        { body: `${incomingCall.fromUsername} is calling you`, icon: '/favicon.ico' }
      );
    }

    // Auto-reject after 35 seconds
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
  }, [incomingCall?.from]);  // key on .from so effect re-runs for new calls only

  // Callee accepted — show WebRTCCall
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
    stopRing();                             // stop ringing immediately on accept
    socket?.emit('call:accept', { to: incomingCall.from });
    setActive(incomingCall);               // render WebRTCCall as callee
  };

  const reject = () => {
    clearTimeout(timeoutRef.current);
    stopRing();
    socket?.emit('call:reject', { to: incomingCall.from });
    setIncomingCall(null);
  };

  return (
    <div style={m.overlay}>
      <div style={m.card}>
        {/* Pulsing ring animation */}
        <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 24px' }}>
          {[0, 0.4, 0.8].map(d => (
            <div key={d} style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(108,99,255,.2)',
              animation: `callRing 1.8s ${d}s ease-out infinite`,
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
          <CircleBtn onClick={reject} bg="#e53e3e" icon="📵"
            label="Decline" />
          <CircleBtn onClick={accept} bg="#38a169"
            icon={incomingCall.callType === 'voice' ? '📞' : '📹'}
            label="Accept" />
        </div>
      </div>
      <style>{`
        @keyframes callRing {
          0%   { transform:scale(1);   opacity:.8; }
          100% { transform:scale(2.5); opacity:0;  }
        }
      `}</style>
    </div>
  );
}

function CircleBtn({ onClick, bg, icon, label }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
      <button onClick={onClick} style={{
        width:72, height:72, borderRadius:'50%', border:'none',
        background: bg, fontSize:30, cursor:'pointer', color:'#fff',
        boxShadow: `0 6px 24px ${bg}90`, transition:'transform .15s',
      }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >{icon}</button>
      <span style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600 }}>{label}</span>
    </div>
  );
}

const m = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.92)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1500, padding:20 },
  card:    { background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:28, padding:'44px 40px', width:'100%', maxWidth:320, textAlign:'center', boxShadow:'0 0 100px rgba(108,99,255,.3)' },
  avatar:  { width:100, height:100, borderRadius:'50%', background:'linear-gradient(135deg,#6c63ff,#a29bfe)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, position:'relative', zIndex:1, boxShadow:'0 0 30px rgba(108,99,255,.5)' },
};
