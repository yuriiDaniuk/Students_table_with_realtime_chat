const Chat = require("../models/Chat");
const User = require("../models/User");
const Message = require("../models/Message");

// GET USER CHATS
exports.getUserChats = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        message: "Please provide userId",
      });
    }

    // Find all chats where this user is a member
    const userChats = await Chat.find({
      users: { $in: [String(userId)] },
      isGroupChat: true,
    });

    res.json(userChats);
  } catch (error) {
    console.error("Error fetching user chats:", error);
    res.status(500).json({
      message: "Error fetching user chats",
      error: error.message,
    });
  }
};

// CREATE GROUP CHAT
exports.createGroupChat = async (req, res) => {
  try {
    const { users, chatName, userId } = req.body;

    // Validate input
    if (!users || users.length === 0 || !chatName || !userId) {
      return res
        .status(400)
        .json({
          message: "Please provide users, chatName, and userId",
        });
    }

    // Users must be at least 2 for a group chat
    if (users.length < 2) {
      return res
        .status(400)
        .json({
          message: "A group chat must have at least 2 users",
        });
    }

    // Convert all IDs to strings
    const userIds = users.map((id) => String(id));
    const adminId = String(userId);

    // Ensure userId (current user/admin) is in the users array
    if (!userIds.includes(adminId)) {
      userIds.push(adminId);
    }

    // Create the group chat
    const groupChat = await Chat.create({
      chatName,
      isGroupChat: true,
      users: userIds,
      groupAdmin: adminId,
    });

    res.status(201).json(groupChat);
  } catch (error) {
    console.error("Error creating group chat:", error);
    res.status(500).json({
      message: "Error creating group chat",
      error: error.message,
    });
  }
};

// RENAME GROUP
exports.renameGroup = async (req, res) => {
  try {
    const { chatId, chatName, userId } = req.body;

    // Validate input
    if (!chatId || !chatName || !userId) {
      return res
        .status(400)
        .json({
          message: "Please provide chatId, chatName, and userId",
        });
    }

    const adminId = String(userId);

    // Find the chat
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    // Verify that the user is the group admin
    if (String(chat.groupAdmin) !== adminId) {
      return res.status(403).json({
        message: "Only the group admin can rename the group",
      });
    }

    // Update the chat name
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { chatName },
      { new: true }
    );

    res.json(updatedChat);
  } catch (error) {
    console.error("Error renaming group:", error);
    res.status(500).json({
      message: "Error renaming group",
      error: error.message,
    });
  }
};

// REMOVE FROM GROUP
exports.removeFromGroup = async (req, res) => {
  try {
    const { chatId, userId, removedUserId } = req.body;

    // Validate input
    if (!chatId || !userId || !removedUserId) {
      return res
        .status(400)
        .json({
          message: "Please provide chatId, userId, and removedUserId",
        });
    }

    // Convert to strings for consistency
    const adminId = String(userId);
    const userToRemove = String(removedUserId);

    // Find the chat
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    // Check if it's a group chat
    if (!chat.isGroupChat) {
      return res.status(400).json({
        message: "This action can only be performed on group chats",
      });
    }

    // Verify that the user is the group admin
    if (String(chat.groupAdmin) !== adminId) {
      return res.status(403).json({
        message: "Only the group admin can remove users from the group",
      });
    }

    // Remove the user from the group
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { $pull: { users: userToRemove } },
      { new: true }
    );

    res.json(updatedChat);
  } catch (error) {
    console.error("Error removing user from group:", error);
    res.status(500).json({
      message: "Error removing user from group",
      error: error.message,
    });
  }
};

// ADD TO GROUP
exports.addToGroup = async (req, res) => {
  try {
    const { chatId, userId, newUserId } = req.body;

    // Validate input
    if (!chatId || !userId || !newUserId) {
      return res
        .status(400)
        .json({
          message: "Please provide chatId, userId, and newUserId",
        });
    }

    // Convert to strings for consistency
    const adminId = String(userId);
    const userToAdd = String(newUserId);

    // Find the chat
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    // Check if it's a group chat
    if (!chat.isGroupChat) {
      return res.status(400).json({
        message: "This action can only be performed on group chats",
      });
    }

    // Verify that the user is the group admin
    if (String(chat.groupAdmin) !== adminId) {
      return res.status(403).json({
        message: "Only the group admin can add users to the group",
      });
    }

    // Check if user is already in the group
    if (chat.users.includes(userToAdd)) {
      return res.status(400).json({
        message: "User is already a member of this group",
      });
    }

    // Add the user to the group
    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      { $push: { users: userToAdd } },
      { new: true }
    );

    res.json(updatedChat);
  } catch (error) {
    console.error("Error adding user to group:", error);
    res.status(500).json({
      message: "Error adding user to group",
      error: error.message,
    });
  }
};

// DELETE GROUP AND ITS MESSAGES
exports.deleteGroup = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({ message: "Please provide chatId and userId" });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    // Перевіряємо чи це адмін
    if (String(chat.groupAdmin) !== String(userId)) {
      return res.status(403).json({ message: "Only the group admin can delete the group" });
    }

    // ВИДАЛЯЄМО ВСІ ПОВІДОМЛЕННЯ з цієї групи, щоб не було "сміття"
    await Message.deleteMany({ chat_id: chatId });

    // Видаляємо саму групу
    await Chat.findByIdAndDelete(chatId);

    // Повертаємо список юзерів, щоб фронтенд знав, кому відправити сокет
    res.json({ message: "Group deleted successfully", users: chat.users });
  } catch (error) {
    console.error("Error deleting group:", error);
    res.status(500).json({ message: "Error deleting group", error: error.message });
  }
};