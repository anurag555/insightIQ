const Conversation = require('../models/Conversation');
const Dataset = require('../models/Dataset');
const aiAnalystService = require('../services/aiAnalystService');
const hybridQueryService = require('../services/hybridQueryService');

class AIController {
  async chat(req, res, next) {
    try {
      const { message, conversationId, datasetId, mode = 'analyst' } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
      }

      let conversation = null;
      if (conversationId) {
        conversation = await Conversation.findOne({ _id: conversationId, workspaceId: req.workspace._id });
      }

      if (!conversation) {
        conversation = new Conversation({
          workspaceId: req.workspace._id,
          userId: req.user._id,
          title: message.slice(0, 40) + '...',
          datasetId: datasetId || null,
          mode,
          messages: []
        });
      }

      // Add user message to conversation
      conversation.messages.push({
        sender: 'user',
        content: message,
        mode,
        datasetId: datasetId || conversation.datasetId
      });

      let dataset = null;
      const targetDatasetId = datasetId || conversation.datasetId;
      if (targetDatasetId) {
        dataset = await Dataset.findOne({ _id: targetDatasetId, workspaceId: req.workspace._id });
      }

      // Execute query through Hybrid / Analyst engine
      let aiResult = null;
      if (mode === 'hybrid' || !targetDatasetId) {
        aiResult = await hybridQueryService.handleQuery(
          req.workspace._id,
          dataset,
          message,
          conversation.messages
        );
      } else {
        aiResult = await aiAnalystService.answerQuery(
          message,
          dataset,
          conversation.messages
        );
      }

      // Add assistant message to conversation
      const assistantMsg = {
        sender: 'assistant',
        content: aiResult.content,
        mode: aiResult.mode || mode,
        datasetId: dataset?._id,
        toolsCalled: aiResult.toolsCalled || [],
        citations: aiResult.citations || [],
        chartSuggestion: aiResult.chartSuggestion || null,
        isDemoResponse: Boolean(aiResult.isDemoResponse)
      };

      conversation.messages.push(assistantMsg);
      await conversation.save();

      res.json({
        success: true,
        conversationId: conversation._id,
        reply: assistantMsg
      });
    } catch (err) {
      next(err);
    }
  }

  async listConversations(req, res, next) {
    try {
      const conversations = await Conversation.find({ workspaceId: req.workspace._id })
        .select('title mode datasetId createdAt updatedAt')
        .sort({ updatedAt: -1 });
      res.json({ success: true, conversations });
    } catch (err) {
      next(err);
    }
  }

  async getConversation(req, res, next) {
    try {
      const conversation = await Conversation.findOne({
        _id: req.params.conversationId,
        workspaceId: req.workspace._id
      });

      if (!conversation) {
        return res.status(404).json({ success: false, error: 'Conversation not found.' });
      }

      res.json({ success: true, conversation });
    } catch (err) {
      next(err);
    }
  }

  async createConversation(req, res, next) {
    try {
      const { title, datasetId, mode = 'analyst' } = req.body;
      const conversation = new Conversation({
        workspaceId: req.workspace._id,
        userId: req.user._id,
        title: title || 'New Analysis',
        datasetId: datasetId || null,
        mode,
        messages: []
      });
      await conversation.save();
      res.status(201).json({ success: true, conversation });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AIController();
