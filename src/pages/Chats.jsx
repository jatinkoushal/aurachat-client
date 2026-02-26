import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useChat } from '../hooks/useChat';
import Avatar from '../components/Sidebar/Avatar';
import WebRTCCall from '../components/VideoCall/WebRTCCall';
import api from '../services/api';

export default function Chats() {
  const { user }                       = useAuth();
  const { isOnline, socket, onlineUsers } = useSocket();
  const [friends,    setFriends]       = useState([]);
  const [selected,   setSelected]      = useState(null);
  const [activeCall, setActiveCall]    = useState(null);
  // unreadMap: { [userId]: count }
  const [unreadMap,  setUnreadMap]     = useState({});

  const loadFriends = useCallback(() => {
    api.get('/api/relationships')
      .then(res => setFriends(
        (res.data.relationships || []).filter(r => r.status === 'accepted' || r.status === 'muted')
      ))
      .catch(() => {});
  }, []);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  // Track unread: increment when a message arrives for a non-selected conversation
  useEffect(() => {
    if (!socket) return;
    const onMsg = (msg) => {
      if (msg.sender_id === user?.id) return; // ignore own
      if (msg.msg_type === 'call') return;    // ignore call logs
      const fromId = msg.sender_id;
      // Only count as unread if this chat is NOT currently open
      if (selected?.user_id !== fromId) {
        setUnreadMap(prev => ({ ...prev, [fromId]: (prev[fromId] || 0) + 1 }));
      }
    };
    socket.on('message:receive', onMsg);
    return () => socket.off('message:receive', onMsg);
  }, [socket, user, selected]);

  const startCall = useCallback((callType) => {
    if (!selected || !socket) return;
    socket.emit('call:initiate', { to: selected.user_id, callType });
    setActiveCall({ peerId: selected.user_id, peerUsername: selected.username, callType });
  }, [selected, socket]);

  const selectFriend = (rel) => {
    setSelected(rel);
    // Clear unread badge for this friend
    setUnreadMap(prev => { const n = { ...prev }; delete n[rel.user_id]; return n; });
  };

  if (activeCall) {
    return (
      <WebRTCCall
        peerId={activeCall.peerId}
        peerUsername={activeCall.peerUsername}
        callType={activeCall.callType}
        isCaller={true}
        onClose={() => setActiveCall(null)}
      />
    );
  }

  return (
    <div style={st.root}>
      {/* Sidebar */}
      <div style={{ ...st.sidebar, display: selected ? 'none' : 'flex' }} className="chat-sidebar chat-sidebar-desktop">
        <div style={st.sidebarHead}>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Chats</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{friends.length}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          {friends.length === 0 && (
            <div style={st.empty}>
              <div style={{ fontSize: 36 }}>💬</div>
              <div style={{ marginTop: 8 }}>No friends yet</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Add friends in People tab</div>
            </div>
          )}
          {friends.map(rel => {
            const online  = isOnline(rel.user_id);
            const unread  = unreadMap[rel.user_id] || 0;
            const isOpen  = selected?.user_id === rel.user_id;
            return (
              <div key={rel.id} onClick={() => selectFriend(rel)}
                style={{ ...st.friendRow, background: isOpen ? 'var(--bg-card)' : 'transparent' }}>
                <div style={{ position: 'relative' }}>
                  <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="md" online={online} />
                  {unread > 0 && (
                    <span style={st.unreadBadge}>{unread > 99 ? '99+' : unread}</span>
                  )}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ ...st.friendName, fontWeight: unread > 0 ? 800 : 600 }}>{rel.username}</div>
                  <div style={{ fontSize: 12, color: online ? 'var(--online-green)' : 'var(--text-muted)' }}>
                    {online ? '🟢 Online' : '⚫ Offline'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div style={st.chatArea}>
        {selected ? (
          <ChatWindow
            key={selected.user_id}
            friend={selected}
            currentUser={user}
            isOnline={isOnline(selected.user_id)}
            onCall={startCall}
            onBack={() => setSelected(null)}
          />
        ) : (
          <div style={st.placeholder}>
            <div style={{ fontSize: 56 }}>💬</div>
            <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Select a chat to start messaging</p>
          </div>
        )}
      </div>
      <style>{`
        @media(min-width:640px){.chat-sidebar{display:flex !important;}}
        @media(min-width:1025px){.chat-sidebar-desktop{width:320px !important;}}
      `}</style>
    </div>
  );
}

// ── Call log bubble ──────────────────────────────────────────────────────────
function CallBubble({ msg, isMe }) {
  let info = { callType: 'video', duration: 0, status: 'completed' };
  try { info = JSON.parse(msg.content); } catch {}
  const isVoice  = (info.callType || '').toLowerCase() === 'voice';
  const callIcon = isVoice ? '📞' : '📹';
  const label    = isVoice ? 'Voice Call' : 'Video Call';
  const missed   = info.status === 'missed' || !info.duration;
  const mins     = Math.floor((info.duration || 0) / 60);
  const secs     = (info.duration || 0) % 60;
  const durText  = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  return (
    <div style={{ background: isMe ? 'var(--accent-primary)' : 'var(--bg-card)', padding: '10px 16px', borderRadius: 16, borderBottomRightRadius: isMe ? 4 : 16, borderBottomLeftRadius: isMe ? 16 : 4, display: 'flex', alignItems: 'center', gap: 10, minWidth: 175 }}>
      <span style={{ fontSize: 26 }}>{callIcon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 11, opacity: .85, display: 'flex', alignItems: 'center', gap: 5 }}>
          {missed
            ? <span>✖️ Not connected</span>
            : <span>✔️ {durText}</span>}
          <span style={{ opacity: .5 }}>•</span>
          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}

// ── Chat window (individual conversation) ───────────────────────────────────
function ChatWindow({ friend, currentUser, isOnline, onCall, onBack }) {
  const { messages, loading, sendMessage, editMessage, deleteMessage, emitTyping, typing, markRead } =
    useChat(friend.user_id);

  const [input,       setInput]       = useState('');
  const [showCallMenu, setShowCallMenu] = useState(false);
  const [editingId,    setEditingId]   = useState(null);
  const [editText,     setEditText]    = useState('');
  const [contextMenu,  setContextMenu] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // msgId awaiting confirm

  const bottomRef    = useRef(null);
  const callMenuRef  = useRef(null);
  const ctxMenuRef   = useRef(null);
  const editInputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Mark messages read when window is open
  useEffect(() => { markRead(); }, [messages, markRead]);

  useEffect(() => {
    const handler = e => {
      if (callMenuRef.current && !callMenuRef.current.contains(e.target)) setShowCallMenu(false);
      // Only close context menu if tap is OUTSIDE the menu — not inside it
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target)) setContextMenu(null);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  useEffect(() => {
    if (editingId) setTimeout(() => editInputRef.current?.focus(), 50);
  }, [editingId]);

  const handleSend = e => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  const startEdit = (msg) => {
    // Can't edit unconfirmed tmp messages or deleted/call messages
    if (String(msg.id).startsWith('tmp_') || msg.deleted || msg.msg_type === 'call') return;
    setEditingId(msg.id);
    setEditText(msg.content);
    setContextMenu(null);
  };

  const submitEdit = e => {
    e?.preventDefault();
    if (!editText.trim()) { setEditingId(null); return; }
    if (editText.trim() === messages.find(m => m.id === editingId)?.content) { setEditingId(null); return; }
    editMessage(editingId, editText.trim());
    setEditingId(null);
  };

  const handleDelete = (msgId) => {
    if (String(msgId).startsWith('tmp_')) return;
    setContextMenu(null);
    setDeleteConfirm(msgId); // show inline confirm instead of window.confirm
  };

  const confirmDelete = () => {
    if (deleteConfirm) deleteMessage(deleteConfirm);
    setDeleteConfirm(null);
  };

  const openContextMenu = (e, msg) => {
    if (msg.sender_id !== currentUser.id) return;
    if (msg.deleted || msg.msg_type === 'call') return;
    if (String(msg.id).startsWith('tmp_')) return; // can't act on pending messages
    e.preventDefault();
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 100;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 100;
    setContextMenu({ msgId: msg.id, msg, x, y });
  };

  return (
    <div style={st.chatWin}>
      {/* Header */}
      <div style={st.chatHead}>
        <button className="btn-icon" onClick={onBack} style={{ fontSize: 20 }}>←</button>
        <Avatar username={friend.username} avatarUrl={friend.avatar_url} size="sm" online={isOnline} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{friend.username}</div>
          <div style={{ fontSize: 12, color: isOnline ? 'var(--online-green)' : 'var(--text-muted)' }}>
            {typing ? '✏️ typing…' : isOnline ? '🟢 Online' : '⚫ Offline'}
          </div>
        </div>
        <div style={{ position: 'relative' }} ref={callMenuRef}>
          <button className="btn btn-primary" onClick={() => setShowCallMenu(m => !m)}
            style={{ padding: '8px 14px', fontSize: 13 }}>
            📞 Call ▾
          </button>
          {showCallMenu && (
            <div style={st.callMenu}>
              <CallOpt icon="📞" title="Voice Call" sub="Audio only"     onClick={() => { onCall('voice'); setShowCallMenu(false); }} />
              <CallOpt icon="📹" title="Video Call" sub="Camera + audio" onClick={() => { onCall('video'); setShowCallMenu(false); }} />
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={st.msgs} onClick={e => {
        // Close context menu only when clicking OUTSIDE it (not on a menu button)
        if (ctxMenuRef.current && ctxMenuRef.current.contains(e.target)) return;
        setContextMenu(null);
      }}>
        {loading && <div style={st.loadTxt}>Loading messages…</div>}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40, fontSize: 14 }}>
            No messages yet. Say hi! 👋
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe     = msg.sender_id === currentUser.id;
          const isEditing = editingId === msg.id;
          const isTmp    = String(msg.id).startsWith('tmp_');

          return (
            <div key={msg.id || i}
              style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}
              onContextMenu={e => openContextMenu(e, msg)}
              onTouchStart={e => {
                if (isMe && !msg.deleted && msg.msg_type !== 'call' && !isTmp) {
                  // Capture position NOW — React pools synthetic events so e is invalid inside setTimeout
                  const x = e.touches[0]?.clientX ?? 100;
                  const y = e.touches[0]?.clientY ?? 100;
                  const el = e.currentTarget;
                  const t = setTimeout(() => {
                    // Create a fake event-like object with captured position
                    setContextMenu({ msgId: msg.id, msg, x, y });
                  }, 600);
                  el._pt = t;
                }
              }}
              onTouchEnd={e  => clearTimeout(e.currentTarget._pt)}
              onTouchMove={e => clearTimeout(e.currentTarget._pt)}>

              {!isMe && <Avatar username={msg.username || friend.username} avatarUrl={msg.avatar_url || friend.avatar_url} size="sm" />}

              {msg.msg_type === 'call' ? (
                <CallBubble msg={msg} isMe={isMe} />
              ) : isEditing ? (
                <form onSubmit={submitEdit} style={{ display: 'flex', gap: 6, maxWidth: '72%', flex: 1 }}>
                  <input ref={editInputRef} className="input" value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setEditingId(null); }}
                    style={{ flex: 1, borderRadius: 20 }} />
                  <button className="btn btn-primary" type="submit" style={{ padding: '8px 12px', fontSize: 12 }}>Save</button>
                  <button className="btn btn-ghost" type="button" onClick={() => setEditingId(null)} style={{ padding: '8px 10px', fontSize: 12 }}>✕</button>
                </form>
              ) : (
                <div className="msg-bubble" style={{
                  maxWidth: '72%', padding: '10px 14px', borderRadius: 16,
                  borderBottomRightRadius: isMe ? 4 : 16,
                  borderBottomLeftRadius:  isMe ? 16 : 4,
                  background: msg.deleted ? 'var(--bg-card)' : isMe ? 'var(--accent-primary)' : 'var(--bg-card)',
                  opacity:    msg.deleted ? 0.65 : isTmp ? 0.75 : 1,
                  cursor:     isMe && !msg.deleted && !isTmp ? 'context-menu' : 'default',
                }}>
                  <div style={{ fontSize: 14, wordBreak: 'break-word', fontStyle: msg.deleted ? 'italic' : 'normal', color: msg.deleted ? 'var(--text-muted)' : 'inherit' }}>
                    {msg.content}
                  </div>
                  <div style={{ display: 'flex', gap: 4, fontSize: 10, color: 'rgba(255,255,255,.5)', justifyContent: 'flex-end', marginTop: 3, alignItems: 'center' }}>
                    {msg.edited && !msg.deleted && <span style={{ opacity: .6 }}>edited</span>}
                    <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && (
                      msg._failed  ? <span title="Failed" style={{ color: 'var(--danger)' }}>✗</span>
                    : msg._pending ? <span title="Sending…" style={{ opacity: .5 }}>🕐</span>
                    : msg.is_read  ? <span style={{ color: 'var(--online-green)' }}>✓✓</span>
                    :                <span style={{ opacity: .5 }}>✓</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={ctxMenuRef}
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          style={{ position: 'fixed', top: Math.min(contextMenu.y, window.innerHeight - 120), left: Math.min(contextMenu.x, window.innerWidth - 170), background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, zIndex: 600, minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,.7)' }}>
          <button onPointerDown={e => { e.stopPropagation(); startEdit(contextMenu.msg); }} style={st.ctxBtn}>✏️ Edit</button>
          <button onPointerDown={e => { e.stopPropagation(); handleDelete(contextMenu.msgId); }} style={{ ...st.ctxBtn, color: 'var(--danger)' }}>🗑️ Delete</button>
        </div>
      )}

      {/* Inline delete confirmation — replaces window.confirm which is blocked on Android */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 700 }}
          onClick={() => setDeleteConfirm(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '24px 28px', textAlign: 'center', maxWidth: 300, width: '90%' }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🗑️</div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Delete message?</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>This cannot be undone.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete} style={{ flex: 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} style={st.inputRow}>
        <input className="input" style={{ flex: 1, borderRadius: 24 }}
          placeholder="Type a message…" value={input}
          onChange={e => { setInput(e.target.value); emitTyping(true); }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e); }} />
        <button className="btn btn-primary" type="submit" disabled={!input.trim()} style={{ padding: '10px 20px' }}>Send</button>
      </form>
    </div>
  );
}

function CallOpt({ icon, title, sub, onClick }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', color: 'var(--text-primary)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
      </div>
    </button>
  );
}

const st = {
  root:       { display: 'flex', width: '100%', height: '100%', overflow: 'hidden' },
  sidebar:    { width: 280, flexShrink: 0, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', flexDirection: 'column' },
  sidebarHead:{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  friendRow:  { display: 'flex', alignItems: 'center', gap: 10, padding: '10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background .15s' },
  friendName: { fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  unreadBadge:{ position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 999, background: '#e53e3e', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid var(--bg-secondary)', zIndex: 1 },
  chatArea:   { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' },
  placeholder:{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  empty:      { padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 },
  chatWin:    { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', position: 'relative' },
  chatHead:   { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 },
  msgs:       { flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2 },
  loadTxt:    { textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 },
  inputRow:   { display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 },
  callMenu:   { position: 'absolute', top: '110%', right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, zIndex: 100, minWidth: 185, boxShadow: '0 8px 32px rgba(0,0,0,.5)' },
  ctxBtn:     { display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--text-primary)', borderRadius: 6 },
};
