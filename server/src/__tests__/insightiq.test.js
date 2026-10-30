const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../app');
const { connectMongo, closeMongo } = require('../config/db');
const { testPgConnection, query } = require('../config/pg');
const ingestionService = require('../services/ingestionService');
const profilingService = require('../services/profilingService');
const cleaningService = require('../services/cleaningService');
const analyticalStorageService = require('../services/analyticalStorageService');
const analyticsEngine = require('../services/analyticsEngine');
const aiAnalystService = require('../services/aiAnalystService');
const ragService = require('../services/ragService');

describe('InsightIQ Comprehensive Test Suite', () => {
  let userAToken = null;
  let userBToken = null;
  let workspaceAId = null;
  let workspaceBId = null;
  let datasetAId = null;
  let testTableName = null;

  beforeAll(async () => {
    await connectMongo();
    await testPgConnection();
  }, 30000);

  afterAll(async () => {
    // Clean up test postgres table if created
    if (testTableName) {
      await query(`DROP TABLE IF EXISTS "${testTableName}" CASCADE;`);
    }
    await closeMongo();
  });

  describe('Module 1: Authentication & Workspace Isolation', () => {
    it('should register User A and automatically provision a default workspace', async () => {
      const email = `usera_${Date.now()}@insightiq.internal`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Analyst User A',
          email,
          password: 'SecurePassword2026!'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.workspace).toBeDefined();

      userAToken = res.body.token;
      workspaceAId = res.body.workspace._id;
    });

    it('should register User B in an isolated separate workspace', async () => {
      const email = `userb_${Date.now()}@insightiq.internal`;
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Analyst User B',
          email,
          password: 'SecurePassword2026!'
        });

      expect(res.status).toBe(201);
      userBToken = res.body.token;
      workspaceBId = res.body.workspace._id;
      expect(workspaceBId).not.toEqual(workspaceAId);
    });

    it('should enforce strict workspace isolation (User B cannot access User A workspace)', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceAId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Access denied/i);
    });
  });

  describe('Module 2 & 3: Ingestion, Schema Profiling & Semantic Mapping', () => {
    it('should parse CSV file and detect column headers and sample data', async () => {
      const csvPath = path.join(__dirname, '../../../sample-data/retail_sales_transactions.csv');
      const inspection = await ingestionService.inspectFile(csvPath, 'csv');

      expect(inspection.rowCount).toBeGreaterThanOrEqual(1000);
      expect(inspection.columnCount).toBe(12);
      expect(inspection.headers).toContain('total_revenue');
      expect(inspection.headers).toContain('date');
      expect(inspection.headers).toContain('category');
    });

    it('should profile data types and infer semantic roles with confidence scores', () => {
      const headers = ['date', 'total_revenue', 'product', 'category', 'customer_id', 'quantity'];
      const sampleRows = [
        { date: '2024-05-10', total_revenue: '150.50', product: 'Pro Laptop 15', category: 'Electronics', customer_id: 'CUST-1001', quantity: '2' },
        { date: '2024-05-11', total_revenue: '45.00', product: 'Gel Pen', category: 'Office Supplies', customer_id: 'CUST-1002', quantity: '5' }
      ];

      const columns = profilingService.profileDataset(headers, sampleRows);
      expect(columns.length).toBe(6);

      const revCol = columns.find(c => c.cleanName === 'total_revenue');
      expect(revCol.dataType).toBe('numeric');
      expect(revCol.semanticRole).toBe('revenue');
      expect(revCol.confidence).toBeGreaterThanOrEqual(0.9);

      const dateCol = columns.find(c => c.cleanName === 'date');
      expect(dateCol.dataType).toBe('date');
      expect(dateCol.semanticRole).toBe('date');

      const custCol = columns.find(c => c.cleanName === 'customer_id');
      expect(custCol.semanticRole).toBe('customer_id');
    });

    it('should parse Excel (.xlsx) workbook accurately', async () => {
      const xlsxPath = path.join(__dirname, '../../../sample-data/sales_q4_2024.xlsx');
      const inspection = await ingestionService.inspectFile(xlsxPath, 'xlsx');

      expect(inspection.rowCount).toBeGreaterThan(0);
      expect(inspection.headers).toContain('Amount');
      expect(inspection.headers).toContain('Client');
    });
  });

  describe('Module 4: Data Quality Inspection & Cleaning Proposals', () => {
    it('should detect duplicate rows and missing values and generate proposals', () => {
      const columns = [
        { originalName: 'id', cleanName: 'id', dataType: 'string', semanticRole: 'transaction_id' },
        { originalName: 'revenue', cleanName: 'revenue', dataType: 'numeric', semanticRole: 'revenue' }
      ];
      const rowsWithIssues = [
        { id: '1', revenue: '100' },
        { id: '1', revenue: '100' }, // duplicate
        { id: '2', revenue: null } // missing
      ];

      const report = cleaningService.generateQualityReport(columns, rowsWithIssues);
      expect(report.duplicateRowCount).toBe(1);
      expect(report.missingValueCount).toBe(1);
      expect(report.overallScore).toBeLessThan(100);
      expect(report.proposedCleanings.some(p => p.type === 'drop_duplicates')).toBe(true);
      expect(report.proposedCleanings.some(p => p.type === 'fill_missing_numeric')).toBe(true);
    });

    it('should apply deduplication without altering original records unpredictably', () => {
      const columns = [{ originalName: 'val', cleanName: 'val', dataType: 'string' }];
      const rows = [{ val: 'A' }, { val: 'B' }, { val: 'A' }];
      const ops = [{ id: 'clean_dedup', type: 'drop_duplicates' }];

      const { cleanedRows, auditLogs } = cleaningService.applyCleanings(rows, columns, ops);
      expect(cleanedRows.length).toBe(2);
      expect(auditLogs[0].rowsAffected).toBe(1);
    });
  });

  describe('Module 5 & 6: Analytical PostgreSQL Storage & Deterministic Engine', () => {
    let mockDataset = null;

    it('should upload dataset via API and store in PostgreSQL analytical table', async () => {
      const csvPath = path.join(__dirname, '../../../sample-data/retail_sales_transactions.csv');
      
      const uploadRes = await request(app)
        .post('/api/datasets/upload')
        .set('Authorization', `Bearer ${userAToken}`)
        .set('x-workspace-id', workspaceAId)
        .attach('file', csvPath);

      expect(uploadRes.status).toBe(201);
      datasetAId = uploadRes.body.dataset._id;
      mockDataset = uploadRes.body.dataset;

      // Store in PostgreSQL
      const storeRes = await request(app)
        .post(`/api/datasets/${datasetAId}/store`)
        .set('Authorization', `Bearer ${userAToken}`)
        .set('x-workspace-id', workspaceAId);

      expect(storeRes.status).toBe(200);
      expect(storeRes.body.success).toBe(true);
      expect(storeRes.body.dataset.status).toBe('stored');
      testTableName = storeRes.body.dataset.pgTableName;
      mockDataset.pgTableName = testTableName;
    });

    it('should compute deterministic summary statistics from PostgreSQL table', async () => {
      const overview = await analyticsEngine.getDatasetOverview(mockDataset);
      expect(overview.rowCount).toBe(1200);
      expect(overview.totalRevenue).toBeGreaterThan(0);
      expect(overview.averageRevenue).toBeGreaterThan(0);
      expect(overview.minDate).toBeDefined();
      expect(overview.maxDate).toBeDefined();
    });

    it('should compute chronological monthly time series with proper aggregations', async () => {
      const ts = await analyticsEngine.getTimeSeries(mockDataset, 'date', 'total_revenue', 'month');
      expect(ts.hasDate).toBe(true);
      expect(ts.series.length).toBe(12); // 12 months in 2024
      expect(ts.series[0].value).toBeGreaterThan(0);
      expect(ts.series[0].label).toBeDefined();
    });

    it('should perform period-over-period comparison (MoM)', async () => {
      const comparison = await analyticsEngine.getPeriodComparison(mockDataset, 'date', 'total_revenue', 'month');
      expect(comparison.canCompare).toBe(true);
      expect(comparison.currentPeriod).toBeDefined();
      expect(comparison.previousPeriod).toBeDefined();
      expect(typeof comparison.percentChange).toBe('number');
    });

    it('should detect statistical anomalies using 2-sigma thresholds', async () => {
      const anomalyRes = await analyticsEngine.detectAnomalies(mockDataset);
      expect(anomalyRes.mean).toBeGreaterThan(0);
      expect(anomalyRes.upperLimit).toBeGreaterThan(anomalyRes.mean);
    });
  });

  describe('Module 8: AI Business Analyst Controlled Tool Calling', () => {
    it('should execute authorized tool "getRevenueByPeriod" with valid results', async () => {
      const res = await aiAnalystService.executeTool('getRevenueByPeriod', { granularity: 'month' }, {
        pgTableName: testTableName,
        columns: [
          { cleanName: 'date', dataType: 'date', semanticRole: 'date' },
          { cleanName: 'total_revenue', dataType: 'numeric', semanticRole: 'revenue' }
        ]
      });

      expect(res.toolName).toBe('getRevenueByPeriod');
      expect(res.result.series.length).toBe(12);
      expect(res.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should reject execution of unauthorized tools', async () => {
      await expect(
        aiAnalystService.executeTool('dropDatabase', {}, {})
      ).rejects.toThrow(/Unrecognized analytical tool/);
    });
  });

  describe('Module 9: RAG Document Intelligence Pipeline', () => {
    it('should chunk document text into overlapping windows and compute normalized vectors', () => {
      const samplePages = [
        { pageNumber: 1, text: 'InsightIQ Strategic Business Review. Enterprise orders exceeding 5 units receive a 15% discount.' }
      ];

      const chunks = ragService.chunkText(samplePages, 50, 10);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].pageNumber).toBe(1);

      const vector = ragService.generateLocalEmbedding(chunks[0].text);
      expect(vector.length).toBe(64);
      // Normalized vector magnitude should be approx 1.0
      const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
      expect(mag).toBeCloseTo(1.0, 2);
    });

    it('should compute exact cosine similarity between matching texts', () => {
      const v1 = ragService.generateLocalEmbedding('Quarterly strategic revenue target and pricing');
      const v2 = ragService.generateLocalEmbedding('Quarterly strategic revenue target and pricing');
      const v3 = ragService.generateLocalEmbedding('Unrelated gardening instructions and flower soil');

      const simMatching = ragService.cosineSimilarity(v1, v2);
      const simDifferent = ragService.cosineSimilarity(v1, v3);

      expect(simMatching).toBeCloseTo(1.0, 2);
      expect(simMatching).toBeGreaterThan(simDifferent);
    });
  });

  describe('Module 11: Business Report Generation & Downloads', () => {
    it('should generate executive report summary JSON', async () => {
      const res = await request(app)
        .get(`/api/reports/${datasetAId}/summary`)
        .set('Authorization', `Bearer ${userAToken}`)
        .set('x-workspace-id', workspaceAId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.report.computedMetrics.totalRows).toBe(1200);
      expect(res.body.report.topPerformers.length).toBeGreaterThan(0);
    });

    it('should stream downloadable CSV format', async () => {
      const res = await request(app)
        .get(`/api/reports/${datasetAId}/csv`)
        .set('Authorization', `Bearer ${userAToken}`)
        .set('x-workspace-id', workspaceAId);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('total_revenue');
    });

    it('should generate downloadable PDF document', async () => {
      const res = await request(app)
        .get(`/api/reports/${datasetAId}/pdf`)
        .set('Authorization', `Bearer ${userAToken}`)
        .set('x-workspace-id', workspaceAId);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });
  });
});
