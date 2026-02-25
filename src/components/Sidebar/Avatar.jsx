export default function Avatar({ username, avatarUrl, size = 'md', online }) {
  const initial = username ? username[0].toUpperCase() : '?';
  const sizeClass = `avatar avatar-${size}`;

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <div className={sizeClass}>
        {avatarUrl
          ? <img src={avatarUrl} alt={username} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          : initial
        }
      </div>
      {online !== undefined && (
        <span
          className={`online-dot ${online ? 'online' : 'offline'}`}
          style={{ position: 'absolute', bottom: 0, right: 0 }}
        />
      )}
    </div>
  );
}
