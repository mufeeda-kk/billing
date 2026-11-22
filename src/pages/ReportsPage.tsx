import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../lib/date';
import { 
  TrendingUp, 
  ShoppingBag, 
  Wallet, 
  ArrowUpRight, 
  AlertTriangle, 
  Layers, 
  Receipt,
  Scale,
  RefreshCw
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { products } = useStore();
  const [dateRange, setDateRange] = useState<string>('today');
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReport = async (range: string) => {
    setIsLoading(true);
    try {
      const data = await db.getSalesReportSummary(range);
      setReport(data);
    } catch (e) {
      console.error('Error fetching report:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(dateRange);

    const handleUpdate = () => {
      fetchReport(dateRange);
    };

    window.addEventListener('vcs_store_update', handleUpdate);
    return () => window.removeEventListener('vcs_store_update', handleUpdate);
  }, [dateRange]);

  // Filter low-stock products from live store
  const lowStockItems = products.filter(p => {
    const total = p.total_stock ?? 0;
    const thresh = p.variants?.[0]?.low_stock_threshold || 5;
    return total <= thresh;
  });

  return (
    <div className="pb-24 pt-2 max-w-7xl mx-auto px-3 sm:px-4">
      {/* Header */}
      <div className="sticky top-14 z-30 bg-slate-100/95 backdrop-blur-xs py-2 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-black text-base sm:text-lg tracking-wide text-slate-900">
              PROFIT & LOSS REPORTS
            </h1>
            <p className="text-xs text-slate-500">Live multi-device business analytics & inventory health</p>
          </div>
          <button
            onClick={() => fetchReport(dateRange)}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-xl bg-white border border-slate-200 shadow-2xs"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Date Filters: Today, Yesterday, Week, Month */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' }
          ].map(d => (
            <button
              key={d.id}
              onClick={() => setDateRange(d.id)}
              className={`py-2 text-center text-xs font-bold rounded-xl transition ${
                dateRange === d.id ? 'bg-slate-900 text-amber-400 shadow-sm' : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !report ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          
          {/* 1. Core Financial Performance Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Total Sales (Revenue) */}
            <div className="bg-slate-900 text-white rounded-2xl p-3.5 shadow-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Net Sales Revenue</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2">
                <div className="font-mono font-black text-lg sm:text-xl text-amber-400">
                  {formatCurrency(report.totalSales)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Across {report.totalBills} completed {report.totalBills === 1 ? 'bill' : 'bills'}
                </div>
              </div>
            </div>

            {/* Cost of Goods Sold (COGS) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Cost of Goods Sold (COGS)</span>
                <Scale className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2">
                <div className="font-mono font-black text-lg sm:text-xl text-slate-900">
                  {formatCurrency(report.cogs || 0)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Historical purchase cost
                </div>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="bg-blue-950/80 border border-blue-700 text-white rounded-2xl p-3.5 shadow-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-blue-300 text-xs font-semibold">
                <span>Gross Profit</span>
                <ArrowUpRight className="w-4 h-4 text-blue-400" />
              </div>
              <div className="mt-2">
                <div className="font-mono font-black text-lg sm:text-xl text-blue-300">
                  {formatCurrency(report.grossProfit)}
                </div>
                <div className="text-[10px] text-blue-200/80 mt-0.5">
                  Revenue − COGS
                </div>
              </div>
            </div>

            {/* Net Shop Profit */}
            <div className="bg-emerald-950/80 border border-emerald-700 text-white rounded-2xl p-3.5 shadow-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold">
                <span>Net Shop Profit</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2">
                <div className="font-mono font-black text-lg sm:text-xl text-emerald-300">
                  {formatCurrency(report.netProfit)}
                </div>
                <div className="text-[10px] text-emerald-200/80 mt-0.5">
                  Gross ₹{report.grossProfit} − Exp ₹{report.totalExpenses}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Secondary Metrics: Items Sold & Total Expenses */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Items Sold</span>
                <ShoppingBag className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2">
                <div className="font-mono font-black text-lg sm:text-xl text-slate-900">
                  {report.itemsSoldCount} pcs
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Clothing garments
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Recorded Expenses</span>
                <Wallet className="w-4 h-4 text-rose-500" />
              </div>
              <div className="mt-2">
                <div className="font-mono font-black text-lg sm:text-xl text-rose-600">
                  {formatCurrency(report.totalExpenses)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Tea, rent, utilities
                </div>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Avg. Bill Value</span>
                <Receipt className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2">
                <div className="font-mono font-black text-lg sm:text-xl text-slate-900">
                  {formatCurrency(report.totalBills > 0 ? Math.round(report.totalSales / report.totalBills) : 0)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Per customer transaction
                </div>
              </div>
            </div>
          </div>

          {/* 3. Payment Method Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Payment Method Breakdown
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                <div className="text-[11px] font-bold text-emerald-800">CASH</div>
                <div className="text-sm font-black font-mono text-emerald-900 mt-1">
                  {formatCurrency(report.cashSales)}
                </div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-center">
                <div className="text-[11px] font-bold text-blue-800">UPI / GPAY</div>
                <div className="text-sm font-black font-mono text-blue-900 mt-1">
                  {formatCurrency(report.upiSales)}
                </div>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-center">
                <div className="text-[11px] font-bold text-purple-800">CARD</div>
                <div className="text-sm font-black font-mono text-purple-900 mt-1">
                  {formatCurrency(report.cardSales)}
                </div>
              </div>
            </div>
            {report.balanceDue > 0 && (
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center text-xs">
                <span className="font-bold text-amber-800">Outstanding Balance Due:</span>
                <span className="font-mono font-black text-amber-900">{formatCurrency(report.balanceDue)}</span>
              </div>
            )}
          </div>

          {/* 4. Top Selling Products */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Top Selling Garments
            </h3>
            {report.topSellingProducts.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No sales recorded in this period</p>
            ) : (
              <div className="divide-y border border-slate-100 rounded-xl bg-slate-50">
                {report.topSellingProducts.map((p: any, idx: number) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{idx + 1}. {p.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {p.qty} units sold
                      </div>
                    </div>
                    <div className="font-bold font-mono text-slate-900">
                      {formatCurrency(p.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Low-Stock Products Alert */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Low-Stock Inventory Alert ({lowStockItems.length})
                </h3>
              </div>
            </div>
            {lowStockItems.length === 0 ? (
              <p className="text-xs text-emerald-600 font-semibold">All products have sufficient stock.</p>
            ) : (
              <div className="divide-y border border-slate-100 rounded-xl bg-slate-50 max-h-60 overflow-y-auto">
                {lowStockItems.map((prod) => (
                  <div key={prod.id} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{prod.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        SKU: {prod.sku} | Category: {prod.category_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        (prod.total_stock ?? 0) === 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {(prod.total_stock ?? 0) === 0 ? 'Out of Stock' : `${prod.total_stock} in stock`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6. Popular Clothing Sizes */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Size-Wise Demand
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(report.sizeBreakdown || {}).map(([size, count]: any) => (
                <div key={size} className="px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold flex items-center space-x-1.5">
                  <span className="text-slate-900">{size}:</span>
                  <span className="text-amber-600 font-mono font-black">{count} pcs</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
