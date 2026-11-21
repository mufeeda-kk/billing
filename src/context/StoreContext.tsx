import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Product } from '../types';
import { db } from '../lib/db';
import { isSupabaseConfigured, getSupabase } from '../lib/supabase';

export type ConnectionStatus = 'connected' | 'syncing' | 'offline';

interface StoreContextType {
  products: Product[];
  isLoadingProducts: boolean;
  refreshProducts: () => Promise<void>;
  lowStockCount: number;
  recentSalesCount: number;
  isOnline: boolean;
  isSupabaseLive: boolean;
  connectionStatus: ConnectionStatus;
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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    typeof navigator !== 'undefined' && !navigator.onLine 
      ? 'offline' 
      : isSupabaseConfigured() ? 'syncing' : 'offline'
  );
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const debounceTimerRef = useRef<any>(null);
  const isRefreshingRef = useRef(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  const refreshProducts = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      const list = await db.getProducts();
      setProducts(list);
      // Count variants where stock is <= threshold
      let lowCount = 0;
      list.forEach(p => {
        const total = p.total_stock ?? 0;
        const thresh = p.variants?.[0]?.low_stock_threshold || 5;
        if (total <= thresh) {
          lowCount++;
        }
      });
      setLowStockCount(lowCount);
    } catch (e) {
      console.error('Error fetching products:', e);
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
      isRefreshingRef.current = false;
    }
  }, []);

  // Debounced refresh helper so bursts of realtime events trigger a single reload
  const triggerDebouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      refreshProducts();
      // Notify other parts of the app (BillHistory, Inventory, Reports)
      window.dispatchEvent(new CustomEvent('vcs_store_update', { detail: { type: 'LIVE_SYNC' } }));
    }, 250);
  }, [refreshProducts]);

  useEffect(() => {
    refreshProducts();

    // 1. Online / Offline network listeners
    const handleOnline = () => { 
      setIsOnline(true);
      setConnectionStatus(isSupabaseConfigured() ? 'connected' : 'offline');
      showToast('Network restored', 'success'); 
      triggerDebouncedRefresh();
    };
    const handleOffline = () => { 
      setIsOnline(false);
      setConnectionStatus('offline');
      showToast('Offline mode', 'info'); 
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Custom DOM update listener for internal broadcasts
    const handleCustomUpdate = (e: any) => {
      const detail = e.detail;
      if (detail?.type === 'BILL_CREATED') {
        triggerDebouncedRefresh();
        setRecentSalesCount(prev => prev + 1);
        if (detail.data?.bill_number) {
          showToast(`Bill Created: #${detail.data.bill_number}`, 'success');
        }
      } else if (
        detail?.type === 'STOCK_UPDATE' || 
        detail?.type === 'PRODUCT_UPDATE' || 
        detail?.type === 'BILL_CANCELLED' || 
        detail?.type === 'BILL_EDITED' ||
        detail?.type === 'EXCHANGE_PROCESSED'
      ) {
        triggerDebouncedRefresh();
      }
    };
    window.addEventListener('vcs_store_update', handleCustomUpdate);

    // 3. Setup Supabase Realtime Multi-User Subscriptions across all tables
    let supabaseChannel: any = null;
    const supabase = getSupabase();

    if (supabase && isSupabaseConfigured()) {
      setConnectionStatus('syncing');
      try {
        supabaseChannel = supabase
          .channel('vcs-shared-cloud-sync')
          // Products table
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'products' },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                showToast(`New product added: ${(payload.new as any).name || ''}`, 'info');
              }
              triggerDebouncedRefresh();
            }
          )
          // Product variants (stock changes)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'product_variants' },
            () => {
              triggerDebouncedRefresh();
            }
          )
          // Sales (bills created, edited, or cancelled)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'sales' },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                showToast(`Live Bill Created: #${(payload.new as any).bill_number || ''}`, 'success');
                setRecentSalesCount(prev => prev + 1);
              } else if (payload.eventType === 'UPDATE') {
                const updated = payload.new as any;
                if (updated.status === 'cancelled') {
                  showToast(`Live: Bill #${updated.bill_number} was cancelled`, 'info');
                }
              }
              triggerDebouncedRefresh();
            }
          )
          // Sale items
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'sale_items' },
            () => {
              triggerDebouncedRefresh();
            }
          )
          // Purchases
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'purchases' },
            () => {
              triggerDebouncedRefresh();
            }
          )
          // Expenses
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'expenses' },
            () => {
              window.dispatchEvent(new CustomEvent('vcs_store_update', { detail: { type: 'EXPENSES_SYNC' } }));
            }
          )
          // Exchanges
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'exchanges' },
            () => {
              triggerDebouncedRefresh();
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setIsSupabaseLive(true);
              setConnectionStatus('connected');
            } else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              setConnectionStatus('syncing');
            }
          });
      } catch (err) {
        console.warn('Realtime subscription setup failed:', err);
        setConnectionStatus('syncing');
      }
    } else {
      setConnectionStatus('offline');
    }

    // 4. Reliable Polling Fallback (Heartbeat every 8 seconds when online)
    const heartbeatInterval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        refreshProducts();
        window.dispatchEvent(new CustomEvent('vcs_store_update', { detail: { type: 'HEARTBEAT_POLL' } }));
      }
    }, 8000);

    // 5. Re-sync when switching back to the app window/tab
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshProducts();
        window.dispatchEvent(new CustomEvent('vcs_store_update', { detail: { type: 'VISIBILITY_FOCUS' } }));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('vcs_store_update', handleCustomUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      clearInterval(heartbeatInterval);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (supabaseChannel && supabase) {
        supabase.removeChannel(supabaseChannel);
      }
    };
  }, [refreshProducts, triggerDebouncedRefresh, showToast]);

  return (
    <StoreContext.Provider value={{
      products,
      isLoadingProducts,
      refreshProducts,
      lowStockCount,
      recentSalesCount,
      isOnline,
      isSupabaseLive,
      connectionStatus,
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

export const useStore = (): StoreContextType => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
