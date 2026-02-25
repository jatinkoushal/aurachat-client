import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import Avatar from '../components/Sidebar/Avatar';
import api from '../services/api';

export default function People() {
  const { isOnline } = useSocket();
  const [allUsers, setAllUsers] = useState([]);       // ALL users on platform
  const [relationships, setRelationships] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, relRes] = await Promise.all([
        api.get('/api/relationships/all'),
        api.get('/api/relationships'),
      ]);
      setAllUsers(usersRes.data.users);
      setRelationships(relRes.data.relationships);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Search filters allUsers client-side (already loaded)
  const filtered = searchQuery.trim()
    ? allUsers.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()))
    : allUsers;

  const friends = relationships.filter(r => r.status === 'accepted');
  const muted = relationships.filter(r => r.status === 'muted');
  const incoming = relationships.filter(r => r.status === 'pending' && r.direction === 'received');
  const sent = relationships.filter(r => r.status === 'pending' && r.direction === 'sent');
  const blocked = relationships.filter(r => r.status === 'blocked');

  const sendRequest = async (addresseeId) => {
    try {
      await api.post('/api/relationships/request', { addresseeId });
      // Update local state immediately
      setAllUsers(prev => prev.map(u => u.id === addresseeId
        ? { ...u, rel_status: 'pending', direction: 'sent' } : u));
    } catch (err) { alert(err.response?.data?.error || 'Failed to send request'); }
  };

  const accept = async (relId) => {
    try {
      await api.patch(`/api/relationships/${relId}/accept`);
      await loadAll();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const remove = async (relId) => {
    try {
      await api.delete(`/api/relationships/${relId}`);
      await loadAll();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const block = async (userId) => {
    try {
      await api.patch(`/api/relationships/${userId}/block`);
      await loadAll();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const mute = async (relId) => {
    try {
      await api.patch(`/api/relationships/${relId}/mute`);
      await loadAll();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const unmute = async (relId) => {
    try {
      await api.patch(`/api/relationships/${relId}/unmute`);
      await loadAll();
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const tabs = [
    { key: 'all',      label: 'Everyone',  count: allUsers.length },
    { key: 'friends',  label: 'Friends',   count: friends.length },
    { key: 'requests', label: 'Requests',  count: incoming.length },
    { key: 'sent',     label: 'Sent',      count: sent.length },
    { key: 'muted',    label: 'Muted',     count: muted.length },
    { key: 'blocked',  label: 'Blocked',   count: blocked.length },
  ];

  return (
    <div style={s.page}>
      {/* Search */}
      <div style={s.searchBar}>
        <span>🔍</span>
        <input className="input"
          style={{ border: 'none', background: 'transparent', flex: 1, padding: '4px 0' }}
          placeholder="Search by username..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && <button className="btn-icon" onClick={() => setSearchQuery('')}>✕</button>}
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ ...s.tabBtn, ...(tab === t.key ? s.tabActive : {}) }}>
            {t.label}
            {t.count > 0 && <span className="badge" style={{ marginLeft: 3 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={s.list}>
        {loading && <div style={s.empty}>Loading...</div>}

        {/* ALL USERS tab */}
        {!loading && tab === 'all' && (
          filtered.length === 0
            ? <div style={s.empty}>No users found</div>
            : filtered.map(u => (
              <UserRow key={u.id} user={u} isOnline={isOnline(u.id)}
                onSend={() => sendRequest(u.id)}
                onAccept={() => accept(u.rel_id)}
                onBlock={() => block(u.id)}
              />
            ))
        )}

        {/* FRIENDS tab */}
        {!loading && tab === 'friends' && (
          friends.length === 0
            ? <div style={s.empty}>No friends yet — find people in the Everyone tab 👆</div>
            : friends.map(r => (
              <RelRow key={r.id} rel={r} isOnline={isOnline(r.user_id)}
                actions={
                  <>
                    <button className="btn-icon" title="Mute" onClick={() => mute(r.id)}>🔇</button>
                    <button className="btn-icon" title="Block" onClick={() => block(r.user_id)}>🚫</button>
                    <button className="btn-icon" title="Remove friend" onClick={() => remove(r.id)}>🗑️</button>
                  </>
                }
              />
            ))
        )}

        {/* INCOMING REQUESTS tab */}
        {!loading && tab === 'requests' && (
          incoming.length === 0
            ? <div style={s.empty}>No incoming requests</div>
            : incoming.map(r => (
              <RelRow key={r.id} rel={r} isOnline={isOnline(r.user_id)}
                actions={
                  <>
                    <button className="btn btn-primary" onClick={() => accept(r.id)} style={s.btnSm}>Accept</button>
                    <button className="btn btn-danger" onClick={() => block(r.user_id)} style={s.btnSm}>Block</button>
                  </>
                }
              />
            ))
        )}

        {/* SENT tab */}
        {!loading && tab === 'sent' && (
          sent.length === 0
            ? <div style={s.empty}>No sent requests</div>
            : sent.map(r => (
              <RelRow key={r.id} rel={r} isOnline={isOnline(r.user_id)}
                badge="Pending..."
                actions={<button className="btn btn-ghost" onClick={() => remove(r.id)} style={s.btnSm}>Cancel</button>}
              />
            ))
        )}

        {/* MUTED tab */}
        {!loading && tab === 'muted' && (
          muted.length === 0
            ? <div style={s.empty}>No muted users</div>
            : muted.map(r => (
              <RelRow key={r.id} rel={r} isOnline={isOnline(r.user_id)}
                actions={<button className="btn btn-ghost" onClick={() => unmute(r.id)} style={s.btnSm}>Unmute</button>}
              />
            ))
        )}

        {/* BLOCKED tab */}
        {!loading && tab === 'blocked' && (
          blocked.length === 0
            ? <div style={s.empty}>No blocked users</div>
            : blocked.map(r => (
              <RelRow key={r.id} rel={r} isOnline={isOnline(r.user_id)}
                actions={<button className="btn btn-ghost" onClick={() => remove(r.id)} style={s.btnSm}>Unblock</button>}
              />
            ))
        )}
      </div>
    </div>
  );
}

// User row for "All users" tab — shows relationship status inline
function UserRow({ user, isOnline, onSend, onAccept, onBlock }) {
  return (
    <div style={s.row}>
      <Avatar username={user.username} avatarUrl={user.avatar_url} size="md" online={isOnline} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={s.name}>{user.username}</div>
        {user.bio && <div className="text-muted truncate" style={{ fontSize: 12 }}>{user.bio}</div>}
        <div style={{ fontSize: 11, color: isOnline ? 'var(--online-green)' : 'var(--text-muted)' }}>
          {isOnline ? '🟢 Online' : '⚫ Offline'}
        </div>
      </div>
      {/* Show correct action based on relationship status */}
      {!user.rel_status && (
        <button className="btn btn-primary" onClick={onSend} style={s.btnSm}>Add Friend</button>
      )}
      {user.rel_status === 'pending' && user.direction === 'sent' && (
        <span style={s.pill}>Request Sent</span>
      )}
      {user.rel_status === 'pending' && user.direction === 'received' && (
        <button className="btn btn-primary" onClick={onAccept} style={s.btnSm}>Accept</button>
      )}
      {user.rel_status === 'accepted' && (
        <span style={{ ...s.pill, background: 'rgba(0,184,148,0.2)', color: 'var(--online-green)' }}>✓ Friends</span>
      )}
      {user.rel_status === 'blocked' && (
        <span style={{ ...s.pill, background: 'rgba(225,112,85,0.2)', color: 'var(--danger)' }}>Blocked</span>
      )}
    </div>
  );
}

// Row for relationships (friends/muted/blocked/requests)
function RelRow({ rel, isOnline, actions, badge }) {
  return (
    <div style={s.row}>
      <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="md" online={isOnline} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={s.name}>{rel.username}</div>
        {rel.bio && <div className="text-muted truncate" style={{ fontSize: 12 }}>{rel.bio}</div>}
        {badge && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{badge}</div>}
        {!badge && <div style={{ fontSize: 11, color: isOnline ? 'var(--online-green)' : 'var(--text-muted)' }}>
          {isOnline ? '🟢 Online' : '⚫ Offline'}
        </div>}
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>{actions}</div>
    </div>
  );
}

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  searchBar: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  tabs: { display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  tabBtn: { flex: 'none', padding: '10px 12px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottom: '2px solid transparent', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' },
  tabActive: { color: 'var(--accent-primary)', borderBottomColor: 'var(--accent-primary)' },
  list: { flex: 1, overflowY: 'auto', padding: 8 },
  empty: { padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid var(--border)' },
  name: { fontWeight: 600, fontSize: 15, marginBottom: 2 },
  btnSm: { padding: '7px 12px', fontSize: 12, flexShrink: 0 },
  pill: { fontSize: 11, fontWeight: 700, background: 'var(--bg-card)', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 999, flexShrink: 0, whiteSpace: 'nowrap' },
};
