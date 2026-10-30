const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  action: {
    type: String,
    required: true,
  },
  resourceType: {
    type: String,
    enum: ['dataset', 'document', 'cleaning', 'relationship', 'workspace', 'auth'],
    required: true,
  },
  resourceId: {
    type: String,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
  },
  ipAddress: {
    type: String,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
