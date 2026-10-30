const path = require('path');
const Dataset = require('../models/Dataset');
const Relationship = require('../models/Relationship');
const AuditLog = require('../models/AuditLog');
const ingestionService = require('../services/ingestionService');
const profilingService = require('../services/profilingService');
const cleaningService = require('../services/cleaningService');
const analyticalStorageService = require('../services/analyticalStorageService');

class DatasetController {
  /**
   * Upload CSV or XLSX dataset, profile schema, and compute data quality report.
   */
  async uploadDataset(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded. Please attach a CSV or XLSX file.' });
      }

      const filePath = req.file.path;
      const originalFileName = req.file.originalname;
      const ext = path.extname(originalFileName).toLowerCase().replace('.', '');
      const fileType = ext === 'xlsx' || ext === 'xls' ? 'xlsx' : 'csv';

      // 1. Inspect and parse preview
      const inspection = await ingestionService.inspectFile(filePath, fileType);

      // 2. Profile schema & infer semantic roles
      const columns = profilingService.profileDataset(inspection.headers, inspection.sampleRows);

      // 3. Inspect quality and generate proposals
      const qualityReport = cleaningService.generateQualityReport(columns, inspection.sampleRows);

      const dataset = new Dataset({
        workspaceId: req.workspace._id,
        name: path.basename(originalFileName, path.extname(originalFileName)).replace(/[-_]/g, ' '),
        originalFileName,
        fileType,
        fileSize: req.file.size,
        status: 'uploaded',
        rowCount: inspection.rowCount,
        columnCount: inspection.columnCount,
        columns,
        qualityReport,
        cleaningHistory: [],
        sourceFilePath: filePath,
        sampleRows: inspection.sampleRows.slice(0, 15)
      });

      await dataset.save();

      // Audit log
      await AuditLog.create({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        action: 'upload_dataset',
        resourceType: 'dataset',
        resourceId: dataset._id.toString(),
        details: { fileName: originalFileName, rowCount: inspection.rowCount }
      });

      res.status(201).json({
        success: true,
        dataset
      });
    } catch (err) {
      next(err);
    }
  }

  async listDatasets(req, res, next) {
    try {
      const datasets = await Dataset.find({ workspaceId: req.workspace._id })
        .select('-sampleRows')
        .sort({ createdAt: -1 });
      res.json({ success: true, datasets });
    } catch (err) {
      next(err);
    }
  }

  async getDataset(req, res, next) {
    try {
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset) {
        return res.status(404).json({ success: false, error: 'Dataset not found in this workspace.' });
      }

      res.json({ success: true, dataset });
    } catch (err) {
      next(err);
    }
  }

  /**
   * User manually adjusts column data types or semantic roles.
   */
  async updateColumnMappings(req, res, next) {
    try {
      const { mappings } = req.body; // array of { originalName, dataType, semanticRole }
      if (!Array.isArray(mappings)) {
        return res.status(400).json({ success: false, error: 'Mappings must be an array of column updates.' });
      }

      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset) {
        return res.status(404).json({ success: false, error: 'Dataset not found.' });
      }

      mappings.forEach(m => {
        const col = dataset.columns.find(c => c.originalName === m.originalName || c.cleanName === m.cleanName);
        if (col) {
          if (m.dataType) col.dataType = m.dataType;
          if (m.semanticRole) {
            col.semanticRole = m.semanticRole;
            col.confidence = 1.0; // Manual user confirmation
            col.isAmbiguous = false;
          }
        }
      });

      await dataset.save();

      res.json({ success: true, dataset });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Applies approved data cleaning operations with audit trail.
   */
  async applyCleanings(req, res, next) {
    try {
      const { approvedCleaningIds } = req.body; // array of string IDs
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset) {
        return res.status(404).json({ success: false, error: 'Dataset not found.' });
      }

      const pendingCleanings = dataset.qualityReport?.proposedCleanings || [];
      const opsToApply = pendingCleanings.filter(p => approvedCleaningIds.includes(p.id));

      if (opsToApply.length === 0) {
        return res.status(400).json({ success: false, error: 'No matching cleaning operations found.' });
      }

      // Read sample/active rows
      const fileData = await ingestionService.inspectFile(dataset.sourceFilePath, dataset.fileType);
      const rows = fileData.allRows || await ingestionService.parseAllCsvRows(dataset.sourceFilePath);

      // Clean rows
      const { cleanedRows, auditLogs } = cleaningService.applyCleanings(rows, dataset.columns, opsToApply);

      // Recalculate quality report
      const newReport = cleaningService.generateQualityReport(dataset.columns, cleanedRows.slice(0, 50));

      // Mark applied in proposals
      newReport.proposedCleanings.forEach(p => {
        if (approvedCleaningIds.includes(p.id)) {
          p.status = 'applied';
        }
      });

      dataset.qualityReport = newReport;
      dataset.sampleRows = cleanedRows.slice(0, 15);
      dataset.rowCount = cleanedRows.length;

      // Append to cleaning history
      auditLogs.forEach(log => {
        dataset.cleaningHistory.push({
          appliedAt: new Date(),
          operation: log.operation,
          rowsAffected: log.rowsAffected,
          description: log.description,
          appliedBy: req.user._id
        });
      });

      await dataset.save();

      // If already stored in Postgres, re-sync Postgres table
      if (dataset.pgTableName) {
        await analyticalStorageService.createDatasetTable(req.workspace._id, dataset._id, dataset.columns);
        await analyticalStorageService.insertRowsBatch(dataset.pgTableName, dataset.columns, cleanedRows);
      }

      res.json({
        success: true,
        message: `Applied ${opsToApply.length} cleaning operation(s).`,
        dataset
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Persists dataset into PostgreSQL analytical table.
   */
  async storeInAnalyticalDatabase(req, res, next) {
    try {
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset) {
        return res.status(404).json({ success: false, error: 'Dataset not found.' });
      }

      // Load all rows from file
      let allRows = [];
      if (dataset.fileType === 'csv') {
        allRows = await ingestionService.parseAllCsvRows(dataset.sourceFilePath);
      } else {
        const parsed = await ingestionService.parseExcel(dataset.sourceFilePath);
        allRows = parsed.allRows;
      }

      // Create Postgres Table
      const tableName = await analyticalStorageService.createDatasetTable(req.workspace._id, dataset._id, dataset.columns);

      // Batch Insert
      const insertedCount = await analyticalStorageService.insertRowsBatch(tableName, dataset.columns, allRows);

      dataset.pgTableName = tableName;
      dataset.status = 'stored';
      dataset.rowCount = insertedCount;
      await dataset.save();

      await AuditLog.create({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        action: 'store_analytical_dataset',
        resourceType: 'dataset',
        resourceId: dataset._id.toString(),
        details: { tableName, rowCount: insertedCount }
      });

      res.json({
        success: true,
        message: `Successfully loaded ${insertedCount} rows into analytical PostgreSQL table.`,
        dataset
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Paginated data explorer view from PostgreSQL table.
   */
  async getDatasetData(req, res, next) {
    try {
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset || !dataset.pgTableName) {
        return res.status(400).json({ success: false, error: 'Dataset is not stored in PostgreSQL yet.' });
      }

      const limit = parseInt(req.query.limit || '50', 10);
      const offset = parseInt(req.query.offset || '0', 10);
      const sortColumn = req.query.sortColumn || '_id';
      const sortOrder = req.query.sortOrder || 'ASC';

      const result = await analyticalStorageService.getTableRows(dataset.pgTableName, limit, offset, sortColumn, sortOrder);

      res.json({
        success: true,
        datasetName: dataset.name,
        columns: dataset.columns,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete dataset and clean up PostgreSQL table.
   */
  async deleteDataset(req, res, next) {
    try {
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset) {
        return res.status(404).json({ success: false, error: 'Dataset not found.' });
      }

      if (dataset.pgTableName) {
        await analyticalStorageService.dropTable(dataset.pgTableName);
      }

      await Dataset.findByIdAndDelete(dataset._id);
      await Relationship.deleteMany({
        $or: [{ sourceDatasetId: dataset._id }, { targetDatasetId: dataset._id }]
      });

      res.json({ success: true, message: 'Dataset and analytical tables removed.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create relationship between two datasets.
   */
  async createRelationship(req, res, next) {
    try {
      const { name, sourceDatasetId, sourceColumn, targetDatasetId, targetColumn, joinType, description } = req.body;

      const [ds1, ds2] = await Promise.all([
        Dataset.findOne({ _id: sourceDatasetId, workspaceId: req.workspace._id }),
        Dataset.findOne({ _id: targetDatasetId, workspaceId: req.workspace._id })
      ]);

      if (!ds1 || !ds2) {
        return res.status(400).json({ success: false, error: 'Both datasets must exist in the active workspace.' });
      }

      const rel = new Relationship({
        workspaceId: req.workspace._id,
        name: name || `${ds1.name} <-> ${ds2.name}`,
        sourceDatasetId,
        sourceColumn,
        targetDatasetId,
        targetColumn,
        joinType: joinType || 'INNER',
        description: description || ''
      });

      await rel.save();
      res.status(201).json({ success: true, relationship: rel });
    } catch (err) {
      next(err);
    }
  }

  async listRelationships(req, res, next) {
    try {
      const relationships = await Relationship.find({ workspaceId: req.workspace._id })
        .populate('sourceDatasetId', 'name pgTableName')
        .populate('targetDatasetId', 'name pgTableName');
      res.json({ success: true, relationships });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Execute safe JOIN query between related datasets.
   */
  async executeJoinQuery(req, res, next) {
    try {
      const { relationshipId, limit = 50 } = req.body;
      const rel = await Relationship.findOne({ _id: relationshipId, workspaceId: req.workspace._id })
        .populate('sourceDatasetId')
        .populate('targetDatasetId');

      if (!rel) {
        return res.status(404).json({ success: false, error: 'Relationship not found.' });
      }

      const rows = await analyticalStorageService.executeJoin(
        req.workspace._id,
        rel.sourceDatasetId,
        rel.targetDatasetId,
        rel.sourceColumn,
        rel.targetColumn,
        rel.joinType,
        limit
      );

      res.json({
        success: true,
        relationship: rel.name,
        rowCount: rows.length,
        rows
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DatasetController();
