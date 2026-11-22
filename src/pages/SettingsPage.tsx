import React, { useState } from 'react';
import { SHOP_INFO } from '../types';
import { useStore } from '../context/StoreContext';
import { 
  getStoredSupabaseConfig, 
  saveStoredSupabaseConfig, 
  testSupabaseConnection,
  isSupabaseConfigured
} from '../lib/supabase';
import { 
  Store, 
  Wifi, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  PhoneCall, 
  Clock, 
  Receipt, 
  Database,
  Smartphone,
  ExternalLink,
  Save,
  RefreshCw
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { isSupabaseLive, connectionStatus, showToast } = useStore();
  const currentConfig = getStoredSupabaseConfig();

  const [supabaseUrl, setSupabaseUrl] = useState(currentConfig.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(currentConfig.anonKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleTestConnection = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setTestResult({ success: false, message: 'Please enter both Supabase URL and Anon Key.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
      setTestResult(res);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      showToast('Please enter both Supabase URL and Anon Key.', 'error');
      return;
    }
    saveStoredSupabaseConfig(supabaseUrl, supabaseAnonKey);
    showToast('Supabase cloud credentials saved! Connecting...', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const handleCopySqlInstructions = () => {
    const sqlPath = 'supabase/migrations/20261122_public_cloud_billing_schema.sql';
    navigator.clipboard.writeText(`-- Run public schema file located in: ${sqlPath}`);
    setCopiedSql(true);
    showToast('SQL migration file path copied to clipboard', 'info');
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const isConnected = isSupabaseConfigured() && isSupabaseLive;

  return (
    <div className="pb-24 pt-2 max-w-7xl mx-auto px-3 sm:px-4 space-y-4">
      {/* Header */}
      <div className="sticky top-14 z-30 bg-slate-100/95 backdrop-blur-xs py-2">
        <h1 className="font-black text-base sm:text-lg tracking-wide text-slate-900">
          SHOP & SYSTEM SETTINGS
        </h1>
        <p className="text-xs text-slate-500">Configure Cloud Supabase, Receipt Policy & Shop Details</p>
      </div>

      {/* 1. Supabase Cloud Database Connection Card */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Database className="w-4 h-4 text-emerald-600" />
            <span>Supabase Cloud Database Connection</span>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
            isConnected
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-rose-100 text-rose-800 animate-pulse'
          }`}>
            {isConnected ? '🟢 Cloud Connected' : '🔴 Disconnected'}
          </span>
        </div>

        {!isConnected && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Database Not Connected</div>
              <p className="text-[11px] text-amber-800 mt-0.5">
                To save products, create bills, and sync all phones in real-time, enter your Supabase Project URL and Public Anon Key below.
              </p>
            </div>
          </div>
        )}

        {testResult && (
          <div className={`p-2.5 rounded-xl text-xs flex items-center space-x-2 ${
            testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
            <span>{testResult.message}</span>
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Supabase Project URL <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="https://your-project-id.supabase.co"
              value={supabaseUrl}
              onChange={e => setSupabaseUrl(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-500 text-slate-900"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Supabase Anon / Publishable Key <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseAnonKey}
              onChange={e => setSupabaseAnonKey(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-500 text-slate-900"
            />
          </div>

          <div className="flex space-x-2 pt-1">
            <button
              type="button"
              disabled={testing || !supabaseUrl.trim() || !supabaseAnonKey.trim()}
              onClick={handleTestConnection}
              className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs transition flex items-center justify-center space-x-1.5"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5 text-slate-600" />}
              <span>{testing ? 'Testing...' : 'Test Connection'}</span>
            </button>
            <button
              type="button"
              disabled={!supabaseUrl.trim() || !supabaseAnonKey.trim()}
              onClick={handleSaveConfig}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center space-x-1.5"
            >
              <Save className="w-3.5 h-3.5 text-amber-400" />
              <span>Save & Connect</span>
            </button>
          </div>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
          <div className="font-semibold text-slate-700">Where to find your Supabase credentials:</div>
          <div>1. Open <span className="font-bold text-slate-800">Supabase Dashboard</span> ➔ Click your Project.</div>
          <div>2. Go to <span className="font-bold text-slate-800">Project Settings (gear icon)</span> ➔ <span className="font-bold text-slate-800">API</span>.</div>
          <div>3. Copy <span className="font-mono text-slate-800">Project URL</span> and <span className="font-mono text-slate-800">anon public key</span>.</div>
          <div className="text-amber-700 font-medium pt-1">
            Tip: You can also set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in Vercel Environment Variables to automatically connect every phone without typing them here.
          </div>
        </div>
      </div>

      {/* 2. Shop Information & Receipt Header Card */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
          <Store className="w-4 h-4 text-amber-500" />
          <span>Shop Identity & Receipt Details</span>
        </div>

        <div className="space-y-1.5 text-xs divide-y divide-slate-100">
          <div className="flex justify-between py-1.5">
            <span className="text-slate-500 flex items-center space-x-1.5">
              <Store className="w-3.5 h-3.5 text-slate-400" />
              <span>Shop Name:</span>
            </span>
            <span className="font-bold text-slate-900">{SHOP_INFO.shop_name}</span>
          </div>

          <div className="flex justify-between py-1.5">
            <span className="text-slate-500 flex items-center space-x-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-slate-400" />
              <span>Primary Contact:</span>
            </span>
            <span className="font-mono font-bold text-slate-900">{SHOP_INFO.phones[0]}</span>
          </div>

          <div className="flex justify-between py-1.5">
            <span className="text-slate-500 flex items-center space-x-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-slate-400" />
              <span>Secondary Contact:</span>
            </span>
            <span className="font-mono font-bold text-slate-900">{SHOP_INFO.phones[1]}</span>
          </div>

          <div className="flex justify-between py-1.5">
            <span className="text-slate-500 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Timezone:</span>
            </span>
            <span className="font-mono font-bold text-slate-900">Asia/Kolkata (IST)</span>
          </div>

          <div className="flex justify-between py-1.5">
            <span className="text-slate-500 flex items-center space-x-1.5">
              <Receipt className="w-3.5 h-3.5 text-slate-400" />
              <span>Exchange Policy:</span>
            </span>
            <span className="font-bold text-emerald-700">Strictly 7 Days from Bill Date</span>
          </div>
        </div>
      </div>

      {/* 3. Database Migration Script Box */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-2xs space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-amber-400">Public Cloud Database Schema</span>
          <button
            onClick={handleCopySqlInstructions}
            className="flex items-center space-x-1 text-slate-300 hover:text-white bg-slate-800 px-2 py-1 rounded text-[11px] transition"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSql ? 'Copied' : 'Copy SQL Path'}</span>
          </button>
        </div>
        <p className="text-slate-400 leading-relaxed text-[11px]">
          The public PostgreSQL schema migration with Row Level Security, Realtime broadcast triggers, and atomic checkout procedures is saved at:
        </p>
        <div className="p-2 bg-slate-950 rounded-lg font-mono text-[11px] text-amber-300 break-all select-all">
          supabase/migrations/20261122_public_cloud_billing_schema.sql
        </div>
      </div>
    </div>
  );
};
