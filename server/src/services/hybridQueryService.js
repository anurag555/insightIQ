const aiAnalystService = require('./aiAnalystService');
const ragService = require('./ragService');
const env = require('../config/env');
const OpenAI = require('openai');

class HybridQueryService {
  constructor() {
    this.openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
  }

  /**
   * Classify user query intent into one of 4 categories:
   * 1. 'ANALYTICS' - requires PostgreSQL structured calculations
   * 2. 'DOCUMENT_RAG' - requires unstructured document context
   * 3. 'HYBRID' - requires both structured numbers and document context
   * 4. 'GENERAL' - general high-level explanation
   */
  classifyIntent(queryText, hasDataset, hasDocuments) {
    const lower = queryText.toLowerCase();

    // Check analytical triggers
    const analyticsKeywords = [
      'revenue', 'sales', 'profit', 'margin', 'cost', 'spend', 'average', 
      'total', 'count', 'trend', 'month', 'quarter', 'top', 'bottom', 
      'perform', 'performer', 'customer', 'anomal', 'spike', 'compare', 
      'growth', 'metric', 'kpi', 'orders', 'quantity', 'how many', 'how much'
    ];
    const isAnalyticsIntent = analyticsKeywords.some(kw => lower.includes(kw));

    // Check document triggers
    const docKeywords = [
      'policy', 'sla', 'warranty', 'refund', 'contract', 'strategy', 'review', 
      'target', 'objective', 'memo', 'guideline', 'terms', 'document', 'clause', 
      'pillar', 'threshold for discount', 'lead time', 'supplier agreement'
    ];
    const isDocIntent = docKeywords.some(kw => lower.includes(kw));

    if (isAnalyticsIntent && isDocIntent && hasDataset && hasDocuments) {
      return 'HYBRID';
    }
    if (isDocIntent && hasDocuments) {
      return 'DOCUMENT_RAG';
    }
    if (isAnalyticsIntent && hasDataset) {
      return 'ANALYTICS';
    }
    if (!hasDataset && !hasDocuments) {
      return 'GENERAL';
    }
    if (hasDataset) {
      return 'ANALYTICS';
    }
    return 'DOCUMENT_RAG';
  }

  /**
   * Synthesize hybrid response combining real SQL data + real RAG document citations.
   */
  async processHybridQuery(workspaceId, dataset, queryText, conversationHistory = []) {
    // 1. Fetch analytical findings
    const analyticalResult = await aiAnalystService.answerQuery(queryText, dataset, conversationHistory);

    // 2. Fetch document context
    const citations = await ragService.retrieveContext(workspaceId, queryText, 3, 0.12);

    // 3. Synthesize combined explanation
    let synthesizedContent = '';

    if (this.openai && !env.DEMO_MODE) {
      try {
        const docContext = citations.map(c => `[${c.documentName}, Page ${c.pageNumber}]: ${c.passage}`).join('\n\n');
        const prompt = `You are InsightIQ's Executive Hybrid Analyst.
The user asked: "${queryText}"

Here are the real analytical results computed from dataset '${dataset.name}':
${analyticalResult.content}

Here are the supporting citations from workspace business documents:
${docContext}

Provide a comprehensive, synthesized response with three distinct sections:
1. 📊 Empirical Analytical Findings (numbers, metrics, trends)
2. 📄 Strategic & Policy Context (grounded quotes from the documents with source & page)
3. 💡 Executive Synthesis & Actionable Recommendations
Make sure all citations clearly state the document name and page number.`;

        const resp = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2
        });

        synthesizedContent = resp.choices[0].message.content;
      } catch (err) {
        console.warn('[Hybrid] OpenAI synthesis failed, using deterministic formatter:', err.message);
      }
    }

    if (!synthesizedContent) {
      // Deterministic Hybrid Formatter
      const docPoints = citations.length > 0 
        ? citations.map(c => `- **${c.documentName} (Page ${c.pageNumber}):** "${c.passage}"`).join('\n')
        : '*(No specific document passages exceeded semantic match threshold)*';

      synthesizedContent = `### 📊 Empirical Analytical Findings\n${analyticalResult.content}\n\n### 📄 Strategic & Policy Context\n${docPoints}\n\n### 💡 Executive Synthesis\nThe quantitative metrics from **${dataset.name}** align with the documented business rules and strategic pillars outlined in your workspace documents. Operational decisions should reflect both the empirical revenue trajectory and verified SLA guidelines.`;
    }

    return {
      content: synthesizedContent,
      mode: 'hybrid',
      toolsCalled: analyticalResult.toolsCalled || [],
      citations: citations,
      chartSuggestion: analyticalResult.chartSuggestion,
      isDemoResponse: false
    };
  }

  /**
   * Unified dispatcher for any question.
   */
  async handleQuery(workspaceId, dataset, queryText, conversationHistory = []) {
    const hasDataset = Boolean(dataset && dataset.pgTableName);
    const hasDocuments = true; // checked inside RAG
    const intent = this.classifyIntent(queryText, hasDataset, hasDocuments);

    if (intent === 'HYBRID') {
      return this.processHybridQuery(workspaceId, dataset, queryText, conversationHistory);
    } else if (intent === 'DOCUMENT_RAG') {
      const ragResp = await ragService.answerDocumentQuery(workspaceId, queryText);
      return {
        ...ragResp,
        mode: 'rag',
        toolsCalled: []
      };
    } else if (intent === 'ANALYTICS') {
      const anaResp = await aiAnalystService.answerQuery(queryText, dataset, conversationHistory);
      return {
        ...anaResp,
        mode: 'analyst',
        citations: []
      };
    } else {
      return {
        content: `I am **InsightIQ**, your enterprise decision intelligence assistant.\n\nHere is how I can assist your workspace:\n- **Dataset Analytics:** Ask natural language questions about your business metrics, period trends, top categories, and customer patterns.\n- **Company Knowledge:** Query corporate governance documents, SLAs, and strategy decks with grounded citations.\n- **Unified Intelligence:** Combine quantitative warehouse data with strategic documents for end-to-end executive answers.\n\nSelect a dataset or upload a document to begin!`,
        mode: 'general',
        toolsCalled: [],
        citations: [],
        isDemoResponse: false
      };
    }
  }
}

module.exports = new HybridQueryService();
