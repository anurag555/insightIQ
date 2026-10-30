const Dataset = require('../models/Dataset');
const analyticsEngine = require('../services/analyticsEngine');

class AnalyticsController {
  async getDatasetOverview(req, res, next) {
    try {
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset || !dataset.pgTableName) {
        return res.status(400).json({ success: false, error: 'Dataset must be stored in PostgreSQL first.' });
      }

      const overview = await analyticsEngine.getDatasetOverview(dataset);
      res.json({ success: true, overview });
    } catch (err) {
      next(err);
    }
  }

  async getDashboardPayload(req, res, next) {
    try {
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset || !dataset.pgTableName) {
        return res.status(400).json({ success: false, error: 'Dataset must be stored in PostgreSQL first.' });
      }

      const payload = await analyticsEngine.getDashboardPayload(dataset);
      res.json({ success: true, ...payload });
    } catch (err) {
      next(err);
    }
  }

  async getTimeSeries(req, res, next) {
    try {
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset || !dataset.pgTableName) {
        return res.status(400).json({ success: false, error: 'Dataset must be stored in PostgreSQL first.' });
      }

      const granularity = req.query.granularity || 'month';
      const dateCol = req.query.dateCol || null;
      const metricCol = req.query.metricCol || null;

      const result = await analyticsEngine.getTimeSeries(dataset, dateCol, metricCol, granularity);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getAggregations(req, res, next) {
    try {
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset || !dataset.pgTableName) {
        return res.status(400).json({ success: false, error: 'Dataset must be stored in PostgreSQL first.' });
      }

      const { groupBy, metric, agg = 'SUM', limit = 15 } = req.query;
      if (!groupBy) {
        return res.status(400).json({ success: false, error: 'groupBy parameter is required.' });
      }

      const rows = await analyticsEngine.getAggregations(dataset, groupBy, metric, agg, parseInt(limit, 10));
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  }

  async getPeriodComparison(req, res, next) {
    try {
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset || !dataset.pgTableName) {
        return res.status(400).json({ success: false, error: 'Dataset must be stored in PostgreSQL first.' });
      }

      const result = await analyticsEngine.getPeriodComparison(dataset, null, null, req.query.granularity || 'month');
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getCustomerInsights(req, res, next) {
    try {
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset || !dataset.pgTableName) {
        return res.status(400).json({ success: false, error: 'Dataset must be stored in PostgreSQL first.' });
      }

      const result = await analyticsEngine.getCustomerInsights(dataset);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  async getAnomalies(req, res, next) {
    try {
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset || !dataset.pgTableName) {
        return res.status(400).json({ success: false, error: 'Dataset must be stored in PostgreSQL first.' });
      }

      const result = await analyticsEngine.detectAnomalies(dataset);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AnalyticsController();
