const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  cleanName: { type: String, required: true },
  dataType: { 
    type: String, 
    enum: ['string', 'numeric', 'date', 'boolean', 'categorical'],
    default: 'string'
  },
  semanticRole: { 
    type: String,
    enum: [
      'revenue', 'cost', 'profit', 'quantity', 'date', 'product', 
      'category', 'customer_id', 'transaction_id', 'region', 
      'price', 'discount', 'status', 'dimension', 'measure', 'none'
    ],
    default: 'none'
  },
  confidence: { type: Number, default: 0.5 },
  isAmbiguous: { type: Boolean, default: false },
  suggestedRoles: [{ type: String }],
  sampleValues: [{ type: mongoose.Schema.Types.Mixed }],
  stats: {
    min: mongoose.Schema.Types.Mixed,
    max: mongoose.Schema.Types.Mixed,
    avg: Number,
    nullCount: { type: Number, default: 0 },
    uniqueCount: { type: Number, default: 0 }
  }
}, { _id: false });

const proposedCleaningSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['drop_duplicates', 'fill_missing_numeric', 'fill_missing_string', 'remove_outliers', 'standardize_dates'],
    required: true 
  },
  column: { type: String },
  strategy: { type: String }, // e.g. 'median', 'mode', 'drop', 'cap'
  description: { type: String, required: true },
  affectedCount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'applied', 'skipped'], default: 'pending' }
}, { _id: false });

const datasetSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  originalFileName: { type: String, required: true },
  fileType: { type: String, enum: ['csv', 'xlsx'], required: true },
  fileSize: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['uploaded', 'profiled', 'stored', 'error'],
    default: 'uploaded'
  },
  pgTableName: { type: String },
  rowCount: { type: Number, default: 0 },
  columnCount: { type: Number, default: 0 },
  columns: [columnSchema],
  qualityReport: {
    missingValueCount: { type: Number, default: 0 },
    duplicateRowCount: { type: Number, default: 0 },
    invalidDatesCount: { type: Number, default: 0 },
    outliers: [{
      column: String,
      count: Number,
      threshold: String,
      samples: [mongoose.Schema.Types.Mixed]
    }],
    overallScore: { type: Number, default: 100 },
    proposedCleanings: [proposedCleaningSchema]
  },
  cleaningHistory: [{
    appliedAt: { type: Date, default: Date.now },
    operation: String,
    rowsAffected: Number,
    description: String,
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  sourceFilePath: { type: String },
  sampleRows: [{ type: mongoose.Schema.Types.Mixed }]
}, {
  timestamps: true,
});

module.exports = mongoose.model('Dataset', datasetSchema);
