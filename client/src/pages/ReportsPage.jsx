import React, { useState, useEffect } from 'react';
import { 
  FileCheck, Download, FileSpreadsheet, FileText, 
  Sparkles, CheckCircle2, TrendingUp, TrendingDown,
  Layers, AlertCircle, RefreshCw
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ReportsPage() {
  const { activeWorkspace } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

  const fetchReport = async (dsId) => {
    if (!dsId) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get(`/reports/${dsId}/summary`);
      if (res.data.success) {
        setReport(res.data.report);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate report');
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDatasetId) {
      fetchReport(selectedDatasetId);
    }
  }, [selectedDatasetId]);

  const handleDownloadCsv = () => {
    if (!selectedDatasetId) return;
    window.open(`/api/reports/${selectedDatasetId}/csv`, '_blank');
  };

  const handleDownloadPdf = () => {
    if (!selectedDatasetId) return;
    window.open(`/api/reports/${selectedDatasetId}/pdf`, '_blank');
  };

  const cm = report?.computedMetrics;
  const pc = report?.periodComparison;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <span>Executive Business Reports</span>
            <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Computed & Audited
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Downloadable executive summaries, CSV analytical exports, and verified PDF reports
          </p>
        </div>

        {/* Dataset Selector & Download Buttons */}
        <div className="flex items-center space-x-3">
          {datasets.length > 0 && (
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-medium"
            >
              {datasets.map((ds) => (
                <option key={ds._id} value={ds._id}>
                  {ds.name} {ds.status === 'stored' ? '✓' : ''}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleDownloadCsv}
            disabled={!selectedDatasetId || !report}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 text-slate-200 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 border border-slate-700"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download CSV</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={!selectedDatasetId || !report}
            className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-brand-500/20 flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Executive PDF</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-950/30 border border-amber-900/50 rounded-2xl flex items-center space-x-3 text-amber-300 text-xs">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}. Please synchronize this dataset to the analytics warehouse.</span>
        </div>
      )}

      {/* Report Document Preview Container */}
      {report && cm && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
          
          {/* Document Header */}
          <div className="border-b border-slate-800 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">
                  Automated Intelligence Report
                </span>
                <h2 className="text-xl font-bold text-white mt-1">
                  Executive Business Review: {report.datasetName}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Generated on {new Date(report.generatedAt).toLocaleDateString('en-US', { dateStyle: 'full' })}
                </p>
              </div>

              <div className="text-right">
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold">
                  Health: {cm.qualityScore}/100
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: KPI Metrics */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              1. Key Empirical Performance Metrics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <p className="text-[10px] text-slate-500 uppercase">Total Volume</p>
                <p className="text-lg font-bold text-white mt-1">{cm.totalRows?.toLocaleString()} rows</p>
              </div>
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <p className="text-[10px] text-slate-500 uppercase">Total Revenue</p>
                <p className="text-lg font-bold text-brand-400 mt-1">
                  {cm.totalRevenue ? `$${cm.totalRevenue.toLocaleString()}` : 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <p className="text-[10px] text-slate-500 uppercase">Avg Order Value</p>
                <p className="text-lg font-bold text-white mt-1">
                  {cm.averageOrderValue ? `$${cm.averageOrderValue}` : 'N/A'}
                </p>
              </div>
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                <p className="text-[10px] text-slate-500 uppercase">Timeline Range</p>
                <p className="text-xs font-semibold text-slate-300 mt-2 truncate">{cm.dateRange}</p>
              </div>
            </div>
          </div>

          {/* Section 2: Top Segments */}
          {report.topPerformers && report.topPerformers.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                2. Segment Contribution & Rankings
              </h3>
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-2.5">Rank</th>
                      <th className="px-4 py-2.5">Segment / Category</th>
                      <th className="px-4 py-2.5">Total Value</th>
                      <th className="px-4 py-2.5">Events</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {report.topPerformers.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-850/40">
                        <td className="px-4 py-2 text-slate-500 font-bold">#{idx + 1}</td>
                        <td className="px-4 py-2 font-medium text-white">{p.dimension}</td>
                        <td className="px-4 py-2 font-semibold text-brand-400">${p.value.toLocaleString()}</td>
                        <td className="px-4 py-2 text-slate-400">{p.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 3: Period Comparison */}
          {pc && pc.canCompare && (
            <div>
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                3. Comparative Trajectory (MoM)
              </h3>
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Comparing </span>
                  <strong className="text-white">{pc.previousPeriod.label}</strong>
                  <span className="text-slate-400"> against </span>
                  <strong className="text-white">{pc.currentPeriod.label}</strong>
                  <p className="text-slate-400 mt-1">
                    Gross change: <strong className={pc.trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}>${pc.delta.toLocaleString()}</strong> ({pc.percentChange >= 0 ? '+' : ''}{pc.percentChange}%)
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${pc.trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {pc.trend === 'up' ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Analytical Commentary */}
          {report.interpretationNotes && report.interpretationNotes.length > 0 && (
            <div className="pt-4 border-t border-slate-800/80">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                4. Analytical Commentary & Observations
              </h3>
              <div className="space-y-1.5 text-xs text-slate-300">
                {report.interpretationNotes.map((note, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <span className="text-brand-400 font-bold">•</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
