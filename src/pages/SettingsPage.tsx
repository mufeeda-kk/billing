import React, { useState } from 'react';
import { SHOP_INFO } from '../types';
import { useStore } from '../context/StoreContext';
import { 
  Store, 
  Wifi, 
  CheckCircle2, 
  Copy, 
  Check, 
  PhoneCall, 
  Clock, 
  Receipt, 
  Database,
  Smartphone
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { isSupabaseLive, connectionStatus, showToast } = useStore();
  const [copiedSql, setCopiedSql] = useState(false);

  const handleCopySqlInstructions = () => {
    const sqlPath = 'supabase/migrations/20261122_public_cloud_billing_schema.sql';
    navigator.clipboard.writeText(`-- Run public schema file located in: ${sqlPath}`);
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
        <p className="text-xs text-slate-500">Shop Identity, Receipt Policy & Public Live Cloud Sync</p>
      </div>

      {/* 1. Cloud Database Connection Status Card */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Database className="w-4 h-4 text-emerald-600" />
            <span>Supabase Cloud Database</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            connectionStatus === 'connected' 
              ? 'bg-emerald-100 text-emerald-800' 
              : connectionStatus === 'syncing' 
              ? 'bg-amber-100 text-amber-800 animate-pulse' 
              : 'bg-slate-100 text-slate-600'
          }`}>
            {connectionStatus === 'connected' ? '🟢 Public Live Sync Active' : '🟡 Connecting...'}
          </span>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1.5">
          <div className="flex items-center space-x-2 text-slate-700 font-medium">
            <Smartphone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Unlimited Multi-Device Access: All phones, tablets, and computers open directly to Billing without login or setup secrets.</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-700 font-medium">
            <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Works across all networks: Mobile data (4G/5G), Shop Wi-Fi, Home Wi-Fi, or any internet connection.</span>
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
