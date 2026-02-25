import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export const useChat = (targetId, isGroup = false) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const typingTimeout = useRef(null);

  // Load history
  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    const url = isGroup
      ? `/api/messages/group/${targetId}`
      : `/api/messages/dm/${targetId}`;

    api.get(url)
      .then(res => setMessages(res.data.messages))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [targetId, isGroup]);

  // Listen for new messages
  useEffect(() => {
    if (!socket || !targetId) return;

    const event = isGroup ? 'group:message:receive' : 'message:receive';

    const handler = (msg) => {
      const relevant = isGroup
        ? msg.groupId === targetId
        : (msg.sender_id === targetId || msg.sender_id === user.id);
      if (relevant) {
        setMessages(prev => [...prev, msg]);
        // Send read receipt for DMs
        if (!isGroup && msg.sender_id === targetId) {
          socket.emit('message:read', { from: targetId });
        }
      }
    };

    socket.on(event, handler);

    // Typing
    const typingStartHandler = ({ from }) => {
      if (from === targetId) setTyping(true);
    };
    const typingStopHandler = ({ from }) => {
      if (from === targetId) setTyping(false);
    };
    socket.on('typing:start', typingStartHandler);
    socket.on('typing:stop', typingStopHandler);

    return () => {
      socket.off(event, handler);
      socket.off('typing:start', typingStartHandler);
      socket.off('typing:stop', typingStopHandler);
    };
  }, [socket, targetId, isGroup, user]);

  const sendMessage = useCallback((content) => {
    if (!socket || !content.trim()) return;
    if (isGroup) {
      socket.emit('group:message:send', { groupId: targetId, content });
    } else {
      socket.emit('message:send', { to: targetId, content });
    }
  }, [socket, targetId, isGroup]);

  const emitTyping = useCallback((isTyping) => {
    if (!socket) return;
    const payload = isGroup ? { to: 'group:' + targetId } : { to: targetId };
    if (isTyping) {
      socket.emit('typing:start', payload);
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socket.emit('typing:stop', payload);
      }, 2000);
    } else {
      socket.emit('typing:stop', payload);
    }
  }, [socket, targetId, isGroup]);

  return { messages, loading, sendMessage, emitTyping, typing };
};
