import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import Avatar from '../components/Sidebar/Avatar';
import api from '../services/api';

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get('/api/groups').then(res => setGroups(res.data.groups)).catch(() => {});
    api.get('/api/relationships').then(res =>
      setFriends(res.data.relationships.filter(r => r.status === 'accepted'))
    ).catch(() => {});
  }, []);

  const createGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/api/groups', {
        name: newGroupName,
        memberIds: selectedMembers,
      });
      setGroups(prev => [res.data.group, ...prev]);
      setShowCreate(false);
      setNewGroupName('');
      setSelectedMembers([]);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const toggleMember = (id) => {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>Groups</h2>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ padding: '7px 14px', fontSize: '13px' }}>
            + New
          </button>
        </div>

        <div style={styles.list}>
          {groups.length === 0 && <div style={styles.empty}>No groups yet</div>}
          {groups.map(g => (
            <div
              key={g.id}
              onClick={() => setSelected(g)}
              style={{ ...styles.groupItem, ...(selected?.id === g.id ? styles.groupItemActive : {}) }}
            >
              <Avatar username={g.name} avatarUrl={g.avatar_url} size="md" />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={styles.groupName}>{g.name}</div>
                <div className="text-muted">{g.member_count} members</div>
              </div>
              {g.admin_id === user.id && <span style={styles.adminBadge}>Admin</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={styles.chatArea}>
        {selected
          ? <GroupChatWindow key={selected.id} group={selected} currentUser={user} />
          : <div style={styles.placeholder}>
              <div style={{ fontSize: '48px' }}>🏠</div>
              <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Select a group to start chatting</p>
            </div>
        }
      </div>

      {/* Create group modal */}
      {showCreate && (
        <div style={styles.overlay}>
          <div style={styles.modal} className="fade-in">
            <h3 style={{ marginBottom: '20px', fontSize: '18px' }}>Create Group</h3>
            <form onSubmit={createGroup} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                className="input"
                placeholder="Group name"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                required
              />
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Add friends</p>
                {friends.map(rel => (
                  <div
                    key={rel.user_id}
                    onClick={() => toggleMember(rel.user_id)}
                    style={{
                      ...styles.memberRow,
                      background: selectedMembers.includes(rel.user_id) ? 'var(--bg-hover)' : 'transparent',
                    }}
                  >
                    <Avatar username={rel.username} size="sm" />
                    <span style={{ flex: 1, fontSize: '14px' }}>{rel.username}</span>
                    {selectedMembers.includes(rel.user_id) && <span style={{ color: 'var(--accent-primary)' }}>✓</span>}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-ghost w-full" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary w-full" disabled={creating}>
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupChatWindow({ group, currentUser }) {
  const { messages, loading, sendMessage, emitTyping, typing } = useChat(group.id, true);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div style={styles.chatWindow}>
      <div style={styles.chatHeader}>
        <Avatar username={group.name} avatarUrl={group.avatar_url} size="sm" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', fontSize: '15px' }}>{group.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {typing ? 'Someone is typing…' : `${group.member_count} members`}
          </div>
        </div>
      </div>

      <div style={styles.messages}>
        {loading && <div style={styles.loadingText}>Loading messages…</div>}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === currentUser.id;
          return (
            <div key={msg.id || i} style={{ ...styles.msgRow, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              {!isMe && <Avatar username={msg.username} size="sm" />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                {!isMe && <span style={{ fontSize: '11px', color: 'var(--accent-secondary)', fontWeight: '600' }}>{msg.username}</span>}
                <div style={{
                  ...styles.bubble,
                  background: isMe ? 'var(--accent-primary)' : 'var(--bg-card)',
                  borderBottomRightRadius: isMe ? '4px' : '16px',
                  borderBottomLeftRadius: isMe ? '16px' : '4px',
                }}>
                  <span style={{ fontSize: '14px' }}>{msg.content}</span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={styles.inputRow}>
        <input
          className="input"
          style={{ flex: 1, borderRadius: '24px' }}
          placeholder="Type a message…"
          value={input}
          onChange={e => { setInput(e.target.value); emitTyping(true); }}
        />
        <button className="btn btn-primary" type="submit" disabled={!input.trim()} style={{ padding: '10px 20px' }}>
          Send
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: { display: 'flex', width: '100%', height: '100%', overflow: 'hidden' },
  sidebar: { width: '280px', flexShrink: 0, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' },
  sidebarHeader: { padding: '20px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sidebarTitle: { fontSize: '20px', fontWeight: '800' },
  list: { flex: 1, overflowY: 'auto', padding: '8px' },
  empty: { padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' },
  groupItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background 0.15s' },
  groupItemActive: { background: 'var(--bg-card)' },
  groupName: { fontWeight: '600', fontSize: '14px' },
  adminBadge: { fontSize: '10px', background: 'var(--accent-primary)', color: '#fff', padding: '2px 8px', borderRadius: '999px', fontWeight: '700' },
  chatArea: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  placeholder: { textAlign: 'center' },
  chatWindow: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%' },
  chatHeader: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' },
  messages: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  loadingText: { textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: '8px' },
  bubble: { maxWidth: '65%', padding: '10px 14px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '4px' },
  inputRow: { display: 'flex', gap: '10px', padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' },
  modal: { background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '28px', width: '100%', maxWidth: '400px', maxHeight: '80vh', overflowY: 'auto' },
  memberRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background 0.15s' },
};
