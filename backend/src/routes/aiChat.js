const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const aiChatController = require('../controllers/aiChatController');

const router = express.Router();

router.use(authenticate);
// The assistant helps whoever is standing in front of the equipment: a
// teacher, a school administrator, or the engineer on the road. The platform
// administrator runs the system rather than fixing tablets, so it is not theirs
// (user instruction, 2026-09-09).
router.use(authorize('subadmin', 'school', 'teacher'));

router.get('/status', aiChatController.status);
router.get('/chats', aiChatController.getChats);
router.get('/chats/:id', aiChatController.getChat);
router.delete('/chats/:id', aiChatController.deleteChat);
router.post('/chat', aiChatController.sendMessage);

module.exports = router;
