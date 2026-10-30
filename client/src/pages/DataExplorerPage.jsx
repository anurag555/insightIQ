import React, { useState, useEffect } from 'react';
import { 
  Database, ChevronLeft, ChevronRight, ArrowUpDown, 
  Search, RefreshCw, AlertCircle, HardDrive
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DataExplorerPage({ initialDatasetId }) {
  const { activeWorkspace } = useAuth();
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(initialDatasetId || '');
  const [tableData, setTableData] = useState(null);
  const [columns, setColumns] = useState([]);
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [sortColumn, setSortColumn] = useState('_id');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch datasets
  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const res = await api.get('/datasets');
        if (res.data.success) {
          setDatasets(res.data.datasets);
          if (!selectedDatasetId) {
            const stored = res.data.datasets.find(d => d.status === 'stored');
            if (stored) setSelectedDatasetId(stored._id);
            else if (res.data.datasets.length > 0) setSelectedDatasetId(res.data.datasets[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to load datasets:', err);
      }
    };
    if (activeWorkspace) fetchDatasets();
  }, [activeWorkspace]);

  // Fetch PostgreSQL rows
  const fetchTableRows = async (dsId, curLimit, curOffset, sortCol, sortOrd) => {
    if (!dsId) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get(
        `/datasets/${dsId}/data?limit=${curLimit}&offset=${curOffset}&sortColumn=${sortCol}&sortOrder=${sortOrd}`
      );
      if (res.data.success) {
        setTableData(res.data);
        setColumns(res.data.columns || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch records from analytics warehouse');
      setTableData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDatasetId) {
      fetchTableRows(selectedDatasetId, limit, offset, sortColumn, sortOrder);
    }
  }, [selectedDatasetId, limit, offset, sortColumn, sortOrder]);

  const handleSort = (colCleanName) => {
    if (sortColumn === colCleanName) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortColumn(colCleanName);
      setSortOrder('ASC');
    }
    setOffset(0);
  };

  const totalRows = tableData?.total || 0;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalRows / limit) || 1;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Data Explorer</h1>
          <p className="text-xs text-slate-400 mt-1">
            High-performance tabular exploration and real-time query inspection for workspace records
          </p>
        </div>

        {/* Dataset Selector */}
        {datasets.length > 0 && (
          <div className="flex items-center space-x-2">
            <label className="text-xs font-medium text-slate-400">Dataset:</label>
            <select
              value={selectedDatasetId}
              onChange={(e) => {
                setSelectedDatasetId(e.target.value);
                setOffset(0);
              }}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-medium"
            >
              {datasets.map((ds) => (
                <option key={ds._id} value={ds._id}>
                  {ds.name} {ds.status === 'stored' ? '(Active)' : '(Pending Sync)'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-amber-950/30 border border-amber-900/50 rounded-2xl flex items-center space-x-3 text-amber-300 text-xs">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Warehouse Synchronization Required</p>
            <p className="text-amber-400/80 mt-0.5">{error}. Please synchronize this dataset to the analytics warehouse from the Datasets tab.</p>
          </div>
        </div>
      )}

      {/* Grid Table Container */}
      {tableData && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Table Toolbar */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-white">{tableData.datasetName}</span>
              <span className="px-2 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-md text-[10px] font-bold">
                {totalRows.toLocaleString()} Rows
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-400">Per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(parseInt(e.target.value, 10));
                    setOffset(0);
                  }}
                  className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Pagination buttons */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="p-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 rounded-lg text-slate-300 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-slate-400">
                  Page <strong className="text-white">{currentPage}</strong> of {totalPages}
                </span>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= totalRows}
                  className="p-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-30 border border-slate-800 rounded-lg text-slate-300 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Table Data */}
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800 z-10">
                <tr>
                  <th 
                    onClick={() => handleSort('_id')}
                    className="px-4 py-3 font-semibold cursor-pointer hover:text-white"
                  >
                    <div className="flex items-center space-x-1">
                      <span>#</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  {columns.map((col) => (
                    <th 
                      key={col.cleanName}
                      onClick={() => handleSort(col.cleanName)}
                      className="px-4 py-3 font-semibold cursor-pointer hover:text-white"
                    >
                      <div className="flex items-center space-x-1">
                        <span>{col.originalName}</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-600" />
                      </div>
                      <span className="text-[9px] text-brand-400/80 font-mono lowercase">
                        {col.semanticRole !== 'none' ? col.semanticRole : col.dataType}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono text-[11px]">
                {tableData.rows.map((row, rIdx) => (
                  <tr key={row._id || rIdx} className="hover:bg-slate-850/40 transition">
                    <td className="px-4 py-2.5 text-slate-500 font-medium">{row._id}</td>
                    {columns.map((col) => {
                      const val = row[col.cleanName];
                      let displayVal = val;
                      if (val === null || val === undefined) displayVal = '—';
                      else if (col.dataType === 'date' && val) displayVal = new Date(val).toISOString().split('T')[0];
                      else if (col.dataType === 'numeric' && typeof val === 'number') displayVal = val.toLocaleString();

                      return (
                        <td key={col.cleanName} className="px-4 py-2.5 max-w-xs truncate">
                          {String(displayVal)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
