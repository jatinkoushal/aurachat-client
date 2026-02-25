import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import Avatar from '../components/Sidebar/Avatar';
import api from '../services/api';

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [invites, setInvites] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('list'); // list | create | invites | join
  const [form, setForm] = useState({ name: '', description: '' });
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const load = async () => {
    const [g, inv, rel] = await Promise.all([
      api.get('/api/groups'),
      api.get('/api/groups/invites'),
      api.get('/api/relationships'),
    ]);
    setGroups(g.data.groups);
    setInvites(inv.data.invites);
    setFriends(rel.data.relationships.filter(r => r.status === 'accepted'));
  };

  useEffect(() => { load(); }, []);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const createGroup = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('description', form.description);
      selectedMembers.forEach(id => fd.append('memberIds[]', id));
      if (avatar) fd.append('avatar', avatar);
      const res = await api.post('/api/groups', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setGroups(prev => [res.data.group, ...prev]);
      setView('list');
      setForm({ name: '', description: '' });
      setSelectedMembers([]);
      setAvatar(null);
      setAvatarPreview(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create group');
    } finally { setLoading(false); }
  };

  const joinGroup = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/groups/join', { code: joinCode });
      await load();
      setView('list');
      setJoinCode('');
    } catch (err) { alert(err.response?.data?.error || 'Invalid code'); }
  };

  const acceptInvite = async (inviteId) => {
    await api.post(`/api/groups/invites/${inviteId}/accept`);
    await load();
    setView('list');
  };

  const declineInvite = async (inviteId) => {
    await api.post(`/api/groups/invites/${inviteId}/decline`);
    setInvites(prev => prev.filter(i => i.id !== inviteId));
  };

  const toggleMember = (id) =>
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  if (selected) {
    return <GroupChat group={selected} currentUser={user} onBack={() => setSelected(null)} onRefresh={load} friends={friends} />;
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Groups</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-icon" title="Join by code" onClick={() => setView(view === 'join' ? 'list' : 'join')}>🔗</button>
          {invites.length > 0 && (
            <button className="btn-icon" title="Invites" onClick={() => setView(view === 'invites' ? 'list' : 'invites')} style={{ position: 'relative' }}>
              🔔<span className="badge" style={{ position: 'absolute', top: 0, right: 0, fontSize: 9, minWidth: 14, height: 14 }}>{invites.length}</span>
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setView(view === 'create' ? 'list' : 'create')} style={{ padding: '7px 14px', fontSize: 13 }}>
            {view === 'create' ? '✕ Cancel' : '+ New'}
          </button>
        </div>
      </div>

      {/* Join by code */}
      {view === 'join' && (
        <div style={s.panel}>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>Enter the group invite code to join</p>
          <form onSubmit={joinGroup} style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="Enter code e.g. AB12CD34" value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())} style={{ flex: 1, letterSpacing: 2, fontWeight: 700 }} />
            <button className="btn btn-primary" type="submit" disabled={!joinCode.trim()}>Join</button>
          </form>
        </div>
      )}

      {/* Invites */}
      {view === 'invites' && (
        <div style={s.panel}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>GROUP INVITES</h3>
          {invites.length === 0 && <div style={s.empty}>No pending invites</div>}
          {invites.map(inv => (
            <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <Avatar username={inv.group_name} avatarUrl={inv.group_avatar} size="md" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{inv.group_name}</div>
                <div className="text-muted">Invited by {inv.inviter_username}</div>
              </div>
              <button className="btn btn-primary" onClick={() => acceptInvite(inv.id)} style={{ padding: '6px 12px', fontSize: 12 }}>Join</button>
              <button className="btn btn-ghost" onClick={() => declineInvite(inv.id)} style={{ padding: '6px 12px', fontSize: 12 }}>Decline</button>
            </div>
          ))}
        </div>
      )}

      {/* Create group form */}
      {view === 'create' && (
        <div style={s.panel}>
          <form onSubmit={createGroup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Avatar picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div onClick={() => fileRef.current?.click()} style={{ cursor: 'pointer', position: 'relative' }}>
                <Avatar username={form.name || 'G'} avatarUrl={avatarPreview} size="lg" />
                <span style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--accent-primary)', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>📷</span>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              <div style={{ flex: 1 }}>
                <input className="input" placeholder="Group name *" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
            </div>
            <input className="input" placeholder="Description (optional)" value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            {/* Add friends */}
            {friends.length > 0 && (
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Add friends to group</p>
                <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {friends.map(rel => (
                    <div key={rel.user_id} onClick={() => toggleMember(rel.user_id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px', borderRadius: 'var(--radius-sm)', background: selectedMembers.includes(rel.user_id) ? 'var(--bg-hover)' : 'transparent', cursor: 'pointer' }}>
                      <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="sm" />
                      <span style={{ flex: 1, fontSize: 14 }}>{rel.username}</span>
                      {selectedMembers.includes(rel.user_id) && <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading || !form.name.trim()}>
              {loading ? 'Creating...' : '🚀 Create Group'}
            </button>
          </form>
        </div>
      )}

      {/* Groups list */}
      {view === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {groups.length === 0 && (
            <div style={s.empty}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
              <div>No groups yet</div>
              <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text-muted)' }}>Create one or join with a code</div>
            </div>
          )}
          {groups.map(g => (
            <div key={g.id} onClick={() => setSelected(g)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Avatar username={g.name} avatarUrl={g.avatar_url} size="md" />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{g.name}</div>
                <div className="text-muted truncate">{g.description || `${g.member_count} members`}</div>
              </div>
              {g.admin_id === user.id && (
                <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent-primary)', color: '#fff', padding: '2px 8px', borderRadius: 999 }}>Admin</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupChat({ group, currentUser, onBack, onRefresh, friends }) {
  const { messages, loading, sendMessage, emitTyping, typing } = useChat(group.id, true);
  const [input, setInput] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [details, setDetails] = useState(null);
  const [inviteId, setInviteId] = useState('');
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    api.get(`/api/groups/${group.id}`).then(res => setDetails(res.data)).catch(() => {});
  }, [group.id]);

  const send = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const inviteFriend = async (friendId) => {
    try {
      await api.post(`/api/groups/${group.id}/invite`, { inviteeId: friendId });
      alert('Invite sent!');
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const notInGroup = friends.filter(f => !details?.members?.find(m => m.id === f.user_id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <Avatar username={group.name} avatarUrl={group.avatar_url} size="sm" />
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setShowInfo(!showInfo)}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{group.name}</div>
          <div className="text-muted">{typing ? 'Someone typing...' : `${details?.members?.length || 0} members`}</div>
        </div>
        {/* Share invite code */}
        {group.admin_id === currentUser.id && details?.group?.invite_code && (
          <button className="btn-icon" title={`Invite code: ${details.group.invite_code}`}
            onClick={() => { navigator.clipboard.writeText(details.group.invite_code); alert(`Code copied: ${details.group.invite_code}`); }}>
            🔗
          </button>
        )}
        <button className="btn-icon" onClick={() => setShowInfo(!showInfo)}>ℹ️</button>
      </div>

      {/* Group info panel */}
      {showInfo && details && (
        <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', padding: 16, maxHeight: 260, overflowY: 'auto' }}>
          {details.group?.description && <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>{details.group.description}</p>}
          {details.group?.invite_code && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Invite code: <strong style={{ color: 'var(--accent-secondary)', letterSpacing: 2 }}>{details.group.invite_code}</strong>
            </div>
          )}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>MEMBERS ({details.members?.length})</div>
          {details.members?.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
              <Avatar username={m.username} avatarUrl={m.avatar_url} size="sm" online={m.is_online} />
              <span style={{ flex: 1, fontSize: 14 }}>{m.username}</span>
              {m.role === 'admin' && <span style={{ fontSize: 10, background: 'var(--accent-primary)', color: '#fff', padding: '2px 6px', borderRadius: 999 }}>Admin</span>}
            </div>
          ))}
          {/* Invite friends */}
          {notInGroup.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: '12px 0 8px' }}>INVITE FRIENDS</div>
              {notInGroup.map(f => (
                <div key={f.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                  <Avatar username={f.username} avatarUrl={f.avatar_url} size="sm" />
                  <span style={{ flex: 1, fontSize: 14 }}>{f.username}</span>
                  <button className="btn btn-primary" onClick={() => inviteFriend(f.user_id)} style={{ padding: '4px 10px', fontSize: 11 }}>Invite</button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === currentUser.id;
          return (
            <div key={msg.id || i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
              {!isMe && <Avatar username={msg.username} avatarUrl={msg.avatar_url} size="sm" />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '65%' }}>
                {!isMe && <span style={{ fontSize: 11, color: 'var(--accent-secondary)', fontWeight: 600 }}>{msg.username}</span>}
                <div style={{ background: isMe ? 'var(--accent-primary)' : 'var(--bg-card)', padding: '10px 14px', borderRadius: 16, borderBottomRightRadius: isMe ? 4 : 16, borderBottomLeftRadius: isMe ? 16 : 4 }}>
                  <span style={{ fontSize: 14 }}>{msg.content}</span>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'right', marginTop: 3 }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} style={{ display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <input className="input" style={{ flex: 1, borderRadius: 24 }} placeholder="Message..."
          value={input} onChange={e => { setInput(e.target.value); emitTyping(true); }} />
        <button className="btn btn-primary" type="submit" disabled={!input.trim()} style={{ padding: '10px 20px' }}>Send</button>
      </form>
    </div>
  );
}

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' },
  panel: { padding: 16, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' },
  empty: { padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 },
};
