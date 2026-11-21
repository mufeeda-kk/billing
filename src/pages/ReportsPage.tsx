import React, { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { formatCurrency } from '../lib/date';
import { 
  BarChart3, 
  TrendingUp, 
  Receipt, 
  ShoppingBag, 
  DollarSign, 
  CreditCard, 
  Tag, 
  Wallet,
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
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
  }, [dateRange]);

  return (
    <div className="pb-24 pt-2 max-w-7xl mx-auto px-3 sm:px-4">
      {/* Header */}
      <div className="sticky top-14 z-30 bg-slate-100/95 backdrop-blur-xs py-2 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-black text-base sm:text-lg tracking-wide text-slate-900">
              SALES & PROFIT REPORTS
            </h1>
            <p className="text-xs text-slate-500">Live shop metrics from real database records</p>
          </div>
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
          
          {/* 1. Primary Highlight Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Total Sales */}
            <div className="bg-slate-900 text-white rounded-2xl p-3.5 shadow-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Total Revenue</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-2">
                <div className="font-mono font-black text-lg sm:text-xl text-amber-400">
                  {formatCurrency(report.totalSales)}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Across {report.totalBills} {report.totalBills === 1 ? 'bill' : 'bills'}
                </div>
              </div>
            </div>

            {/* Net Estimated Profit */}
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
                  Gross ₹{report.grossProfit} - Exp ₹{report.totalExpenses}
                </div>
              </div>
            </div>

            {/* Total Pieces Sold */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Items Sold</span>
                <ShoppingBag className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2">
                <div className="font-mono font-black text-lg sm:text-xl text-slate-900">
                  {report.itemsSoldCount} pcs
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Clothing pieces
                </div>
              </div>
            </div>

            {/* Total Shop Expenses */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Total Expenses</span>
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
          </div>

          {/* 2. Payment Method Breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Payment Breakdown
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

          {/* 3. Top Selling Products */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
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

          {/* 4. Popular Clothing Sizes */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
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
