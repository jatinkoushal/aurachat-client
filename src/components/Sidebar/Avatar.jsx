export default function Avatar({ username, avatarUrl, size = 'md', online }) {
  const initial = username ? username[0].toUpperCase() : '?';
  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <div className={`avatar avatar-${size}`}>
        {avatarUrl
          ? <img src={avatarUrl} alt={username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initial}
      </div>
      {online !== undefined && (
        <span className={`online-dot ${online ? 'online' : 'offline'}`}
          style={{ position: 'absolute', bottom: 1, right: 1 }} />
      )}
    </div>
  );
}
