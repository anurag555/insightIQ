import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Upload, Search, Trash2, Sparkles, 
  BookOpen, CheckCircle2, AlertCircle, Loader2, ArrowRight
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DocumentRAGPage() {
  const { activeWorkspace } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [queryText, setQueryText] = useState('');
  const [ragResult, setRagResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/documents');
      if (res.data.success) {
        setDocuments(res.data.documents);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  useEffect(() => {
    if (activeWorkspace) fetchDocuments();
  }, [activeWorkspace]);

  const handleDocumentUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setStatusMessage('');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setStatusMessage(res.data.message);
        await fetchDocuments();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Document ingestion failed. Must be PDF or DOCX.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLoadSampleDoc = async (sampleFileName) => {
    setIsUploading(true);
    setStatusMessage('');
    setErrorMessage('');

    try {
      const response = await fetch(`/sample-docs/${sampleFileName}`);
      const blob = await response.blob();
      const file = new File([blob], sampleFileName, { 
        type: sampleFileName.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      await handleDocumentUpload(file);
    } catch (err) {
      setErrorMessage(`Failed to load sample document: ${err.message}`);
      setIsUploading(false);
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!queryText.trim() || isSearching) return;
    setIsSearching(true);
    setErrorMessage('');

    try {
      const res = await api.post('/documents/query', { query: queryText });
      if (res.data.success) {
        setRagResult(res.data);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'RAG retrieval failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Delete this document and purge its vector passages?')) return;
    try {
      const res = await api.delete(`/documents/${docId}`);
      if (res.data.success) {
        await fetchDocuments();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Failed to delete document');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <span>Company Knowledge Base</span>
            <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Semantic Discovery
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Upload corporate policies, vendor contracts, and strategic reviews for instant conversational discovery
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-900/60 rounded-xl flex items-center space-x-2 text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-950/40 border border-rose-900/60 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* RAG Query Input */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search across policies, service agreements, and strategic reports..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !queryText.trim()}
            className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-brand-500/20 flex items-center space-x-1.5"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Search Knowledge Base</span>
          </button>
        </form>

        {/* Quick query chips */}
        <div className="flex items-center space-x-2 mt-3 overflow-x-auto no-scrollbar">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Test Queries:</span>
          {[
            'What are the volume discounting thresholds for enterprise orders?',
            'What is our guaranteed SLA response time for Enterprise vs Scale tiers?',
            'What is the hardware return and restocking fee policy?'
          ].map((q, idx) => (
            <button
              key={idx}
              onClick={() => { setQueryText(q); }}
              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-lg text-[10px] text-slate-300 whitespace-nowrap transition"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* RAG Answer & Grounded Citations Display */}
      {ragResult && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-brand-400" />
              <h3 className="text-sm font-bold text-white">Knowledge Base Findings</h3>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3 inline" />
              <span>Grounded in Workspace Documents</span>
            </span>
          </div>

          <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
            {ragResult.content}
          </div>

          {/* Citations List */}
          {ragResult.citations && ragResult.citations.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Source Citations & Evidence ({ragResult.citations.length})
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ragResult.citations.map((c, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                      <span className="text-indigo-400">{c.documentName}</span>
                      <span>Page {c.pageNumber}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 italic line-clamp-3">
                      "{c.passage}"
                    </p>
                    <div className="text-[10px] text-slate-500 pt-1">
                      Semantic Similarity: {Math.round(c.similarityScore * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Document Library Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload Zone */}
        <div className="bg-slate-900/70 border-2 border-dashed border-slate-800 hover:border-brand-500/50 rounded-2xl p-6 text-center transition flex flex-col justify-center items-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleDocumentUpload(e.target.files[0])}
            accept=".pdf,.docx,.txt"
            className="hidden"
            id="doc-upload"
          />
          <label htmlFor="doc-upload" className="cursor-pointer flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
              {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
            </div>
            <h3 className="text-xs font-semibold text-white mb-1">Upload Document</h3>
            <p className="text-[11px] text-slate-400 max-w-xs mb-3">
              Attach PDF or DOCX file to chunk and index into searchable vectors
            </p>
            <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-[10px] font-medium border border-slate-700">
              Browse Document
            </span>
          </label>
        </div>

        {/* Sample Docs Launcher */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-4 h-4" />
            <span>Quick-Start Corporate Documents</span>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Pre-index enterprise policy benchmarks into your workspace library:
          </p>

          <div className="space-y-2">
            <button
              onClick={() => handleLoadSampleDoc('Q3_Strategic_Business_Review.pdf')}
              disabled={isUploading}
              className="w-full text-left p-2.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition flex items-center justify-between text-xs"
            >
              <div>
                <p className="font-semibold text-slate-200">Q3 Strategic Business Review</p>
                <p className="text-[10px] text-slate-400">PDF • Pricing thresholds & regional margins</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
            </button>

            <button
              onClick={() => handleLoadSampleDoc('Customer_Support_SLA_and_Refund_Policy.docx')}
              disabled={isUploading}
              className="w-full text-left p-2.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition flex items-center justify-between text-xs"
            >
              <div>
                <p className="font-semibold text-slate-200">Customer Support SLA & Policy</p>
                <p className="text-[10px] text-slate-400">DOCX • 1-hour P1 SLA, hardware warranty</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
            </button>

            <button
              onClick={() => handleLoadSampleDoc('Annual_Financial_Commentary_2024.pdf')}
              disabled={isUploading}
              className="w-full text-left p-2.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition flex items-center justify-between text-xs"
            >
              <div>
                <p className="font-semibold text-slate-200">Annual Financial Commentary</p>
                <p className="text-[10px] text-slate-400">PDF • DSO metrics, credit exposure</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          </div>
        </div>

        {/* Workspace Documents List */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
            Indexed Documents ({documents.length})
          </h3>

          {documents.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-500">
              No documents indexed in this workspace yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {documents.map((doc) => (
                <div key={doc._id} className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 truncate">
                    <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <div className="truncate">
                      <p className="font-medium text-slate-200 truncate">{doc.originalName}</p>
                      <p className="text-[10px] text-slate-500">{doc.chunkCount} vector passages</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteDocument(doc._id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
