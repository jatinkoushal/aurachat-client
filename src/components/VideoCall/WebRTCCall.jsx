import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';

const ICE = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]};

export default function WebRTCCall({ peerId, peerUsername, callType='video', isCaller, onClose }) {
  const { socket } = useSocket();
  const localRef  = useRef(null);
  const remoteRef = useRef(null);
  const pcRef     = useRef(null);
  const streamRef = useRef(null);
  const startTime = useRef(null);

  const [status,   setStatus]   = useState('connecting');
  const [muted,    setMuted]    = useState(false);
  const [camOff,   setCamOff]   = useState(false);
  const [duration, setDuration] = useState(0);
  const timer = useRef(null);

  const cleanup = useCallback((callStatus='ended') => {
    clearInterval(timer.current);
    const dur = startTime.current ? Math.round((Date.now()-startTime.current)/1000) : 0;
    // Save call log to chat history
    if (socket && dur > 0) {
      socket.emit('call:log', { to: peerId, callType, duration: dur, status: callStatus });
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
  }, [socket, peerId, callType]);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const constraints = callType==='voice'
          ? { audio:true, video:false }
          : { audio:true, video:{ width:1280, height:720 } };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) { stream.getTracks().forEach(t=>t.stop()); return; }
        streamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;

        const pc = new RTCPeerConnection(ICE);
        pcRef.current = pc;
        stream.getTracks().forEach(t => pc.addTrack(t, stream));

        pc.ontrack = e => {
          if (remoteRef.current && e.streams[0]) {
            remoteRef.current.srcObject = e.streams[0];
            setStatus('connected');
            startTime.current = Date.now();
            timer.current = setInterval(() => setDuration(d => d+1), 1000);
          }
        };
        pc.onicecandidate = e => { if (e.candidate) socket?.emit('call:ice', { to:peerId, candidate:e.candidate }); };
        pc.onconnectionstatechange = () => {
          if (['disconnected','failed','closed'].includes(pc.connectionState)) {
            setStatus('ended'); setTimeout(() => { cleanup('missed'); onClose(); }, 1500);
          }
        };
        if (isCaller) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket?.emit('call:offer', { to:peerId, offer });
        }
      } catch(err) {
        setStatus(err.name==='NotAllowedError' ? 'denied' : 'error');
      }
    };
    start();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onOffer = async ({ offer }) => {
      const pc = pcRef.current; if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call:answer', { to:peerId, answer });
    };
    const onAnswer = async ({ answer }) => {
      const pc = pcRef.current; if (!pc) return;
      if (pc.signalingState !== 'have-local-offer') return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };
    const onIce = async ({ candidate }) => {
      try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    };
    const onEnded = () => { setStatus('ended'); setTimeout(() => { cleanup('completed'); onClose(); }, 1200); };

    socket.on('call:offer',   onOffer);
    socket.on('call:answer',  onAnswer);
    socket.on('call:ice',     onIce);
    socket.on('call:ended',   onEnded);
    socket.on('call:rejected',onEnded);
    return () => {
      socket.off('call:offer', onOffer); socket.off('call:answer', onAnswer);
      socket.off('call:ice', onIce); socket.off('call:ended', onEnded); socket.off('call:rejected', onEnded);
    };
  }, [socket, peerId]);

  const hangUp = () => {
    socket?.emit('call:end', { to:peerId });
    cleanup('completed');
    onClose();
  };

  const toggleMute = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  };
  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOff(c => !c);
  };

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  return (
    <div style={c.overlay}>
      <div style={c.wrap}>
        {callType !== 'voice'
          ? <video ref={remoteRef} autoPlay playsInline style={c.remote} />
          : <div style={c.voiceWrap}>
              <div style={c.voiceAvatar}>{peerUsername?.[0]?.toUpperCase()||'?'}</div>
            </div>
        }
        {/* Status */}
        {status !== 'connected' && (
          <div style={c.statusBox}>
            {status==='connecting' && <span>⏳ Connecting…</span>}
            {status==='denied'     && <span>❌ Camera/mic permission denied<br/><small>Allow in browser settings and retry</small></span>}
            {status==='error'      && <span>❌ Connection failed</span>}
            {status==='ended'      && <span>📵 Call ended</span>}
          </div>
        )}
        {/* Top info */}
        <div style={c.info}>
          <div style={{ fontWeight:800, fontSize:20, color:'#fff' }}>{peerUsername}</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,.7)', marginTop:2 }}>
            {status==='connected' ? `🟢 ${fmt(duration)}` : status==='connecting' ? '⏳ Ringing…' : '📵 Ended'}
          </div>
        </div>
        {/* Local preview */}
        {callType !== 'voice' && (
          <video ref={localRef} autoPlay playsInline muted
            style={{ ...c.local, opacity: camOff ? 0.3 : 1 }} />
        )}
        {/* Controls */}
        <div style={c.controls}>
          <CtrlBtn onClick={toggleMute}  active={muted}  label={muted  ? '🔇' : '🎤'} title={muted?'Unmute':'Mute'} />
          {callType !== 'voice' && <CtrlBtn onClick={toggleCam} active={camOff} label={camOff ? '📷' : '📹'} title={camOff?'Camera on':'Camera off'} />}
          <CtrlBtn onClick={hangUp} danger label="📞" title="End call" rotate />
        </div>
      </div>
      <style>{`@keyframes pulse{from{transform:scale(1)}to{transform:scale(1.06)}}`}</style>
    </div>
  );
}

function CtrlBtn({ onClick, active, danger, label, title, rotate }) {
  return (
    <button onClick={onClick} title={title} style={{
      width:60, height:60, borderRadius:'50%', border:'none', fontSize:26, cursor:'pointer',
      background: danger ? '#e53e3e' : active ? 'var(--danger)' : 'rgba(255,255,255,.18)',
      color:'#fff', transition:'all .2s',
      transform: rotate ? 'rotate(135deg)' : 'none',
    }}>{label}</button>
  );
}

const c = {
  overlay:   { position:'fixed', inset:0, background:'#000', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' },
  wrap:      { position:'relative', width:'100%', height:'100%', background:'#111', display:'flex', alignItems:'center', justifyContent:'center' },
  remote:    { width:'100%', height:'100%', objectFit:'cover', background:'#1a1a2e' },
  voiceWrap: { display:'flex', flexDirection:'column', alignItems:'center', gap:16 },
  voiceAvatar: { width:130, height:130, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent-primary),var(--accent-secondary))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:56, fontWeight:800, color:'#fff', boxShadow:'0 0 50px rgba(108,99,255,.5)', animation:'pulse .8s ease-in-out infinite alternate' },
  local:     { position:'absolute', bottom:100, right:16, width:120, height:90, borderRadius:12, objectFit:'cover', border:'2px solid rgba(255,255,255,.3)', background:'#333' },
  info:      { position:'absolute', top:0, left:0, right:0, padding:'20px 20px 16px', background:'linear-gradient(to bottom,rgba(0,0,0,.8),transparent)' },
  statusBox: { position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.6)', color:'#fff', fontSize:17, fontWeight:600, textAlign:'center', padding:20, lineHeight:1.6 },
  controls:  { position:'absolute', bottom:0, left:0, right:0, padding:20, background:'linear-gradient(to top,rgba(0,0,0,.8),transparent)', display:'flex', justifyContent:'center', gap:20 },
};
