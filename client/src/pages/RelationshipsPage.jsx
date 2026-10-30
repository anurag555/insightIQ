import React, { useState, useEffect } from 'react';
import { 
  Link2, Plus, Play, Database, CheckCircle2, 
  AlertCircle, ArrowRight, Table, Loader2 
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function RelationshipsPage() {
  const { activeWorkspace } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [selectedRel, setSelectedRel] = useState(null);
  const [joinedRows, setJoinedRows] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form states
  const [relName, setRelName] = useState('');
  const [sourceDsId, setSourceDsId] = useState('');
  const [sourceCol, setSourceCol] = useState('');
  const [targetDsId, setTargetDsId] = useState('');
  const [targetCol, setTargetCol] = useState('');
  const [joinType, setJoinType] = useState('INNER');

  const fetchData = async () => {
    try {
      const [dsRes, relRes] = await Promise.all([
        api.get('/datasets'),
        api.get('/datasets/relationships')
      ]);
      if (dsRes.data.success) {
        setDatasets(dsRes.data.datasets.filter(d => d.status === 'stored'));
      }
      if (relRes.data.success) {
        setRelationships(relRes.data.relationships);
      }
    } catch (err) {
      console.error('Failed to load datasets/relationships:', err);
    }
  };

  useEffect(() => {
    if (activeWorkspace) fetchData();
  }, [activeWorkspace]);

  const sourceDataset = datasets.find(d => d._id === sourceDsId);
  const targetDataset = datasets.find(d => d._id === targetDsId);

  const handleCreateRelationship = async (e) => {
    e.preventDefault();
    if (!sourceDsId || !targetDsId || !sourceCol || !targetCol) {
      setErrorMessage('Please select both datasets and their matching identifier columns.');
      return;
    }
    setIsCreating(true);
    setStatusMessage('');
    setErrorMessage('');

    try {
      const res = await api.post('/datasets/relationships', {
        name: relName || `${sourceDataset?.name} ⟷ ${targetDataset?.name}`,
        sourceDatasetId: sourceDsId,
        sourceColumn: sourceCol,
        targetDatasetId: targetDsId,
        targetColumn: targetCol,
        joinType
      });
      if (res.data.success) {
        setStatusMessage('Relationship successfully registered!');
        setRelName('');
        await fetchData();
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Failed to create relationship');
    } finally {
      setIsCreating(false);
    }
  };

  const handleExecuteJoin = async (rel) => {
    setSelectedRel(rel);
    setIsExecuting(true);
    setErrorMessage('');
    try {
      const res = await api.post('/datasets/join', {
        relationshipId: rel._id,
        limit: 50
      });
      if (res.data.success) {
        setJoinedRows(res.data.rows);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Failed to execute join query');
      setJoinedRows(null);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <span>Data Modeling & Relationships</span>
            <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Relational Graph
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Connect related business entities across datasets to perform joined analytics and multi-table reporting
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Create Relationship Form */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center space-x-2 text-xs font-bold text-white uppercase tracking-wider mb-4">
            <Link2 className="w-4 h-4 text-brand-400" />
            <span>Connect Datasets</span>
          </div>

          <form onSubmit={handleCreateRelationship} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Relationship Name (Optional)</label>
              <input
                type="text"
                value={relName}
                onChange={(e) => setRelName(e.target.value)}
                placeholder="e.g. Sales to Customers"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Source Dataset */}
            <div>
              <label className="block text-slate-400 mb-1">Source Dataset *</label>
              <select
                value={sourceDsId}
                onChange={(e) => {
                  setSourceDsId(e.target.value);
                  setSourceCol('');
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 font-medium"
                required
              >
                <option value="">Select Primary Dataset</option>
                {datasets.map(d => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>

            {sourceDataset && (
              <div>
                <label className="block text-slate-400 mb-1">Source Identifier Column *</label>
                <select
                  value={sourceCol}
                  onChange={(e) => setSourceCol(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  required
                >
                  <option value="">Select Match Column</option>
                  {sourceDataset.columns.map(c => (
                    <option key={c.cleanName} value={c.cleanName}>
                      {c.originalName} ({c.semanticRole})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Target Dataset */}
            <div className="pt-2 border-t border-slate-800/60">
              <label className="block text-slate-400 mb-1">Target Dataset *</label>
              <select
                value={targetDsId}
                onChange={(e) => {
                  setTargetDsId(e.target.value);
                  setTargetCol('');
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 font-medium"
                required
              >
                <option value="">Select Secondary Dataset</option>
                {datasets.filter(d => d._id !== sourceDsId).map(d => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>

            {targetDataset && (
              <div>
                <label className="block text-slate-400 mb-1">Target Identifier Column *</label>
                <select
                  value={targetCol}
                  onChange={(e) => setTargetCol(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  required
                >
                  <option value="">Select Foreign Key Column</option>
                  {targetDataset.columns.map(c => (
                    <option key={c.cleanName} value={c.cleanName}>
                      {c.originalName} ({c.semanticRole})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-slate-400 mb-1">SQL Join Type</label>
              <select
                value={joinType}
                onChange={(e) => setJoinType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
              >
                <option value="INNER">INNER JOIN (Exact matches)</option>
                <option value="LEFT">LEFT JOIN (All source rows)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium rounded-xl transition shadow-md shadow-brand-500/20 flex items-center justify-center space-x-1.5 mt-2"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Register Relationship</span>
            </button>
          </form>
        </div>

        {/* Existing Relationships List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">
              Registered Relationships ({relationships.length})
            </h3>

            {relationships.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No entity relationships registered yet. Ensure at least two datasets are synchronized to the warehouse.
              </div>
            ) : (
              <div className="space-y-3">
                {relationships.map((rel) => (
                  <div 
                    key={rel._id}
                    className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-white text-xs">{rel.name}</span>
                        <span className="px-2 py-0.5 bg-slate-800 text-brand-400 rounded text-[10px] font-mono">
                          {rel.joinType}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {rel.sourceDatasetId?.name}.<strong className="text-slate-300">{rel.sourceColumn}</strong> ⟷ {rel.targetDatasetId?.name}.<strong className="text-slate-300">{rel.targetColumn}</strong>
                      </p>
                    </div>

                    <button
                      onClick={() => handleExecuteJoin(rel)}
                      disabled={isExecuting}
                      className="px-3.5 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Execute Join Query</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Joined Results Table */}
          {joinedRows && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Table className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white">Joined Query Results ({joinedRows.length} rows)</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Live Warehouse Query</span>
              </div>

              {joinedRows.length > 0 ? (
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs whitespace-nowrap font-mono text-[11px]">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[9px] tracking-wider border-b border-slate-800">
                      <tr>
                        {Object.keys(joinedRows[0]).slice(0, 8).map(k => (
                          <th key={k} className="px-3 py-2">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {joinedRows.slice(0, 15).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-850/40">
                          {Object.keys(joinedRows[0]).slice(0, 8).map(k => (
                            <td key={k} className="px-3 py-2 truncate max-w-[150px]">
                              {String(row[k] !== null && row[k] !== undefined ? row[k] : '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-500">
                  Join returned zero matching rows.
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
