import React, { useState, useEffect } from 'react';
import { ActivityLog } from '../types';
import { db } from '../lib/db';
import { formatDateTimeIST } from '../lib/date';
import { Activity, ShieldCheck, UserCheck, RefreshCw } from 'lucide-react';

export const ActivityLogPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await db.getActivityLogs(100);
      setLogs(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="pb-24 pt-2 max-w-7xl mx-auto px-3 sm:px-4">
      <div className="sticky top-14 z-30 bg-slate-100/95 backdrop-blur-xs py-2 flex items-center justify-between">
        <div>
          <h1 className="font-black text-base sm:text-lg tracking-wide text-slate-900">
            STAFF ACTIVITY LOG
          </h1>
          <p className="text-xs text-slate-500">Shop audit trail across all 3 staff</p>
        </div>
        <button
          onClick={loadLogs}
          className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 shadow-2xs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-slate-200 rounded-xl animate-pulse" />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Activity className="w-10 h-10 mx-auto text-slate-400 mb-2 stroke-[1.5]" />
            <p className="font-bold text-sm">No activity recorded yet</p>
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                  log.action_type === 'BILL_CREATED' ? 'bg-emerald-100 text-emerald-800' :
                  log.action_type === 'EXCHANGE_PROCESSED' ? 'bg-blue-100 text-blue-800' :
                  log.action_type === 'STOCK_ADJUSTED' ? 'bg-amber-100 text-amber-800' :
                  'bg-slate-100 text-slate-800'
                }`}>
                  {log.action_type}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {formatDateTimeIST(log.created_at)}
                </span>
              </div>
              <p className="font-semibold text-slate-800">{log.description}</p>
              <div className="text-[11px] text-slate-500">
                Staff: <span className="font-bold text-slate-700">{log.staff_name}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
