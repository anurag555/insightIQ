const mongoose = require('mongoose');

const citationSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  documentName: { type: String },
  pageNumber: { type: Number },
  passage: { type: String },
  similarityScore: { type: Number }
}, { _id: false });

const toolCallSchema = new mongoose.Schema({
  toolName: { type: String },
  args: { type: mongoose.Schema.Types.Mixed },
  result: { type: mongoose.Schema.Types.Mixed },
  executionTimeMs: { type: Number }
}, { _id: false });

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  mode: { type: String, enum: ['analyst', 'rag', 'hybrid', 'general'], default: 'analyst' },
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset' },
  toolsCalled: [toolCallSchema],
  citations: [citationSchema],
  chartSuggestion: {
    type: { type: String, enum: ['bar', 'line', 'pie', 'table', 'kpi'] },
    title: { type: String },
    xAxis: { type: String },
    yAxis: { type: String },
    data: [{ type: mongoose.Schema.Types.Mixed }]
  },
  isDemoResponse: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const conversationSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: { type: String, default: 'New Analysis' },
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset' },
  mode: {
    type: String,
    enum: ['analyst', 'rag', 'hybrid'],
    default: 'analyst',
  },
  messages: [messageSchema]
}, {
  timestamps: true,
});

module.exports = mongoose.model('Conversation', conversationSchema);
