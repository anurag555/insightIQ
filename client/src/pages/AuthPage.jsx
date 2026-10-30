import React, { useState } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Database, Bot, BarChart2, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setName('Demo Executive');
    setEmail('executive@insightiq.internal');
    setPassword('DemoPass2026!');
    setError('');
    setIsLoading(true);

    try {
      // Try login first, or register if not existing
      try {
        await login('executive@insightiq.internal', 'DemoPass2026!');
      } catch {
        await register('Demo Executive', 'executive@insightiq.internal', 'DemoPass2026!');
      }
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative gradient glow circles */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-cyan-400 shadow-xl shadow-brand-500/25 mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white">
          Insight<span className="text-brand-400">IQ</span>
        </h2>
        <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
          The unified decision intelligence platform for modern enterprises. Turn data and documents into executive answers in seconds.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl py-8 px-6 sm:px-10 border border-slate-800 rounded-2xl shadow-2xl">
          
          {/* Tabs */}
          <div className="flex border-b border-slate-800 mb-6">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition ${
                isLogin ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition ${
                !isLogin ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3.5 bg-red-950/40 border border-red-900/60 rounded-xl text-red-400 text-xs leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@company.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-sm"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition shadow-lg shadow-brand-500/25 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>{isLogin ? 'Sign In to Workspace' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access Button */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleQuickDemoLogin}
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-slate-800/90 hover:bg-slate-750 text-slate-100 hover:text-white border border-slate-700/80 font-medium rounded-xl text-xs flex items-center justify-center space-x-2 transition shadow-sm"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Explore Live Product Sandbox (Instant Access)</span>
            </button>
          </div>
        </div>

        {/* Feature badges */}
        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-slate-900/50 border border-slate-800/80 rounded-xl">
            <Database className="w-5 h-5 text-brand-400 mx-auto mb-1" />
            <p className="text-[11px] font-medium text-slate-300">Tenant Vault</p>
            <p className="text-[9px] text-slate-500">Dedicated Isolation</p>
          </div>
          <div className="p-3 bg-slate-900/50 border border-slate-800/80 rounded-xl">
            <BarChart2 className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
            <p className="text-[11px] font-medium text-slate-300">Live Analytics</p>
            <p className="text-[9px] text-slate-500">Sub-Second Execution</p>
          </div>
          <div className="p-3 bg-slate-900/50 border border-slate-800/80 rounded-xl">
            <Bot className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
            <p className="text-[11px] font-medium text-slate-300">Governed AI</p>
            <p className="text-[9px] text-slate-500">Audited Citations</p>
          </div>
        </div>
      </div>
    </div>
  );
}
