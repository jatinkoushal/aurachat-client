import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useChat } from '../hooks/useChat';
import Avatar from '../components/Sidebar/Avatar';
import WebRTCCall from '../components/VideoCall/WebRTCCall';
import api from '../services/api';

export default function Chats() {
  const { user } = useAuth();
  const { isOnline, socket } = useSocket();
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(null);
  const [activeCall, setActiveCall] = useState(null); // { peerId, peerUsername, callType }

  const loadFriends = useCallback(() => {
    api.get('/api/relationships')
      .then(res => setFriends((res.data.relationships || []).filter(r => r.status === 'accepted' || r.status === 'muted')))
      .catch(() => {});
  }, []);

  useEffect(() => { loadFriends(); }, [loadFriends]);

  // Listen for call accepted — then start WebRTC as caller
  useEffect(() => {
    if (!socket) return;
    const handler = () => {}; // WebRTCCall component handles this internally
    socket.on('call:accepted', handler);
    return () => socket.off('call:accepted', handler);
  }, [socket]);

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
        onClose={() => {
          socket?.emit('call:end', { to: activeCall.peerId });
          setActiveCall(null);
        }}
      />
    );
  }

  // Desktop: always show sidebar + chat side by side
  // Mobile: show one at a time
  return (
    <div style={st.root}>
      {/* Friend list — hide on mobile when chat is open */}
      <div style={{ ...st.sidebar, display: selected ? 'none' : 'flex' }} className="chat-sidebar">
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
          {friends.map(rel => (
            <div key={rel.id} onClick={() => setSelected(rel)}
              style={{ ...st.friendRow, background: selected?.user_id === rel.user_id ? 'var(--bg-card)' : 'transparent' }}>
              <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="md" online={isOnline(rel.user_id)} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={st.friendName}>{rel.username}</div>
                <div style={{ fontSize: 12, color: isOnline(rel.user_id) ? 'var(--online-green)' : 'var(--text-muted)' }}>
                  {isOnline(rel.user_id) ? '🟢 Online' : '⚫ Offline'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area — full width on mobile, flex:1 on desktop */}
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
        @media(min-width:640px){
          .chat-sidebar { display:flex !important; }
        }
      `}</style>
    </div>
  );
}

// Render a call history bubble
function CallBubble({ msg, isMe }) {
  let info = { callType: 'video', duration: 0, status: 'ended' };
  try { info = JSON.parse(msg.content); } catch {}
  const icon = info.callType === 'voice' ? '📞' : '📹';
  const label = info.callType === 'voice' ? 'Voice Call' : 'Video Call';
  const dur = info.duration > 0
    ? `${String(Math.floor(info.duration / 60)).padStart(2,'0')}:${String(info.duration % 60).padStart(2,'0')}`
    : 'Missed';
  return (
    <div style={{ background: isMe ? 'var(--accent-primary)' : 'var(--bg-card)', padding: '10px 16px', borderRadius: 16, borderBottomRightRadius: isMe ? 4 : 16, borderBottomLeftRadius: isMe ? 16 : 4, display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
        <div style={{ fontSize: 11, opacity: 0.75 }}>
          {info.status === 'missed' ? '📵 Missed' : `⏱ ${dur}`} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

function ChatWindow({ friend, currentUser, isOnline, onCall, onBack }) {
  const { messages, loading, sendMessage, emitTyping, typing } = useChat(friend.user_id);
  const [input, setInput] = useState('');
  const [showCallMenu, setShowCallMenu] = useState(false);
  const bottomRef = useRef(null);
  const callMenuRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Close call menu when clicking outside
  useEffect(() => {
    const handler = e => { if (callMenuRef.current && !callMenuRef.current.contains(e.target)) setShowCallMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSend = e => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
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
        {/* Call button with dropdown for voice/video */}
        <div style={{ position: 'relative' }} ref={callMenuRef}>
          <button className="btn btn-primary"
            onClick={() => setShowCallMenu(m => !m)}
            disabled={!isOnline}
            style={{ padding: '8px 14px', fontSize: 13 }}
            title={isOnline ? 'Call' : 'User is offline'}>
            📞 Call ▾
          </button>
          {showCallMenu && (
            <div style={st.callMenu}>
              <button onClick={() => { onCall('voice'); setShowCallMenu(false); }} style={st.callOpt}>
                <span style={{ fontSize: 20 }}>📞</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Voice Call</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Audio only</div>
                </div>
              </button>
              <button onClick={() => { onCall('video'); setShowCallMenu(false); }} style={st.callOpt}>
                <span style={{ fontSize: 20 }}>📹</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Video Call</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Camera + audio</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={st.msgs}>
        {loading && <div style={st.loadTxt}>Loading messages…</div>}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40, fontSize: 14 }}>No messages yet. Say hi! 👋</div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === currentUser.id;
          return (
            <div key={msg.id || i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
              {!isMe && <Avatar username={msg.username || friend.username} avatarUrl={msg.avatar_url || friend.avatar_url} size="sm" />}
              {msg.msg_type === 'call' ? (
                <CallBubble msg={msg} isMe={isMe} />
              ) : (
                <div style={{ maxWidth: '65%', padding: '10px 14px', borderRadius: 16, borderBottomRightRadius: isMe ? 4 : 16, borderBottomLeftRadius: isMe ? 16 : 4, background: isMe ? 'var(--accent-primary)' : 'var(--bg-card)' }}>
                  <div style={{ fontSize: 14, wordBreak: 'break-word' }}>{msg.content}</div>
                  <div style={{ display: 'flex', gap: 4, fontSize: 10, color: 'rgba(255,255,255,.5)', justifyContent: 'flex-end', marginTop: 3 }}>
                    <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMe && <span style={{ color: msg.is_read ? 'var(--online-green)' : 'rgba(255,255,255,.4)' }}>{msg.is_read ? '✓✓' : '✓'}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

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

const st = {
  root:       { display: 'flex', width: '100%', height: '100%', overflow: 'hidden' },
  sidebar:    { width: 280, flexShrink: 0, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', flexDirection: 'column' },
  sidebarHead:{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  friendRow:  { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background .15s' },
  friendName: { fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chatArea:   { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' },
  placeholder:{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  empty:      { padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 },
  chatWin:    { display: 'flex', flexDirection: 'column', width: '100%', height: '100%' },
  chatHead:   { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', position: 'relative', flexShrink: 0 },
  msgs:       { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column' },
  loadTxt:    { textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 },
  inputRow:   { display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 },
  callMenu:   { position: 'absolute', top: '110%', right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, zIndex: 100, minWidth: 180, boxShadow: '0 8px 32px rgba(0,0,0,.5)' },
  callOpt:    { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', color: 'var(--text-primary)', transition: 'background .15s' },
};
