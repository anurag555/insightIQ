const express = require('express');
const router = express.Router();
const workspaceController = require('../controllers/workspaceController');
const { authenticate } = require('../middleware/auth');
const { requireWorkspace } = require('../middleware/workspace');

router.use(authenticate);

router.get('/', workspaceController.listWorkspaces);
router.post('/', workspaceController.createWorkspace);
router.get('/:workspaceId', requireWorkspace, workspaceController.getWorkspace);
router.put('/:workspaceId', requireWorkspace, workspaceController.updateWorkspace);
router.delete('/:workspaceId', requireWorkspace, workspaceController.deleteWorkspace);

module.exports = router;
