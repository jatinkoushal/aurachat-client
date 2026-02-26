import { Outlet, NavLink } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import IncomingCallModal from '../VideoCall/IncomingCallModal';
import api from '../../services/api';

export default function AppLayout() {
  const { socket } = useSocket();
  const [inviteCount, setInviteCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);

  const loadBadges = useCallback(() => {
    api.get('/api/groups/invites').then(res => setInviteCount(res.data.invites?.length || 0)).catch(() => {});
    api.get('/api/relationships').then(res => {
      const pending = (res.data.relationships || []).filter(r => r.status === 'pending' && r.direction === 'received');
      setRequestCount(pending.length);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadBadges(); }, [loadBadges]);

  // Refresh badges on socket events that might change counts
  useEffect(() => {
    if (!socket) return;
    // When we receive a message, a new request notification could be embedded
    // Better: reload badges on any relevant event
    const refresh = () => loadBadges();
    socket.on('connect', refresh);
    return () => { socket.off('connect', refresh); };
  }, [socket, loadBadges]);

  const tabs = [
    { path: '/chats',    icon: '💬', label: 'Chats' },
    { path: '/people',   icon: '👥', label: 'People',  badge: requestCount },
    { path: '/groups',   icon: '🏠', label: 'Groups',  badge: inviteCount },
    { path: '/settings', icon: '⚙️', label: 'Settings' },
  ];

  return (
    <div style={st.layout}>
      <main style={st.main}>
        <Outlet />
      </main>
      <nav style={st.nav}>
        {tabs.map(tab => (
          <NavLink key={tab.path} to={tab.path}
            style={({ isActive }) => ({ ...st.tab, ...(isActive ? st.active : {}) })}>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <span style={st.tabIcon}>{tab.icon}</span>
              {tab.badge > 0 && (
                <span className="badge" style={{ position: 'absolute', top: -4, right: -6, fontSize: 9, minWidth: 14, height: 14, padding: '0 3px' }}>
                  {tab.badge}
                </span>
              )}
            </div>
            <span style={st.tabLabel}>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
      <IncomingCallModal />
    </div>
  );
}

const st = {
  layout:   { display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-primary)' },
  main:     { flex: 1, height: 0, overflow: 'hidden', display: 'flex', width: '100%' },
  nav:      { display: 'flex', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', padding: '8px 0 max(8px, env(safe-area-inset-bottom))', flexShrink: 0 },
  tab:      { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 4px', textDecoration: 'none', color: 'var(--text-muted)', transition: 'color .2s' },
  active:   { color: 'var(--accent-primary)' },
  tabIcon:  { fontSize: 22 },
  tabLabel: { fontSize: 10, fontWeight: 600 },
};
