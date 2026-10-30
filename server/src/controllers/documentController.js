const path = require('path');
const Document = require('../models/Document');
const AuditLog = require('../models/AuditLog');
const ragService = require('../services/ragService');

class DocumentController {
  async uploadDocument(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Please upload a PDF or DOCX document.' });
      }

      const filePath = req.file.path;
      const originalName = req.file.originalname;
      const ext = path.extname(originalName).toLowerCase().replace('.', '');
      const fileType = ext === 'docx' ? 'docx' : (ext === 'pdf' ? 'pdf' : 'txt');

      // 1. Extract text and page numbers
      const pages = await ragService.extractText(filePath, fileType);

      // 2. Chunk text with overlap
      const chunks = ragService.chunkText(pages, 500, 100);

      // 3. Generate embeddings
      const embeddedChunks = await ragService.embedChunks(chunks);

      const document = new Document({
        workspaceId: req.workspace._id,
        originalName,
        fileType,
        fileSize: req.file.size,
        chunkCount: embeddedChunks.length,
        status: 'indexed',
        chunks: embeddedChunks,
        filePath
      });

      await document.save();

      await AuditLog.create({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        action: 'upload_document',
        resourceType: 'document',
        resourceId: document._id.toString(),
        details: { originalName, chunkCount: embeddedChunks.length, pagesCount: pages.length }
      });

      res.status(201).json({
        success: true,
        message: `Indexed document into ${embeddedChunks.length} searchable passages.`,
        document: {
          id: document._id,
          originalName: document.originalName,
          fileType: document.fileType,
          chunkCount: document.chunkCount,
          createdAt: document.createdAt
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async listDocuments(req, res, next) {
    try {
      const documents = await Document.find({ workspaceId: req.workspace._id })
        .select('-chunks.embedding')
        .sort({ createdAt: -1 });

      res.json({ success: true, documents });
    } catch (err) {
      next(err);
    }
  }

  async deleteDocument(req, res, next) {
    try {
      const doc = await Document.findOne({
        _id: req.params.documentId,
        workspaceId: req.workspace._id
      });

      if (!doc) {
        return res.status(404).json({ success: false, error: 'Document not found.' });
      }

      await Document.findByIdAndDelete(doc._id);
      res.json({ success: true, message: 'Document and its vector passages removed.' });
    } catch (err) {
      next(err);
    }
  }

  async queryDocuments(req, res, next) {
    try {
      const { query } = req.body;
      if (!query || !query.trim()) {
        return res.status(400).json({ success: false, error: 'Query text is required.' });
      }

      const answer = await ragService.answerDocumentQuery(req.workspace._id, query);
      res.json({ success: true, ...answer });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DocumentController();
