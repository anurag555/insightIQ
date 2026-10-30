const { query } = require('../config/pg');

class AnalyticsEngine {
  /**
   * Helper to resolve the best column name for a given semantic role or fallback.
   */
  resolveColumn(dataset, role, fallbackType = null) {
    const colByRole = dataset.columns.find(c => c.semanticRole === role);
    if (colByRole) return colByRole.cleanName;

    if (fallbackType) {
      const colByType = dataset.columns.find(c => c.dataType === fallbackType);
      if (colByType) return colByType.cleanName;
    }
    return null;
  }

  /**
   * Computes high-level business metrics and dataset overview.
   */
  async getDatasetOverview(dataset) {
    const tableName = dataset.pgTableName;
    if (!tableName) throw new Error('Dataset is not stored in PostgreSQL.');

    const revCol = this.resolveColumn(dataset, 'revenue', 'numeric');
    const dateCol = this.resolveColumn(dataset, 'date', 'date');
    const custCol = this.resolveColumn(dataset, 'customer_id');
    const prodCol = this.resolveColumn(dataset, 'product');
    const catCol = this.resolveColumn(dataset, 'category');

    const selectParts = ['COUNT(*) as row_count'];

    if (revCol) {
      selectParts.push(`COALESCE(SUM("${revCol}"), 0) as total_revenue`);
      selectParts.push(`COALESCE(AVG("${revCol}"), 0) as avg_revenue`);
      selectParts.push(`COALESCE(MIN("${revCol}"), 0) as min_revenue`);
      selectParts.push(`COALESCE(MAX("${revCol}"), 0) as max_revenue`);
    }

    if (dateCol) {
      selectParts.push(`MIN("${dateCol}") as min_date`);
      selectParts.push(`MAX("${dateCol}") as max_date`);
    }

    if (custCol) {
      selectParts.push(`COUNT(DISTINCT "${custCol}") as unique_customers`);
    }

    if (prodCol) {
      selectParts.push(`COUNT(DISTINCT "${prodCol}") as unique_products`);
    }

    if (catCol) {
      selectParts.push(`COUNT(DISTINCT "${catCol}") as unique_categories`);
    }

    const sql = `SELECT ${selectParts.join(', ')} FROM "${tableName}";`;
    const res = await query(sql);
    const row = res.rows[0];

    return {
      rowCount: parseInt(row.row_count, 10),
      columnCount: dataset.columnCount || dataset.columns.length,
      revenueColumn: revCol,
      dateColumn: dateCol,
      totalRevenue: revCol ? parseFloat(row.total_revenue) : null,
      averageRevenue: revCol ? parseFloat(parseFloat(row.avg_revenue).toFixed(2)) : null,
      minRevenue: revCol ? parseFloat(row.min_revenue) : null,
      maxRevenue: revCol ? parseFloat(row.max_revenue) : null,
      minDate: dateCol && row.min_date ? new Date(row.min_date).toISOString().split('T')[0] : null,
      maxDate: dateCol && row.max_date ? new Date(row.max_date).toISOString().split('T')[0] : null,
      uniqueCustomers: custCol ? parseInt(row.unique_customers, 10) : null,
      uniqueProducts: prodCol ? parseInt(row.unique_products, 10) : null,
      uniqueCategories: catCol ? parseInt(row.unique_categories, 10) : null,
      datasetName: dataset.name,
      overallQualityScore: dataset.qualityReport?.overallScore || 100
    };
  }

  /**
   * Group-by aggregation for any dimension and metric.
   */
  async getAggregations(dataset, groupByCol, metricCol = null, aggFunc = 'SUM', limit = 15) {
    const tableName = dataset.pgTableName;
    const cleanGroup = String(groupByCol).replace(/[^a-zA-Z0-9_]/g, '');
    const cleanMetric = metricCol ? String(metricCol).replace(/[^a-zA-Z0-9_]/g, '') : null;
    const safeAgg = ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT'].includes(aggFunc.toUpperCase()) ? aggFunc.toUpperCase() : 'SUM';

    let metricSql = 'COUNT(*) as metric_value';
    if (cleanMetric && safeAgg !== 'COUNT') {
      metricSql = `COALESCE(${safeAgg}("${cleanMetric}"), 0) as metric_value, COUNT(*) as count_value`;
    }

    const sql = `
      SELECT "${cleanGroup}" as dimension, ${metricSql}
      FROM "${tableName}"
      WHERE "${cleanGroup}" IS NOT NULL AND TRIM(CAST("${cleanGroup}" as TEXT)) != ''
      GROUP BY "${cleanGroup}"
      ORDER BY metric_value DESC
      LIMIT $1;
    `;

    const res = await query(sql, [limit]);
    return res.rows.map(r => ({
      dimension: r.dimension,
      value: parseFloat(parseFloat(r.metric_value).toFixed(2)),
      count: r.count_value ? parseInt(r.count_value, 10) : parseInt(r.metric_value, 10)
    }));
  }

  /**
   * Time series aggregation by month, week, day, or quarter.
   */
  async getTimeSeries(dataset, dateCol = null, metricCol = null, granularity = 'month') {
    const tableName = dataset.pgTableName;
    const activeDateCol = dateCol || this.resolveColumn(dataset, 'date', 'date');
    if (!activeDateCol) {
      return { hasDate: false, series: [] };
    }

    const activeMetricCol = metricCol || this.resolveColumn(dataset, 'revenue', 'numeric');
    const cleanDate = String(activeDateCol).replace(/[^a-zA-Z0-9_]/g, '');
    const safeGranularity = ['day', 'week', 'month', 'quarter', 'year'].includes(granularity.toLowerCase()) ? granularity.toLowerCase() : 'month';

    let metricSelect = 'COUNT(*) as total_count';
    if (activeMetricCol) {
      const cleanMetric = String(activeMetricCol).replace(/[^a-zA-Z0-9_]/g, '');
      metricSelect = `
        COALESCE(SUM("${cleanMetric}"), 0) as total_metric,
        COALESCE(AVG("${cleanMetric}"), 0) as avg_metric,
        COUNT(*) as total_count
      `;
    }

    const sql = `
      SELECT 
        DATE_TRUNC('${safeGranularity}', "${cleanDate}") as period,
        ${metricSelect}
      FROM "${tableName}"
      WHERE "${cleanDate}" IS NOT NULL
      GROUP BY period
      ORDER BY period ASC;
    `;

    const res = await query(sql);
    const series = res.rows.map(r => ({
      period: new Date(r.period).toISOString().split('T')[0],
      label: new Date(r.period).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: safeGranularity === 'day' ? 'short' : 'short', 
        day: safeGranularity === 'day' ? 'numeric' : undefined 
      }),
      value: r.total_metric !== undefined ? parseFloat(parseFloat(r.total_metric).toFixed(2)) : parseInt(r.total_count, 10),
      avgValue: r.avg_metric ? parseFloat(parseFloat(r.avg_metric).toFixed(2)) : null,
      count: parseInt(r.total_count, 10)
    }));

    return {
      hasDate: true,
      granularity: safeGranularity,
      dateColumn: activeDateCol,
      metricColumn: activeMetricCol,
      series
    };
  }

  /**
   * Period comparison (MoM, YoY) with delta calculations.
   */
  async getPeriodComparison(dataset, dateCol = null, metricCol = null, granularity = 'month') {
    const ts = await this.getTimeSeries(dataset, dateCol, metricCol, granularity);
    if (!ts.hasDate || ts.series.length < 2) {
      return {
        canCompare: false,
        message: 'Insufficient time periods for comparison (minimum 2 periods required).'
      };
    }

    const series = ts.series;
    const current = series[series.length - 1];
    const previous = series[series.length - 2];

    const delta = current.value - previous.value;
    const percentChange = previous.value !== 0 ? parseFloat(((delta / previous.value) * 100).toFixed(2)) : 0;

    return {
      canCompare: true,
      currentPeriod: {
        label: current.label,
        value: current.value,
        count: current.count
      },
      previousPeriod: {
        label: previous.label,
        value: previous.value,
        count: previous.count
      },
      delta: parseFloat(delta.toFixed(2)),
      percentChange,
      trend: delta >= 0 ? 'up' : 'down'
    };
  }

  /**
   * Top and bottom performing entities for a dimension.
   */
  async getTopBottomPerformers(dataset, dimensionCol, metricCol = null, limit = 5) {
    const tableName = dataset.pgTableName;
    const cleanDim = String(dimensionCol).replace(/[^a-zA-Z0-9_]/g, '');
    const cleanMetric = metricCol ? String(metricCol).replace(/[^a-zA-Z0-9_]/g, '') : this.resolveColumn(dataset, 'revenue', 'numeric');

    let sumExpr = 'COUNT(*)';
    if (cleanMetric) {
      sumExpr = `COALESCE(SUM("${cleanMetric}"), 0)`;
    }

    const topSql = `
      SELECT "${cleanDim}" as dimension, ${sumExpr} as metric_val
      FROM "${tableName}"
      WHERE "${cleanDim}" IS NOT NULL AND TRIM(CAST("${cleanDim}" as TEXT)) != ''
      GROUP BY "${cleanDim}"
      ORDER BY metric_val DESC
      LIMIT $1;
    `;

    const bottomSql = `
      SELECT "${cleanDim}" as dimension, ${sumExpr} as metric_val
      FROM "${tableName}"
      WHERE "${cleanDim}" IS NOT NULL AND TRIM(CAST("${cleanDim}" as TEXT)) != ''
      GROUP BY "${cleanDim}"
      ORDER BY metric_val ASC
      LIMIT $1;
    `;

    const [topRes, bottomRes] = await Promise.all([
      query(topSql, [limit]),
      query(bottomSql, [limit])
    ]);

    return {
      dimension: cleanDim,
      metric: cleanMetric || 'count',
      top: topRes.rows.map(r => ({ dimension: r.dimension, value: parseFloat(parseFloat(r.metric_val).toFixed(2)) })),
      bottom: bottomRes.rows.map(r => ({ dimension: r.dimension, value: parseFloat(parseFloat(r.metric_val).toFixed(2)) }))
    };
  }

  /**
   * Customer analytics: RFM, frequency, customer concentration.
   */
  async getCustomerInsights(dataset) {
    const tableName = dataset.pgTableName;
    const custCol = this.resolveColumn(dataset, 'customer_id');
    const revCol = this.resolveColumn(dataset, 'revenue', 'numeric');
    const dateCol = this.resolveColumn(dataset, 'date', 'date');

    if (!custCol) {
      return {
        hasCustomerData: false,
        message: 'No customer identifier detected in this dataset.'
      };
    }

    const revExpr = revCol ? `COALESCE(SUM("${revCol}"), 0)` : '0';
    const dateExpr = dateCol ? `MAX("${dateCol}")` : 'NULL';

    const sql = `
      SELECT 
        "${custCol}" as customer_id,
        COUNT(*) as transaction_count,
        ${revExpr} as total_spend,
        ${dateExpr} as last_transaction_date
      FROM "${tableName}"
      WHERE "${custCol}" IS NOT NULL
      GROUP BY "${custCol}"
      ORDER BY total_spend DESC
      LIMIT 10;
    `;

    const res = await query(sql);

    // Get distribution of transaction counts (repeat vs single)
    const distSql = `
      WITH cust_counts AS (
        SELECT "${custCol}", COUNT(*) as cnt
        FROM "${tableName}"
        WHERE "${custCol}" IS NOT NULL
        GROUP BY "${custCol}"
      )
      SELECT 
        COUNT(CASE WHEN cnt = 1 THEN 1 END) as single_orders,
        COUNT(CASE WHEN cnt BETWEEN 2 AND 5 THEN 1 END) as repeat_2_to_5,
        COUNT(CASE WHEN cnt > 5 THEN 1 END) as frequent_buyers,
        COUNT(*) as total_customers
      FROM cust_counts;
    `;
    const distRes = await query(distSql);
    const dist = distRes.rows[0];

    return {
      hasCustomerData: true,
      topCustomers: res.rows.map(r => ({
        customerId: r.customer_id,
        transactionCount: parseInt(r.transaction_count, 10),
        totalSpend: parseFloat(parseFloat(r.total_spend).toFixed(2)),
        lastDate: r.last_transaction_date ? new Date(r.last_transaction_date).toISOString().split('T')[0] : null
      })),
      distribution: {
        singleBuyers: parseInt(dist.single_orders || '0', 10),
        repeatBuyers: parseInt(dist.repeat_2_to_5 || '0', 10),
        frequentBuyers: parseInt(dist.frequent_buyers || '0', 10),
        totalUniqueCustomers: parseInt(dist.total_customers || '0', 10)
      }
    };
  }

  /**
   * Statistical anomaly detection on daily or weekly metric values using 2-sigma thresholds.
   */
  async detectAnomalies(dataset, dateCol = null, metricCol = null) {
    const ts = await this.getTimeSeries(dataset, dateCol, metricCol, 'day');
    if (!ts.hasDate || ts.series.length < 5) {
      return {
        hasAnomalies: false,
        message: 'Insufficient daily data points for anomaly detection.'
      };
    }

    const values = ts.series.map(s => s.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const upperLimit = mean + 2 * stdDev;
    const lowerLimit = Math.max(0, mean - 2 * stdDev);

    const anomalies = [];
    ts.series.forEach(item => {
      if (item.value > upperLimit || item.value < lowerLimit) {
        anomalies.push({
          date: item.period,
          value: item.value,
          expectedMean: parseFloat(mean.toFixed(2)),
          upperThreshold: parseFloat(upperLimit.toFixed(2)),
          lowerThreshold: parseFloat(lowerLimit.toFixed(2)),
          type: item.value > upperLimit ? 'spike' : 'dip',
          severity: Math.abs(item.value - mean) / (stdDev || 1) > 3 ? 'high' : 'medium'
        });
      }
    });

    return {
      hasAnomalies: anomalies.length > 0,
      mean: parseFloat(mean.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(2)),
      upperLimit: parseFloat(upperLimit.toFixed(2)),
      lowerLimit: parseFloat(lowerLimit.toFixed(2)),
      anomalyCount: anomalies.length,
      anomalies
    };
  }

  /**
   * Generates full structured dashboard payload for frontend rendering.
   */
  async getDashboardPayload(dataset) {
    const overview = await this.getDatasetOverview(dataset);
    const catCol = this.resolveColumn(dataset, 'category');
    const prodCol = this.resolveColumn(dataset, 'product');
    const regionCol = this.resolveColumn(dataset, 'region');
    const dateCol = this.resolveColumn(dataset, 'date', 'date');
    const revCol = this.resolveColumn(dataset, 'revenue', 'numeric');

    const [timeSeries, periodComp, categoryBreakdown, topProducts, regionBreakdown] = await Promise.all([
      this.getTimeSeries(dataset, dateCol, revCol, 'month'),
      this.getPeriodComparison(dataset, dateCol, revCol, 'month'),
      catCol ? this.getAggregations(dataset, catCol, revCol, 'SUM', 10) : Promise.resolve([]),
      prodCol ? this.getTopBottomPerformers(dataset, prodCol, revCol, 5) : Promise.resolve(null),
      regionCol ? this.getAggregations(dataset, regionCol, revCol, 'SUM', 6) : Promise.resolve([])
    ]);

    return {
      overview,
      timeSeries,
      periodComparison: periodComp,
      categoryBreakdown,
      topProducts,
      regionBreakdown
    };
  }
}

module.exports = new AnalyticsEngine();
