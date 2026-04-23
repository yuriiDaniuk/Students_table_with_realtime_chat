import React, { useEffect, useState, useRef } from "react";
import { useSocketContext } from "./SocketContext";
import GroupChatModal from "./GroupChatModal";

export default function Messages() {
  const { socket, unreadMessages, markAsRead, onlineUserIds, deleteMessage } = useSocketContext();
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [contacts, setContacts] = useState([]);
  const [currentRoom, setCurrentRoom] = useState("");
  const [selectedContactName, setSelectedContactName] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  // Отримуємо поточного користувача лише один раз для всього компонента
  const storedUser = JSON.parse(localStorage.getItem("currentUser"));
  const username = storedUser
    ? `${storedUser.firstname} ${storedUser.lastname}`
    : null;
  const myId = storedUser ? storedUser.id : null;

  const messagesEndRef = useRef(null);
  const contextMenuRef = useRef(null);

  // Якщо користувач не авторизований
  if (!username) {
    return (
      <div className="flex items-center justify-center h-[500px] text-gray-500 text-xl font-semibold">
        Щоб переглядати повідомлення та спілкуватися, будь ласка, увійдіть в
        систему (кнопка Log In у правому верхньому куті).
      </div>
    );
  }

  // Socket підключення та прослуховування
  useEffect(() => {

    setIsConnected(socket.connected);

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("receive_message", (data) => {
      // Додаємо повідомлення в чат ТІЛЬКИ якщо воно для поточної відкритої кімнати
      if (data.chat_id === currentRoom) {
        setMessages((prev) => [...prev, data]);

        markAsRead(currentRoom, String(myId)); // Позначаємо повідомлення як прочитані, якщо вони для поточної кімнати
      }
    });

    socket.on("message_deleted", ({ messageId }) => {
      // Remove deleted message from local state
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    });

    socket.on("group_invite", (groupData) => {
      // When invited to a new group, add it to contacts
      console.log("🎉 Received group invite:", groupData);
      
      setContacts((prev) => {
        // Check if group already exists
        const exists = prev.some(
          (c) => String(c._id || c.id) === String(groupData._id || groupData.id)
        );
        
        if (exists) {
          console.log("Group already exists, skipping duplicate");
          return prev;
        }
        
        // Add the new group
        return [
          {
            id: groupData._id || groupData.id,
            firstname: groupData.firstname || groupData.chatName,
            lastname: groupData.lastname || "(Group)",
            isGroup: groupData.isGroup !== false,
            isGroupChat: groupData.isGroupChat !== false,
            _id: groupData._id || groupData.id,
            chatName: groupData.chatName || groupData.firstname,
          },
          ...prev,
        ];
      });
    });

    socket.on("group_was_deleted", ({ chatId }) => {
      // 1. Прибираємо групу зі списку контактів зліва
      setContacts((prev) => prev.filter((c) => String(c._id || c.id) !== String(chatId)));
      
      // 2. Якщо ми прямо зараз сиділи в цій групі - викидаємо нас з неї
      setCurrentRoom((prevRoom) => {
        if (String(prevRoom) === String(chatId)) {
          setSelectedContactName("");
          setSelectedContactId(null);
          return "";
        }
        return prevRoom;
      });
    });

    let typingTimer;
    socket.on("typing", (data) => {
      // Показуємо індикатор тільки якщо ми в тій самій кімнаті і це не ми друкуємо
      if (data.chat_id === currentRoom && data.user !== username) {
        setTypingUser(data.user);
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          setTypingUser("");
        }, 2000);
      }
    });

    return () => {
      clearTimeout(typingTimer);
      socket.off("connect");
      socket.off("disconnect");
      socket.off("receive_message");
      socket.off("message_deleted");
      socket.off("typing");
      socket.off("group_invite");
      socket.off("group_was_deleted");
    };
  }, [username, currentRoom, socket, myId]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Переключення кімнати
  useEffect(() => {
    if (isConnected && currentRoom) {
      socket.emit("join_room", currentRoom);
    }
  }, [currentRoom, isConnected, socket]);

  // Отримання контактів
  useEffect(() => {
    fetch("http://localhost/students_api/api.php")
      .then((res) => res.json())
      .then((data) => {
        const allStudents = data.data;
        if (Array.isArray(allStudents)) {
          // Залишаємо всіх, крім себе
          const others = allStudents.filter(
            (student) => String(student.id) !== String(myId),
          );
          setContacts(others);
        }
      })
      .catch((err) => console.error("Помилка завантаження контактів:", err));
  }, [myId]);

  // Отримання групових чатів
  useEffect(() => {
    if (!myId) return;

    const fetchGroupChats = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/chats/user/${myId}`);
        if (response.ok) {
          const groupChats = await response.json();
          if (Array.isArray(groupChats) && groupChats.length > 0) {
            // Додаємо групові чати до списку контактів
            // Перетворюємо їх у формат, сумісний з контактами
            const formattedGroups = groupChats.map((group) => ({
              id: group._id,
              _id: group._id,
              firstname: group.chatName,
              lastname: "(Group)",
              isGroup: true,
              isGroupChat: true,
              chatName: group.chatName,
              users: group.users,
              groupAdmin: group.groupAdmin,
            }));
            setContacts((prev) => {
              // Prevent duplicates when merging groups with contacts
              const existingIds = prev.map((c) => String(c._id || c.id));
              const newGroups = formattedGroups.filter(
                (group) => !existingIds.includes(String(group._id))
              );
              return [...newGroups, ...prev];
            });
          }
        }
      } catch (error) {
        console.error("Помилка завантаження групових чатів:", error);
      }
    };

    fetchGroupChats();
  }, [myId]);

  // Сортування контактів за новими повідомленнями
  useEffect(() => {
    if (contacts.length === 0) return;

    const sortedContacts = [...contacts].sort((contactA, contactB) => {
      const roomA = [Number(myId), Number(contactA.id)]
        .sort((a, b) => a - b)
        .join("_");
      const roomB = [Number(myId), Number(contactB.id)]
        .sort((a, b) => a - b)
        .join("_");

      const unreadA = unreadMessages.filter((msg) => msg.chat_id === roomA);
      const timeA =
        unreadA.length > 0
          ? new Date(unreadA[unreadA.length - 1].createdAt).getTime()
          : 0;

      const unreadB = unreadMessages.filter((msg) => msg.chat_id === roomB);
      const timeB =
        unreadB.length > 0
          ? new Date(unreadB[unreadB.length - 1].createdAt).getTime()
          : 0;

      return timeB - timeA;
    });

    // Оновлюємо стан тільки якщо порядок дійсно змінився (щоб уникнути зайвих рендерів)
    if (JSON.stringify(contacts) !== JSON.stringify(sortedContacts)) {
      setContacts(sortedContacts);
    }
  }, [unreadMessages, contacts, myId]);

  // Завантаження історії повідомлень при відкритті чату
  useEffect(() => {
    if (!currentRoom) return;

    const fetchMessages = async () => {
      try {
        const response = await fetch(
          `http://localhost:3001/api/messages/${currentRoom}`,
        );
        const data = await response.json();
        setMessages(data);
      } catch (error) {
        console.error("Failed to fetch messages:", error);
      }
    };
    fetchMessages();
  }, [currentRoom]);

  // Автоскрол
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  const handleSendMessage = () => {
    if (messageInput.trim() !== "" && currentRoom) {
      const messageData = {
        chat_id: currentRoom,
        sender: username,
        content: messageInput,
      };

      socket.emit("chat_message", messageData);
      setMessageInput("");
      setTypingUser(""); // Прибираємо свій статус друку
    }
  };

  const handleContextMenu = (e: React.MouseEvent, messageId: string, isMe: boolean) => {
    e.preventDefault();
    // Only show context menu for own messages
    if (!isMe) return;
    
    // Get the message bubble position
    const messageBubble = (e.currentTarget as HTMLElement).getBoundingClientRect();
    
    setContextMenu({
      messageId,
      x: messageBubble.right - 150,
      y: messageBubble.bottom + 5,
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("uk-UA", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDeleteGroup = async () => {
    const currentChatObj = contacts.find(c => String(c._id || c.id) === currentRoom);
    if (!currentChatObj) return;

    const confirmDelete = window.confirm("Ви впевнені, що хочете назавжди видалити цю групу? Всі повідомлення зникнуть.");
    if (!confirmDelete) return;

    try {
      const response = await fetch(`http://localhost:3001/api/chats/group/${currentRoom}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: myId }),
      });

      if (response.ok) {
        const data = await response.json();
        // Сервер видалив базу, тепер ми кажемо сокету оновити екрани всім учасникам
        socket.emit("group_deleted", { 
          chatId: currentRoom, 
          users: currentChatObj.users || data.users 
        });
      } else {
        const errorData = await response.json();
        alert(`Помилка: ${errorData.message}`);
      }
    } catch (error) {
      console.error("Помилка видалення групи:", error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 font-sans flex gap-6">
      {/* ЛІВА КОЛОНКА */}
      <div className="w-1/3 border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-bold text-gray-700">Контакти</h3>
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="px-3 py-1 bg-[#A8A5D8] text-white text-sm rounded-lg hover:bg-opacity-90 transition-colors"
          >
            + Group
          </button>
        </div>
        <div className="flex-1 p-2 flex flex-col gap-2">
          <div className="overflow-y-auto h-[calc(100vh-250px)] pr-2 custom-scrollbar">
            {contacts.map((contact) => {
              const newRoomId = contact.isGroup ? String(contact.id) : [Number(myId), Number(contact.id)]
                .sort((a, b) => a - b)
                .join("_");
              const hasUnread = unreadMessages.some(
                (msg) => msg.chat_id === newRoomId,
              );
              const isSelected = currentRoom === newRoomId;

              return (
                <div
                  key={contact.id}
                  onClick={() => {
                    setCurrentRoom(newRoomId);
                    setSelectedContactName(
                      `${contact.firstname} ${contact.lastname}`,
                    );
                    setSelectedContactId(contact.isGroup ? null : String(contact.id));
                    markAsRead(newRoomId, String(myId));
                  }}
                  className={`p-3 rounded-lg cursor-pointer mb-2 flex items-center justify-between transition-colors ${
                    isSelected ? "bg-[#A8A5D8] text-white" : "hover:bg-gray-100"
                  }`}
                >
                  <div className="font-semibold text-sm">
                    {contact.firstname} {contact.lastname}
                  </div>
                  {hasUnread && !isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm animate-pulse"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ПРАВА КОЛОНКА */}
      <div className="w-2/3 flex flex-col">
        {/* Оновлений заголовок чату */}
        <div className="flex justify-between items-center mb-4 w-full h-10">
          
          {/* Ліва частина: Назва + Крапочка (вирівняні по центру) */}
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800 leading-none">
              {selectedContactName
                ? `Чат з: ${selectedContactName}`
                : "Оберіть контакт для чату"}
            </h2>
            
            {/* РОЗУМНА КРАПОЧКА ОНЛАЙН/ОФЛАЙН */}
            {(() => {
              const currentChatObj = contacts.find(c => String(c._id || c.id) === currentRoom);
              let isOnline = false;

              if (currentChatObj) {
                if (currentChatObj.isGroupChat) {
                  // ПРАВИЛО ДЛЯ ГРУПИ: Шукаємо, чи є хоч хтось з учасників (крім мене) в масиві onlineUserIds
                  isOnline = currentChatObj.users?.some(
                    userId => String(userId) !== String(myId) && onlineUserIds.includes(String(userId))
                  );
                } else {
                  // ПРАВИЛО ДЛЯ 1-НА-1: Просто перевіряємо ID співрозмовника
                  isOnline = selectedContactId && onlineUserIds.includes(selectedContactId);
                }
              }

              return (
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    isOnline ? "bg-green-500" : "bg-gray-400"
                  }`}
                  title={isOnline ? "Є учасники онлайн" : "Всі офлайн"}
                ></span>
              );
            })()}
          </div>

          <div className="flex items-center">
            {(() => {
              const currentChatObj = contacts.find(c => String(c._id || c.id) === currentRoom);
              if (currentChatObj?.isGroupChat && String(currentChatObj.groupAdmin) === String(myId)) {
                return (
                  <button
                    onClick={handleDeleteGroup}
                    className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 shadow-sm transition-colors whitespace-nowrap"
                  >
                    Видалити групу
                  </button>
                );
              }
              return null;
            })()}
          </div>
        </div>

        {/* СПИСОК ПОВІДОМЛЕНЬ */}
        <div className="border border-gray-200 h-[450px] overflow-y-auto p-5 flex flex-col gap-4 bg-gray-50 rounded-xl shadow-inner custom-scrollbar">
          {!currentRoom ? (
            <div className="m-auto text-gray-400 text-sm">
              Оберіть користувача зліва, щоб почати спілкування.
            </div>
          ) : messages.length === 0 ? (
            <div className="m-auto text-gray-400 text-sm">
              Тут поки пусто. Напишіть щось!
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.sender === username;
              return (
                <div
                  key={index}
                  className={`flex flex-col max-w-[70%] ${isMe ? "self-end" : "self-start"}`}
                >
                  <div
                    onContextMenu={(e) => handleContextMenu(e, msg._id, isMe)}
                    className={`px-4 py-2 rounded-2xl shadow-sm ${isMe ? "bg-[#A8A5D8] text-white rounded-br-none" : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"}`}
                  >
                    <div className="font-semibold text-[11px] mb-1 opacity-60">
                      {msg.sender}
                    </div>
                    <div className="text-base break-words">{msg.content}</div>
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-1">
                    <div className="text-[10px] text-gray-400">
                      {formatTime(msg.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* CONTEXT MENU */}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="fixed bg-white border border-gray-300 rounded-lg shadow-lg z-50 min-w-[150px]"
            style={{
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
            }}
          >
            <button
              onClick={() => {
                deleteMessage(contextMenu.messageId, currentRoom);
                setContextMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              Delete
            </button>
          </div>
        )}

        {/* ІНДИКАТОР ДРУКУ */}
        <div className="h-5 text-sm text-gray-400 italic px-2 mt-1 mb-1">
          {typingUser ? `${typingUser} друкує...` : ""}
        </div>

        {/* ПОЛЕ ВВОДУ */}
        <div className="flex gap-3">
          <input
            type="text"
            value={messageInput}
            disabled={!currentRoom}
            onChange={(e) => {
              setMessageInput(e.target.value);
              socket.emit("typing", { chat_id: currentRoom, user: username });
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            className="flex-1 p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A8A5D8] disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder={
              currentRoom
                ? `Написати в ${selectedContactName}...`
                : "Оберіть чат..."
            }
          />
          <button
            onClick={handleSendMessage}
            disabled={!currentRoom || !messageInput.trim()}
            className="px-6 py-3 bg-[#A8A5D8] text-white font-semibold rounded-xl hover:bg-[#8F8CC2] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Відправити
          </button>
        </div>
      </div>

      {/* Group Chat Modal */}
      <GroupChatModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        contacts={contacts}
        onGroupCreated={(newChat) => {
          setContacts((prev) => {
            const exists = prev.some(
              (c) => String(c._id || c.id) === String(newChat._id || newChat.id)
            );
            
            if (exists) {
              return prev;
            }
            
            return [
              {
                id: newChat._id,
                firstname: newChat.chatName,
                lastname: "(Group)",
                isGroup: true,
                isGroupChat: true,
                _id: newChat._id,
                chatName: newChat.chatName,
                groupAdmin: newChat.groupAdmin || myId,
                users: newChat.users,
              },
              ...prev,
            ];
          });
          
          setCurrentRoom(newChat._id);
          setSelectedContactName(newChat.chatName || "Group Chat");
          setSelectedContactId(null);
        }}
      />
    </div>
  );
}