const Dataset = require('../models/Dataset');
const reportService = require('../services/reportService');

class ReportController {
  async getSummaryReport(req, res, next) {
    try {
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset || !dataset.pgTableName) {
        return res.status(400).json({ success: false, error: 'Dataset is not stored in PostgreSQL yet.' });
      }

      const report = await reportService.generateExecutiveReport(dataset);
      res.json({ success: true, report });
    } catch (err) {
      next(err);
    }
  }

  async downloadCsv(req, res, next) {
    try {
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset || !dataset.pgTableName) {
        return res.status(400).json({ success: false, error: 'Dataset is not stored in PostgreSQL yet.' });
      }

      const csvData = await reportService.exportDatasetCsv(dataset);
      const safeName = dataset.name.replace(/[^a-zA-Z0-9_-]/g, '_');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}_export.csv"`);
      res.send(csvData);
    } catch (err) {
      next(err);
    }
  }

  async downloadPdf(req, res, next) {
    try {
      const dataset = await Dataset.findOne({
        _id: req.params.datasetId,
        workspaceId: req.workspace._id
      });

      if (!dataset || !dataset.pgTableName) {
        return res.status(400).json({ success: false, error: 'Dataset is not stored in PostgreSQL yet.' });
      }

      const safeName = dataset.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Executive_Report.pdf"`);

      await reportService.generatePdfReport(dataset, res);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReportController();
