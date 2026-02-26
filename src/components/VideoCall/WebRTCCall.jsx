import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';

const ICE_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'turn:openrelay.metered.ca:80',   username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443',  username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceCandidatePoolSize: 10,
};

export default function WebRTCCall({ peerId, peerUsername, callType = 'video', isCaller, onClose }) {
  const { socket } = useSocket();

  const localVideoRef  = useRef(null); // local camera preview
  const remoteVideoRef = useRef(null); // remote video (video calls)
  const remoteAudioRef = useRef(null); // remote audio (voice calls — CRITICAL FIX)
  const pcRef          = useRef(null);
  const streamRef      = useRef(null);
  const startRef       = useRef(null);
  const timerRef       = useRef(null);
  const pendingIce     = useRef([]);
  const pendingOffer   = useRef(null);
  const readyRef       = useRef(false);
  const ringingRef     = useRef(null); // only caller plays ringtone

  const [status,   setStatus]   = useState(isCaller ? 'ringing' : 'connecting');
  const [muted,    setMuted]    = useState(false);
  const [camOff,   setCamOff]   = useState(false);
  const [duration, setDuration] = useState(0);

  // ── Ringtone: ONLY the caller plays while waiting for answer ────────────
  const playRingtone = useCallback(() => {
    if (ringingRef.current || !isCaller) return; // callee never plays ringtone here
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      let playing = true;
      const ring = () => {
        if (!playing) return;
        [[480, 0], [440, 0.5]].forEach(([freq, when]) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine'; osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.3, ctx.currentTime + when);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + 0.45);
          osc.start(ctx.currentTime + when);
          osc.stop(ctx.currentTime + when + 0.5);
        });
        if (playing) setTimeout(ring, 2200);
      };
      ring();
      ringingRef.current = { stop: () => { playing = false; setTimeout(() => { try { ctx.close(); } catch {} }, 600); } };
    } catch {}
  }, [isCaller]);

  const stopRingtone = useCallback(() => {
    ringingRef.current?.stop();
    ringingRef.current = null;
  }, []);

  // ── Mark call as connected ───────────────────────────────────────────────
  const markConnected = useCallback(() => {
    stopRingtone(); // stop ringing immediately when connected
    setStatus('connected');
    if (!startRef.current) {
      startRef.current = Date.now();
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
  }, [stopRingtone]);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback((callStatus = 'ended') => {
    stopRingtone();
    clearInterval(timerRef.current);
    const dur = startRef.current ? Math.round((Date.now() - startRef.current) / 1000) : 0;
    if (socket && dur > 0) {
      socket.emit('call:log', { to: peerId, callType, duration: dur, status: callStatus });
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
  }, [socket, peerId, callType, stopRingtone]);

  const hangUp = useCallback(() => {
    socket?.emit('call:end', { to: peerId });
    cleanup('completed');
    onClose();
  }, [socket, peerId, cleanup, onClose]);

  // ── Flush queued ICE candidates ──────────────────────────────────────────
  const flushIce = useCallback(async (pc) => {
    for (const c of pendingIce.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    pendingIce.current = [];
  }, []);

  // ── Create RTCPeerConnection ─────────────────────────────────────────────
  const createPC = useCallback((stream) => {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      const remoteStream = e.streams[0];
      if (!remoteStream) return;

      if (callType === 'voice') {
        // Voice call: attach audio stream to <audio> element
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(() => {});
        }
      } else {
        // Video call: attach to <video> element
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      }
      markConnected();
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) socket?.emit('call:ice', { to: peerId, candidate: e.candidate });
    };

    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      console.log('[WebRTC] ICE:', st);
      if (st === 'connected' || st === 'completed') markConnected();
      if (st === 'failed') {
        setStatus('error');
        setTimeout(() => { cleanup('missed'); onClose(); }, 2500);
      }
      if (st === 'disconnected') {
        setTimeout(() => {
          if (pcRef.current?.iceConnectionState === 'disconnected') {
            cleanup('completed'); onClose();
          }
        }, 5000);
      }
    };

    return pc;
  }, [socket, peerId, callType, cleanup, onClose, markConnected]);

  // ── Initial setup: get media → build PC → check queued offer ────────────
  useEffect(() => {
    let alive = true;

    const processOffer = async (offer) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket?.emit('call:answer', { to: peerId, answer });
      } catch (err) { console.error('[WebRTC] processOffer:', err); }
    };

    const init = async () => {
      if (isCaller) playRingtone();

      try {
        const constraints = callType === 'voice'
          ? { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }
          : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (localVideoRef.current && callType !== 'voice') {
          localVideoRef.current.srcObject = stream;
        }

        createPC(stream);
        readyRef.current = true;

        // Process any offer that arrived before we were ready
        if (pendingOffer.current) {
          const { offer } = pendingOffer.current;
          pendingOffer.current = null;
          await processOffer(offer);
        }
      } catch (err) {
        if (!alive) return;
        console.error('[WebRTC] media error:', err);
        setStatus(err.name === 'NotAllowedError' ? 'denied' : 'error');
      }
    };

    // Expose processOffer for the socket listener useEffect
    window.__webrtcProcessOffer = async (offer) => {
      if (readyRef.current && pcRef.current) {
        await processOffer(offer);
      } else {
        pendingOffer.current = { offer };
      }
    };

    init();
    return () => {
      alive = false;
      delete window.__webrtcProcessOffer;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Socket event listeners ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Caller: callee accepted → stop ring → send offer
    const onAccepted = async () => {
      stopRingtone(); // ← STOPS RINGING when call is accepted
      setStatus('connecting');
      const pc = pcRef.current;
      if (!pc || !streamRef.current) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:offer', { to: peerId, offer });
      } catch (err) { console.error('[WebRTC] createOffer:', err); }
    };

    // Callee: received offer
    const onOffer = async ({ offer }) => {
      if (window.__webrtcProcessOffer) {
        await window.__webrtcProcessOffer(offer);
      }
    };

    // Caller: received answer
    const onAnswer = async ({ answer }) => {
      const pc = pcRef.current;
      if (!pc) return;
      if (pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await flushIce(pc);
        } catch (err) { console.error('[WebRTC] setRemoteAnswer:', err); }
      }
    };

    const onIce = async ({ candidate }) => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        pendingIce.current.push(candidate);
      } else {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      }
    };

    const onEnded    = () => { stopRingtone(); setStatus('ended'); setTimeout(() => { cleanup('completed'); onClose(); }, 1200); };
    const onRejected = () => { stopRingtone(); setStatus('ended'); setTimeout(() => { cleanup('missed');    onClose(); }, 1200); };

    socket.on('call:accepted', onAccepted);
    socket.on('call:offer',    onOffer);
    socket.on('call:answer',   onAnswer);
    socket.on('call:ice',      onIce);
    socket.on('call:ended',    onEnded);
    socket.on('call:rejected', onRejected);

    return () => {
      socket.off('call:accepted', onAccepted);
      socket.off('call:offer',    onOffer);
      socket.off('call:answer',   onAnswer);
      socket.off('call:ice',      onIce);
      socket.off('call:ended',    onEnded);
      socket.off('call:rejected', onRejected);
    };
  }, [socket, peerId, cleanup, onClose, stopRingtone, flushIce]);

  const toggleMute = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setMuted(m => !m);
  };
  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setCamOff(c => !c);
  };

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const statusLabel = {
    connecting: '⏳ Connecting…',
    ringing:    '🔔 Ringing…',
    connected:  `🟢 ${fmt(duration)}`,
    denied:     '❌ Mic/camera denied',
    error:      '❌ Connection failed',
    ended:      '📵 Call ended',
  }[status] || '⏳';

  return (
    <div style={s.overlay}>
      {/* Hidden audio element for voice calls — THIS IS THE KEY FIX for voice audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      <div style={s.wrap}>
        {callType === 'voice' ? (
          // ── Voice call UI ──────────────────────────────────────────────
          <div style={s.voiceScreen}>
            <div style={{ ...s.voiceAvatar, animation: status === 'connected' ? 'pulse 2s ease-in-out infinite' : 'none' }}>
              {peerUsername?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={s.peerName}>{peerUsername}</div>
            <div style={s.statusChip}>{statusLabel}</div>

            <div style={s.controls}>
              <Btn onClick={toggleMute} active={muted} icon={muted ? '🔇' : '🎤'} label={muted ? 'Unmute' : 'Mute'} />
              <Btn onClick={hangUp} danger icon="📵" label="End" />
            </div>
          </div>
        ) : (
          // ── Video call UI ──────────────────────────────────────────────
          <>
            <video ref={remoteVideoRef} autoPlay playsInline style={s.remoteVideo} />

            {/* Overlay when not connected */}
            {status !== 'connected' && (
              <div style={s.statusBox}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>
                  {status === 'ringing' ? '🔔' : status === 'denied' ? '🚫' : status === 'error' ? '❌' : status === 'ended' ? '📵' : '⏳'}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{peerUsername}</div>
                <div style={{ fontSize: 15, opacity: .8, marginTop: 8 }}>{statusLabel}</div>
              </div>
            )}

            {/* Connected header */}
            {status === 'connected' && (
              <div style={s.videoHeader}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{peerUsername}</div>
                <div style={{ fontSize: 13, opacity: .8 }}>{statusLabel}</div>
              </div>
            )}

            {/* Local preview */}
            <video ref={localVideoRef} autoPlay playsInline muted
              style={{ ...s.localVideo, opacity: camOff ? 0.2 : 1 }} />

            <div style={s.controls}>
              <Btn onClick={toggleMute}  active={muted}  icon={muted   ? '🔇' : '🎤'} label={muted   ? 'Unmute'   : 'Mute'} />
              <Btn onClick={toggleCam}   active={camOff} icon={camOff  ? '🚫' : '📹'} label={camOff  ? 'Cam on'   : 'Cam off'} />
              <Btn onClick={hangUp} danger icon="📵" label="End" />
            </div>
          </>
        )}
      </div>
      <style>{`
        @keyframes pulse {
          0%,100% { transform:scale(1); box-shadow:0 0 40px rgba(108,99,255,.5); }
          50%      { transform:scale(1.07); box-shadow:0 0 80px rgba(108,99,255,.9); }
        }
      `}</style>
    </div>
  );
}

function Btn({ onClick, active, danger, icon, label }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
      <button onClick={onClick} style={{
        width:60, height:60, borderRadius:'50%', border:'none', fontSize:26, cursor:'pointer',
        background: danger ? '#e53e3e' : active ? 'rgba(255,80,80,.8)' : 'rgba(255,255,255,.18)',
        color:'#fff', transition:'all .2s', backdropFilter:'blur(4px)',
        boxShadow: danger ? '0 4px 20px rgba(229,62,62,.5)' : '0 2px 8px rgba(0,0,0,.3)',
      }}>{icon}</button>
      <span style={{ fontSize:10, color:'rgba(255,255,255,.7)', fontWeight:600 }}>{label}</span>
    </div>
  );
}

const s = {
  overlay:    { position:'fixed', inset:0, background:'linear-gradient(135deg,#0a0a1a,#1a0a2e)', zIndex:2000 },
  wrap:       { position:'relative', width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' },
  // Voice call
  voiceScreen:{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, color:'#fff', textAlign:'center', padding:24 },
  voiceAvatar:{ width:140, height:140, borderRadius:'50%', background:'linear-gradient(135deg,#6c63ff,#a29bfe)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:62, fontWeight:800, color:'#fff', boxShadow:'0 0 60px rgba(108,99,255,.6)' },
  peerName:   { fontSize:26, fontWeight:800, marginTop:8 },
  statusChip: { fontSize:15, color:'rgba(255,255,255,.65)', marginBottom:24 },
  // Video call
  remoteVideo:{ width:'100%', height:'100%', objectFit:'cover' },
  statusBox:  { position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.72)', color:'#fff', textAlign:'center', padding:20 },
  videoHeader:{ position:'absolute', top:0, left:0, right:0, padding:'20px 20px 60px', background:'linear-gradient(to bottom,rgba(0,0,0,.8),transparent)', color:'#fff' },
  localVideo: { position:'absolute', bottom:110, right:16, width:110, height:80, borderRadius:12, objectFit:'cover', border:'2px solid rgba(255,255,255,.3)', background:'#222', transition:'opacity .3s' },
  // Shared controls
  controls:   { position:'absolute', bottom:0, left:0, right:0, padding:'20px 20px 40px', background:'linear-gradient(to top,rgba(0,0,0,.9),transparent)', display:'flex', justifyContent:'center', gap:32 },
};
