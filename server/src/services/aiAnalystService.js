const OpenAI = require('openai');
const env = require('../config/env');
const analyticsEngine = require('./analyticsEngine');

class AIAnalystService {
  constructor() {
    this.openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
  }

  /**
   * Tool definitions specification for OpenAI / LangChain style tool calling.
   */
  getTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'getDatasetOverview',
          description: 'Retrieve high-level summary of the dataset including row count, date range, total revenue, and unique counts.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getBusinessMetrics',
          description: 'Get key financial and operational KPI metrics such as total revenue, average transaction value, min/max values.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getRevenueByPeriod',
          description: 'Get time series breakdown of revenue or transaction volume grouped by month, week, or day.',
          parameters: {
            type: 'object',
            properties: {
              granularity: {
                type: 'string',
                enum: ['day', 'week', 'month', 'quarter'],
                description: 'Time bucket granularity'
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getTopCategories',
          description: 'Get top performing categories, products, or dimensions sorted by revenue or frequency.',
          parameters: {
            type: 'object',
            properties: {
              dimension: {
                type: 'string',
                description: 'Column to group by (e.g. category, product, region)'
              },
              limit: {
                type: 'number',
                description: 'Number of top results to return (default 5)'
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'comparePeriods',
          description: 'Compare current period metrics against previous period (e.g. Month-over-Month growth and percentage delta).',
          parameters: {
            type: 'object',
            properties: {
              granularity: {
                type: 'string',
                enum: ['month', 'quarter'],
                description: 'Period step to compare'
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getCustomerInsights',
          description: 'Get customer analytics including top spending accounts and purchase frequency distribution.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'detectAnomalies',
          description: 'Detect statistical anomalies, spikes, or sudden drops in daily time series metrics.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'getDatasetColumns',
          description: 'Inspect available dataset columns, inferred data types, and semantic roles.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      }
    ];
  }

  /**
   * Safe execution of authorized tools against PostgreSQL via AnalyticsEngine.
   */
  async executeTool(toolName, args, dataset) {
    const startTime = Date.now();
    let result = null;

    switch (toolName) {
      case 'getDatasetOverview':
      case 'getBusinessMetrics': {
        result = await analyticsEngine.getDatasetOverview(dataset);
        break;
      }
      case 'getRevenueByPeriod': {
        const gran = args?.granularity || 'month';
        result = await analyticsEngine.getTimeSeries(dataset, null, null, gran);
        break;
      }
      case 'getTopCategories': {
        const dimCol = args?.dimension || analyticsEngine.resolveColumn(dataset, 'category') || analyticsEngine.resolveColumn(dataset, 'product') || dataset.columns[0]?.cleanName;
        const limit = args?.limit || 5;
        result = await analyticsEngine.getAggregations(dataset, dimCol, null, 'SUM', limit);
        break;
      }
      case 'comparePeriods': {
        const gran = args?.granularity || 'month';
        result = await analyticsEngine.getPeriodComparison(dataset, null, null, gran);
        break;
      }
      case 'getCustomerInsights': {
        result = await analyticsEngine.getCustomerInsights(dataset);
        break;
      }
      case 'detectAnomalies': {
        result = await analyticsEngine.detectAnomalies(dataset);
        break;
      }
      case 'getDatasetColumns': {
        result = dataset.columns.map(c => ({
          name: c.originalName,
          type: c.dataType,
          role: c.semanticRole,
          confidence: c.confidence
        }));
        break;
      }
      default:
        throw new Error(`Unrecognized analytical tool: ${toolName}`);
    }

    return {
      toolName,
      args,
      result,
      executionTimeMs: Date.now() - startTime
    };
  }

  /**
   * Deterministic Natural Language Engine for Demo Mode / fallback when OpenAI key is absent.
   */
  async processDeterministicQuery(queryText, dataset) {
    const lower = queryText.toLowerCase();
    const toolsCalled = [];
    let content = '';
    let chartSuggestion = null;

    if (lower.includes('trend') || lower.includes('month') || lower.includes('over time') || lower.includes('period') || lower.includes('revenue by month') || lower.includes('sales trend')) {
      const toolRes = await this.executeTool('getRevenueByPeriod', { granularity: 'month' }, dataset);
      toolsCalled.push(toolRes);

      const series = toolRes.result.series || [];
      if (series.length > 0) {
        const highestPeriod = [...series].sort((a, b) => b.value - a.value)[0];
        const lowestPeriod = [...series].sort((a, b) => a.value - b.value)[0];

        content = `Analysis of **${dataset.name}** across ${series.length} recorded months:
- **Peak Performance:** ${highestPeriod.label} reached **$${highestPeriod.value.toLocaleString()}** (${highestPeriod.count} transactions).
- **Lowest Performance:** ${lowestPeriod.label} recorded **$${lowestPeriod.value.toLocaleString()}** (${lowestPeriod.count} transactions).
- **Recent Trajectory:** The monthly run rate has tracked an average volume of **$${(series.reduce((a, b) => a + b.value, 0) / series.length).toFixed(2)}** per month.`;

        chartSuggestion = {
          type: 'line',
          title: 'Monthly Revenue Progression',
          xAxis: 'label',
          yAxis: 'value',
          data: series
        };
      } else {
        content = `The dataset **${dataset.name}** does not contain enough dated records to construct a time trend.`;
      }
    } else if (lower.includes('category') || lower.includes('product') || lower.includes('top') || lower.includes('breakdown') || lower.includes('best seller')) {
      const dim = lower.includes('product') ? (analyticsEngine.resolveColumn(dataset, 'product') || 'category') : (analyticsEngine.resolveColumn(dataset, 'category') || 'product');
      const toolRes = await this.executeTool('getTopCategories', { dimension: dim, limit: 6 }, dataset);
      toolsCalled.push(toolRes);

      const items = toolRes.result || [];
      if (items.length > 0) {
        const topItem = items[0];
        content = `Revenue breakdown by **${dim}**:
- **Leading Segment:** **${topItem.dimension}** generates the highest volume with **$${topItem.value.toLocaleString()}** across ${topItem.count} records.
- **Top Rankings:**
${items.map((it, idx) => `  ${idx + 1}. **${it.dimension}**: $${it.value.toLocaleString()} (${it.count} transactions)`).join('\n')}`;

        chartSuggestion = {
          type: 'bar',
          title: `Revenue by ${dim.charAt(0).toUpperCase() + dim.slice(1)}`,
          xAxis: 'dimension',
          yAxis: 'value',
          data: items
        };
      } else {
        content = `Could not find categorical dimensions for breakdown in **${dataset.name}**.`;
      }
    } else if (lower.includes('customer') || lower.includes('buyer') || lower.includes('client') || lower.includes('account')) {
      const toolRes = await this.executeTool('getCustomerInsights', {}, dataset);
      toolsCalled.push(toolRes);

      if (toolRes.result.hasCustomerData) {
        const dist = toolRes.result.distribution;
        const topCust = toolRes.result.topCustomers[0];
        content = `Customer intelligence metrics for **${dataset.name}**:
- **Total Unique Accounts:** ${dist.totalUniqueCustomers.toLocaleString()}
- **Repeat Customers (2+ transactions):** ${dist.repeatBuyers + dist.frequentBuyers} (${Math.round(((dist.repeatBuyers + dist.frequentBuyers) / dist.totalUniqueCustomers) * 100)}% retention rate)
- **Top Enterprise Account:** **${topCust?.customerId}** with cumulative spend of **$${topCust?.totalSpend?.toLocaleString()}** across ${topCust?.transactionCount} orders.`;

        chartSuggestion = {
          type: 'bar',
          title: 'Top 5 Enterprise Clients by Lifetime Spend',
          xAxis: 'customerId',
          yAxis: 'totalSpend',
          data: toolRes.result.topCustomers.slice(0, 5)
        };
      } else {
        content = `No customer identifier column was found in **${dataset.name}**.`;
      }
    } else if (lower.includes('anomal') || lower.includes('spike') || lower.includes('outlier') || lower.includes('abnormal')) {
      const toolRes = await this.executeTool('detectAnomalies', {}, dataset);
      toolsCalled.push(toolRes);

      if (toolRes.result.hasAnomalies) {
        content = `Statistical 2-sigma anomaly scan detected **${toolRes.result.anomalyCount} anomaly dates**:
- **Baseline Daily Mean:** $${toolRes.result.mean.toLocaleString()} (StdDev: ±$${toolRes.result.stdDev.toLocaleString()})
- **Significant Spikes:**
${toolRes.result.anomalies.slice(0, 4).map(a => `  - **${a.date}**: Observed $${a.value.toLocaleString()} (${a.type.toUpperCase()}, threshold: $${a.upperThreshold})`).join('\n')}`;
      } else {
        content = `No statistical anomalies beyond 2 standard deviations were detected in daily transaction activity. Operational variance remains within expected bounds.`;
      }
    } else if (lower.includes('compare') || lower.includes('mom') || lower.includes('growth') || lower.includes('change')) {
      const toolRes = await this.executeTool('comparePeriods', { granularity: 'month' }, dataset);
      toolsCalled.push(toolRes);

      if (toolRes.result.canCompare) {
        const r = toolRes.result;
        content = `Period comparison analysis (**${r.previousPeriod.label}** vs **${r.currentPeriod.label}**):
- **Current Period:** $${r.currentPeriod.value.toLocaleString()} (${r.currentPeriod.count} orders)
- **Previous Period:** $${r.previousPeriod.value.toLocaleString()} (${r.previousPeriod.count} orders)
- **Net Change:** **$${r.delta.toLocaleString()}** (${r.percentChange >= 0 ? '+' : ''}${r.percentChange}% growth trend).`;
      } else {
        content = toolRes.result.message || 'Insufficient historical periods to compute comparative growth.';
      }
    } else {
      // Default: Overview & Metrics
      const toolRes = await this.executeTool('getDatasetOverview', {}, dataset);
      toolsCalled.push(toolRes);
      const r = toolRes.result;

      content = `Overview for **${r.datasetName}**:
- **Total Records:** ${r.rowCount.toLocaleString()} rows across ${r.columnCount} attributes.
- **Total Revenue:** ${r.totalRevenue ? '$' + r.totalRevenue.toLocaleString() : 'N/A (Non-monetary dataset)'}
- **Average Order / Value:** ${r.averageRevenue ? '$' + r.averageRevenue.toLocaleString() : 'N/A'}
- **Date Range:** ${r.minDate && r.maxDate ? `${r.minDate} to ${r.maxDate}` : 'Continuous / unindexed'}
- **Data Quality Health Score:** ${r.overallQualityScore}/100`;

      if (r.revenueColumn) {
        const catCol = analyticsEngine.resolveColumn(dataset, 'category');
        if (catCol) {
          const breakdown = await analyticsEngine.getAggregations(dataset, catCol, r.revenueColumn, 'SUM', 5);
          chartSuggestion = {
            type: 'bar',
            title: `Revenue Distribution by ${catCol}`,
            xAxis: 'dimension',
            yAxis: 'value',
            data: breakdown
          };
        }
      }
    }

    return {
      content,
      toolsCalled,
      chartSuggestion,
      isDemoResponse: false
    };
  }

  /**
   * Main conversational query handler.
   */
  async answerQuery(queryText, dataset, conversationHistory = []) {
    // If OpenAI key is absent or DEMO_MODE is true, run deterministic engine
    if (!this.openai || env.DEMO_MODE) {
      return this.processDeterministicQuery(queryText, dataset);
    }

    try {
      const tools = this.getTools();
      const messages = [
        {
          role: 'system',
          content: `You are the InsightIQ AI Business Analyst. You analyze real dataset '${dataset.name}'.
Columns available: ${JSON.stringify(dataset.columns.map(c => ({ name: c.cleanName, role: c.semanticRole, type: c.dataType })))}.
Always call tools to retrieve actual data. Never hallucinate numbers. If required data is unavailable in the dataset, clearly explain that.`
        },
        ...conversationHistory.slice(-4).map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.content
        })),
        { role: 'user', content: queryText }
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.2
      });

      const responseMessage = response.choices[0].message;
      const toolsCalled = [];

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        for (const toolCall of responseMessage.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(toolCall.function.arguments);
          } catch (e) {
            fnArgs = {};
          }

          const toolExecution = await this.executeTool(fnName, fnArgs, dataset);
          toolsCalled.push(toolExecution);

          messages.push(responseMessage);
          messages.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: fnName,
            content: JSON.stringify(toolExecution.result)
          });
        }

        const secondResponse = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.2
        });

        return {
          content: secondResponse.choices[0].message.content,
          toolsCalled,
          chartSuggestion: null,
          isDemoResponse: false
        };
      }

      return {
        content: responseMessage.content,
        toolsCalled: [],
        chartSuggestion: null,
        isDemoResponse: false
      };
    } catch (err) {
      console.warn('[AI Analyst] OpenAI call failed, falling back to deterministic engine:', err.message);
      return this.processDeterministicQuery(queryText, dataset);
    }
  }
}

module.exports = new AIAnalystService();
