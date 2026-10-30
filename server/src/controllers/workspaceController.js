const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Dataset = require('../models/Dataset');
const Document = require('../models/Document');
const Conversation = require('../models/Conversation');
const analyticalStorageService = require('../services/analyticalStorageService');

class WorkspaceController {
  async listWorkspaces(req, res, next) {
    try {
      const workspaces = await Workspace.find({
        $or: [{ ownerId: req.user._id }, { 'members.userId': req.user._id }]
      }).sort({ updatedAt: -1 });

      res.json({ success: true, workspaces });
    } catch (err) {
      next(err);
    }
  }

  async createWorkspace(req, res, next) {
    try {
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, error: 'Workspace name is required.' });
      }

      const slug = `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Math.round(Math.random() * 1e4)}`;
      const workspace = new Workspace({
        name,
        slug,
        description: description || '',
        ownerId: req.user._id,
        members: [{ userId: req.user._id, role: 'owner' }]
      });

      await workspace.save();

      // Set as active workspace
      req.user.activeWorkspaceId = workspace._id;
      await req.user.save();

      res.status(201).json({ success: true, workspace });
    } catch (err) {
      next(err);
    }
  }

  async getWorkspace(req, res) {
    res.json({ success: true, workspace: req.workspace });
  }

  async updateWorkspace(req, res, next) {
    try {
      const { name, description, settings } = req.body;
      if (name) req.workspace.name = name;
      if (description !== undefined) req.workspace.description = description;
      if (settings) req.workspace.settings = { ...req.workspace.settings, ...settings };

      await req.workspace.save();
      res.json({ success: true, workspace: req.workspace });
    } catch (err) {
      next(err);
    }
  }

  async deleteWorkspace(req, res, next) {
    try {
      // Clean up PostgreSQL analytical tables for all datasets in workspace
      const datasets = await Dataset.find({ workspaceId: req.workspace._id });
      for (const ds of datasets) {
        if (ds.pgTableName) {
          await analyticalStorageService.dropTable(ds.pgTableName);
        }
      }

      await Dataset.deleteMany({ workspaceId: req.workspace._id });
      await Document.deleteMany({ workspaceId: req.workspace._id });
      await Conversation.deleteMany({ workspaceId: req.workspace._id });
      await Workspace.findByIdAndDelete(req.workspace._id);

      res.json({ success: true, message: 'Workspace and all associated datasets deleted.' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new WorkspaceController();
