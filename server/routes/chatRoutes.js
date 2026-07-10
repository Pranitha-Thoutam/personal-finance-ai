const express = require("express");
const router  = express.Router();

const { chat, getChatHistory } = require("../controllers/chatController");

// POST /api/chat          → send message, get AI reply, persist both turns
// GET  /api/chat/history  → return full conversation history (oldest first)

router.post("/",        chat);
router.get ("/history", getChatHistory);

module.exports = router;
