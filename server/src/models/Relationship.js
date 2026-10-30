const mongoose = require('mongoose');

const relationshipSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  name: { type: String, required: true },
  sourceDatasetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dataset',
    required: true,
  },
  sourceColumn: { type: String, required: true },
  targetDatasetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dataset',
    required: true,
  },
  targetColumn: { type: String, required: true },
  joinType: {
    type: String,
    enum: ['INNER', 'LEFT', 'RIGHT', 'FULL'],
    default: 'INNER',
  },
  description: { type: String, default: '' },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Relationship', relationshipSchema);
