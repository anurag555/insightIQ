import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, FileSpreadsheet, FileCheck, Database, Layers, 
  Trash2, ArrowRight, Loader2, CheckCircle2, AlertCircle, 
  Sparkles, FileUp, HardDrive
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DatasetsPage({ onSelectDatasetForMapping, onSelectDatasetForExplorer }) {
  const { activeWorkspace } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const fileInputRef = useRef(null);

  const fetchDatasets = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/datasets');
      if (res.data.success) {
        setDatasets(res.data.datasets);
      }
    } catch (err) {
      console.error('Failed to load datasets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeWorkspace) {
      fetchDatasets();
    }
  }, [activeWorkspace]);

  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError('');
    setActionSuccess('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/datasets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setActionSuccess(`Successfully uploaded and profiled ${res.data.dataset.name}!`);
        await fetchDatasets();
      }
    } catch (err) {
      setUploadError(err.response?.data?.error || 'File upload failed. Ensure CSV or XLSX format.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Load sample business dataset directly
  const handleLoadSample = async (sampleFileName) => {
    setIsUploading(true);
    setUploadError('');
    setActionSuccess('');

    try {
      // Fetch sample file from public or backend directory
      const response = await fetch(`/sample-data/${sampleFileName}`);
      const blob = await response.blob();
      const file = new File([blob], sampleFileName, { type: sampleFileName.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv' });
      await handleFileUpload(file);
    } catch (err) {
      setUploadError(`Failed to load sample dataset: ${err.message}`);
      setIsUploading(false);
    }
  };

  const handleStoreInPostgres = async (datasetId, dsName) => {
    try {
      setActionSuccess('');
      const res = await api.post(`/datasets/${datasetId}/store`);
      if (res.data.success) {
        setActionSuccess(`Successfully synchronized ${dsName} to the analytics warehouse.`);
        await fetchDatasets();
      }
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Failed to synchronize dataset to the warehouse');
    }
  };

  const handleDeleteDataset = async (datasetId) => {
    if (!window.confirm('Are you sure you want to delete this dataset and drop its analytical tables?')) return;
    try {
      const res = await api.delete(`/datasets/${datasetId}`);
      if (res.data.success) {
        await fetchDatasets();
      }
    } catch (err) {
      setUploadError(err.response?.data?.error || 'Failed to delete dataset');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Datasets & Data Sources</h1>
          <p className="text-xs text-slate-400 mt-1">
            Import business datasets, inspect schema profiles, and sync with analytical warehouse storage
          </p>
        </div>
      </div>

      {/* Notifications */}
      {uploadError && (
        <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-2xl flex items-center space-x-3 text-rose-300 text-xs">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-900/60 rounded-2xl flex items-center space-x-3 text-emerald-300 text-xs">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Upload Zone & Sample Data Launchers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upload Dropzone */}
        <div className="lg:col-span-2 bg-slate-900/70 border-2 border-dashed border-slate-800 hover:border-brand-500/50 rounded-2xl p-8 text-center transition group">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files[0])}
            accept=".csv,.xlsx,.xls"
            className="hidden"
            id="dataset-upload"
          />
          <label htmlFor="dataset-upload" className="cursor-pointer flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 text-brand-400 group-hover:scale-105 group-hover:bg-brand-500/20 flex items-center justify-center transition mb-3">
              {isUploading ? <Loader2 className="w-7 h-7 animate-spin" /> : <Upload className="w-7 h-7" />}
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">
              {isUploading ? 'Ingesting and Profiling Dataset...' : 'Click to Upload or Drag and Drop'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-3">
              Supports CSV, Excel (.xlsx, .xls) files up to 50MB. Automatic data type inference and quality inspection applied on upload.
            </p>
            <span className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700">
              Browse Files
            </span>
          </label>
        </div>

        {/* 1-Click Sample Datasets Panel */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-brand-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4" />
              <span>Quick-Start Business Datasets</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Explore InsightIQ instantly with pre-built production transaction data:
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleLoadSample('retail_sales_transactions.csv')}
                disabled={isUploading}
                className="w-full text-left p-2.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-200">Retail Sales Transactions</p>
                  <p className="text-[10px] text-slate-400">1,200 rows • 12 attributes • Sales & Margins</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
              </button>

              <button
                onClick={() => handleLoadSample('customer_segments.csv')}
                disabled={isUploading}
                className="w-full text-left p-2.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-200">Customer Segments</p>
                  <p className="text-[10px] text-slate-400">245 accounts • Enterprise Tiers • Contacts</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
              </button>

              <button
                onClick={() => handleLoadSample('sales_q4_2024.xlsx')}
                disabled={isUploading}
                className="w-full text-left p-2.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-200">Sales Q4 2024 (Excel .xlsx)</p>
                  <p className="text-[10px] text-slate-400">Multi-column Excel workbook</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-800/60 mt-3">
            Synchronized to analytical warehouse with tenant isolation
          </div>
        </div>

      </div>

      {/* Datasets List Grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4">
          Workspace Datasets ({datasets.length})
        </h2>

        {datasets.length === 0 && !isLoading ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
            No datasets uploaded in this workspace yet. Upload a CSV or select a sample dataset above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {datasets.map((ds) => (
              <div 
                key={ds._id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between transition shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2.5 bg-brand-500/10 text-brand-400 rounded-xl">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm tracking-tight">{ds.name}</h3>
                        <p className="text-[11px] text-slate-400">{ds.originalFileName}</p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                      ds.status === 'stored'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {ds.status === 'stored' ? 'Warehouse Synced' : 'Awaiting Sync'}
                    </span>
                  </div>

                  {/* Metrics Badges */}
                  <div className="grid grid-cols-3 gap-2 my-3 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase">Rows</p>
                      <p className="text-xs font-bold text-white">{ds.rowCount?.toLocaleString() || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase">Columns</p>
                      <p className="text-xs font-bold text-white">{ds.columnCount || ds.columns?.length || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase">Quality</p>
                      <p className="text-xs font-bold text-emerald-400">{ds.qualityReport?.overallScore || 100}%</p>
                    </div>
                  </div>

                  {/* Schema Roles Preview */}
                  <div className="text-[11px] text-slate-400 mb-4 line-clamp-1">
                    <span className="text-slate-500">Roles: </span>
                    {ds.columns?.map(c => `${c.cleanName}(${c.semanticRole})`).join(', ')}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-2">
                  <div className="flex items-center space-x-2">
                    {ds.status !== 'stored' ? (
                      <button
                        onClick={() => handleStoreInPostgres(ds._id, ds.name)}
                        className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-brand-500/20"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Sync to Warehouse</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onSelectDatasetForExplorer(ds._id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium rounded-xl transition flex items-center space-x-1.5"
                      >
                        <Database className="w-3.5 h-3.5 text-cyan-400" />
                        <span>View Data Grid</span>
                      </button>
                    )}

                    <button
                      onClick={() => onSelectDatasetForMapping(ds._id)}
                      className="px-3 py-1.5 bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-medium rounded-xl transition flex items-center space-x-1.5"
                    >
                      <Layers className="w-3.5 h-3.5 text-brand-400" />
                      <span>Quality & Schema</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleDeleteDataset(ds._id)}
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-xl transition"
                    title="Delete Dataset"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
