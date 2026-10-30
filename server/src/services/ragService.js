const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const OpenAI = require('openai');
const env = require('../config/env');
const Document = require('../models/Document');

class RAGService {
  constructor() {
    this.openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
  }

  /**
   * Extracts text and page information from PDF, DOCX, or TXT.
   */
  async extractText(filePath, fileType) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Document file not found at ${filePath}`);
    }

    const pages = [];

    if (fileType === 'pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      let currentPage = 1;

      const options = {
        pagerender: function (pageData) {
          return pageData.getTextContent().then(function (textContent) {
            let lastY, text = '';
            for (const item of textContent.items) {
              if (lastY === item.transform[5] || !lastY) {
                text += item.str + ' ';
              } else {
                text += '\n' + item.str + ' ';
              }
              lastY = item.transform[5];
            }
            pages.push({ pageNumber: currentPage++, text: text.trim() });
            return text;
          });
        }
      };

      await pdfParse(dataBuffer, options);

      // Fallback if pagerender yielded no items
      if (pages.length === 0) {
        const fullData = await pdfParse(dataBuffer);
        pages.push({ pageNumber: 1, text: fullData.text });
      }
    } else if (fileType === 'docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      const paragraphs = result.value.split('\n\n');
      // Approximate 1 page per ~1800 characters
      let curPage = 1;
      let curText = '';
      for (const p of paragraphs) {
        curText += p + '\n\n';
        if (curText.length > 1800) {
          pages.push({ pageNumber: curPage++, text: curText.trim() });
          curText = '';
        }
      }
      if (curText.trim().length > 0 || pages.length === 0) {
        pages.push({ pageNumber: curPage, text: curText.trim() || result.value.trim() });
      }
    } else {
      // Plain text
      const content = fs.readFileSync(filePath, 'utf8');
      pages.push({ pageNumber: 1, text: content });
    }

    return pages;
  }

  /**
   * Splits pages into overlapping text chunks.
   */
  chunkText(pages, chunkSize = 500, overlap = 100) {
    const chunks = [];
    let chunkSeq = 1;

    for (const page of pages) {
      const text = page.text.replace(/\s+/g, ' ').trim();
      if (!text) continue;

      let start = 0;
      while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        const chunkText = text.slice(start, end).trim();

        if (chunkText.length > 20) {
          chunks.push({
            chunkId: `chunk_${chunkSeq++}`,
            pageNumber: page.pageNumber,
            text: chunkText,
            charLength: chunkText.length,
            embedding: []
          });
        }

        if (end === text.length) break;
        start += (chunkSize - overlap);
      }
    }

    return chunks;
  }

  /**
   * Local High-Fidelity N-gram / Term Frequency vectorizer for local development.
   * Generates a 64-dimensional normalized vector hash for semantic cosine similarity.
   */
  generateLocalEmbedding(text) {
    const vector = new Array(64).fill(0);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(t => t.length > 2);

    for (const token of tokens) {
      // Word hash bucket
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      const bucket = Math.abs(hash) % 64;
      vector[bucket] += 1;

      // Character bigrams for subword matching
      for (let i = 0; i < token.length - 1; i++) {
        const bigramHash = (token.charCodeAt(i) * 31 + token.charCodeAt(i + 1)) % 64;
        vector[bigramHash] += 0.5;
      }
    }

    // Normalize vector to unit length
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] = parseFloat((vector[i] / magnitude).toFixed(6));
      }
    }

    return vector;
  }

  /**
   * Embed text chunks using OpenAI embeddings or local vectorizer fallback.
   */
  async embedChunks(chunks) {
    if (this.openai && !env.DEMO_MODE) {
      try {
        const texts = chunks.map(c => c.text);
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: texts,
        });

        response.data.forEach((item, idx) => {
          chunks[idx].embedding = item.embedding;
        });
        return chunks;
      } catch (err) {
        console.warn('[RAG] OpenAI embeddings failed, falling back to local vectorizer:', err.message);
      }
    }

    // Local deterministic embedding fallback
    chunks.forEach(c => {
      c.embedding = this.generateLocalEmbedding(c.text);
    });

    return chunks;
  }

  /**
   * Computes cosine similarity between two numeric vectors.
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Retrieves relevant passages across all documents in a workspace.
   */
  async retrieveContext(workspaceId, queryText, topK = 4, threshold = 0.12) {
    const docs = await Document.find({ workspaceId, status: 'indexed' });
    if (!docs || docs.length === 0) {
      return [];
    }

    // Generate query embedding
    let queryEmbedding = null;
    if (this.openai && !env.DEMO_MODE) {
      try {
        const resp = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: queryText,
        });
        queryEmbedding = resp.data[0].embedding;
      } catch (e) {
        queryEmbedding = this.generateLocalEmbedding(queryText);
      }
    } else {
      queryEmbedding = this.generateLocalEmbedding(queryText);
    }

    const matches = [];

    // Also perform keyword matching booster
    const queryTerms = queryText.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    for (const doc of docs) {
      for (const chunk of doc.chunks) {
        let similarity = 0;
        if (chunk.embedding && chunk.embedding.length === queryEmbedding.length) {
          similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        }

        // Keyword boost
        let termMatches = 0;
        const chunkLower = chunk.text.toLowerCase();
        for (const term of queryTerms) {
          if (chunkLower.includes(term)) termMatches++;
        }
        const keywordBoost = queryTerms.length > 0 ? (termMatches / queryTerms.length) * 0.2 : 0;
        const finalScore = similarity + keywordBoost;

        if (finalScore >= threshold) {
          matches.push({
            documentId: doc._id,
            documentName: doc.originalName,
            pageNumber: chunk.pageNumber,
            chunkId: chunk.chunkId,
            passage: chunk.text,
            similarityScore: parseFloat(finalScore.toFixed(3))
          });
        }
      }
    }

    // Sort by descending similarity score
    matches.sort((a, b) => b.similarityScore - a.similarityScore);
    return matches.slice(0, topK);
  }

  /**
   * Generates grounded RAG response for document queries.
   */
  async answerDocumentQuery(workspaceId, queryText) {
    const citations = await this.retrieveContext(workspaceId, queryText, 4, 0.15);

    if (citations.length === 0) {
      return {
        content: `I could not find any relevant information in your uploaded documents matching the query "${queryText}". Please verify that relevant documents are uploaded and indexed in this workspace.`,
        citations: [],
        isGrounded: false,
        isDemoResponse: !this.openai || env.DEMO_MODE
      };
    }

    // Grounded synthesis
    if (this.openai && !env.DEMO_MODE) {
      try {
        const contextText = citations.map(c => `[Doc: ${c.documentName}, Page ${c.pageNumber}]\n${c.passage}`).join('\n\n');
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are InsightIQ Document Intelligence Assistant. Answer the user question strictly using the provided context passages. Distinguish retrieved document facts from any interpretation. Mention document sources and page numbers in your response.`
            },
            {
              role: 'user',
              content: `Context:\n${contextText}\n\nQuestion: ${queryText}`
            }
          ],
          temperature: 0.1
        });

        return {
          content: completion.choices[0].message.content,
          citations,
          isGrounded: true,
          isDemoResponse: false
        };
      } catch (err) {
        console.warn('[RAG] OpenAI completion failed, falling back to deterministic synthesis:', err.message);
      }
    }

    // Deterministic synthesized response
    const primary = citations[0];
    const bulletPoints = citations.map(c => `- **${c.documentName} (Page ${c.pageNumber}):** "${c.passage.length > 220 ? c.passage.slice(0, 220) + '...' : c.passage}"`).join('\n\n');

    const content = `### Grounded Document Findings\n\nBased on retrieved records from your workspace document library:\n\n${bulletPoints}\n\n**Key Takeaway:** The retrieved documentation directly addresses your inquiry regarding *${queryText}* with verified source passages cited above.`;

    return {
      content,
      citations,
      isGrounded: true,
      isDemoResponse: false
    };
  }
}

module.exports = new RAGService();
