const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

// Import models
const Chat = require("./models/Chat");
const Message = require("./models/Message");
const User = require("./models/User");

// Import routes
const chatRoutes = require("./routes/chatRoutes");

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);
app.use(express.json());

mongoose
  .connect(
    "mongodb+srv://danukura2007_db_user:pLAWA4RMertxWTaI@pvilaba6.7p5ef1b.mongodb.net/?appName=PviLaba6",
  )
  .then(() => console.log("MongoDB connected successfully"))
  .catch((error) => console.error("MongoDB connection error:", error));

// Use routes
app.use("/api/chats", chatRoutes);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const onlineUsers = {};

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("user_connected", (userId) => {
    onlineUsers[userId] = socket.id;
    socket.userId = userId;
    socket.join(`user_${userId}`); // Join personal notification room
    
    // Send the current list of all online user IDs to the connecting user
    const onlineUserIds = Object.keys(onlineUsers);
    socket.emit("initial_online_users", onlineUserIds);
    
    // Broadcast that this user is now online to everyone
    io.emit("user_status", { userId, status: "online" });
  });

  socket.on("join_room", (chatId) => {
    // Leave previous chat room, but KEEP personal notification room (user_${userId})
    socket.rooms.forEach((room) => {
      if (room !== socket.id && !room.startsWith("user_")) {
        socket.leave(room);
      }
    });

    socket.join(chatId);
    console.log(`Користувач ${socket.userId} зайшов у кімнату: ${chatId}`);
  });

  socket.on("new_group_created", (chat) => {
    // Broadcast group invite to all members except the creator
    chat.users.forEach((userId) => {
      if (String(userId) !== String(socket.userId)) {
        io.to(`user_${userId}`).emit("group_invite", {
          _id: chat._id,
          id: chat._id,
          firstname: chat.chatName,
          lastname: "(Group)",
          isGroup: true,
          isGroupChat: true,
          chatName: chat.chatName,
          users: chat.users,
          groupAdmin: chat.groupAdmin,
          updatedAt: chat.updatedAt,
        });
      }
    });
    console.log(`✅ Group "${chat.chatName}" created and invites sent to members`);
  });

  socket.on("group_deleted", ({ chatId, users }) => {
    // Сповіщаємо всіх учасників групи, щоб їхній React видалив чат з меню
    if (users && Array.isArray(users)) {
      users.forEach((userId) => {
        io.to(`user_${userId}`).emit("group_was_deleted", { chatId });
      });
    }
    console.log(`🗑️ Group ${chatId} completely deleted and members notified`);
  });

  socket.on("kicked_from_group", ({ userId, chatId }) => {
    // Notify the kicked user in their personal notification room
    io.to(`user_${userId}`).emit("removed_from_group", {
      chat_id: chatId,
      message: "You have been removed from this group.",
    });
    console.log(`✅ User ${userId} kicked from group ${chatId}`);
  });

  socket.on("typing", ({ chat_id, user }) => {
    socket.to(chat_id).emit("typing", { user, chat_id });
  });

  socket.on("chat_message", async ({ chat_id, sender, content }) => {
    try {
      const message = new Message({ chat_id, sender, senderId: socket.userId, content, isRead: false });
      const savedMessage = await message.save();
      
      // Broadcast message to all users in the chat room
      io.to(chat_id).emit("receive_message", savedMessage);

      // Emit global notification to users NOT in the chat room (for unread count, etc.)
      // This assumes the Chat model stores user IDs in a 'users' array
      const chat = await Chat.findById(chat_id);
      if (chat && chat.users) {
        chat.users.forEach((userId) => {
          if (String(userId) !== String(socket.userId)) {
            io.to(`user_${userId}`).emit("global_notification", {
              chat_id,
              sender,
              content: content.substring(0, 50),
              createdAt: savedMessage.createdAt,
            });
          }
        });
      }
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("mark_messages_read", async ({ chat_id, reader_id }) => {
    try {
      await Message.updateMany(
        { chat_id, senderId: { $ne: reader_id }, isRead: false },
        { $set: { isRead: true } },
      );
      socket.to(chat_id).emit("messages_marked_read");
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  });

  socket.on("delete_message", async ({ messageId, chatId }) => {
    try {
      // Find the message by ID
      const message = await Message.findById(messageId);

      if (!message) {
        console.error("Message not found:", messageId);
        socket.emit("delete_message_error", { error: "Message not found" });
        return;
      }

      // Check if the sender ID matches the current user's ID
      if (String(message.senderId) !== String(socket.userId)) {
        console.error("Unauthorized deletion attempt by user:", socket.userId);
        socket.emit("delete_message_error", { error: "You can only delete your own messages" });
        return;
      }

      // Delete the message
      await Message.findByIdAndDelete(messageId);
      console.log(`✅ Message ${messageId} deleted by user ${socket.userId}`);

      // Broadcast the deletion to all users in the chat room
      io.to(chatId).emit("message_deleted", { messageId, chatId });
    } catch (error) {
      console.error("Error deleting message:", error);
      socket.emit("delete_message_error", { error: "Failed to delete message" });
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    if (socket.userId) {
      console.log(`User ${socket.userId} is now offline`);
      delete onlineUsers[socket.userId];
      // Broadcast offline status to all connected clients
      io.emit("user_status", { userId: socket.userId, status: "offline" });
    }
  }); 
}); 


app.get("/api/unread/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const messages = await Message.find({
      chat_id: { $regex: new RegExp(`(^|_)${userId}(_|$)`) },
      isRead: false,
    });

    res.json(messages);
  } catch (error) {
    console.error("Error fetching unread messages:", error);
    res.status(500).json({ error: "Failed to load unread messages" });
  }
});

app.get("/api/messages/:chatId", async (req, res) => {
  try {
    const messages = await Message.find({ chat_id: req.params.chatId }).sort({
      createdAt: 1,
    });
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
