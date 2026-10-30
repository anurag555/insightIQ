import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import DatasetsPage from './pages/DatasetsPage';
import SchemaMappingPage from './pages/SchemaMappingPage';
import DataExplorerPage from './pages/DataExplorerPage';
import AIAnalystPage from './pages/AIAnalystPage';
import DocumentRAGPage from './pages/DocumentRAGPage';
import RelationshipsPage from './pages/RelationshipsPage';
import ReportsPage from './pages/ReportsPage';
import { Loader2 } from 'lucide-react';

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [targetDatasetId, setTargetDatasetId] = useState(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Loading InsightIQ Intelligence Workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  const navigateToMapping = (datasetId) => {
    setTargetDatasetId(datasetId);
    setActiveTab('mapping');
  };

  const navigateToExplorer = (datasetId) => {
    setTargetDatasetId(datasetId);
    setActiveTab('explorer');
  };

  return (
    <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col font-sans">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardPage onNavigateToDatasets={() => setActiveTab('datasets')} />
        )}
        {activeTab === 'datasets' && (
          <DatasetsPage 
            onSelectDatasetForMapping={navigateToMapping} 
            onSelectDatasetForExplorer={navigateToExplorer} 
          />
        )}
        {activeTab === 'mapping' && (
          <SchemaMappingPage initialDatasetId={targetDatasetId} />
        )}
        {activeTab === 'explorer' && (
          <DataExplorerPage initialDatasetId={targetDatasetId} />
        )}
        {activeTab === 'analyst' && (
          <AIAnalystPage />
        )}
        {activeTab === 'rag' && (
          <DocumentRAGPage />
        )}
        {activeTab === 'relationships' && (
          <RelationshipsPage />
        )}
        {activeTab === 'reports' && (
          <ReportsPage />
        )}
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950/40 py-4 text-center text-xs text-slate-500">
        © 2026 InsightIQ Technologies Inc. Enterprise Decision Intelligence Platform. All rights reserved.
      </footer>
    </div>
  );
}
