import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Avatar from '../components/Sidebar/Avatar';
import api from '../services/api';

export default function People() {
  const { user } = useAuth();
  const { isOnline } = useSocket();
  const [relationships, setRelationships] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState('friends'); // friends | pending | requests

  useEffect(() => {
    api.get('/api/relationships').then(res => setRelationships(res.data.relationships)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/api/relationships/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data.users);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const sendRequest = async (addresseeId) => {
    try {
      await api.post('/api/relationships/request', { addresseeId });
      setSearchResults(prev => prev.filter(u => u.id !== addresseeId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  const accept = async (id) => {
    const res = await api.patch(`/api/relationships/${id}/accept`);
    setRelationships(prev => prev.map(r => r.id === id ? { ...r, status: 'accepted' } : r));
  };

  const remove = async (id) => {
    await api.delete(`/api/relationships/${id}`);
    setRelationships(prev => prev.filter(r => r.id !== id));
  };

  const block = async (id) => {
    await api.patch(`/api/relationships/${id}/block`);
    setRelationships(prev => prev.filter(r => r.id !== id));
  };

  const friends = relationships.filter(r => r.status === 'accepted');
  const pending = relationships.filter(r => r.status === 'pending' && r.direction === 'sent');
  const incoming = relationships.filter(r => r.status === 'pending' && r.direction === 'received');

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2 style={styles.title}>People</h2>
        <input
          className="input"
          style={{ maxWidth: '300px' }}
          placeholder="Search users…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Search results */}
      {searchQuery.length >= 2 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Search Results</h3>
          {searching && <div style={styles.loading}>Searching…</div>}
          {searchResults.map(u => (
            <div key={u.id} style={styles.userRow}>
              <Avatar username={u.username} avatarUrl={u.avatar_url} size="md" online={isOnline(u.id)} />
              <div style={{ flex: 1 }}>
                <div style={styles.username}>{u.username}</div>
                <div className="text-muted">{isOnline(u.id) ? 'Online' : 'Offline'}</div>
              </div>
              <button className="btn btn-primary" onClick={() => sendRequest(u.id)} style={{ padding: '7px 14px', fontSize: '13px' }}>
                Add
              </button>
            </div>
          ))}
          {!searching && searchResults.length === 0 && searchQuery.length >= 2 && (
            <div style={styles.empty}>No users found</div>
          )}
        </div>
      )}

      {/* Tabs */}
      {!searchQuery && (
        <>
          <div style={styles.tabs}>
            {[['friends', `Friends (${friends.length})`], ['pending', `Sent (${pending.length})`], ['requests', `Requests (${incoming.length})`]].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{ ...styles.tabBtn, ...(tab === key ? styles.tabBtnActive : {}) }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={styles.list}>
            {tab === 'friends' && friends.map(rel => (
              <div key={rel.id} style={styles.userRow}>
                <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="md" online={isOnline(rel.user_id)} />
                <div style={{ flex: 1 }}>
                  <div style={styles.username}>{rel.username}</div>
                  <div className="text-muted">{isOnline(rel.user_id) ? 'Online' : 'Offline'}</div>
                </div>
                <button className="btn btn-ghost" onClick={() => block(rel.id)} style={{ padding: '7px 14px', fontSize: '12px' }}>Block</button>
                <button className="btn btn-danger" onClick={() => remove(rel.id)} style={{ padding: '7px 14px', fontSize: '12px' }}>Remove</button>
              </div>
            ))}
            {tab === 'friends' && friends.length === 0 && <div style={styles.empty}>No friends yet — search for users above!</div>}

            {tab === 'pending' && pending.map(rel => (
              <div key={rel.id} style={styles.userRow}>
                <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="md" />
                <div style={{ flex: 1 }}>
                  <div style={styles.username}>{rel.username}</div>
                  <div className="text-muted">Request pending</div>
                </div>
                <button className="btn btn-ghost" onClick={() => remove(rel.id)} style={{ padding: '7px 14px', fontSize: '12px' }}>Cancel</button>
              </div>
            ))}
            {tab === 'pending' && pending.length === 0 && <div style={styles.empty}>No pending requests</div>}

            {tab === 'requests' && incoming.map(rel => (
              <div key={rel.id} style={styles.userRow}>
                <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="md" />
                <div style={{ flex: 1 }}>
                  <div style={styles.username}>{rel.username}</div>
                  <div className="text-muted">Wants to connect</div>
                </div>
                <button className="btn btn-primary" onClick={() => accept(rel.id)} style={{ padding: '7px 14px', fontSize: '13px' }}>Accept</button>
                <button className="btn btn-danger" onClick={() => block(rel.id)} style={{ padding: '7px 14px', fontSize: '12px' }}>Block</button>
              </div>
            ))}
            {tab === 'requests' && incoming.length === 0 && <div style={styles.empty}>No incoming requests</div>}
          </div>
        </>
      )}
    </div>
  );
}

const styles = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '20px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' },
  title: { fontSize: '20px', fontWeight: '800' },
  section: { padding: '12px 16px', borderBottom: '1px solid var(--border)' },
  sectionTitle: { fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' },
  loading: { color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' },
  empty: { color: 'var(--text-muted)', fontSize: '14px', padding: '24px', textAlign: 'center' },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 8px' },
  tabBtn: { flex: 1, padding: '12px 8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', borderBottom: '2px solid transparent', transition: 'all 0.2s' },
  tabBtnActive: { color: 'var(--accent-primary)', borderBottomColor: 'var(--accent-primary)' },
  list: { flex: 1, overflowY: 'auto', padding: '8px' },
  userRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 8px', borderRadius: 'var(--radius-sm)', borderBottom: '1px solid var(--border)' },
  username: { fontWeight: '600', fontSize: '15px' },
};
