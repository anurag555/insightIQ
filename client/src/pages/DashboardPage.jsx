import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, 
  Sparkles, ShieldAlert, Calendar, Layers, ArrowUpRight, ArrowDownRight,
  Database, RefreshCw, AlertCircle
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#0c87eb', '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#34d399'];

export default function DashboardPage({ onNavigateToDatasets }) {
  const { activeWorkspace } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [granularity, setGranularity] = useState('month');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch datasets
  const fetchDatasets = async () => {
    try {
      const res = await api.get('/datasets');
      if (res.data.success) {
        setDatasets(res.data.datasets || []);
        // Pick first dataset with stored status or first dataset
        const stored = res.data.datasets.find(d => d.status === 'stored');
        if (stored) {
          setSelectedDatasetId(stored._id);
        } else if (res.data.datasets.length > 0) {
          setSelectedDatasetId(res.data.datasets[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch datasets:', err);
    }
  };

  useEffect(() => {
    if (activeWorkspace) {
      fetchDatasets();
    }
  }, [activeWorkspace]);

  // Fetch dashboard payload when selected dataset changes
  const fetchDashboard = async (dsId, gran) => {
    if (!dsId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const res = await api.get(`/analytics/${dsId}/dashboard?granularity=${gran}`);
      if (res.data.success) {
        setDashboardData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load analytical dashboard data');
      setDashboardData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDatasetId) {
      fetchDashboard(selectedDatasetId, granularity);
    }
  }, [selectedDatasetId, granularity]);

  const overview = dashboardData?.overview;
  const timeSeries = dashboardData?.timeSeries?.series || [];
  const categoryBreakdown = dashboardData?.categoryBreakdown || [];
  const topProducts = dashboardData?.topProducts?.top || [];
  const regionBreakdown = dashboardData?.regionBreakdown || [];
  const periodComp = dashboardData?.periodComparison;

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Executive Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            Consolidated business performance, run-rate trends, and customer metrics
          </p>
        </div>

        {/* Dataset Selector & Controls */}
        <div className="flex items-center space-x-3">
          {datasets.length > 0 ? (
            <div className="flex items-center space-x-2">
              <label className="text-xs font-medium text-slate-400">Dataset:</label>
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-medium"
              >
                {datasets.map((ds) => (
                  <option key={ds._id} value={ds._id}>
                    {ds.name} {ds.status === 'stored' ? '(Active)' : '(Pending Sync)'}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <button
              onClick={onNavigateToDatasets}
              className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-xl transition shadow-md shadow-brand-500/20"
            >
              + Connect Dataset
            </button>
          )}

          <button
            onClick={() => fetchDashboard(selectedDatasetId, granularity)}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* When no datasets exist */}
      {datasets.length === 0 && !isLoading && (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center max-w-xl mx-auto my-12">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center mx-auto mb-4 border border-brand-500/20">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No Active Datasets Connected</h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Upload CSV or Excel business data to immediately generate automated metrics, visual trends, and AI analytics.
          </p>
          <button
            onClick={onNavigateToDatasets}
            className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-xl text-sm transition shadow-lg shadow-brand-500/25 inline-flex items-center space-x-2"
          >
            <span>Connect First Dataset</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-amber-950/30 border border-amber-900/50 rounded-2xl flex items-center space-x-3 text-amber-300 text-xs">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Warehouse Synchronization Required</p>
            <p className="text-amber-400/80 mt-0.5">{error}. Please visit Datasets or Schema tab to synchronize this dataset to the analytics warehouse.</p>
          </div>
        </div>
      )}

      {/* Main KPI Cards Grid */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Total Revenue / Volume */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden card-glow">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>{overview.totalRevenue !== null ? 'Gross Revenue' : 'Total Records'}</span>
              <div className="p-2 bg-brand-500/10 text-brand-400 rounded-xl">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">
              {overview.totalRevenue !== null ? `$${overview.totalRevenue.toLocaleString()}` : `${overview.rowCount.toLocaleString()} rows`}
            </div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center space-x-1.5">
              <span>Total Volume:</span>
              <span className="text-slate-200 font-semibold">{overview.rowCount.toLocaleString()} transactions</span>
            </div>
          </div>

          {/* Card 2: Average Order Value / Mean */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Average Order Value</span>
              <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-white">
              {overview.averageRevenue !== null ? `$${overview.averageRevenue.toLocaleString()}` : 'N/A'}
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              Range: ${overview.minRevenue || 0} — ${overview.maxRevenue?.toLocaleString() || 0}
            </div>
          </div>

          {/* Card 3: Period Comparison MoM Delta */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Period Growth (MoM)</span>
              <div className={`p-2 rounded-xl ${periodComp?.trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {periodComp?.trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-white">
                {periodComp?.canCompare ? `${periodComp.percentChange >= 0 ? '+' : ''}${periodComp.percentChange}%` : 'N/A'}
              </span>
              {periodComp?.canCompare && (
                <span className={`text-xs font-semibold ${periodComp.trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ${periodComp.delta.toLocaleString()}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-2 truncate">
              {periodComp?.canCompare ? `${periodComp.previousPeriod.label} vs ${periodComp.currentPeriod.label}` : 'Single period'}
            </div>
          </div>

          {/* Card 4: Data Quality & Uniques */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Data Health Score</span>
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-white">
                {overview.overallQualityScore}<span className="text-xs text-slate-500 font-normal">/100</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Verified
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2 truncate">
              {overview.uniqueCustomers ? `${overview.uniqueCustomers} unique accounts` : `${overview.columnCount} columns mapped`}
            </div>
          </div>

        </div>
      )}

      {/* Main Charts Row */}
      {timeSeries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Time Series Area Chart */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Revenue Run-rate Progression</h3>
                <p className="text-xs text-slate-400 mt-0.5">Chronological timeline of gross transaction volume</p>
              </div>
              <div className="flex items-center space-x-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                <button
                  onClick={() => setGranularity('month')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition ${
                    granularity === 'month' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setGranularity('day')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition ${
                    granularity === 'day' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Daily
                </button>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0c87eb" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0c87eb" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px', color: '#f8fafc' }}
                    formatter={(val) => [`$${val.toLocaleString()}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#0c87eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Regional Geographic Distribution Donut Chart */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Geographic Distribution</h3>
            <p className="text-xs text-slate-400 mb-4">Volume breakdown across global territories</p>

            {regionBreakdown.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={regionBreakdown}
                      dataKey="value"
                      nameKey="dimension"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {regionBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px', color: '#f8fafc' }}
                      formatter={(val) => [`$${val.toLocaleString()}`, 'Total']}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      formatter={(val) => <span className="text-slate-300">{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-500">
                No geographic dimensions detected
              </div>
            )}
          </div>

        </div>
      )}

      {/* Secondary Row: Category Bar Chart & Top Products Table */}
      {categoryBreakdown.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Category Revenue Bar Chart */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Category Performance</h3>
            <p className="text-xs text-slate-400 mb-4">Contribution by product category</p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryBreakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="dimension" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px', color: '#f8fafc' }}
                    formatter={(val) => [`$${val.toLocaleString()}`, 'Revenue']}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {categoryBreakdown.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Products Rankings */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-1">Top Performing Offerings</h3>
            <p className="text-xs text-slate-400 mb-4">Highest gross volume products</p>

            {topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 text-brand-400 flex items-center justify-center text-xs font-bold">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-medium text-slate-200">{p.dimension}</span>
                    </div>
                    <span className="text-xs font-bold text-white">${p.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-500">
                No product dimension detected
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
