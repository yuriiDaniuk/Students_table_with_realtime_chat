const express = require("express");
const router = express.Router();
const {
  createGroupChat,
  renameGroup,
  removeFromGroup,
  addToGroup,
  getUserChats,
  deleteGroup,
} = require("../controllers/chatController");

// Create a new group chat
router.post("/create-group", createGroupChat);

// Get all chats for a user
router.get("/user/:userId", getUserChats);

// Rename a group chat
router.put("/rename-group", renameGroup);

// Remove a user from a group chat
router.put("/remove-from-group", removeFromGroup);

// Add a user to a group chat
router.put("/add-to-group", addToGroup);

router.delete("/group/:chatId", deleteGroup);

module.exports = router;
