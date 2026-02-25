import { Outlet, NavLink } from 'react-router-dom';

const tabs = [
  { path: '/chats',   icon: '💬', label: 'Chats'    },
  { path: '/people',  icon: '👥', label: 'People'   },
  { path: '/groups',  icon: '🏠', label: 'Groups'   },
  { path: '/settings',icon: '⚙️', label: 'Settings' },
];

export default function AppLayout() {
  return (
    <div style={styles.layout}>
      <main style={styles.main}>
        <Outlet />
      </main>
      <nav style={styles.nav}>
        {tabs.map(tab => (
          <NavLink
            key={tab.path}
            to={tab.path}
            style={({ isActive }) => ({
              ...styles.tab,
              ...(isActive ? styles.tabActive : {}),
            })}
          >
            <span style={styles.tabIcon}>{tab.icon}</span>
            <span style={styles.tabLabel}>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

const styles = {
  layout: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    background: 'var(--bg-primary)',
  },
  main: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
  },
  nav: {
    display: 'flex',
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
    padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
    flexShrink: 0,
  },
  tab: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 4px',
    textDecoration: 'none',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-sm)',
    margin: '0 4px',
    transition: 'color 0.2s',
  },
  tabActive: {
    color: 'var(--accent-primary)',
  },
  tabIcon: { fontSize: '20px' },
  tabLabel: { fontSize: '10px', fontWeight: '600' },
};
