import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import Avatar from '../components/Sidebar/Avatar';
import api from '../services/api';

export default function People() {
  const { isOnline } = useSocket();
  const [relationships, setRelationships] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState('friends');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/relationships').then(res => {
      setRelationships(res.data.relationships);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/api/relationships/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data.users);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const sendRequest = async (addresseeId) => {
    try {
      await api.post('/api/relationships/request', { addresseeId });
      setSearchResults(prev => prev.map(u => u.id === addresseeId
        ? { ...u, rel_status: 'pending', direction: 'sent' } : u));
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const accept = async (id) => {
    await api.patch(`/api/relationships/${id}/accept`);
    const res = await api.get('/api/relationships');
    setRelationships(res.data.relationships);
  };

  const remove = async (id) => {
    await api.delete(`/api/relationships/${id}`);
    setRelationships(prev => prev.filter(r => r.id !== id));
  };

  const block = async (relId, userId) => {
    if (relId) {
      await api.patch(`/api/relationships/${relId}/block`);
      setRelationships(prev => prev.filter(r => r.id !== relId));
    } else {
      await api.patch(`/api/relationships/${userId}/block`);
    }
    setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, rel_status: 'blocked' } : u));
  };

  const mute = async (id) => {
    await api.patch(`/api/relationships/${id}/mute`);
    setRelationships(prev => prev.map(r => r.id === id ? { ...r, status: 'muted' } : r));
  };

  const unmute = async (id) => {
    await api.patch(`/api/relationships/${id}/unmute`);
    setRelationships(prev => prev.map(r => r.id === id ? { ...r, status: 'accepted' } : r));
  };

  const friends = relationships.filter(r => r.status === 'accepted');
  const muted = relationships.filter(r => r.status === 'muted');
  const pending = relationships.filter(r => r.status === 'pending' && r.direction === 'sent');
  const incoming = relationships.filter(r => r.status === 'pending' && r.direction === 'received');
  const blocked = relationships.filter(r => r.status === 'blocked');

  const tabs = [
    { key: 'friends', label: 'Friends', count: friends.length },
    { key: 'requests', label: 'Requests', count: incoming.length },
    { key: 'pending', label: 'Sent', count: pending.length },
    { key: 'muted', label: 'Muted', count: muted.length },
    { key: 'blocked', label: 'Blocked', count: blocked.length },
  ];

  return (
    <div style={s.page}>
      {/* Search bar */}
      <div style={s.searchBar}>
        <span style={{ fontSize: 18 }}>🔍</span>
        <input
          className="input"
          style={{ border: 'none', background: 'transparent', flex: 1, padding: '4px 0' }}
          placeholder="Search username..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && <button className="btn-icon" onClick={() => setSearchQuery('')}>✕</button>}
      </div>

      {/* Search results */}
      {searchQuery ? (
        <div style={s.list}>
          {searching && <div style={s.empty}>Searching...</div>}
          {!searching && searchResults.length === 0 && <div style={s.empty}>No users found for "{searchQuery}"</div>}
          {searchResults.map(u => (
            <div key={u.id} style={s.userRow}>
              <Avatar username={u.username} avatarUrl={u.avatar_url} size="md" online={isOnline(u.id)} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={s.username}>{u.username}</div>
                {u.bio && <div className="text-muted truncate">{u.bio}</div>}
                <div className="text-muted">{isOnline(u.id) ? '🟢 Online' : '⚫ Offline'}</div>
              </div>
              {!u.rel_status && (
                <button className="btn btn-primary" onClick={() => sendRequest(u.id)} style={s.btnSm}>Add</button>
              )}
              {u.rel_status === 'pending' && u.direction === 'sent' && (
                <span style={s.pill}>Sent</span>
              )}
              {u.rel_status === 'pending' && u.direction === 'received' && (
                <button className="btn btn-primary" onClick={() => accept(u.rel_id)} style={s.btnSm}>Accept</button>
              )}
              {u.rel_status === 'accepted' && <span style={{ ...s.pill, background: 'var(--online-green)' }}>Friends</span>}
              {u.rel_status === 'blocked' && <span style={{ ...s.pill, background: 'var(--danger)' }}>Blocked</span>}
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={s.tabs}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ ...s.tabBtn, ...(tab === t.key ? s.tabActive : {}) }}>
                {t.label}
                {t.count > 0 && <span className="badge" style={{ marginLeft: 4 }}>{t.count}</span>}
              </button>
            ))}
          </div>

          <div style={s.list}>
            {/* Friends */}
            {tab === 'friends' && (loading ? <div style={s.empty}>Loading...</div> :
              friends.length === 0 ? <div style={s.empty}>No friends yet — search for users above! 👆</div> :
              friends.map(rel => (
                <div key={rel.id} style={s.userRow}>
                  <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="md" online={isOnline(rel.user_id)} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={s.username}>{rel.username}</div>
                    {rel.bio && <div className="text-muted truncate">{rel.bio}</div>}
                    <div className="text-muted">{isOnline(rel.user_id) ? '🟢 Online' : '⚫ Offline'}</div>
                  </div>
                  <button className="btn-icon" title="Mute" onClick={() => mute(rel.id)}>🔇</button>
                  <button className="btn-icon" title="Block" onClick={() => block(rel.id, rel.user_id)}>🚫</button>
                  <button className="btn-icon" title="Remove" onClick={() => remove(rel.id)}>🗑️</button>
                </div>
              ))
            )}

            {/* Incoming requests */}
            {tab === 'requests' && (incoming.length === 0 ? <div style={s.empty}>No incoming requests</div> :
              incoming.map(rel => (
                <div key={rel.id} style={s.userRow}>
                  <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="md" />
                  <div style={{ flex: 1 }}>
                    <div style={s.username}>{rel.username}</div>
                    <div className="text-muted">Wants to connect</div>
                  </div>
                  <button className="btn btn-primary" onClick={() => accept(rel.id)} style={s.btnSm}>Accept</button>
                  <button className="btn btn-danger" onClick={() => block(rel.id, rel.user_id)} style={s.btnSm}>Block</button>
                </div>
              ))
            )}

            {/* Sent requests */}
            {tab === 'pending' && (pending.length === 0 ? <div style={s.empty}>No sent requests</div> :
              pending.map(rel => (
                <div key={rel.id} style={s.userRow}>
                  <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="md" />
                  <div style={{ flex: 1 }}>
                    <div style={s.username}>{rel.username}</div>
                    <div className="text-muted">Request pending...</div>
                  </div>
                  <button className="btn btn-ghost" onClick={() => remove(rel.id)} style={s.btnSm}>Cancel</button>
                </div>
              ))
            )}

            {/* Muted */}
            {tab === 'muted' && (muted.length === 0 ? <div style={s.empty}>No muted users</div> :
              muted.map(rel => (
                <div key={rel.id} style={s.userRow}>
                  <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="md" />
                  <div style={{ flex: 1 }}>
                    <div style={s.username}>{rel.username}</div>
                    <div className="text-muted">Muted</div>
                  </div>
                  <button className="btn btn-ghost" onClick={() => unmute(rel.id)} style={s.btnSm}>Unmute</button>
                </div>
              ))
            )}

            {/* Blocked */}
            {tab === 'blocked' && (blocked.length === 0 ? <div style={s.empty}>No blocked users</div> :
              blocked.map(rel => (
                <div key={rel.id} style={s.userRow}>
                  <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="md" />
                  <div style={{ flex: 1 }}>
                    <div style={s.username}>{rel.username}</div>
                    <div className="text-muted">Blocked</div>
                  </div>
                  <button className="btn btn-ghost" onClick={() => remove(rel.id)} style={s.btnSm}>Unblock</button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' },
  searchBar: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' },
  tabBtn: { flex: 1, minWidth: 80, padding: '12px 6px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottom: '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, whiteSpace: 'nowrap' },
  tabActive: { color: 'var(--accent-primary)', borderBottomColor: 'var(--accent-primary)' },
  list: { flex: 1, overflowY: 'auto', padding: 8 },
  empty: { padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 },
  userRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' },
  username: { fontWeight: 600, fontSize: 15, marginBottom: 2 },
  btnSm: { padding: '7px 14px', fontSize: 12, flexShrink: 0 },
  pill: { fontSize: 11, fontWeight: 700, background: 'var(--bg-card)', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 999, flexShrink: 0 },
};
