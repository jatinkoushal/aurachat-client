import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Sidebar/Avatar';

export default function Settings() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div style={styles.page}>
      <div style={styles.content}>
        <h2 style={styles.title}>Settings</h2>

        {/* Profile card */}
        <div style={styles.card}>
          <div style={styles.profileHeader}>
            <Avatar username={user?.username} avatarUrl={user?.avatar_url} size="lg" />
            <div>
              <div style={styles.username}>{user?.username}</div>
              <div style={styles.userId}>ID: {user?.id?.slice(0, 8)}…</div>
            </div>
          </div>
        </div>

        {/* App info */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>About AuraChat</h3>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Version</span>
            <span style={styles.infoValue}>1.0.0</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Tech Stack</span>
            <span style={styles.infoValue}>React + Vite, Node.js, PostgreSQL</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Real-time</span>
            <span style={styles.infoValue}>Socket.io</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Video</span>
            <span style={styles.infoValue}>Jitsi Meet</span>
          </div>
        </div>

        {/* Privacy note */}
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Privacy</h3>
          <p style={styles.privacyText}>
            AuraChat uses end-to-end secure sessions via JWT stored in HttpOnly cookies.
            Passwords are hashed with bcrypt. Messages are stored encrypted in PostgreSQL.
            You can only be contacted by users you've accepted.
          </p>
        </div>

        <button className="btn btn-danger w-full" onClick={handleLogout} style={{ marginTop: '8px' }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: { flex: 1, overflowY: 'auto', padding: '20px' },
  content: { maxWidth: '500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' },
  title: { fontSize: '24px', fontWeight: '800', marginBottom: '4px' },
  card: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' },
  profileHeader: { display: 'flex', alignItems: 'center', gap: '16px' },
  username: { fontSize: '20px', fontWeight: '700' },
  userId: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace' },
  sectionTitle: { fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '14px' },
  infoLabel: { color: 'var(--text-secondary)' },
  infoValue: { color: 'var(--accent-secondary)', fontWeight: '600' },
  privacyText: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' },
};
