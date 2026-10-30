const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');
const { requireWorkspace } = require('../middleware/workspace');

router.use(authenticate, requireWorkspace);

router.post('/chat', aiController.chat);
router.get('/conversations', aiController.listConversations);
router.post('/conversations', aiController.createConversation);
router.get('/conversations/:conversationId', aiController.getConversation);

module.exports = router;
