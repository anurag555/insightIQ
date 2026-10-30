const PDFDocument = require('pdfkit');
const analyticsEngine = require('./analyticsEngine');
const analyticalStorageService = require('./analyticalStorageService');
const { query } = require('../config/pg');

class ReportService {
  /**
   * Generates a structured executive business summary report from real analytics.
   */
  async generateExecutiveReport(dataset) {
    const overview = await analyticsEngine.getDatasetOverview(dataset);
    const catCol = analyticsEngine.resolveColumn(dataset, 'category') || analyticsEngine.resolveColumn(dataset, 'product');
    const revCol = analyticsEngine.resolveColumn(dataset, 'revenue', 'numeric');
    const dateCol = analyticsEngine.resolveColumn(dataset, 'date', 'date');

    const [topCategories, periodComp, anomalies] = await Promise.all([
      catCol ? analyticsEngine.getAggregations(dataset, catCol, revCol, 'SUM', 5) : Promise.resolve([]),
      analyticsEngine.getPeriodComparison(dataset, dateCol, revCol, 'month'),
      analyticsEngine.detectAnomalies(dataset, dateCol, revCol)
    ]);

    return {
      generatedAt: new Date().toISOString(),
      datasetName: dataset.name,
      computedMetrics: {
        totalRows: overview.rowCount,
        totalRevenue: overview.totalRevenue,
        averageOrderValue: overview.averageRevenue,
        uniqueCustomers: overview.uniqueCustomers,
        dateRange: overview.minDate && overview.maxDate ? `${overview.minDate} to ${overview.maxDate}` : 'Continuous',
        qualityScore: overview.overallQualityScore
      },
      topPerformers: topCategories,
      periodComparison: periodComp,
      anomalies: anomalies.hasAnomalies ? anomalies.anomalies : [],
      interpretationNotes: [
        `Revenue concentration is led by ${topCategories[0]?.dimension || 'primary segments'} accounting for major gross share.`,
        periodComp.canCompare ? `Recent period showed a ${periodComp.percentChange}% delta compared to previous interval.` : 'Continuous operational monitoring recommended.',
        anomalies.hasAnomalies ? `Detected ${anomalies.anomalyCount} operational spikes/dips requiring localized investigation.` : 'No critical standard-deviation violations detected.'
      ]
    };
  }

  /**
   * Generates CSV text export of dataset rows from PostgreSQL.
   */
  async exportDatasetCsv(dataset) {
    const tableName = dataset.pgTableName;
    const res = await query(`SELECT * FROM "${tableName}" LIMIT 50000;`);
    if (res.rows.length === 0) return '';

    const headers = Object.keys(res.rows[0]);
    const lines = [headers.join(',')];

    for (const r of res.rows) {
      const line = headers.map(h => {
        const val = r[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n') 
          ? `"${str.replace(/"/g, '""')}"` 
          : str;
      }).join(',');
      lines.push(line);
    }

    return lines.join('\n');
  }

  /**
   * Generates a downloadable executive PDF report using PDFKit.
   */
  async generatePdfReport(dataset, resStream) {
    const reportData = await this.generateExecutiveReport(dataset);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(resStream);

    // Header & Brand
    doc.rect(0, 0, doc.page.width, 8).fill('#0c87eb');
    doc.fontSize(22).fillColor('#0f172a').font('Helvetica-Bold').text('InsightIQ Executive Business Report', 40, 45);
    doc.fontSize(10).fillColor('#64748b').font('Helvetica').text(`Dataset: ${dataset.name} | Generated: ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`, 40, 72);
    doc.moveDown(1.5);

    // Divider
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, 95).lineTo(555, 95).stroke();
    doc.moveDown(1.5);

    // Section 1: Executive KPI Cards
    doc.fontSize(14).fillColor('#0355a3').font('Helvetica-Bold').text('1. Key Performance Indicators', 40, 115);
    doc.moveDown(0.5);

    const kpis = [
      { label: 'Total Volume', val: `${reportData.computedMetrics.totalRows.toLocaleString()} rows` },
      { label: 'Total Revenue', val: reportData.computedMetrics.totalRevenue ? `$${reportData.computedMetrics.totalRevenue.toLocaleString()}` : 'N/A' },
      { label: 'Avg Order Value', val: reportData.computedMetrics.averageOrderValue ? `$${reportData.computedMetrics.averageOrderValue.toLocaleString()}` : 'N/A' },
      { label: 'Data Quality Score', val: `${reportData.computedMetrics.qualityScore} / 100` }
    ];

    let startX = 40;
    const cardY = 140;
    const cardW = 120;
    const cardH = 55;

    kpis.forEach(k => {
      doc.rect(startX, cardY, cardW, cardH).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fontSize(9).fillColor('#64748b').font('Helvetica').text(k.label, startX + 10, cardY + 10);
      doc.fontSize(12).fillColor('#0f172a').font('Helvetica-Bold').text(k.val, startX + 10, cardY + 28);
      startX += cardW + 12;
    });

    doc.moveDown(4);

    // Section 2: Top Performing Segments
    let curY = 220;
    doc.fontSize(14).fillColor('#0355a3').font('Helvetica-Bold').text('2. Top Performing Business Segments', 40, curY);
    curY += 25;

    if (reportData.topPerformers.length > 0) {
      // Table Header
      doc.rect(40, curY, 515, 22).fill('#f1f5f9');
      doc.fontSize(10).fillColor('#334155').font('Helvetica-Bold');
      doc.text('Rank', 50, curY + 6);
      doc.text('Segment / Dimension', 100, curY + 6);
      doc.text('Total Metric Value', 320, curY + 6);
      doc.text('Transactions', 450, curY + 6);
      curY += 25;

      reportData.topPerformers.forEach((p, idx) => {
        doc.rect(40, curY, 515, 20).strokeColor('#f1f5f9').stroke();
        doc.fontSize(9).fillColor('#0f172a').font('Helvetica');
        doc.text(`#${idx + 1}`, 50, curY + 5);
        doc.text(String(p.dimension).slice(0, 32), 100, curY + 5);
        doc.text(`$${p.value.toLocaleString()}`, 320, curY + 5);
        doc.text(String(p.count), 450, curY + 5);
        curY += 22;
      });
    } else {
      doc.fontSize(10).fillColor('#64748b').font('Helvetica').text('No categorical breakdown available for this dataset.', 40, curY);
      curY += 20;
    }

    curY += 25;

    // Section 3: Period Comparison
    doc.fontSize(14).fillColor('#0355a3').font('Helvetica-Bold').text('3. Period Trajectory & Growth Comparison', 40, curY);
    curY += 22;

    if (reportData.periodComparison.canCompare) {
      const pc = reportData.periodComparison;
      doc.fontSize(10).fillColor('#1e293b').font('Helvetica');
      doc.text(`Comparing ${pc.previousPeriod.label} vs ${pc.currentPeriod.label}:`, 40, curY);
      curY += 16;
      doc.text(`- Current Period Metric: $${pc.currentPeriod.value.toLocaleString()} (${pc.currentPeriod.count} events)`, 50, curY);
      curY += 16;
      doc.text(`- Previous Period Metric: $${pc.previousPeriod.value.toLocaleString()} (${pc.previousPeriod.count} events)`, 50, curY);
      curY += 16;
      doc.text(`- Net Period Change: $${pc.delta.toLocaleString()} (${pc.percentChange >= 0 ? '+' : ''}${pc.percentChange}%)`, 50, curY);
      curY += 25;
    } else {
      doc.fontSize(10).fillColor('#64748b').font('Helvetica').text('Historical periods are insufficient for comparative growth analysis.', 40, curY);
      curY += 25;
    }

    // Section 4: Strategic Interpretations
    doc.fontSize(14).fillColor('#0355a3').font('Helvetica-Bold').text('4. Analytical Observations & Commentary', 40, curY);
    curY += 20;

    reportData.interpretationNotes.forEach(note => {
      doc.fontSize(9.5).fillColor('#334155').font('Helvetica').text(`• ${note}`, 50, curY, { width: 500 });
      curY += 18;
    });

    // Footer
    doc.fontSize(8).fillColor('#94a3b8').text('InsightIQ Automated Intelligence Report — Confidential Internal Business Document', 40, 780, { align: 'center' });

    doc.end();
  }
}

module.exports = new ReportService();
