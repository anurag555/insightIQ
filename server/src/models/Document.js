const mongoose = require('mongoose');

const chunkSchema = new mongoose.Schema({
  chunkId: { type: String, required: true },
  pageNumber: { type: Number, default: 1 },
  text: { type: String, required: true },
  charLength: { type: Number },
  embedding: [{ type: Number }], // stored vector
}, { _id: false });

const documentSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  originalName: { type: String, required: true },
  fileType: { type: String, enum: ['pdf', 'docx', 'txt'], required: true },
  fileSize: { type: Number, default: 0 },
  chunkCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['uploaded', 'processing', 'indexed', 'error'],
    default: 'uploaded'
  },
  errorMessage: { type: String },
  chunks: [chunkSchema],
  filePath: { type: String }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Document', documentSchema);
