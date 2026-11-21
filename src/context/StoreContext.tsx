import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product, Sale } from '../types';
import { db } from '../lib/db';
import { isSupabaseConfigured, getSupabase } from '../lib/supabase';

interface StoreContextType {
  products: Product[];
  isLoadingProducts: boolean;
  refreshProducts: () => Promise<void>;
  lowStockCount: number;
  recentSalesCount: number;
  isOnline: boolean;
  isSupabaseLive: boolean;
  notificationMessage: string | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [recentSalesCount, setRecentSalesCount] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSupabaseLive, setIsSupabaseLive] = useState(isSupabaseConfigured());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  const refreshProducts = useCallback(async () => {
    try {
      const list = await db.getProducts();
      setProducts(list);
      // Count variants where stock is <= threshold
      let lowCount = 0;
      list.forEach(p => {
        p.variants?.forEach(v => {
          if (v.stock_quantity <= (v.low_stock_threshold || 2)) {
            lowCount++;
          }
        });
      });
      setLowStockCount(lowCount);
    } catch (e) {
      console.error('Error fetching products:', e);
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    refreshProducts();

    // Listen to online / offline network state
    const handleOnline = () => { setIsOnline(true); showToast('Back online', 'success'); };
    const handleOffline = () => { setIsOnline(false); showToast('Operating in offline mode', 'info'); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Realtime listener for cross-tab and cross-device sync
    const handleCustomUpdate = (e: any) => {
      const detail = e.detail;
      if (detail?.type === 'BILL_CREATED') {
        refreshProducts();
        setRecentSalesCount(prev => prev + 1);
        showToast(`New Bill Created: #${detail.data?.bill_number}`, 'success');
      } else if (detail?.type === 'STOCK_UPDATE' || detail?.type === 'PRODUCT_UPDATE' || detail?.type === 'EXCHANGE_PROCESSED') {
        refreshProducts();
      }
    };
    window.addEventListener('vcs_store_update', handleCustomUpdate);

    // Setup Supabase Realtime Channel if configured
    let supabaseChannel: any = null;
    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      try {
        supabaseChannel = supabase
          .channel('schema-db-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'sales' },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                showToast(`Live: New bill created #${payload.new.bill_number}`, 'success');
              }
              refreshProducts();
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'product_variants' },
            () => {
              refreshProducts();
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setIsSupabaseLive(true);
            }
          });
      } catch (err) {
        console.warn('Realtime subscription error:', err);
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('vcs_store_update', handleCustomUpdate);
      if (supabaseChannel) {
        supabase?.removeChannel(supabaseChannel);
      }
    };
  }, [refreshProducts, showToast]);

  return (
    <StoreContext.Provider value={{
      products,
      isLoadingProducts,
      refreshProducts,
      lowStockCount,
      recentSalesCount,
      isOnline,
      isSupabaseLive,
      notificationMessage: toast?.message || null,
      showToast
    }}>
      {children}

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-sm w-11/12 animate-fade-in shadow-xl">
          <div className={`px-4 py-2.5 rounded-lg flex items-center justify-between text-sm font-medium ${
            toast.type === 'success' ? 'bg-emerald-800 text-white' :
            toast.type === 'error' ? 'bg-rose-800 text-white' : 'bg-slate-800 text-white'
          }`}>
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-white/80 hover:text-white">✕</button>
          </div>
        </div>
      )}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
};
