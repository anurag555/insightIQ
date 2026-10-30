import React, { useState } from 'react';
import { 
  Building2, 
  ChevronDown, 
  Plus, 
  LogOut, 
  User, 
  Sparkles, 
  Cpu, 
  Database,
  BarChart3,
  Layers,
  Bot,
  FileText,
  FileSpreadsheet,
  Link2,
  FileCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import WorkspaceModal from './WorkspaceModal';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, workspaces, activeWorkspace, setActiveWorkspace, logout } = useAuth();
  const [isWsDropdownOpen, setIsWsDropdownOpen] = useState(false);
  const [isWsModalOpen, setIsWsModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Executive Overview', icon: BarChart3 },
    { id: 'datasets', label: 'Datasets & Sources', icon: FileSpreadsheet },
    { id: 'mapping', label: 'Quality & Schema', icon: Layers },
    { id: 'explorer', label: 'Data Explorer', icon: Database },
    { id: 'analyst', label: 'AI Analyst', icon: Bot },
    { id: 'rag', label: 'Company Knowledge', icon: FileText },
    { id: 'relationships', label: 'Data Modeling', icon: Link2 },
    { id: 'reports', label: 'Executive Reports', icon: FileCheck },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Brand Logo & Workspace Selector */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-brand-500/25">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-lg tracking-tight text-white">Insight<span className="text-brand-400">IQ</span></span>
                    <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded">Enterprise</span>
                  </div>
                </div>
              </div>

              {/* Workspace Switcher */}
              <div className="relative">
                <button
                  onClick={() => setIsWsDropdownOpen(!isWsDropdownOpen)}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-sm transition"
                >
                  <Building2 className="w-4 h-4 text-brand-400" />
                  <span className="font-medium text-slate-200 max-w-[140px] truncate">
                    {activeWorkspace?.name || 'Select Workspace'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {isWsDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 animate-fade-in">
                    <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Workspaces
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {workspaces.map((ws) => (
                        <button
                          key={ws._id}
                          onClick={() => {
                            setActiveWorkspace(ws);
                            setIsWsDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2 text-sm flex items-center justify-between hover:bg-slate-800/80 transition ${
                            activeWorkspace?._id === ws._id ? 'text-brand-400 font-semibold bg-brand-500/5' : 'text-slate-300'
                          }`}
                        >
                          <span className="truncate">{ws.name}</span>
                          {activeWorkspace?._id === ws._id && (
                            <span className="w-2 h-2 rounded-full bg-brand-400"></span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-slate-800 mt-1 pt-1">
                      <button
                        onClick={() => {
                          setIsWsDropdownOpen(false);
                          setIsWsModalOpen(true);
                        }}
                        className="w-full text-left px-3.5 py-2 text-xs font-medium text-brand-400 hover:bg-slate-800 flex items-center space-x-2 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create New Workspace</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Engine Status & User Profile */}
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2 px-3 py-1 bg-slate-950/80 border border-slate-800 rounded-full text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-400 font-medium">Warehouse:</span>
                <span className="text-emerald-400 font-medium">Live Sync Active</span>
              </div>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2.5 p-1.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition"
                >
                  <div className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-xs">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="text-xs font-medium text-slate-200 hidden sm:inline-block max-w-[100px] truncate">
                    {user?.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50">
                    <div className="px-3.5 py-2 border-b border-slate-800">
                      <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-red-400 hover:bg-red-950/30 flex items-center space-x-2 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="border-t border-slate-800/80 bg-slate-900/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-1 overflow-x-auto py-1.5 no-scrollbar">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-medium rounded-xl whitespace-nowrap transition ${
                      isActive
                        ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <WorkspaceModal
        isOpen={isWsModalOpen}
        onClose={() => setIsWsModalOpen(false)}
      />
    </>
  );
}
