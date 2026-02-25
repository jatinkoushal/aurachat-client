import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import Avatar from '../components/Sidebar/Avatar';
import api from '../services/api';

export default function People() {
  const { isOnline } = useSocket();
  const [allUsers, setAllUsers] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, relRes] = await Promise.all([
        api.get('/api/relationships/all'),
        api.get('/api/relationships'),
      ]);
      setAllUsers(usersRes.data.users || []);
      setRelationships(relRes.data.relationships || []);
    } catch (e) {
      console.error('People loadAll error:', e);
      setError('Failed to load users. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = searchQuery.trim()
    ? allUsers.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()))
    : allUsers;

  const friends  = relationships.filter(r => r.status === 'accepted');
  const muted    = relationships.filter(r => r.status === 'muted');
  const incoming = relationships.filter(r => r.status === 'pending' && r.direction === 'received');
  const sent     = relationships.filter(r => r.status === 'pending' && r.direction === 'sent');
  const blocked  = relationships.filter(r => r.status === 'blocked');

  const sendRequest = async (addresseeId) => {
    try {
      await api.post('/api/relationships/request', { addresseeId });
      setAllUsers(prev => prev.map(u =>
        u.id === addresseeId ? { ...u, rel_status: 'pending', direction: 'sent' } : u
      ));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send request');
    }
  };

  const accept = async (relId) => {
    try { await api.patch(`/api/relationships/${relId}/accept`); await loadAll(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const remove = async (relId) => {
    try { await api.delete(`/api/relationships/${relId}`); await loadAll(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const block = async (targetUserId) => {
    try { await api.patch(`/api/relationships/${targetUserId}/block`); await loadAll(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const mute = async (relId) => {
    try { await api.patch(`/api/relationships/${relId}/mute`); await loadAll(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const unmute = async (relId) => {
    try { await api.patch(`/api/relationships/${relId}/unmute`); await loadAll(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
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
      {/* Search bar */}
      <div style={s.searchBar}>
        <span style={{ fontSize: 16 }}>🔍</span>
        <input
          className="input"
          style={{ border: 'none', background: 'transparent', flex: 1, padding: '4px 0' }}
          placeholder="Search username..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="btn-icon" onClick={() => setSearchQuery('')} style={{ fontSize: 14 }}>✕</button>
        )}
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ ...s.tabBtn, ...(tab === t.key ? s.tabActive : {}) }}>
            {t.label}
            {t.count > 0 && <span className="badge" style={{ marginLeft: 3, fontSize: 9 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={s.list}>

        {loading && (
          <div style={s.center}>
            <div className="spin" style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
            <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 13 }}>Loading users...</div>
          </div>
        )}

        {!loading && error && (
          <div style={{ ...s.center, color: 'var(--danger)' }}>
            <div>{error}</div>
            <button className="btn btn-primary" onClick={loadAll} style={{ marginTop: 12, padding: '8px 16px' }}>Retry</button>
          </div>
        )}

        {/* EVERYONE tab */}
        {!loading && !error && tab === 'all' && (
          <>
            {filtered.length === 0 && (
              <div style={s.empty}>
                {allUsers.length === 0
                  ? 'No other users registered yet'
                  : `No users matching "${searchQuery}"`}
              </div>
            )}
            {filtered.map(u => (
              <div key={u.id} style={s.row}>
                <Avatar username={u.username} avatarUrl={u.avatar_url} size="md" online={isOnline(u.id)} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={s.name}>{u.username}</div>
                  {u.bio && <div className="text-muted truncate" style={{ fontSize: 12 }}>{u.bio}</div>}
                  <div style={{ fontSize: 11, color: isOnline(u.id) ? 'var(--online-green)' : 'var(--text-muted)' }}>
                    {isOnline(u.id) ? '🟢 Online' : '⚫ Offline'}
                  </div>
                </div>
                {!u.rel_status && (
                  <button className="btn btn-primary" onClick={() => sendRequest(u.id)} style={s.btnSm}>
                    Add Friend
                  </button>
                )}
                {u.rel_status === 'pending' && u.direction === 'sent' && (
                  <span style={s.pill}>Sent ✓</span>
                )}
                {u.rel_status === 'pending' && u.direction === 'received' && (
                  <button className="btn btn-primary" onClick={() => accept(u.rel_id)} style={s.btnSm}>
                    Accept
                  </button>
                )}
                {u.rel_status === 'accepted' && (
                  <span style={{ ...s.pill, background: 'rgba(0,184,148,0.15)', color: 'var(--online-green)' }}>
                    ✓ Friends
                  </span>
                )}
                {u.rel_status === 'blocked' && (
                  <span style={{ ...s.pill, background: 'rgba(225,112,85,0.15)', color: 'var(--danger)' }}>
                    Blocked
                  </span>
                )}
                {u.rel_status === 'muted' && (
                  <span style={{ ...s.pill, color: 'var(--warning)' }}>Muted</span>
                )}
              </div>
            ))}
          </>
        )}

        {/* FRIENDS tab */}
        {!loading && !error && tab === 'friends' && (
          friends.length === 0
            ? <div style={s.empty}>No friends yet — go to Everyone tab and add some! 👆</div>
            : friends.map(r => (
              <div key={r.id} style={s.row}>
                <Avatar username={r.username} avatarUrl={r.avatar_url} size="md" online={isOnline(r.user_id)} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={s.name}>{r.username}</div>
                  {r.bio && <div className="text-muted truncate" style={{ fontSize: 12 }}>{r.bio}</div>}
                  <div style={{ fontSize: 11, color: isOnline(r.user_id) ? 'var(--online-green)' : 'var(--text-muted)' }}>
                    {isOnline(r.user_id) ? '🟢 Online' : '⚫ Offline'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-icon" title="Mute" onClick={() => mute(r.id)}>🔇</button>
                  <button className="btn-icon" title="Block" onClick={() => block(r.user_id)}>🚫</button>
                  <button className="btn-icon" title="Remove" onClick={() => remove(r.id)}>🗑️</button>
                </div>
              </div>
            ))
        )}

        {/* INCOMING REQUESTS tab */}
        {!loading && !error && tab === 'requests' && (
          incoming.length === 0
            ? <div style={s.empty}>No incoming friend requests</div>
            : incoming.map(r => (
              <div key={r.id} style={s.row}>
                <Avatar username={r.username} avatarUrl={r.avatar_url} size="md" />
                <div style={{ flex: 1 }}>
                  <div style={s.name}>{r.username}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Wants to be friends</div>
                </div>
                <button className="btn btn-primary" onClick={() => accept(r.id)} style={s.btnSm}>Accept</button>
                <button className="btn btn-danger" onClick={() => block(r.user_id)} style={{ ...s.btnSm, marginLeft: 4 }}>Block</button>
              </div>
            ))
        )}

        {/* SENT tab */}
        {!loading && !error && tab === 'sent' && (
          sent.length === 0
            ? <div style={s.empty}>No sent requests</div>
            : sent.map(r => (
              <div key={r.id} style={s.row}>
                <Avatar username={r.username} avatarUrl={r.avatar_url} size="md" />
                <div style={{ flex: 1 }}>
                  <div style={s.name}>{r.username}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Request pending...</div>
                </div>
                <button className="btn btn-ghost" onClick={() => remove(r.id)} style={s.btnSm}>Cancel</button>
              </div>
            ))
        )}

        {/* MUTED tab */}
        {!loading && !error && tab === 'muted' && (
          muted.length === 0
            ? <div style={s.empty}>No muted users</div>
            : muted.map(r => (
              <div key={r.id} style={s.row}>
                <Avatar username={r.username} avatarUrl={r.avatar_url} size="md" />
                <div style={{ flex: 1 }}>
                  <div style={s.name}>{r.username}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>🔇 Muted</div>
                </div>
                <button className="btn btn-ghost" onClick={() => unmute(r.id)} style={s.btnSm}>Unmute</button>
              </div>
            ))
        )}

        {/* BLOCKED tab */}
        {!loading && !error && tab === 'blocked' && (
          blocked.length === 0
            ? <div style={s.empty}>No blocked users</div>
            : blocked.map(r => (
              <div key={r.id} style={s.row}>
                <Avatar username={r.username} avatarUrl={r.avatar_url} size="md" />
                <div style={{ flex: 1 }}>
                  <div style={s.name}>{r.username}</div>
                  <div style={{ fontSize: 12, color: 'var(--danger)' }}>🚫 Blocked</div>
                </div>
                <button className="btn btn-ghost" onClick={() => remove(r.id)} style={s.btnSm}>Unblock</button>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

const s = {
  page:      { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  searchBar: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  tabs:      { display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', flexShrink: 0, scrollbarWidth: 'none' },
  tabBtn:    { flexShrink: 0, padding: '10px 10px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottom: '2px solid transparent', display: 'flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' },
  tabActive: { color: 'var(--accent-primary)', borderBottomColor: 'var(--accent-primary)' },
  list:      { flex: 1, overflowY: 'auto', padding: 8 },
  center:    { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' },
  empty:     { padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 },
  row:       { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid var(--border)' },
  name:      { fontWeight: 600, fontSize: 15, marginBottom: 2 },
  btnSm:     { padding: '7px 12px', fontSize: 12, flexShrink: 0 },
  pill:      { fontSize: 11, fontWeight: 700, background: 'var(--bg-card)', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 999, flexShrink: 0, whiteSpace: 'nowrap' },
};
