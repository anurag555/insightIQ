const Workspace = require('../models/Workspace');

async function requireWorkspace(req, res, next) {
  try {
    const workspaceId = req.headers['x-workspace-id'] || req.params.workspaceId || req.query.workspaceId || req.body.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ success: false, error: 'Workspace ID is required (header: x-workspace-id or param: workspaceId).' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, error: 'Workspace not found.' });
    }

    // Verify user is owner or member of this workspace
    const isOwner = workspace.ownerId.toString() === req.user._id.toString();
    const isMember = workspace.members.some(m => m.userId.toString() === req.user._id.toString());

    if (!isOwner && !isMember && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied: You do not have permission for this workspace.' });
    }

    req.workspace = workspace;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: `Workspace authorization error: ${err.message}` });
  }
}

module.exports = {
  requireWorkspace
};
