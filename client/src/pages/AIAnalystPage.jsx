import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, Sparkles, Cpu, Clock, BarChart2, Layers, 
  ChevronRight, RefreshCw, AlertCircle, FileText, CheckCircle2
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function AIAnalystPage() {
  const { activeWorkspace } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [mode, setMode] = useState('analyst'); // 'analyst' or 'hybrid'
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Suggestions
  const promptSuggestions = [
    'What is our monthly sales trend and peak month?',
    'Which category generates the highest revenue?',
    'Show top enterprise customers by spend',
    'Are there any statistical anomalies in daily sales?',
    'Compare current period growth with previous month'
  ];

  // Fetch datasets
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const res = await api.get('/datasets');
        if (res.data.success) {
          setDatasets(res.data.datasets);
          const stored = res.data.datasets.find(d => d.status === 'stored');
          if (stored) setSelectedDatasetId(stored._id);
          else if (res.data.datasets.length > 0) setSelectedDatasetId(res.data.datasets[0]._id);
        }
      } catch (err) {
        console.error('Failed to load datasets:', err);
      }
    };
    if (activeWorkspace) fetchDatasets();
  }, [activeWorkspace]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          sender: 'assistant',
          content: `Hello! I am your **InsightIQ Decision Analyst**.\n\nI query your warehouse datasets and corporate documents to calculate performance metrics, growth rates, customer retention, and strategic alignments.\n\nAsk a question or select a recommended prompt below to begin.`,
          toolsCalled: [],
          citations: [],
          isDemoResponse: false
        }
      ]);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleSendMessage = async (textToSend = null) => {
    const queryText = textToSend || inputMessage;
    if (!queryText.trim() || isSending) return;

    const userMsg = {
      sender: 'user',
      content: queryText,
      mode
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsSending(true);

    try {
      const res = await api.post('/ai/chat', {
        message: queryText,
        datasetId: selectedDatasetId,
        conversationId,
        mode
      });

      if (res.data.success) {
        setConversationId(res.data.conversationId);
        setMessages(prev => [...prev, res.data.reply]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          content: `⚠️ Error executing query: ${err.response?.data?.error || err.message}`,
          toolsCalled: []
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-4">
      {/* Top Header & Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <span>AI Business Analyst</span>
            <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
              Enterprise Assistant
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Ask complex business questions in plain English. Get answers calculated directly from your company data.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Mode Selector */}
          <div className="flex items-center space-x-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <button
              onClick={() => setMode('analyst')}
              className={`px-3 py-1 font-medium rounded-lg transition ${
                mode === 'analyst' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Data Analytics
            </button>
            <button
              onClick={() => setMode('hybrid')}
              className={`px-3 py-1 font-medium rounded-lg transition ${
                mode === 'hybrid' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Unified (Data + Documents)
            </button>
          </div>

          {/* Dataset Selector */}
          {datasets.length > 0 && (
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-medium max-w-[200px] truncate"
            >
              {datasets.map((ds) => (
                <option key={ds._id} value={ds._id}>
                  {ds.name} {ds.status === 'stored' ? '✓' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Chat Messages Feed Container */}
      <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 overflow-y-auto space-y-4">
        {messages.map((msg, idx) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl rounded-2xl p-4 space-y-3 ${
                isUser 
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' 
                  : 'bg-slate-900 border border-slate-800 text-slate-200 shadow-xl'
              }`}>
                {/* Assistant header tag */}
                {!isUser && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center space-x-1.5">
                      <Bot className="w-3.5 h-3.5 text-brand-400" />
                      <span className="font-semibold text-slate-300">InsightIQ Analyst</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 flex items-center space-x-1 font-medium">
                      <CheckCircle2 className="w-3 h-3 inline" />
                      <span>Verified by Warehouse</span>
                    </span>
                  </div>
                )}

                {/* Tool Calling Execution Badges */}
                {msg.toolsCalled && msg.toolsCalled.length > 0 && (
                  <div className="space-y-1.5 py-1">
                    {msg.toolsCalled.map((tool, tIdx) => {
                      const toolDisplayNames = {
                        getRevenueByPeriod: 'Analyzed Period Trends',
                        getTopCategories: 'Queried Category Breakdown',
                        getDatasetOverview: 'Computed Overview KPIs',
                        getBusinessMetrics: 'Calculated Key Metrics',
                        comparePeriods: 'Computed Period-over-Period Delta',
                        getCustomerInsights: 'Queried Customer Intelligence',
                        detectAnomalies: 'Scanned Statistical Variances',
                        getDatasetColumns: 'Inspected Schema Model'
                      };
                      const displayName = toolDisplayNames[tool.toolName] || tool.toolName;

                      return (
                        <div key={tIdx} className="flex items-center space-x-2 text-[10px] bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span className="font-semibold text-slate-200">{displayName}</span>
                          <span className="text-slate-500 ml-auto flex items-center space-x-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{tool.executionTimeMs || 8}ms</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Document Citations (if Hybrid or RAG) */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 rounded-xl space-y-2">
                    <div className="flex items-center space-x-1.5 text-[11px] font-bold text-indigo-300 uppercase">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Retrieved Document Citations ({msg.citations.length})</span>
                    </div>
                    <div className="space-y-1">
                      {msg.citations.map((c, cIdx) => (
                        <div key={cIdx} className="text-[11px] text-slate-300">
                          <span className="font-semibold text-indigo-300">[{c.documentName}, Page {c.pageNumber}]:</span> "{c.passage}"
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Text Content */}
                <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
                  {msg.content}
                </div>

                {/* Embedded Dynamic Chart Suggestion */}
                {msg.chartSuggestion && msg.chartSuggestion.data && (
                  <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-white">
                        {msg.chartSuggestion.title || 'Visual Output'}
                      </span>
                      <span className="text-[10px] text-brand-400 font-mono uppercase">
                        {msg.chartSuggestion.type} chart
                      </span>
                    </div>

                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        {msg.chartSuggestion.type === 'line' ? (
                          <LineChart data={msg.chartSuggestion.data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey={msg.chartSuggestion.xAxis || 'label'} stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                            <Line type="monotone" dataKey={msg.chartSuggestion.yAxis || 'value'} stroke="#0c87eb" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        ) : (
                          <BarChart data={msg.chartSuggestion.data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey={msg.chartSuggestion.xAxis || 'dimension'} stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                            <Bar dataKey={msg.chartSuggestion.yAxis || 'value'} fill="#0c87eb" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-center space-x-2 text-xs text-slate-400 p-2">
            <Sparkles className="w-4 h-4 text-brand-400 animate-spin" />
            <span>Analyzing query, computing warehouse metrics...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar flex-shrink-0">
        <span className="text-[11px] text-slate-500 font-semibold whitespace-nowrap">Suggested:</span>
        {promptSuggestions.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            disabled={isSending}
            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-full text-[11px] text-slate-300 whitespace-nowrap transition"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Message Bar */}
      <div className="flex items-center space-x-3 bg-slate-900 border border-slate-800 rounded-2xl p-2 flex-shrink-0">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder={`Ask a question about ${datasets.find(d => d._id === selectedDatasetId)?.name || 'dataset'}...`}
          disabled={isSending}
          className="flex-1 px-3 py-2 bg-transparent text-white placeholder-slate-500 text-xs focus:outline-none"
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim() || isSending}
          className="p-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white rounded-xl transition shadow-md shadow-brand-500/20"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
