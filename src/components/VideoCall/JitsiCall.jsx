import { useEffect, useRef } from 'react';

export default function JitsiCall({ roomName, displayName, onClose }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    const loadJitsi = () => {
      if (!window.JitsiMeetExternalAPI) {
        // Retry if script not yet loaded
        setTimeout(loadJitsi, 500);
        return;
      }
      apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName,
        parentNode: containerRef.current,
        userInfo: { displayName },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableClosePage: false,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          MOBILE_APP_PROMO: false,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        },
      });
      apiRef.current.on('readyToClose', onClose);
      apiRef.current.on('videoConferenceLeft', onClose);
    };

    loadJitsi();

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, [roomName, displayName, onClose]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.topBar}>
        <span style={styles.roomLabel}>📹 {roomName}</span>
        <button className="btn btn-danger" onClick={onClose} style={{ padding: '6px 16px', fontSize: '13px' }}>
          End Call
        </button>
      </div>
      <div ref={containerRef} style={styles.container} />
    </div>
  );
}

const styles = {
  wrapper: { position: 'fixed', inset: 0, zIndex: 200, background: '#000', display: 'flex', flexDirection: 'column' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  roomLabel: { fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace' },
  container: { flex: 1, width: '100%' },
};
