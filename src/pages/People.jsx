import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import Avatar from '../components/Sidebar/Avatar';
import api from '../services/api';

export default function People() {
  const { isOnline, onlineUsers } = useSocket();
  const [allUsers, setAllUsers]       = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [search, setSearch]           = useState('');
  const [tab, setTab]                 = useState('all');
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [u, r] = await Promise.all([
        api.get('/api/relationships/all'),
        api.get('/api/relationships'),
      ]);
      setAllUsers(u.data.users || []);
      setRelationships(r.data.relationships || []);
    } catch {
      setError('Could not load users — server may be starting up. Please retry in a moment.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filt = arr => q ? arr.filter(x => x.username?.toLowerCase().includes(q)) : arr;

  const friends  = relationships.filter(r => r.status === 'accepted');
  const muted    = relationships.filter(r => r.status === 'muted');
  const incoming = relationships.filter(r => r.status === 'pending' && r.direction === 'received');
  const sent     = relationships.filter(r => r.status === 'pending' && r.direction === 'sent');
  const blocked  = relationships.filter(r => r.status === 'blocked');

  // ── Actions — optimistic + async ─────────────────────────────────────────
  const sendRequest = async (addresseeId) => {
    setAllUsers(prev => prev.map(u => u.id === addresseeId ? { ...u, rel_status: 'pending', direction: 'sent' } : u));
    try { await api.post('/api/relationships/request', { addresseeId }); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); load(); }
  };

  const accept = async (relId, userId) => {
    setRelationships(prev => prev.map(r => r.id === relId ? { ...r, status: 'accepted' } : r));
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, rel_status: 'accepted' } : u));
    try { await api.patch(`/api/relationships/${relId}/accept`); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); load(); }
  };

  const remove = async (relId, userId) => {
    setRelationships(prev => prev.filter(r => r.id !== relId));
    setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, rel_status: null, rel_id: null, direction: null } : u));
    try { await api.delete(`/api/relationships/${relId}`); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); load(); }
  };

  const blockUser = async (targetUserId, relId) => {
    if (relId) setRelationships(prev => prev.map(r => r.id === relId ? { ...r, status: 'blocked' } : r));
    setAllUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, rel_status: 'blocked' } : u));
    try { await api.patch(`/api/relationships/${targetUserId}/block`); await load(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); load(); }
  };

  const muteUser = async (relId, userId) => {
    setRelationships(prev => prev.map(r => r.id === relId ? { ...r, status: 'muted' } : r));
    try { await api.patch(`/api/relationships/${relId}/mute`); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); load(); }
  };

  const unmuteUser = async (relId) => {
    setRelationships(prev => prev.map(r => r.id === relId ? { ...r, status: 'accepted' } : r));
    try { await api.patch(`/api/relationships/${relId}/unmute`); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); load(); }
  };

  const tabs = [
    { key: 'all',      label: 'Everyone',  count: allUsers.length },
    { key: 'friends',  label: 'Friends',   count: friends.length },
    { key: 'requests', label: 'Requests',  count: incoming.length, highlight: incoming.length > 0 },
    { key: 'sent',     label: 'Sent',      count: sent.length },
    { key: 'muted',    label: 'Muted',     count: muted.length },
    { key: 'blocked',  label: 'Blocked',   count: blocked.length },
  ];

  const UserRow = ({ user, badge, online, children }) => (
    <div style={s.row}>
      <Avatar username={user.username} avatarUrl={user.avatar_url} size="md" online={online} />
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        <div style={s.name}>{user.username}</div>
        {user.bio && <div style={s.bio}>{user.bio}</div>}
        {badge
          ? <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{badge}</div>
          : <div style={{ fontSize: 11, color: online ? 'var(--online-green)' : 'var(--text-muted)' }}>
              {online ? '🟢 Online' : '⚫ Offline'}
            </div>
        }
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>{children}</div>
    </div>
  );

  return (
    <div style={s.page}>
      {/* Search */}
      <div style={s.searchBar}>
        <span style={{ fontSize: 16 }}>🔍</span>
        <input className="input" style={{ border: 'none', background: 'transparent', flex: 1, padding: '4px 0' }}
          placeholder="Search by username…" value={search}
          onChange={e => setSearch(e.target.value)} />
        {search && <button className="btn-icon" onClick={() => setSearch('')} style={{ fontSize: 14 }}>✕</button>}
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ ...s.tabBtn, ...(tab === t.key ? s.tabOn : {}), ...(t.highlight && tab !== t.key ? { color: 'var(--warning)' } : {}) }}>
            {t.label}
            {t.count > 0 && <span className="badge" style={{ marginLeft: 3, fontSize: 9 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      <div style={s.list}>

        {loading && (
          <div style={s.center}>
            <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13 }}>Loading users…</div>
          </div>
        )}

        {!loading && error && (
          <div style={{ ...s.center, gap: 12 }}>
            <div style={{ color: 'var(--danger)', textAlign: 'center', fontSize: 14 }}>{error}</div>
            <button className="btn btn-primary" onClick={load} style={{ padding: '8px 20px' }}>🔄 Retry</button>
          </div>
        )}

        {/* EVERYONE */}
        {!loading && !error && tab === 'all' && (
          filt(allUsers).length === 0
            ? <div style={s.empty}>{allUsers.length === 0 ? 'No other users yet' : `No results for "${search}"`}</div>
            : filt(allUsers).map(u => (
              <UserRow key={u.id} user={u} online={isOnline(u.id)}>
                {!u.rel_status &&
                  <button className="btn btn-primary" onClick={() => sendRequest(u.id)} style={s.btn}>Add Friend</button>}
                {u.rel_status === 'pending' && u.direction === 'sent' &&
                  <span style={s.pill}>Sent ✓</span>}
                {u.rel_status === 'pending' && u.direction === 'received' &&
                  <button className="btn btn-primary" onClick={() => accept(u.rel_id, u.id)} style={s.btn}>Accept</button>}
                {u.rel_status === 'accepted' &&
                  <span style={{ ...s.pill, background: 'rgba(0,184,148,.15)', color: 'var(--online-green)' }}>✓ Friends</span>}
                {u.rel_status === 'blocked' &&
                  <span style={{ ...s.pill, background: 'rgba(225,112,85,.15)', color: 'var(--danger)' }}>Blocked</span>}
                {u.rel_status === 'muted' &&
                  <span style={{ ...s.pill, color: 'var(--warning)' }}>🔇 Muted</span>}
              </UserRow>
            ))
        )}

        {/* FRIENDS */}
        {!loading && !error && tab === 'friends' && (
          filt(friends).length === 0
            ? <div style={s.empty}>{q ? `No friends matching "${search}"` : 'No friends yet — go to Everyone!'}</div>
            : filt(friends).map(r => (
              <UserRow key={r.id} user={r} online={isOnline(r.user_id)}>
                <button className="btn-icon" title="Mute"   onClick={() => muteUser(r.id, r.user_id)}>🔇</button>
                <button className="btn-icon" title="Block"  onClick={() => blockUser(r.user_id, r.id)}>🚫</button>
                <button className="btn-icon" title="Remove" onClick={() => remove(r.id, r.user_id)}>🗑️</button>
              </UserRow>
            ))
        )}

        {/* REQUESTS */}
        {!loading && !error && tab === 'requests' && (
          filt(incoming).length === 0
            ? <div style={s.empty}>{q ? `No results` : 'No incoming requests'}</div>
            : filt(incoming).map(r => (
              <UserRow key={r.id} user={r} badge="Wants to be friends" online={isOnline(r.user_id)}>
                <button className="btn btn-primary" onClick={() => accept(r.id, r.user_id)} style={s.btn}>Accept</button>
                <button className="btn btn-danger"  onClick={() => blockUser(r.user_id, r.id)} style={{ ...s.btn, marginLeft: 4 }}>Block</button>
              </UserRow>
            ))
        )}

        {/* SENT */}
        {!loading && !error && tab === 'sent' && (
          filt(sent).length === 0
            ? <div style={s.empty}>{q ? 'No results' : 'No sent requests'}</div>
            : filt(sent).map(r => (
              <UserRow key={r.id} user={r} badge="Request pending…" online={isOnline(r.user_id)}>
                <button className="btn btn-ghost" onClick={() => remove(r.id, r.user_id)} style={s.btn}>Cancel</button>
              </UserRow>
            ))
        )}

        {/* MUTED */}
        {!loading && !error && tab === 'muted' && (
          filt(muted).length === 0
            ? <div style={s.empty}>{q ? 'No results' : 'No muted users'}</div>
            : filt(muted).map(r => (
              <UserRow key={r.id} user={r} badge="🔇 Muted" online={isOnline(r.user_id)}>
                <button className="btn btn-ghost" onClick={() => unmuteUser(r.id, r.user_id)} style={s.btn}>Unmute</button>
              </UserRow>
            ))
        )}

        {/* BLOCKED */}
        {!loading && !error && tab === 'blocked' && (
          filt(blocked).length === 0
            ? <div style={s.empty}>{q ? 'No results' : 'No blocked users'}</div>
            : filt(blocked).map(r => (
              <UserRow key={r.id} user={r} badge="🚫 Blocked" online={false}>
                <button className="btn btn-ghost" onClick={() => remove(r.id, r.user_id)} style={s.btn}>Unblock</button>
              </UserRow>
            ))
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const s = {
  page:      { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' },
  searchBar: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  tabs:      { display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', flexShrink: 0, scrollbarWidth: 'none' },
  tabBtn:    { flexShrink: 0, padding: '10px 10px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottom: '2px solid transparent', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' },
  tabOn:     { color: 'var(--accent-primary)', borderBottomColor: 'var(--accent-primary)' },
  list:      { flex: 1, overflowY: 'auto', padding: 8 },
  center:    { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' },
  empty:     { padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 },
  row:       { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid var(--border)' },
  name:      { fontWeight: 600, fontSize: 15, marginBottom: 2 },
  bio:       { fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  btn:       { padding: '7px 12px', fontSize: 12, flexShrink: 0 },
  pill:      { fontSize: 11, fontWeight: 700, background: 'var(--bg-card)', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 999, flexShrink: 0, whiteSpace: 'nowrap' },
};
