import React, { useState, useEffect } from 'react';
import { 
  Layers, ShieldAlert, Sparkles, Check, AlertTriangle, 
  HelpCircle, RefreshCw, Save, CheckCircle2, History, Wand2
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const DATA_TYPES = ['string', 'numeric', 'date', 'boolean', 'categorical'];
const SEMANTIC_ROLES = [
  'none', 'revenue', 'cost', 'profit', 'quantity', 'date', 
  'product', 'category', 'customer_id', 'transaction_id', 
  'region', 'price', 'discount', 'status', 'dimension', 'measure'
];

export default function SchemaMappingPage({ initialDatasetId }) {
  const { activeWorkspace } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(initialDatasetId || '');
  const [dataset, setDataset] = useState(null);
  const [columns, setColumns] = useState([]);
  const [selectedCleanings, setSelectedCleanings] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch available datasets
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const res = await api.get('/datasets');
        if (res.data.success) {
          setDatasets(res.data.datasets);
          if (!selectedDatasetId && res.data.datasets.length > 0) {
            setSelectedDatasetId(res.data.datasets[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to load datasets:', err);
      }
    };
    if (activeWorkspace) fetchDatasets();
  }, [activeWorkspace]);

  // Fetch selected dataset details
  const fetchDatasetDetails = async (id) => {
    if (!id) return;
    try {
      setErrorMessage('');
      const res = await api.get(`/datasets/${id}`);
      if (res.data.success) {
        setDataset(res.data.dataset);
        setColumns(res.data.dataset.columns || []);
        // Select all pending cleanings by default
        const pending = res.data.dataset.qualityReport?.proposedCleanings?.filter(p => p.status === 'pending').map(p => p.id) || [];
        setSelectedCleanings(pending);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Failed to fetch dataset schema');
    }
  };

  useEffect(() => {
    if (selectedDatasetId) {
      fetchDatasetDetails(selectedDatasetId);
    }
  }, [selectedDatasetId]);

  // Handle column mapping edit
  const handleColumnChange = (index, field, value) => {
    const updated = [...columns];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'semanticRole') {
      updated[index].confidence = 1.0;
      updated[index].isAmbiguous = false;
    }
    setColumns(updated);
  };

  // Save manual mappings
  const handleSaveMappings = async () => {
    setIsSaving(true);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const res = await api.put(`/datasets/${selectedDatasetId}/mapping`, {
        mappings: columns.map(c => ({
          originalName: c.originalName,
          cleanName: c.cleanName,
          dataType: c.dataType,
          semanticRole: c.semanticRole
        }))
      });
      if (res.data.success) {
        setStatusMessage('Schema profiling and column mappings saved successfully!');
        setDataset(res.data.dataset);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Failed to save mappings');
    } finally {
      setIsSaving(false);
    }
  };

  // Apply approved cleaning operations
  const handleApplyCleanings = async () => {
    if (selectedCleanings.length === 0) return;
    setIsCleaning(true);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const res = await api.post(`/datasets/${selectedDatasetId}/clean`, {
        approvedCleaningIds: selectedCleanings
      });
      if (res.data.success) {
        setStatusMessage(res.data.message);
        await fetchDatasetDetails(selectedDatasetId);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Failed to apply cleaning operations');
    } finally {
      setIsCleaning(false);
    }
  };

  const qr = dataset?.qualityReport;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Data Quality & Schema Models</h1>
          <p className="text-xs text-slate-400 mt-1">
            Validate column classifications, resolve semantic roles, and apply automated quality corrections
          </p>
        </div>

        {/* Dataset Selector */}
        {datasets.length > 0 && (
          <div className="flex items-center space-x-2">
            <label className="text-xs font-medium text-slate-400">Dataset:</label>
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-medium"
            >
              {datasets.map((ds) => (
                <option key={ds._id} value={ds._id}>{ds.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {statusMessage && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-900/60 rounded-xl flex items-center space-x-2 text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-950/40 border border-rose-900/60 rounded-xl flex items-center space-x-2 text-rose-300 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Quality Report Banner */}
      {qr && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            <div className="flex items-center space-x-4">
              <div className="relative w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center">
                <span className={`text-xl font-black ${
                  qr.overallScore >= 80 ? 'text-emerald-400' : (qr.overallScore >= 60 ? 'text-amber-400' : 'text-rose-400')
                }`}>
                  {qr.overallScore}
                </span>
                <span className="text-[10px] text-slate-500 absolute bottom-1">SCORE</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Data Quality Health Assessment</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Audit report scanning missing values, duplicate records, invalid formats, and numeric outliers.
                </p>
              </div>
            </div>

            {/* Quality Metrics Counters */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl min-w-[100px]">
                <p className="text-[10px] text-slate-400 uppercase">Missing Values</p>
                <p className={`text-xs font-bold ${qr.missingValueCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                  {qr.missingValueCount}
                </p>
              </div>
              <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl min-w-[100px]">
                <p className="text-[10px] text-slate-400 uppercase">Duplicates</p>
                <p className={`text-xs font-bold ${qr.duplicateRowCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                  {qr.duplicateRowCount}
                </p>
              </div>
              <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl min-w-[100px]">
                <p className="text-[10px] text-slate-400 uppercase">Outliers (IQR)</p>
                <p className={`text-xs font-bold ${qr.outliers?.length > 0 ? 'text-indigo-400' : 'text-slate-200'}`}>
                  {qr.outliers?.length || 0}
                </p>
              </div>
            </div>

          </div>

          {/* Proposed Cleanings Section */}
          {qr.proposedCleanings && qr.proposedCleanings.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
                  <Wand2 className="w-3.5 h-3.5 text-brand-400" />
                  <span>Proposed Cleaning Operations</span>
                </div>
                <button
                  onClick={handleApplyCleanings}
                  disabled={isCleaning || selectedCleanings.length === 0}
                  className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-brand-500/20 flex items-center space-x-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isCleaning ? 'Applying...' : `Apply Selected (${selectedCleanings.length})`}</span>
                </button>
              </div>

              <div className="space-y-2">
                {qr.proposedCleanings.map((prop) => (
                  <label
                    key={prop.id}
                    className="flex items-center space-x-3 p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs cursor-pointer hover:bg-slate-900 transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCleanings.includes(prop.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCleanings([...selectedCleanings, prop.id]);
                        } else {
                          setSelectedCleanings(selectedCleanings.filter(id => id !== prop.id));
                        }
                      }}
                      className="rounded border-slate-700 bg-slate-900 text-brand-500 focus:ring-brand-500 w-4 h-4"
                    />
                    <div className="flex-1">
                      <span className="font-semibold text-slate-200">{prop.description}</span>
                      <span className="text-[11px] text-slate-500 ml-2">({prop.affectedCount} items affected)</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${
                      prop.status === 'applied' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {prop.status}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Column Schema Mapping Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Schema Attributes & Semantic Roles</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Review and adjust inferred data types and business roles prior to analytical computation
            </p>
          </div>
          <button
            onClick={handleSaveMappings}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-brand-500/20"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Schema Mappings'}</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-semibold">Column Name</th>
                <th className="px-4 py-3 font-semibold">Primitive Type</th>
                <th className="px-4 py-3 font-semibold">Semantic Role</th>
                <th className="px-4 py-3 font-semibold">Confidence</th>
                <th className="px-4 py-3 font-semibold">Sample Values</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {columns.map((col, idx) => (
                <tr key={idx} className="hover:bg-slate-850/40 transition">
                  <td className="px-4 py-3 font-medium text-white">
                    <div className="flex items-center space-x-2">
                      <span>{col.originalName}</span>
                      {col.isAmbiguous && (
                        <span className="p-0.5 text-amber-400" title="Ambiguous role inferred">
                          <AlertTriangle className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{col.cleanName}</span>
                  </td>

                  {/* Primitive Type Selector */}
                  <td className="px-4 py-3">
                    <select
                      value={col.dataType}
                      onChange={(e) => handleColumnChange(idx, 'dataType', e.target.value)}
                      className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-medium"
                    >
                      {DATA_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>

                  {/* Semantic Role Selector */}
                  <td className="px-4 py-3">
                    <select
                      value={col.semanticRole}
                      onChange={(e) => handleColumnChange(idx, 'semanticRole', e.target.value)}
                      className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-medium"
                    >
                      {SEMANTIC_ROLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>

                  {/* Confidence Progress Bar */}
                  <td className="px-4 py-3">
                    <div className="w-24">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-400">{Math.round(col.confidence * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${col.confidence >= 0.8 ? 'bg-emerald-400' : 'bg-brand-400'}`}
                          style={{ width: `${col.confidence * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>

                  {/* Sample Values Preview */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {col.sampleValues && col.sampleValues.slice(0, 3).map((v, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-slate-950 border border-slate-800 text-slate-400 rounded text-[10px] truncate max-w-[100px]">
                          {String(v)}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auditable Cleaning History */}
      {dataset?.cleaningHistory && dataset.cleaningHistory.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
            <History className="w-4 h-4 text-brand-400" />
            <span>Auditable Transformation Log</span>
          </div>

          <div className="space-y-2">
            {dataset.cleaningHistory.map((hist, idx) => (
              <div key={idx} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-200">{hist.description}</p>
                  <p className="text-[10px] text-slate-500">Operation: {hist.operation} • Rows affected: {hist.rowsAffected}</p>
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(hist.appliedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
