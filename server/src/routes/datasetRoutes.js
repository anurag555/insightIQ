const express = require('express');
const router = express.Router();
const datasetController = require('../controllers/datasetController');
const { authenticate } = require('../middleware/auth');
const { requireWorkspace } = require('../middleware/workspace');
const upload = require('../middleware/upload');

router.use(authenticate, requireWorkspace);

router.post('/upload', upload.single('file'), datasetController.uploadDataset);
router.get('/', datasetController.listDatasets);
router.get('/relationships', datasetController.listRelationships);
router.post('/relationships', datasetController.createRelationship);
router.post('/join', datasetController.executeJoinQuery);

router.get('/:datasetId', datasetController.getDataset);
router.put('/:datasetId/mapping', datasetController.updateColumnMappings);
router.post('/:datasetId/clean', datasetController.applyCleanings);
router.post('/:datasetId/store', datasetController.storeInAnalyticalDatabase);
router.get('/:datasetId/data', datasetController.getDatasetData);
router.delete('/:datasetId', datasetController.deleteDataset);

module.exports = router;
