const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');
const { requireWorkspace } = require('../middleware/workspace');

router.use(authenticate, requireWorkspace);

router.get('/:datasetId/overview', analyticsController.getDatasetOverview);
router.get('/:datasetId/dashboard', analyticsController.getDashboardPayload);
router.get('/:datasetId/timeseries', analyticsController.getTimeSeries);
router.get('/:datasetId/aggregations', analyticsController.getAggregations);
router.get('/:datasetId/comparison', analyticsController.getPeriodComparison);
router.get('/:datasetId/customers', analyticsController.getCustomerInsights);
router.get('/:datasetId/anomalies', analyticsController.getAnomalies);

module.exports = router;
