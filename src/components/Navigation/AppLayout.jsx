import { Outlet, NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function AppLayout() {
  const [inviteCount, setInviteCount] = useState(0);

  useEffect(() => {
    api.get('/api/groups/invites').then(res => setInviteCount(res.data.invites.length)).catch(() => {});
  }, []);

  const tabs = [
    { path: '/chats',    icon: '💬', label: 'Chats'    },
    { path: '/people',   icon: '👥', label: 'People'   },
    { path: '/groups',   icon: '🏠', label: 'Groups', badge: inviteCount },
    { path: '/settings', icon: '⚙️', label: 'Settings' },
  ];

  return (
    <div style={styles.layout}>
      <main style={styles.main}><Outlet /></main>
      <nav style={styles.nav}>
        {tabs.map(tab => (
          <NavLink key={tab.path} to={tab.path}
            style={({ isActive }) => ({ ...styles.tab, ...(isActive ? styles.tabActive : {}) })}>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <span style={styles.tabIcon}>{tab.icon}</span>
              {tab.badge > 0 && (
                <span className="badge" style={{ position: 'absolute', top: -4, right: -6, fontSize: 9, minWidth: 14, height: 14, padding: '0 3px' }}>{tab.badge}</span>
              )}
            </div>
            <span style={styles.tabLabel}>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

const styles = {
  layout: { display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-primary)' },
  main: { flex: 1, overflow: 'hidden', display: 'flex' },
  nav: { display: 'flex', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', padding: '8px 0 max(8px, env(safe-area-inset-bottom))', flexShrink: 0 },
  tab: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 4px', textDecoration: 'none', color: 'var(--text-muted)', transition: 'color .2s' },
  tabActive: { color: 'var(--accent-primary)' },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 10, fontWeight: 600 },
};
