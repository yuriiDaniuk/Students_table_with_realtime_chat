const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

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

const chatSchema = new mongoose.Schema({
  name: String,
  members: [String],
});

const messageSchema = new mongoose.Schema({
  chat_id: String,
  sender: String,
  content: String,
  isRead: { type: Boolean, default: false },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Chat = mongoose.model("Chat", chatSchema);
const Message = mongoose.model("Message", messageSchema);

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
    console.log(`Користувач зайшов у кімнату: ${chatId}`);
  });

  socket.on("typing", ({ chat_id, user }) => {
    socket.to(chat_id).emit("typing", { user, chat_id });
  });

  socket.on("chat_message", async ({ chat_id, sender, content }) => {
    try {
      const message = new Message({ chat_id, sender, content, isRead: false });
      const savedMessage = await message.save();
      io.to(chat_id).emit("receive_message", savedMessage);

      // Extract receiver ID from chat_id (format: "5_8")
      const [id1, id2] = chat_id.split("_");
      const receiverId = String(socket.userId) === String(id1) ? id2 : id1;

      console.log(`Відправляємо сповіщення юзеру: user_${receiverId}`); // Лог для перевірки

      // Emit global notification to receiver's personal room
      io.to(`user_${receiverId}`).emit("global_notification", {
        chat_id,
        sender,
        content: content.substring(0, 50),
        createdAt: savedMessage.createdAt,
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("mark_messages_read", async ({ chat_id, reader_name }) => {
    try {
      await Message.updateMany(
        { chat_id, sender: { $ne: reader_name }, isRead: false },
        { $set: { isRead: true } },
      );
      socket.to(chat_id).emit("messages_marked_read");
    } catch (error) {
      console.error("Error marking messages as read:", error);
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
