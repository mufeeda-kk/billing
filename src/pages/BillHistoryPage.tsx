import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sale } from '../types';
import { db } from '../lib/db';
import { useStore } from '../context/StoreContext';
import { checkExchangeEligibility, formatCurrency, formatDateTimeIST } from '../lib/date';
import { BillDetailsModal } from '../components/history/BillDetailsModal';
import { PrintReceiptContainer } from '../components/billing/PrintReceiptContainer';
import { 
  Search, 
  Receipt, 
  RotateCcw, 
  Calendar, 
  Filter, 
  Phone, 
  User, 
  Layers,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

export const BillHistoryPage: React.FC = () => {
  const { isSupabaseLive } = useStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month'>('today');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const loadSales = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await db.getSales({
        dateRange: dateFilter === 'all' ? undefined : dateFilter,
        search: searchQuery,
        status: statusFilter,
        paymentMethod: paymentFilter
      });
      setSales(data);
    } catch (e) {
      console.error('Error loading sales history:', e);
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter, searchQuery, statusFilter, paymentFilter]);

  useEffect(() => {
    loadSales();

    // Auto-update when new bills or exchanges happen
    const handleUpdate = () => {
      loadSales();
    };
    window.addEventListener('vcs_store_update', handleUpdate);
    return () => window.removeEventListener('vcs_store_update', handleUpdate);
  }, [loadSales]);

  // Quick summary stats for current view (excluding cancelled bills)
  const summary = useMemo(() => {
    const activeBills = sales.filter(s => s.status !== 'cancelled');
    const totalAmount = activeBills.reduce((sum, s) => sum + s.grand_total, 0);
    const totalBills = activeBills.length;
    return { totalAmount, totalBills };
  }, [sales]);

  return (
    <div className="pb-24 pt-2 max-w-7xl mx-auto px-3 sm:px-4">
      
      {/* 1. Header & Live Filter Bar */}
      <div className="sticky top-14 z-30 bg-slate-100/95 backdrop-blur-xs py-2 space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Bill #, Customer Name, Phone, or Product..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full w-5 h-5 flex items-center justify-center font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Date Filters: Today, Yesterday, This Week, This Month, All */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
            { id: 'all', label: 'All Bills' }
          ].map(d => {
            const isSel = dateFilter === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDateFilter(d.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all select-none ${
                  isSel
                    ? 'bg-slate-900 text-amber-400 shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        {/* Payment & Status Quick Toggles */}
        <div className="flex items-center space-x-2 text-[11px] overflow-x-auto no-scrollbar">
          <select
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700"
          >
            <option value="all">All Payments</option>
            <option value="cash">Cash Only</option>
            <option value="upi">UPI Only</option>
            <option value="card">Card Only</option>
            <option value="split">Split/Credit</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="exchanged">Exchanged</option>
            <option value="partially_exchanged">Partially Exchanged</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Quick Summary Strip */}
          <div className="ml-auto font-mono text-[11px] text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-md whitespace-nowrap font-bold">
            {summary.totalBills} Bills • {formatCurrency(summary.totalAmount)}
          </div>
        </div>
      </div>

      {/* 2. Bill Cards List */}
      <div className="mt-2 space-y-2.5">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Receipt className="w-10 h-10 mx-auto text-slate-400 mb-2 stroke-[1.5]" />
            <p className="font-bold text-sm">
              {!isSupabaseLive ? 'Cloud Database Not Connected' : 'No bills found'}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              {!isSupabaseLive
                ? 'Configure Supabase in Settings so all 3 phones share sales & receipts live.'
                : 'Try changing the date filter or create a new bill in Billing.'}
            </p>
          </div>
        ) : (
          sales.map(sale => {
            const isCancelled = sale.status === 'cancelled';
            const eligibility = checkExchangeEligibility(sale.created_at, isCancelled);
            const totalItems = sale.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;

            return (
              <div
                key={sale.id}
                onClick={() => setSelectedSale(sale)}
                className={`bg-white border rounded-xl p-3.5 cursor-pointer shadow-xs active:scale-[0.99] transition flex flex-col space-y-2 ${
                  isCancelled 
                    ? 'border-rose-200 bg-rose-50/30 hover:border-rose-300' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Top: Bill #, Status Badge, Time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-extrabold text-xs text-slate-900">
                      {sale.bill_number}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                      isCancelled ? 'bg-rose-600 text-white font-black' :
                      sale.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                      sale.status === 'exchanged' ? 'bg-blue-100 text-blue-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {sale.status.replace('_', ' ')}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatDateTimeIST(sale.created_at)}
                  </span>
                </div>

                {/* Middle: Customer & Items Preview */}
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <div className="truncate pr-2">
                    {sale.customer_name ? (
                      <span className="font-semibold text-slate-800">{sale.customer_name}</span>
                    ) : (
                      <span className="text-slate-400 italic">Walk-in Customer</span>
                    )}
                    {sale.customer_phone && (
                      <span className="text-slate-400 font-mono ml-1.5">({sale.customer_phone})</span>
                    )}
                  </div>
                  <div className="text-slate-500 font-medium whitespace-nowrap">
                    {totalItems} {totalItems === 1 ? 'pc' : 'pcs'}
                  </div>
                </div>

                {/* If Cancelled: Show cancellation reason */}
                {isCancelled && sale.cancellation_reason && (
                  <div className="text-[11px] text-rose-700 bg-rose-100/60 p-1.5 rounded-lg italic">
                    Reason: "{sale.cancellation_reason}"
                  </div>
                )}

                {/* Bottom: 7-Day Exchange eligibility badge & Grand Total */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    {isCancelled ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                        Cancelled (Stock Restored)
                      </span>
                    ) : eligibility.isEligible ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${eligibility.badgeColor}`}>
                        Exchange: {eligibility.daysRemaining}d left
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        Exchange Expired
                      </span>
                    )}
                    <span className="text-[10px] font-medium text-slate-400 ml-1">
                      via {sale.payment_method.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <span className={`font-black text-sm font-mono ${
                      isCancelled ? 'line-through text-slate-400' : 'text-slate-900'
                    }`}>
                      {formatCurrency(sale.grand_total)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bill Details Modal */}
      {selectedSale && (
        <BillDetailsModal
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onRefreshHistory={loadSales}
        />
      )}

      {/* Hidden Thermal Receipt Print Container */}
      <PrintReceiptContainer sale={selectedSale} />
    </div>
  );
};
