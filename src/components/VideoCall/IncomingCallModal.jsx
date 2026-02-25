import { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import WebRTCCall from './WebRTCCall';

export default function IncomingCallModal() {
  const { incomingCall, setIncomingCall, socket } = useSocket();
  const { user } = useAuth();
  const [active, setActive] = useState(null);

  useEffect(() => {
    if (!incomingCall) return;
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`📞 Incoming ${incomingCall.callType} call`, {
        body: `${incomingCall.fromUsername} is calling you`,
        icon: '/favicon.ico',
      });
    }
    const t = setTimeout(() => {
      socket?.emit('call:reject', { to: incomingCall.from });
      setIncomingCall(null);
    }, 35000);
    return () => clearTimeout(t);
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
    socket?.emit('call:accept', { to: incomingCall.from });
    setActive(incomingCall);
  };
  const reject = () => {
    socket?.emit('call:reject', { to: incomingCall.from });
    setIncomingCall(null);
  };

  return (
    <div style={m.overlay}>
      <div style={m.modal}>
        <div style={{ position:'relative', marginBottom:20, height:72 }}>
          {[0,.4,.8].map(d => (
            <div key={d} style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
              width:64, height:64, borderRadius:'50%', background:'rgba(108,99,255,.25)',
              animation:`ring 1.5s ${d}s ease-out infinite` }} />
          ))}
          <div style={{ position:'relative', fontSize:48, textAlign:'center', lineHeight:'72px' }}>
            {incomingCall.callType==='voice' ? '📞' : '📹'}
          </div>
        </div>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:4 }}>
          Incoming {incomingCall.callType==='voice' ? 'Voice' : 'Video'} Call
        </div>
        <div style={{ fontSize:22, fontWeight:800, marginBottom:28 }}>{incomingCall.fromUsername}</div>
        <div style={{ display:'flex', gap:20, justifyContent:'center' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
            <button onClick={reject} style={{ ...m.circleBtn, background:'#e53e3e' }}>✕</button>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Decline</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
            <button onClick={accept} style={{ ...m.circleBtn, background:'#38a169' }}>
              {incomingCall.callType==='voice' ? '📞' : '📹'}
            </button>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Accept</span>
          </div>
        </div>
      </div>
      <style>{`@keyframes ring { 0%{transform:translate(-50%,-50%) scale(1);opacity:.8} 100%{transform:translate(-50%,-50%) scale(2.5);opacity:0} }`}</style>
    </div>
  );
}

const m = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1500, padding:20 },
  modal:   { background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:24, padding:'40px 32px', width:'100%', maxWidth:300, textAlign:'center', boxShadow:'0 0 60px rgba(108,99,255,.4)' },
  circleBtn: { width:64, height:64, borderRadius:'50%', border:'none', fontSize:28, cursor:'pointer', color:'#fff', boxShadow:'0 4px 20px rgba(0,0,0,.3)' },
};
