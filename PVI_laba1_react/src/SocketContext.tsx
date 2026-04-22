import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

// Initialize socket outside the component
const socket = io('http://localhost:3001', { autoConnect: false });
interface UnreadMessage {
  chat_id: string;
  sender: string;
  content: string;
  createdAt: string;
}

interface SocketContextType {
  socket: Socket;
  unreadMessages: UnreadMessage[];
  markAsRead: (chat_id: string, reader_id: string) => void;
  onlineUserIds: string[];
  deleteMessage: (messageId: string, chatId: string) => void;
}

// Create the Context
const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [unreadMessages, setUnreadMessages] = useState<UnreadMessage[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  // Get current user from localStorage
  const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  
  // ТЕПЕР МИ БЕРЕМО ID ЗАМІСТЬ ІМЕНІ
  const currentUserId = storedUser.id ? String(storedUser.id) : null;
  const currentUserName = storedUser.firstname ? `${storedUser.firstname} ${storedUser.lastname}` : null;

    // INITIALIZE SOCKET CONNECTION
  useEffect(() => {
    if (!currentUserId) return;

    socket.connect();

    // Створюємо функцію, яка спрацює ТІЛЬКИ після успішного з'єднання
    const handleConnect = () => {
      console.log("✅ Сокет успішно підключився! Реєструємо юзера:", currentUserId);
      socket.emit('user_connected', currentUserId);
    };

    // Слухаємо подію підключення
    socket.on('connect', handleConnect);

    // Якщо сокет вже був підключений (наприклад, при швидкому оновленні сторінки)
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      // socket.disconnect(); // Поки що залишаємо закоментованим
    };
  }, [currentUserId]);

  // Fetch unread messages on component mount
  useEffect(() => {
    if (!currentUserId) return;

    const fetchUnreadMessages = async () => {
      try {
        // ВАЖЛИВО: Замініть 192.168.1.15 на вашу IP-адресу
        // Відправляємо саме ID на бекенд
        const response = await fetch(
          `http://localhost:3001/api/unread/${currentUserId}`
        );
        const data = await response.json();
        
        // Фільтруємо на фронтенді: відкидаємо СВОЇ ж повідомлення
        // Перевіряємо і по ID, і по Імені (щоб точно не пропустити)
        const onlyOthersMessages = (data || []).filter(
          (msg: UnreadMessage) => String(msg.sender) !== currentUserId && msg.sender !== currentUserName
        );
        
        setUnreadMessages(onlyOthersMessages);
      } catch (error) {
        console.error('Failed to fetch unread messages:', error);
      }
    };

    fetchUnreadMessages();
  }, [currentUserId, currentUserName]);

  useEffect(() => {
    if(!socket || !currentUserId) return;

    function handleGlobalNotification(notification: UnreadMessage){
      console.log("🚨 ПРИЛЕТІЛО СПОВІЩЕННЯ З СЕРВЕРА:", notification); // <--- ДОДАЙТЕ ЦЕ


      setUnreadMessages((prev) => {
        const exists = prev.some(
          (msg) => msg.chat_id === notification.chat_id && msg.sender === notification.sender
        );
        if (exists) return prev;
        
        return [...prev, {
          chat_id: notification.chat_id,
          sender: notification.sender,
          content: notification.content,
          createdAt: notification.createdAt,
        }]; 
      });
    }

    socket.on('global_notification', handleGlobalNotification);

    return () => {
      socket.off('global_notification', handleGlobalNotification);
    };
  }, [socket, currentUserId]);

  // Listen for initial online users list when user connects
  useEffect(() => {
    if (!socket) return;

    function handleInitialOnlineUsers(onlineUserIds: string[]) {
      console.log("📗 Отримано список онлайн юзерів:", onlineUserIds);
      setOnlineUserIds(onlineUserIds);
    }

    socket.on('initial_online_users', handleInitialOnlineUsers);

    return () => {
      socket.off('initial_online_users', handleInitialOnlineUsers);
    };
  }, [socket]);

  // Listen for real-time user status changes (online/offline)
  useEffect(() => {
    if (!socket) return;

    function handleUserStatus(data: { userId: string; status: 'online' | 'offline' }) {
      console.log(`👤 User ${data.userId} is now ${data.status}`);
      
      setOnlineUserIds((prev) => {
        if (data.status === 'online') {
          // Add user if not already in list
          if (!prev.includes(data.userId)) {
            return [...prev, data.userId];
          }
          return prev;
        } else {
          // Remove user from list
          return prev.filter((id) => id !== data.userId);
        }
      });
    }

    socket.on('user_status', handleUserStatus);

    return () => {
      socket.off('user_status', handleUserStatus);
    };
  }, [socket]);



  // Function to mark messages as read
  const markAsRead = (chat_id: string, reader_id: string) => {
    // Remove messages of that chat from unreadMessages state
    setUnreadMessages((prev) =>
      prev.filter((msg) => msg.chat_id !== chat_id)
    );

    // Emit socket event to notify backend
    socket.emit('mark_messages_read', {
      chat_id,
      reader_id,
    });
  };

  // Function to delete a message
  const deleteMessage = (messageId: string, chatId: string) => {
    socket.emit('delete_message', {
      messageId,
      chatId,
    });
  };

  const value: SocketContextType = {
    socket,
    unreadMessages,
    markAsRead,
    onlineUserIds,
    deleteMessage,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

// Custom hook to use the SocketContext
export function useSocketContext(): SocketContextType {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}
