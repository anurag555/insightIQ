const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');
const { requireWorkspace } = require('../middleware/workspace');

router.use(authenticate, requireWorkspace);

router.get('/:datasetId/summary', reportController.getSummaryReport);
router.get('/:datasetId/csv', reportController.downloadCsv);
router.get('/:datasetId/pdf', reportController.downloadPdf);

module.exports = router;
