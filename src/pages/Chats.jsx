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

  useEffect(() => {
    api.get('/api/relationships')
      .then(res => setFriends(res.data.relationships.filter(r => r.status === 'accepted')))
      .catch(() => {});
  }, []);

  const handleCall = () => {
    if (!selected || !socket) return;
    const roomName = [user.id, selected.user_id].sort().join('_');
    socket.emit('call:initiate', { to: selected.user_id, roomName });
    setCallRoom(roomName);
  };

  if (callRoom) {
    return (
      <JitsiCall
        roomName={callRoom}
        displayName={user.username}
        onClose={() => setCallRoom(null)}
      />
    );
  }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>Chats</h2>
        </div>
        <div style={styles.list}>
          {friends.length === 0 && (
            <div style={styles.empty}>
              <p>No chats yet</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Add friends in People tab
              </p>
            </div>
          )}
          {friends.map(rel => (
            <div
              key={rel.id}
              onClick={() => setSelected(rel)}
              style={{
                ...styles.friendItem,
                ...(selected?.user_id === rel.user_id ? styles.friendItemActive : {}),
              }}
            >
              <Avatar username={rel.username} avatarUrl={rel.avatar_url} size="md" online={isOnline(rel.user_id)} />
              <div style={styles.friendInfo}>
                <span style={styles.friendName}>{rel.username}</span>
                <span className="text-muted">{isOnline(rel.user_id) ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={styles.chatArea}>
        {selected
          ? <ChatWindow
              key={selected.user_id}
              friend={selected}
              currentUser={user}
              isOnline={isOnline(selected.user_id)}
              onCall={handleCall}
            />
          : <div style={styles.placeholder}>
              <div style={{ fontSize: '48px' }}>💬</div>
              <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Select a chat to start messaging</p>
            </div>
        }
      </div>
    </div>
  );
}

function ChatWindow({ friend, currentUser, isOnline, onCall }) {
  const { messages, loading, sendMessage, emitTyping, typing } = useChat(friend.user_id);
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

  const handleInput = (e) => {
    setInput(e.target.value);
    emitTyping(true);
  };

  return (
    <div style={styles.chatWindow}>
      {/* Header */}
      <div style={styles.chatHeader}>
        <Avatar username={friend.username} avatarUrl={friend.avatar_url} size="sm" online={isOnline} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '700', fontSize: '15px' }}>{friend.username}</div>
          <div style={{ fontSize: '12px', color: isOnline ? 'var(--online-green)' : 'var(--text-muted)' }}>
            {typing ? 'typing…' : isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={onCall}
          disabled={!isOnline}
          style={{ padding: '8px 16px', fontSize: '13px' }}
          title={isOnline ? 'Start video call' : 'User is offline'}
        >
          📹 Call
        </button>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {loading && <div style={styles.loadingText}>Loading messages…</div>}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === currentUser.id;
          return (
            <div key={msg.id || i} style={{ ...styles.msgRow, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
              {!isMe && <Avatar username={msg.username} avatarUrl={msg.avatar_url} size="sm" />}
              <div style={{
                ...styles.bubble,
                background: isMe ? 'var(--accent-primary)' : 'var(--bg-card)',
                borderBottomRightRadius: isMe ? '4px' : '16px',
                borderBottomLeftRadius: isMe ? '16px' : '4px',
              }}>
                <span style={{ fontSize: '14px' }}>{msg.content}</span>
                <div style={styles.msgMeta}>
                  <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {isMe && <span style={{ color: msg.is_read ? 'var(--online-green)' : 'var(--text-muted)' }}>
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
        <input
          className="input"
          style={{ flex: 1, borderRadius: '24px' }}
          placeholder="Type a message…"
          value={input}
          onChange={handleInput}
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
  sidebar: {
    width: '280px',
    flexShrink: 0,
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    '@media (max-width: 600px)': { width: '100%' },
  },
  sidebarHeader: { padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' },
  sidebarTitle: { fontSize: '20px', fontWeight: '800' },
  list: { flex: 1, overflowY: 'auto', padding: '8px' },
  empty: { padding: '40px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' },
  friendItem: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 12px', borderRadius: 'var(--radius-sm)',
    cursor: 'pointer', transition: 'background 0.15s',
  },
  friendItemActive: { background: 'var(--bg-card)' },
  friendInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' },
  friendName: { fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chatArea: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  placeholder: { textAlign: 'center' },
  chatWindow: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%' },
  chatHeader: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 16px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
  },
  messages: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  loadingText: { textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: '8px' },
  bubble: {
    maxWidth: '65%', padding: '10px 14px', borderRadius: '16px',
    display: 'flex', flexDirection: 'column', gap: '4px',
  },
  msgMeta: { display: 'flex', gap: '4px', fontSize: '10px', color: 'rgba(255,255,255,0.5)', justifyContent: 'flex-end' },
  inputRow: {
    display: 'flex', gap: '10px', padding: '12px 16px',
    borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)',
  },
};
