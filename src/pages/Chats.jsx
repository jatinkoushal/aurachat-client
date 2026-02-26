import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useChat } from '../hooks/useChat';
import Avatar from '../components/Sidebar/Avatar';
import WebRTCCall from '../components/VideoCall/WebRTCCall';
import api from '../services/api';

export default function Chats() {
  const { user } = useAuth();
  const { isOnline, socket, onlineUsers } = useSocket();
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  const loadFriends = useCallback(() => {
    api.get('/api/relationships')
      .then(res => setFriends((res.data.relationships || []).filter(r => r.status === 'accepted' || r.status === 'muted')))
      .catch(() => {});
  }, []);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  // Re-render friend list when online status changes
  // (onlineUsers object changes reference triggers re-render automatically)

  const startCall = useCallback((callType) => {
    if (!selected || !socket) return;
    socket.emit('call:initiate', { to: selected.user_id, callType });
    setActiveCall({ peerId: selected.user_id, peerUsername: selected.username, callType });
  }, [selected, socket]);

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
            const online = isOnline(rel.user_id);
            return (
              <div key={rel.id} onClick={() => setSelected(rel)}
                style={{ ...st.friendRow, background: selected?.user_id === rel.user_id ? 'var(--bg-card)' : 'transparent' }}>
                <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="md" online={online} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={st.friendName}>{rel.username}</div>
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
        @media(max-width:640px){.chat-area-full{width:100% !important;}}
      `}</style>
    </div>
  );
}

function CallBubble({ msg, isMe }) {
  let info = { callType: 'video', duration: 0, status: 'completed' };
  try { info = JSON.parse(msg.content); } catch {}
  const isVoice = (info.callType || '').toLowerCase() === 'voice';
  const callIcon = isVoice ? '📞' : '📹';
  const label    = isVoice ? 'Voice Call' : 'Video Call';
  const missed   = info.status === 'missed' || info.duration === 0;
  const mins = Math.floor((info.duration || 0) / 60);
  const secs = (info.duration || 0) % 60;
  const durText = missed ? null : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  return (
    <div style={{ background: isMe ? 'var(--accent-primary)' : 'var(--bg-card)', padding: '10px 16px', borderRadius: 16, borderBottomRightRadius: isMe ? 4 : 16, borderBottomLeftRadius: isMe ? 16 : 4, display: 'flex', alignItems: 'center', gap: 10, minWidth: 170 }}>
      <span style={{ fontSize: 24 }}>{callIcon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, opacity: .8, display: 'flex', alignItems: 'center', gap: 4 }}>
          {missed
            ? <><span>✖️</span><span>Not connected</span></>
            : <><span>✔️</span><span>{durText}</span></>
          }
          <span style={{ opacity: .5 }}>•</span>
          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}

function ChatWindow({ friend, currentUser, isOnline, onCall, onBack }) {
  const { messages, loading, sendMessage, editMessage, deleteMessage, emitTyping, typing } = useChat(friend.user_id);
  const [input, setInput] = useState('');
  const [showCallMenu, setShowCallMenu] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [contextMenu, setContextMenu] = useState(null); // { msgId, x, y }
  const bottomRef = useRef(null);
  const callMenuRef = useRef(null);
  const editInputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Close menus on outside click
  useEffect(() => {
    const handler = e => {
      if (callMenuRef.current && !callMenuRef.current.contains(e.target)) setShowCallMenu(false);
      setContextMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus edit input when editing starts
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
    setEditingId(msg.id);
    setEditText(msg.content);
    setContextMenu(null);
  };

  const submitEdit = e => {
    e?.preventDefault();
    if (!editText.trim() || editText === messages.find(m => m.id === editingId)?.content) {
      setEditingId(null); return;
    }
    editMessage(editingId, editText.trim());
    setEditingId(null);
  };

  const handleDelete = (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    deleteMessage(msgId);
    setContextMenu(null);
  };

  const handleLongPress = (e, msg) => {
    if (msg.sender_id !== currentUser.id) return;
    if (msg.deleted || msg.msg_type === 'call') return;
    e.preventDefault();
    setContextMenu({ msgId: msg.id, msg, x: e.clientX || e.touches?.[0]?.clientX || 0, y: e.clientY || e.touches?.[0]?.clientY || 0 });
  };

  return (
    <div style={st.chatWin}>
      {/* Header */}
      <div style={st.chatHead}>
        <button className="btn-icon" onClick={onBack}>←</button>
        <Avatar username={friend.username} avatarUrl={friend.avatar_url} size="sm" online={isOnline} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{friend.username}</div>
          <div style={{ fontSize: 12, color: isOnline ? 'var(--online-green)' : 'var(--text-muted)' }}>
            {typing ? '✏️ typing...' : isOnline ? '🟢 Online' : '⚫ Offline'}
          </div>
        </div>
        <div style={{ position: 'relative' }} ref={callMenuRef}>
          <button className="btn btn-primary"
            onClick={() => setShowCallMenu(m => !m)}
            style={{ padding: '8px 14px', fontSize: 13 }}>
            📞 Call ▾
          </button>
          {showCallMenu && (
            <div style={st.callMenu}>
              <CallOpt icon="📞" title="Voice Call" sub="Audio only"       onClick={() => { onCall('voice'); setShowCallMenu(false); }} />
              <CallOpt icon="📹" title="Video Call" sub="Camera + audio"   onClick={() => { onCall('video'); setShowCallMenu(false); }} />
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={st.msgs} onClick={() => setContextMenu(null)}>
        {loading && <div style={st.loadTxt}>Loading messages…</div>}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40, fontSize: 14 }}>No messages yet. Say hi! 👋</div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === currentUser.id;
          const isEditing = editingId === msg.id;

          return (
            <div key={msg.id || i}
              style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}
              onContextMenu={e => { e.preventDefault(); handleLongPress(e, msg); }}
              onTouchStart={e => { if (isMe && !msg.deleted && msg.msg_type !== 'call') { const t = setTimeout(() => handleLongPress(e, msg), 600); e.currentTarget._t = t; } }}
              onTouchEnd={e => clearTimeout(e.currentTarget._t)}>

              {!isMe && <Avatar username={msg.username || friend.username} avatarUrl={msg.avatar_url || friend.avatar_url} size="sm" />}

              {msg.msg_type === 'call' ? (
                <CallBubble msg={msg} isMe={isMe} />
              ) : isEditing ? (
                <form onSubmit={submitEdit} style={{ display: 'flex', gap: 6, maxWidth: '65%', flex: 1 }}>
                  <input ref={editInputRef} className="input" value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setEditingId(null); }}
                    style={{ flex: 1, borderRadius: 20 }} />
                  <button className="btn btn-primary" type="submit" style={{ padding: '8px 12px', fontSize: 12 }}>Save</button>
                  <button className="btn btn-ghost" type="button" onClick={() => setEditingId(null)} style={{ padding: '8px 10px', fontSize: 12 }}>✕</button>
                </form>
              ) : (
                <div className="msg-bubble" style={{ maxWidth: '65%', padding: '10px 14px', borderRadius: 16,
                  borderBottomRightRadius: isMe ? 4 : 16,
                  borderBottomLeftRadius: isMe ? 16 : 4,
                  background: msg.deleted ? 'var(--bg-card)' : isMe ? 'var(--accent-primary)' : 'var(--bg-card)',
                  opacity: msg.deleted ? 0.65 : 1,
                  cursor: isMe && !msg.deleted && msg.msg_type !== 'call' ? 'context-menu' : 'default',
                }}>
                  <div style={{ fontSize: 14, wordBreak: 'break-word', fontStyle: msg.deleted ? 'italic' : 'normal', color: msg.deleted ? 'var(--text-muted)' : 'inherit' }}>
                    {msg.content}
                  </div>
                  <div style={{ display: 'flex', gap: 4, fontSize: 10, color: 'rgba(255,255,255,.5)', justifyContent: 'flex-end', marginTop: 3, alignItems: 'center' }}>
                    {msg.edited && !msg.deleted && <span style={{ opacity: .6 }}>edited</span>}
                    <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && msg._pending && <span title="Sending…" style={{ opacity:.5 }}>🕐</span>}
                    {isMe && !msg._pending && !msg._tmp && <span style={{ color: msg.is_read ? 'var(--online-green)' : 'rgba(255,255,255,.4)' }}>{msg.is_read ? '✓✓' : '✓'}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Context menu for edit/delete */}
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 4, zIndex: 500, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
          <button onClick={() => startEdit(contextMenu.msg)} style={st.ctxBtn}>✏️ Edit message</button>
          <button onClick={() => handleDelete(contextMenu.msgId)} style={{ ...st.ctxBtn, color: 'var(--danger)' }}>🗑️ Delete message</button>
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
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', color: 'var(--text-primary)' }}
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
  friendName: { fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chatArea:   { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' },
  placeholder:{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  empty:      { padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 },
  chatWin:    { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', position: 'relative' },
  chatHead:   { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 },
  msgs:       { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column' },
  loadTxt:    { textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 },
  inputRow:   { display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 },
  callMenu:   { position: 'absolute', top: '110%', right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, zIndex: 100, minWidth: 180, boxShadow: '0 8px 32px rgba(0,0,0,.5)' },
  ctxBtn:     { display: 'block', width: '100%', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, color: 'var(--text-primary)', borderRadius: 6 },
};
