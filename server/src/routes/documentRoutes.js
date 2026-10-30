const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { authenticate } = require('../middleware/auth');
const { requireWorkspace } = require('../middleware/workspace');
const upload = require('../middleware/upload');

router.use(authenticate, requireWorkspace);

router.post('/upload', upload.single('file'), documentController.uploadDocument);
router.get('/', documentController.listDocuments);
router.delete('/:documentId', documentController.deleteDocument);
router.post('/query', documentController.queryDocuments);

module.exports = router;
