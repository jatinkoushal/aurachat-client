import { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';

const ICE_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'turn:openrelay.metered.ca:80',   username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443',  username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443',  username: 'openrelayproject', credential: 'openrelayproject', credentialType: 'password' },
  ],
  iceCandidatePoolSize: 10,
};

export default function WebRTCCall({ peerId, peerUsername, callType = 'video', isCaller, onClose }) {
  const { socket } = useSocket();

  const localRef   = useRef(null);
  const remoteRef  = useRef(null);
  const pcRef      = useRef(null);
  const streamRef  = useRef(null);
  const startRef   = useRef(null);
  const timerRef   = useRef(null);
  const pendingIce = useRef([]);
  const pendingOffer = useRef(null);   // queued offer if it arrives before PC is ready
  const readyRef   = useRef(false);   // true once PC + stream are ready
  const ringingRef = useRef(null);

  const [status,   setStatus]   = useState(isCaller ? 'ringing' : 'connecting');
  const [muted,    setMuted]    = useState(false);
  const [camOff,   setCamOff]   = useState(false);
  const [duration, setDuration] = useState(0);

  // ── Ringtone (caller side: ringing while waiting) ─────────────────────────
  const playRingtone = useCallback(() => {
    if (ringingRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      let playing = true;
      const ring = () => {
        if (!playing) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, ctx.currentTime);
        osc.frequency.setValueAtTime(440, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
        osc.start(); osc.stop(ctx.currentTime + 1);
        if (playing) setTimeout(ring, 2000);
      };
      ring();
      ringingRef.current = { stop: () => { playing = false; try { ctx.close(); } catch {} } };
    } catch {}
  }, []);

  const stopRingtone = useCallback(() => {
    ringingRef.current?.stop();
    ringingRef.current = null;
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback((callStatus = 'ended') => {
    stopRingtone();
    clearInterval(timerRef.current);
    const dur = startRef.current ? Math.round((Date.now() - startRef.current) / 1000) : 0;
    if (socket && dur > 0) socket.emit('call:log', { to: peerId, callType, duration: dur, status: callStatus });
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
  }, [socket, peerId, callType, stopRingtone]);

  const hangUp = useCallback(() => {
    socket?.emit('call:end', { to: peerId });
    cleanup('completed');
    onClose();
  }, [socket, peerId, cleanup, onClose]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const markConnected = useCallback(() => {
    setStatus('connected');
    stopRingtone();
    if (!startRef.current) {
      startRef.current = Date.now();
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
  }, [stopRingtone]);

  // ── Create RTCPeerConnection ───────────────────────────────────────────────
  const createPC = useCallback((stream) => {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      if (remoteRef.current && e.streams[0]) {
        remoteRef.current.srcObject = e.streams[0];
        markConnected();
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) socket?.emit('call:ice', { to: peerId, candidate: e.candidate });
    };

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log('ICE state:', s);
      if (s === 'connected' || s === 'completed') markConnected();
      if (s === 'failed') {
        setStatus('error');
        setTimeout(() => { cleanup('missed'); onClose(); }, 2000);
      }
      if (s === 'disconnected') {
        // give it 5s to reconnect before declaring ended
        setTimeout(() => {
          if (pcRef.current?.iceConnectionState === 'disconnected') {
            setStatus('ended');
            cleanup('completed');
            onClose();
          }
        }, 5000);
      }
    };

    return pc;
  }, [socket, peerId, cleanup, onClose, markConnected]);

  // ── Flush pending ICE (call after setRemoteDescription) ───────────────────
  const flushIce = useCallback(async (pc) => {
    for (const c of pendingIce.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
    pendingIce.current = [];
  }, []);

  // ── Initial setup: get media, build PC ────────────────────────────────────
  useEffect(() => {
    let alive = true;

    const init = async () => {
      if (isCaller) playRingtone();

      try {
        const constraints = callType === 'voice'
          ? { audio: true, video: false }
          : { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;

        createPC(stream);
        readyRef.current = true;

        // If an offer arrived while we were initializing, process it now
        if (pendingOffer.current) {
          const { offer } = pendingOffer.current;
          pendingOffer.current = null;
          await processOffer(offer);
        }
      } catch (err) {
        if (!alive) return;
        console.error('media error:', err);
        setStatus(err.name === 'NotAllowedError' ? 'denied' : 'error');
      }
    };

    const processOffer = async (offer) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket?.emit('call:answer', { to: peerId, answer });
      } catch (err) { console.error('processOffer error:', err); }
    };

    // attach processOffer so socket listener can call it
    window.__webrtcProcessOffer = processOffer;

    init();
    return () => {
      alive = false;
      delete window.__webrtcProcessOffer;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Caller: callee accepted → create and send offer
    const onAccepted = async () => {
      stopRingtone();
      setStatus('connecting');
      const pc = pcRef.current;
      if (!pc || !streamRef.current) return;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:offer', { to: peerId, offer });
      } catch (err) { console.error('createOffer error:', err); }
    };

    // Callee: received offer
    const onOffer = async ({ offer }) => {
      if (readyRef.current && pcRef.current) {
        // PC is ready, process immediately
        const pc = pcRef.current;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          await flushIce(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call:answer', { to: peerId, answer });
        } catch (err) { console.error('onOffer error:', err); }
      } else {
        // PC not ready yet, queue it
        pendingOffer.current = { offer };
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
        } catch (err) { console.error('setRemoteAnswer error:', err); }
      }
    };

    const onIce = async ({ candidate }) => {
      const pc = pcRef.current;
      if (!pc) { pendingIce.current.push(candidate); return; }
      if (pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      } else {
        pendingIce.current.push(candidate);
      }
    };

    const onEnded = () => {
      setStatus('ended');
      setTimeout(() => { cleanup('completed'); onClose(); }, 1200);
    };
    const onRejected = () => {
      stopRingtone();
      setStatus('ended');
      setTimeout(() => { cleanup('missed'); onClose(); }, 1200);
    };

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
    denied:     '❌ Camera/mic permission denied',
    error:      '❌ Connection failed',
    ended:      '📵 Call ended',
  }[status] || '⏳';

  return (
    <div style={s.overlay}>
      <div style={s.wrap}>
        {/* Remote video / voice avatar */}
        {callType !== 'voice' ? (
          <video ref={remoteRef} autoPlay playsInline style={s.remote} />
        ) : (
          <div style={s.voiceCenter}>
            <div style={{ ...s.voiceAvatar, animation: status === 'connected' ? 'pulse 2s ease-in-out infinite' : 'none' }}>
              {peerUsername?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginTop: 16 }}>{peerUsername}</div>
            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, marginTop: 8 }}>{statusLabel}</div>
          </div>
        )}

        {/* Status overlay (video mode only, when not connected) */}
        {callType !== 'voice' && status !== 'connected' && (
          <div style={s.statusBox}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>
              {status === 'ringing' ? '🔔' : status === 'ended' ? '📵' : status === 'denied' ? '🚫' : status === 'error' ? '❌' : '⏳'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{peerUsername}</div>
            <div style={{ fontSize: 15, opacity: .8, marginTop: 8 }}>{statusLabel}</div>
          </div>
        )}

        {/* Header (video mode, connected) */}
        {callType !== 'voice' && status === 'connected' && (
          <div style={s.header}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{peerUsername}</div>
            <div style={{ fontSize: 13, opacity: .8 }}>{statusLabel}</div>
          </div>
        )}

        {/* Local video preview */}
        {callType !== 'voice' && (
          <video ref={localRef} autoPlay playsInline muted
            style={{ ...s.local, opacity: camOff ? 0.2 : 1 }} />
        )}

        {/* Controls */}
        <div style={s.controls}>
          <Btn onClick={toggleMute}  active={muted}  icon={muted   ? '🔇' : '🎤'} label={muted   ? 'Unmute'    : 'Mute'} />
          {callType !== 'voice' && <Btn onClick={toggleCam} active={camOff} icon={camOff ? '🚫' : '📹'} label={camOff ? 'Cam on' : 'Cam off'} />}
          <Btn onClick={hangUp} danger icon="📵" label="End" />
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0%,100% { transform: scale(1); box-shadow: 0 0 40px rgba(108,99,255,.5); }
          50% { transform: scale(1.06); box-shadow: 0 0 80px rgba(108,99,255,.9); }
        }
      `}</style>
    </div>
  );
}

function Btn({ onClick, active, danger, icon, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <button onClick={onClick} style={{
        width: 60, height: 60, borderRadius: '50%', border: 'none', fontSize: 26, cursor: 'pointer',
        background: danger ? '#e53e3e' : active ? 'rgba(255,80,80,.8)' : 'rgba(255,255,255,.2)',
        color: '#fff', transition: 'all .2s', backdropFilter: 'blur(4px)',
        boxShadow: danger ? '0 4px 20px rgba(229,62,62,.5)' : 'none',
      }}>{icon}</button>
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>{label}</span>
    </div>
  );
}

const s = {
  overlay:     { position: 'fixed', inset: 0, background: 'linear-gradient(135deg,#0a0a1a,#1a0a2e)', zIndex: 2000 },
  wrap:        { position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  remote:      { width: '100%', height: '100%', objectFit: 'cover' },
  voiceCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  voiceAvatar: { width: 140, height: 140, borderRadius: '50%', background: 'linear-gradient(135deg,#6c63ff,#a29bfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60, fontWeight: 800, color: '#fff', boxShadow: '0 0 60px rgba(108,99,255,.6)' },
  statusBox:   { position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)', color: '#fff', textAlign: 'center', padding: 20 },
  header:      { position: 'absolute', top: 0, left: 0, right: 0, padding: '20px 20px 60px', background: 'linear-gradient(to bottom,rgba(0,0,0,.8),transparent)', color: '#fff' },
  local:       { position: 'absolute', bottom: 110, right: 16, width: 110, height: 80, borderRadius: 12, objectFit: 'cover', border: '2px solid rgba(255,255,255,.3)', background: '#222', transition: 'opacity .3s' },
  controls:    { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 20px 40px', background: 'linear-gradient(to top,rgba(0,0,0,.9),transparent)', display: 'flex', justifyContent: 'center', gap: 32 },
};
