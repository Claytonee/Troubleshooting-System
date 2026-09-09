const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const aiChatController = require('../controllers/aiChatController');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin', 'subadmin', 'school', 'teacher'));

router.get('/status', aiChatController.status);
router.get('/chats', aiChatController.getChats);
router.get('/chats/:id', aiChatController.getChat);
router.delete('/chats/:id', aiChatController.deleteChat);
router.post('/chat', aiChatController.sendMessage);

module.exports = router;
