import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { db } from '../lib/db';
import { formatCurrency, formatDateIST } from '../lib/date';
import { Users, Search, Phone, ShoppingBag, ArrowRight } from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true);
      try {
        const data = await db.getCustomers(search);
        setCustomers(data);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCustomers();
  }, [search]);

  return (
    <div className="pb-24 pt-2 max-w-7xl mx-auto px-3 sm:px-4">
      <div className="sticky top-14 z-30 bg-slate-100/95 backdrop-blur-xs py-2 space-y-2">
        <h1 className="font-black text-base sm:text-lg tracking-wide text-slate-900">
          CUSTOMER DIRECTORY
        </h1>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name or 10-digit phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-amber-500 shadow-xs"
          />
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-200 rounded-xl animate-pulse" />)}
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Users className="w-10 h-10 mx-auto text-slate-400 mb-2 stroke-[1.5]" />
            <p className="font-bold text-sm">No customers found</p>
          </div>
        ) : (
          customers.map(c => (
            <div key={c.id} className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-black text-xs">
                  {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900">{c.name || 'Valued Customer'}</div>
                  <div className="text-[11px] text-slate-500 font-mono flex items-center space-x-1 mt-0.5">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{c.phone}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-mono font-black text-xs text-slate-900">
                  {formatCurrency(c.total_purchases)}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  {c.total_bills} {c.total_bills === 1 ? 'bill' : 'bills'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
