import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useChat } from '../hooks/useChat';
import Avatar from '../components/Sidebar/Avatar';
import api from '../services/api';

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [invites, setInvites] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('list');
  const [form, setForm] = useState({ name: '', description: '' });
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [loadErr, setLoadErr] = useState('');

  const load = async () => {
    try {
      const [g, inv, rel] = await Promise.all([
        api.get('/api/groups'),
        api.get('/api/groups/invites'),
        api.get('/api/relationships'),
      ]);
      setGroups(g.data.groups || []);
      setInvites(inv.data.invites || []);
      setFriends((rel.data.relationships || []).filter(r => r.status === 'accepted'));
      setLoadErr('');
    } catch { setLoadErr('Failed to load groups'); }
  };
  useEffect(() => { load(); }, []);

  const createGroup = async e => {
    e.preventDefault();
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('description', form.description.trim());
      selectedMembers.forEach(id => fd.append('memberIds', id));
      const res = await api.post('/api/groups', fd);
      setGroups(p => [res.data.group, ...p]);
      setView('list'); setForm({ name: '', description: '' }); setSelectedMembers([]);
    } catch (err) { alert(err.response?.data?.error || 'Failed to create group'); }
    finally { setCreating(false); }
  };

  const joinGroup = async e => {
    e.preventDefault();
    try {
      await api.post('/api/groups/join', { code: joinCode.trim() });
      await load(); setView('list'); setJoinCode('');
    } catch (err) { alert(err.response?.data?.error || 'Invalid code'); }
  };

  const acceptInvite = async id => {
    try { await api.post(`/api/groups/invites/${id}/accept`); await load(); setView('list'); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };
  const declineInvite = async id => {
    try { await api.post(`/api/groups/invites/${id}/decline`); setInvites(p => p.filter(i => i.id !== id)); }
    catch {}
  };
  const toggleMember = id => setSelectedMembers(p => p.includes(id) ? p.filter(m => m !== id) : [...p, id]);

  if (selected) {
    return <GroupChat group={selected} currentUser={user} onBack={() => { setSelected(null); load(); }} friends={friends} />;
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Groups</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-icon" onClick={() => setView(v => v === 'join' ? 'list' : 'join')}>🔗</button>
          {invites.length > 0 && (
            <button className="btn-icon" style={{ position: 'relative' }} onClick={() => setView(v => v === 'invites' ? 'list' : 'invites')}>
              🔔 <span className="badge" style={{ position: 'absolute', top: -2, right: -2, fontSize: 9, minWidth: 14, height: 14 }}>{invites.length}</span>
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setView(v => v === 'create' ? 'list' : 'create')} style={{ padding: '8px 14px', fontSize: 13 }}>
            {view === 'create' ? '✕ Cancel' : '+ New Group'}
          </button>
        </div>
      </div>

      {view === 'join' && (
        <div style={s.panel}>
          <form onSubmit={joinGroup} style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="Enter invite code" value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              style={{ flex: 1, letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase' }} />
            <button className="btn btn-primary" type="submit" disabled={!joinCode.trim()}>Join</button>
          </form>
        </div>
      )}

      {view === 'invites' && (
        <div style={s.panel}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>GROUP INVITES ({invites.length})</div>
          {invites.map(inv => (
            <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <Avatar username={inv.group_name} avatarUrl={inv.group_avatar} size="md" />
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{inv.group_name}</div><div className="text-muted">From {inv.inviter_username}</div></div>
              <button className="btn btn-primary" onClick={() => acceptInvite(inv.id)} style={{ padding: '6px 12px', fontSize: 12 }}>Join</button>
              <button className="btn btn-ghost"   onClick={() => declineInvite(inv.id)} style={{ padding: '6px 12px', fontSize: 12 }}>Decline</button>
            </div>
          ))}
        </div>
      )}

      {view === 'create' && (
        <div style={{ ...s.panel, flex: 1, overflowY: 'auto' }}>
          <form onSubmit={createGroup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={s.label}>Group Name *</label>
              <input className="input" placeholder="Min 2 chars" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required minLength={2} /></div>
            <div><label style={s.label}>Description (optional)</label>
              <input className="input" placeholder="What's this group about?" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
            {friends.length > 0 ? (
              <div>
                <label style={s.label}>Add Friends ({selectedMembers.length} selected)</label>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  {friends.map(rel => (
                    <div key={rel.user_id} onClick={() => toggleMember(rel.user_id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', background: selectedMembers.includes(rel.user_id) ? 'var(--bg-hover)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                      <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="sm" />
                      <span style={{ flex: 1, fontSize: 14 }}>{rel.username}</span>
                      <span style={{ color: selectedMembers.includes(rel.user_id) ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 800 }}>{selectedMembers.includes(rel.user_id) ? '✓' : '+'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)' }}>💡 Add friends first to include them.</div>}
            <button className="btn btn-primary" type="submit" disabled={creating || form.name.trim().length < 2} style={{ padding: 12, fontSize: 15 }}>
              {creating ? '⏳ Creating...' : '🚀 Create Group'}
            </button>
          </form>
        </div>
      )}

      {view === 'list' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {loadErr && <div style={{ color: 'var(--danger)', padding: 12 }}>{loadErr} <button className="btn btn-ghost" onClick={load} style={{ marginLeft: 8, padding: '4px 10px', fontSize: 12 }}>Retry</button></div>}
          {groups.length === 0 && !loadErr && (
            <div style={s.empty}><div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div><div style={{ fontWeight: 600 }}>No groups yet</div><div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Create or join a group to get started</div></div>
          )}
          {groups.map(g => (
            <div key={g.id} onClick={() => setSelected(g)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Avatar username={g.name} avatarUrl={g.avatar_url} size="md" />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{g.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.description || `${g.member_count} members`}</div>
              </div>
              {g.admin_id === user?.id && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent-primary)', color: '#fff', padding: '2px 8px', borderRadius: 999, flexShrink: 0 }}>Admin</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupChat({ group, currentUser, onBack, friends }) {
  const { messages, loading, sendMessage, editMessage, deleteMessage, emitTyping, typing } = useChat(group.id, true);
  const [input, setInput] = useState('');
  const [details, setDetails] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: group.name, description: group.description || '' });
  const [editAvatar, setEditAvatar] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const bottomRef = useRef();
  const editFileRef = useRef();
  const editMsgRef = useRef();

  const isAdmin = details?.group?.admin_id === currentUser.id;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  const loadDetails = () => api.get(`/api/groups/${group.id}`).then(res => setDetails(res.data)).catch(() => {});
  useEffect(() => { loadDetails(); }, [group.id]);

  useEffect(() => {
    const h = e => setContextMenu(null);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { if (editingMsgId) setTimeout(() => editMsgRef.current?.focus(), 50); }, [editingMsgId]);

  const send = e => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim()); setInput('');
  };

  const inviteFriend = async friendId => {
    try { await api.post(`/api/groups/${group.id}/invite`, { inviteeId: friendId }); alert('✅ Invite sent!'); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const removeMember = async memberId => {
    if (!window.confirm('Remove this member?')) return;
    try { await api.delete(`/api/groups/${group.id}/members/${memberId}`); loadDetails(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const leaveGroup = async () => {
    if (!window.confirm('Leave this group?')) return;
    try { await api.delete(`/api/groups/${group.id}/leave`); onBack(); }
    catch (err) { alert(err.response?.data?.error || 'Failed'); }
  };

  const saveGroupEdits = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      if (editForm.name.trim()) fd.append('name', editForm.name.trim());
      fd.append('description', editForm.description);
      if (editAvatar) fd.append('avatar', editAvatar);
      await api.patch(`/api/groups/${group.id}`, fd);
      await loadDetails(); setEditMode(false); setEditAvatar(null);
    } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const submitMsgEdit = () => {
    if (!editingText.trim()) { setEditingMsgId(null); return; }
    editMessage(editingMsgId, editingText.trim());
    setEditingMsgId(null);
  };

  const handleMsgDelete = msgId => {
    if (!window.confirm('Delete this message?')) return;
    deleteMessage(msgId); setContextMenu(null);
  };

  const notInGroup = friends.filter(f => !details?.members?.find(m => m.id === f.user_id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <Avatar username={group.name} avatarUrl={details?.group?.avatar_url || group.avatar_url} size="sm" />
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setShowInfo(p => !p); setEditMode(false); }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{details?.group?.name || group.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{typing ? '✏️ typing...' : `${details?.members?.length || 0} members • tap for info`}</div>
        </div>
        <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={leaveGroup} title="Leave group">🚪</button>
        {details?.group?.invite_code && (
          <button className="btn-icon" onClick={() => { navigator.clipboard.writeText(details.group.invite_code); alert(`Code: ${details.group.invite_code}`); }}>🔗</button>
        )}
      </div>

      {showInfo && details && (
        <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', padding: 14, maxHeight: 320, overflowY: 'auto', flexShrink: 0 }}>
          {isAdmin && !editMode && (
            <button className="btn btn-ghost" onClick={() => setEditMode(true)} style={{ marginBottom: 12, padding: '6px 14px', fontSize: 12, width: '100%' }}>✏️ Edit Group</button>
          )}
          {isAdmin && editMode && (
            <div style={{ marginBottom: 14, padding: 12, background: 'var(--bg-card)', borderRadius: 10 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => editFileRef.current?.click()}>
                  <Avatar username={editForm.name} avatarUrl={editAvatar ? URL.createObjectURL(editAvatar) : details.group?.avatar_url} size="md" />
                  <span style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--accent-primary)', borderRadius: '50%', width: 16, height: 16, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📷</span>
                  <input ref={editFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setEditAvatar(e.target.files[0] || null)} />
                </div>
                <input className="input" value={editForm.name} style={{ flex: 1 }} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} placeholder="Group name" />
              </div>
              <input className="input" value={editForm.description} style={{ marginBottom: 10 }} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} placeholder="Description" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={saveGroupEdits} disabled={saving} style={{ flex: 1, padding: 8 }}>{saving ? 'Saving...' : '💾 Save'}</button>
                <button className="btn btn-ghost" onClick={() => setEditMode(false)} style={{ padding: '8px 14px' }}>Cancel</button>
              </div>
            </div>
          )}
          {details.group?.invite_code && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, padding: '6px 10px', background: 'var(--bg-card)', borderRadius: 6 }}>
              Code: <strong style={{ color: 'var(--accent-secondary)', letterSpacing: 2 }}>{details.group.invite_code}</strong>
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>MEMBERS ({details.members?.length})</div>
          {details.members?.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <Avatar username={m.username} avatarUrl={m.avatar_url} size="sm" online={m.is_online} />
              <span style={{ flex: 1, fontSize: 13 }}>{m.username}</span>
              {m.role === 'admin' && <span style={{ fontSize: 10, background: 'var(--accent-primary)', color: '#fff', padding: '1px 6px', borderRadius: 999 }}>Admin</span>}
              {isAdmin && m.id !== currentUser.id && (
                <button className="btn-icon" style={{ fontSize: 14, color: 'var(--danger)' }} onClick={() => removeMember(m.id)}>✕</button>
              )}
            </div>
          ))}
          {notInGroup.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', margin: '12px 0 8px' }}>INVITE FRIENDS</div>
              {notInGroup.map(f => (
                <div key={f.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                  <Avatar username={f.username} avatarUrl={f.avatar_url} size="sm" />
                  <span style={{ flex: 1, fontSize: 13 }}>{f.username}</span>
                  <button className="btn btn-primary" onClick={() => inviteFriend(f.user_id)} style={{ padding: '4px 10px', fontSize: 11 }}>Invite</button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }} onClick={() => setContextMenu(null)}>
        {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>}
        {!loading && messages.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40, fontSize: 14 }}>No messages yet. Say something! 👋</div>}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === currentUser.id;
          const isEditing = editingMsgId === msg.id;
          return (
            <div key={msg.id || i}
              style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6 }}
              onContextMenu={e => {
                if (!isMe || msg.deleted || msg.msg_type === 'call') return;
                e.preventDefault();
                setContextMenu({ msgId: msg.id, msg, x: e.clientX, y: e.clientY });
              }}
              onTouchStart={e => {
                if (!isMe || msg.deleted || msg.msg_type === 'call') return;
                const touch = e.touches[0];
                const t = setTimeout(() => {
                  setContextMenu({ msgId: msg.id, msg, x: touch.clientX, y: touch.clientY });
                }, 600);
                e.currentTarget._pressTimer = t;
              }}
              onTouchEnd={e => { clearTimeout(e.currentTarget._pressTimer); }}
              onTouchMove={e => { clearTimeout(e.currentTarget._pressTimer); }}>
              {!isMe && <Avatar username={msg.username} avatarUrl={msg.avatar_url} size="sm" />}
              <div style={{ maxWidth: '65%' }}>
                {!isMe && <div style={{ fontSize: 11, color: 'var(--accent-secondary)', fontWeight: 600, marginBottom: 2 }}>{msg.username}</div>}
                {isEditing ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input ref={editMsgRef} className="input" value={editingText}
                      onChange={e => setEditingText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') submitMsgEdit(); if (e.key === 'Escape') setEditingMsgId(null); }}
                      style={{ borderRadius: 20 }} />
                    <button className="btn btn-primary" onClick={submitMsgEdit} style={{ padding: '8px 12px', fontSize: 12 }}>Save</button>
                    <button className="btn btn-ghost" onClick={() => setEditingMsgId(null)} style={{ padding: '8px 10px', fontSize: 12 }}>✕</button>
                  </div>
                ) : (
                  <div className="msg-bubble" style={{ background: isMe ? 'var(--accent-primary)' : 'var(--bg-card)', padding: '10px 14px', borderRadius: 16, borderBottomRightRadius: isMe ? 4 : 16, borderBottomLeftRadius: isMe ? 16 : 4, opacity: msg.deleted ? .65 : 1, maxWidth: '65%' }}>
                    <div style={{ fontSize: 14, wordBreak: 'break-word', fontStyle: msg.deleted ? 'italic' : 'normal', color: msg.deleted ? 'var(--text-muted)' : 'inherit' }}>{msg.content}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', textAlign: 'right', marginTop: 3, display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {msg.edited && !msg.deleted && <span style={{ opacity: .6 }}>edited</span>}
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, zIndex: 500, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
          <button onClick={() => { setEditingMsgId(contextMenu.msgId); setEditingText(contextMenu.msg.content); setContextMenu(null); }}
            style={{ display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--text-primary)', borderRadius: 6 }}>
            ✏️ Edit message
          </button>
          <button onClick={() => handleMsgDelete(contextMenu.msgId)}
            style={{ display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--danger)', borderRadius: 6 }}>
            🗑️ Delete message
          </button>
        </div>
      )}

      <form onSubmit={send} style={{ display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <input className="input" style={{ flex: 1, borderRadius: 24 }} placeholder="Message group…" value={input}
          onChange={e => { setInput(e.target.value); emitTyping(true); }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) send(e); }} />
        <button className="btn btn-primary" type="submit" disabled={!input.trim()} style={{ padding: '10px 20px' }}>Send</button>
      </form>
    </div>
  );
}

const s = {
  page:   { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 },
  panel:  { padding: 16, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 },
  empty:  { padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 },
  label:  { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
};
