import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useChat } from '../hooks/useChat';
import Avatar from '../components/Sidebar/Avatar';
import JitsiCall from '../components/VideoCall/JitsiCall';
import api from '../services/api';

export default function Chats() {
  const { user } = useAuth();
  const { isOnline, socket } = useSocket();
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(null);
  const [callRoom, setCallRoom] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true); // mobile toggle

  useEffect(() => {
    api.get('/api/relationships')
      .then(res => setFriends(res.data.relationships.filter(r => r.status === 'accepted' || r.status === 'muted')))
      .catch(() => {});
  }, []);

  const handleCall = () => {
    if (!selected || !socket) return;
    const roomName = `aurachat_${[user.id, selected.user_id].sort().join('_')}`;
    socket.emit('call:initiate', { to: selected.user_id, roomName });
    setCallRoom(roomName);
  };

  const selectFriend = (rel) => {
    setSelected(rel);
    setShowSidebar(false); // on mobile, hide sidebar to show chat
  };

  if (callRoom) {
    return <JitsiCall roomName={callRoom} displayName={user.username} onClose={() => setCallRoom(null)} />;
  }

  return (
    <div style={styles.container}>
      {/* Sidebar — friend list */}
      <div style={{ ...styles.sidebar, display: (!showSidebar && selected) ? 'none' : 'flex' }}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.title}>Chats</h2>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{friends.length} friends</span>
        </div>
        <div style={styles.list}>
          {friends.length === 0 && (
            <div style={styles.empty}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
              <div>No chats yet</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Add friends in the People tab</div>
            </div>
          )}
          {friends.map(rel => (
            <div key={rel.id} onClick={() => selectFriend(rel)}
              style={{ ...styles.friendItem, ...(selected?.user_id === rel.user_id ? styles.friendItemActive : {}) }}>
              <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="md" online={isOnline(rel.user_id)} />
              <div style={styles.friendInfo}>
                <span style={styles.friendName}>{rel.username}</span>
                <span style={{ fontSize: 12, color: isOnline(rel.user_id) ? 'var(--online-green)' : 'var(--text-muted)' }}>
                  {isOnline(rel.user_id) ? '🟢 Online' : '⚫ Offline'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ ...styles.chatArea, display: (showSidebar && !selected) ? 'none' : 'flex' }}>
        {selected ? (
          <ChatWindow
            key={selected.user_id}
            friend={selected}
            currentUser={user}
            isOnline={isOnline(selected.user_id)}
            onCall={handleCall}
            onBack={() => { setSelected(null); setShowSidebar(true); }}
          />
        ) : (
          <div style={styles.placeholder}>
            <div style={{ fontSize: 56 }}>💬</div>
            <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Select a chat to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatWindow({ friend, currentUser, isOnline, onCall, onBack }) {
  const { messages, loading, sendMessage, emitTyping, typing } = useChat(friend.user_id);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  return (
    <div style={styles.chatWindow}>
      {/* Header */}
      <div style={styles.chatHeader}>
        <button className="btn-icon" onClick={onBack} style={{ marginRight: 4 }}>←</button>
        <Avatar username={friend.username} avatarUrl={friend.avatar_url} size="sm" online={isOnline} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{friend.username}</div>
          <div style={{ fontSize: 12, color: isOnline ? 'var(--online-green)' : 'var(--text-muted)' }}>
            {typing ? '✏️ typing...' : isOnline ? '🟢 Online' : '⚫ Offline'}
          </div>
        </div>
        <button className="btn btn-primary" onClick={onCall} disabled={!isOnline}
          style={{ padding: '8px 14px', fontSize: 13 }} title={isOnline ? 'Start video call' : 'User is offline'}>
          📹 Call
        </button>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {loading && <div style={styles.loadingText}>Loading messages…</div>}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40, fontSize: 14 }}>
            No messages yet. Say hi! 👋
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === currentUser.id;
          return (
            <div key={msg.id || i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
              {!isMe && <Avatar username={msg.username || friend.username} avatarUrl={msg.avatar_url || friend.avatar_url} size="sm" />}
              <div style={{
                maxWidth: '65%', padding: '10px 14px', borderRadius: 16,
                borderBottomRightRadius: isMe ? 4 : 16,
                borderBottomLeftRadius: isMe ? 16 : 4,
                background: isMe ? 'var(--accent-primary)' : 'var(--bg-card)',
              }}>
                <div style={{ fontSize: 14, wordBreak: 'break-word' }}>{msg.content}</div>
                <div style={{ display: 'flex', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.5)', justifyContent: 'flex-end', marginTop: 3 }}>
                  <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {isMe && <span style={{ color: msg.is_read ? 'var(--online-green)' : 'rgba(255,255,255,0.4)' }}>
                    {msg.is_read ? '✓✓' : '✓'}
                  </span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={styles.inputRow}>
        <input className="input" style={{ flex: 1, borderRadius: 24 }}
          placeholder="Type a message…"
          value={input}
          onChange={e => { setInput(e.target.value); emitTyping(true); }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e); }}
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
  sidebar: { width: 280, flexShrink: 0, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', flexDirection: 'column' },
  sidebarHeader: { padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 800 },
  list: { flex: 1, overflowY: 'auto', padding: 8 },
  empty: { padding: '40px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 },
  friendItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background .15s' },
  friendItemActive: { background: 'var(--bg-card)' },
  friendInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' },
  friendName: { fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chatArea: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  placeholder: { textAlign: 'center' },
  chatWindow: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%' },
  chatHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' },
  messages: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column' },
  loadingText: { textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 },
  inputRow: { display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' },
};
