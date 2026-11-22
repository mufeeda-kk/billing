import React, { useState } from 'react';
import { SHOP_INFO } from '../types';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { 
  getStoredSupabaseConfig, 
  saveStoredSupabaseConfig, 
  testSupabaseConnection 
} from '../lib/supabase';
import { 
  Settings as SettingsIcon, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Copy, 
  Check, 
  PhoneCall, 
  Store,
  Wifi,
  Sparkles,
  Smartphone,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { isSupabaseLive, showToast } = useStore();
  const { isDeviceAuthorized, deviceSlot, deviceName, refreshDeviceStatus } = useAuth();
  const currentConfig = getStoredSupabaseConfig();

  const [supabaseUrl, setSupabaseUrl] = useState(currentConfig.url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(currentConfig.anonKey);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleTestConnection = async () => {
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
    saveStoredSupabaseConfig(supabaseUrl, supabaseAnonKey);
    showToast('Supabase configuration saved! Reloading...', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  const handleCopySqlInstructions = () => {
    const sqlPath = 'supabase/migrations/20261122_master_cloud_billing_schema.sql';
    navigator.clipboard.writeText(`-- Run schema file located in: ${sqlPath}`);
    setCopiedSql(true);
    showToast('SQL migration file path copied to clipboard', 'info');
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="pb-24 pt-2 max-w-7xl mx-auto px-3 sm:px-4 space-y-4">
      {/* Header */}
      <div className="sticky top-14 z-30 bg-slate-100/95 backdrop-blur-xs py-2">
        <h1 className="font-black text-base sm:text-lg tracking-wide text-slate-900">
          SHOP & SYSTEM SETTINGS
        </h1>
        <p className="text-xs text-slate-500">Configure Cloud Supabase, 3-Phone Sync & Shop Info</p>
      </div>

      {/* 0. Authorized Device Status Card */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Smartphone className="w-4 h-4 text-amber-500" />
            <span>Store Device Authorization</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isDeviceAuthorized ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {isDeviceAuthorized ? '🟢 Authorized Phone' : '⚠️ Unenrolled Phone'}
          </span>
        </div>

        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
          <div>
            <div className="font-bold text-slate-900 flex items-center space-x-1.5">
              <span>{deviceName}</span>
              {deviceSlot && (
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                  Slot #{deviceSlot}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {isDeviceAuthorized 
                ? 'Persistent session active. Bypasses all logins directly into Billing.'
                : 'This phone is not enrolled into the 3-device limit yet.'}
            </div>
          </div>
          <button
            type="button"
            onClick={refreshDeviceStatus}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition"
            title="Recheck Device Status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 1. Shop Information Card */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
          <Store className="w-4 h-4 text-amber-500" />
          <span>Shop Identity & Receipt Header</span>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Shop Name:</span>
            <span className="font-bold text-slate-900">{SHOP_INFO.shop_name}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Primary Phone:</span>
            <span className="font-mono font-bold text-slate-900">{SHOP_INFO.phones[0]}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Secondary Phone:</span>
            <span className="font-mono font-bold text-slate-900">{SHOP_INFO.phones[1]}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500">Timezone:</span>
            <span className="font-mono font-bold text-slate-900">Asia/Kolkata (IST)</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-slate-500">Exchange Window:</span>
            <span className="font-bold text-emerald-700">Strictly 7 Days from Bill Date</span>
          </div>
        </div>
      </div>

      {/* 2. Supabase Cloud Database Configuration */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Database className="w-4 h-4 text-emerald-600" />
            <span>Supabase Cloud Integration (3 Users)</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isSupabaseLive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {isSupabaseLive ? 'Active Cloud Live' : 'Shared Realtime Mode'}
          </span>
        </div>

        <p className="text-xs text-slate-500">
          Enter your Supabase project credentials to synchronize all 3 staff members live across multiple mobile phones.
        </p>

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
            <label className="font-bold text-slate-700 block mb-1">VITE_SUPABASE_URL</label>
            <input
              type="text"
              placeholder="https://xyzcompany.supabase.co"
              value={supabaseUrl}
              onChange={e => setSupabaseUrl(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">VITE_SUPABASE_ANON_KEY</label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseAnonKey}
              onChange={e => setSupabaseAnonKey(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex space-x-2 pt-1">
            <button
              type="button"
              disabled={testing || !supabaseUrl || !supabaseAnonKey}
              onClick={handleTestConnection}
              className="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              type="button"
              disabled={!supabaseUrl || !supabaseAnonKey}
              onClick={handleSaveConfig}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs"
            >
              Save & Apply
            </button>
          </div>
        </div>
      </div>

      {/* 3. Database Migration Script Box */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xs space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-amber-400">Database Migration (PostgreSQL SQL)</span>
          <button
            onClick={handleCopySqlInstructions}
            className="flex items-center space-x-1 text-slate-300 hover:text-white bg-slate-800 px-2 py-1 rounded text-[11px]"
          >
            {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSql ? 'Copied' : 'Copy SQL Path'}</span>
          </button>
        </div>
        <p className="text-slate-400 leading-relaxed text-[11px]">
          The complete SQL schema with Row Level Security, Realtime publications, and stored procedures for atomic checkout and 7-day exchanges is saved at:
        </p>
        <div className="p-2 bg-slate-950 rounded-lg font-mono text-[11px] text-amber-300 break-all select-all">
          supabase/migrations/20261121_initial_schema.sql
        </div>
      </div>
    </div>
  );
};
