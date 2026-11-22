import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { useCart } from '../context/CartContext';
import { Product, Sale } from '../types';
import { CartDrawer } from '../components/billing/CartDrawer';
import { BillSuccessModal } from '../components/billing/BillSuccessModal';
import { PrintReceiptContainer } from '../components/billing/PrintReceiptContainer';
import { formatCurrency } from '../lib/date';
import { 
  Search, 
  Layers, 
  ArrowRight,
  Plus,
  Minus
} from 'lucide-react';

export const BillingPage: React.FC = () => {
  const { products, isLoadingProducts, showToast, isSupabaseLive } = useStore();
  const { 
    items, 
    addSimpleProductToCart, 
    incrementItemQty, 
    decrementItemQty, 
    grandTotal, 
    totalQuantity 
  } = useCart();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Extract unique categories
  const categories = useMemo(() => {
    const list = Array.from(new Set(products.map(p => p.category_name))).filter(Boolean);
    return ['All', ...list];
  }, [products]);

  // Filter products by search and category (strictly active & non-archived only)
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => p.is_active && !p.is_archived);
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category_name.toLowerCase() === selectedCategory.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.category_name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, selectedCategory, searchQuery]);

  const handleAddProduct = (product: Product) => {
    const res = addSimpleProductToCart(product, 1);
    if (!res.success && res.message) {
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="pb-28 pt-2 max-w-7xl mx-auto px-3 sm:px-4">
      {/* 1. Fast Search Bar */}
      <div className="sticky top-14 z-30 bg-slate-100/95 backdrop-blur-xs py-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search product by name or category..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs"
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full w-5 h-5 flex items-center justify-center font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* 2. Horizontal Category Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pt-2 pb-1">
          {categories.map(cat => {
            const isSel = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all select-none ${
                  isSel
                    ? 'bg-slate-900 text-amber-400 shadow'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Product Catalog Grid */}
      <div className="mt-2">
        {isLoadingProducts ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 bg-slate-200 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Layers className="w-10 h-10 mx-auto text-slate-400 mb-2 stroke-[1.5]" />
            <p className="font-bold text-sm">
              {!isSupabaseLive ? 'Cloud Database Not Connected' : 'No products found'}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              {!isSupabaseLive 
                ? 'Enter your Supabase URL & Key in Settings to connect your store and load shared products.'
                : searchQuery ? 'Try searching with a different keyword' : 'Add products in Inventory to start billing'}
            </p>
            {!isSupabaseLive && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('vcs_navigate_tab', { detail: 'settings' }))}
                className="mt-3 inline-flex items-center space-x-1.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-500 px-3 py-2 rounded-xl shadow-xs transition"
              >
                <span>➔ Connect Database in Settings</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {filteredProducts.map(product => {
              const totalStock = product.total_stock ?? 0;
              const isOutOfStock = totalStock <= 0;
              
              // Find if this product is currently in cart
              const cartItem = items.find(i => i.product_id === product.id);
              const inCartQty = cartItem ? cartItem.quantity : 0;

              return (
                <div
                  key={product.id}
                  className={`bg-white rounded-xl border p-3 flex flex-col justify-between select-none transition-all shadow-xs ${
                    isOutOfStock 
                      ? 'border-slate-200 opacity-60' 
                      : inCartQty > 0
                      ? 'border-amber-400 bg-amber-50/20 shadow-xs'
                      : 'border-slate-200 hover:border-amber-400'
                  }`}
                >
                  <div>
                    {/* Category */}
                    <div className="text-[10px] text-slate-400 font-semibold truncate mb-1">
                      {product.category_name}
                    </div>

                    {/* Product Title */}
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 leading-snug">
                      {product.name}
                    </h4>
                  </div>

                  {/* Price & Stock info */}
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="font-black text-sm text-slate-900 font-mono">
                        {formatCurrency(product.selling_price)}
                      </div>
                      <div className={`text-[10px] font-semibold ${
                        isOutOfStock ? 'text-rose-600' : totalStock <= 5 ? 'text-amber-600' : 'text-emerald-700'
                      }`}>
                        {isOutOfStock ? 'Out of stock' : `${totalStock} in stock`}
                      </div>
                    </div>

                    {/* PRIORITY 3: DIRECT 1-TAP ADD / ADJUST BUTTONS */}
                    {isOutOfStock ? (
                      <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-md">
                        Sold out
                      </span>
                    ) : inCartQty > 0 ? (
                      <div className="flex items-center space-x-1 bg-amber-500 text-slate-950 rounded-lg p-0.5 shadow-xs">
                        <button
                          type="button"
                          onClick={() => decrementItemQty(cartItem!.cart_id)}
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-amber-600 active:bg-amber-700 font-bold"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-4 text-center font-black text-xs font-mono">
                          {inCartQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const res = incrementItemQty(cartItem!.cart_id);
                            if (!res.success && res.message) showToast(res.message, 'error');
                          }}
                          className="w-6 h-6 rounded flex items-center justify-center hover:bg-amber-600 active:bg-amber-700 font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddProduct(product)}
                        className="py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs flex items-center space-x-1 shadow-xs transition select-none"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Bottom Sticky Cart Action Bar (Primary Mobile UX) */}
      {totalQuantity > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 p-3 max-w-lg mx-auto animate-slide-up">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-slate-900 text-white rounded-2xl p-3.5 shadow-2xl flex items-center justify-between border border-slate-700 active:scale-[0.99] transition"
          >
            <div className="flex items-center space-x-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-sm">
                {totalQuantity}
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium">TOTAL BILL AMOUNT</div>
                <div className="text-base font-black text-amber-400 font-mono leading-none mt-0.5">
                  {formatCurrency(grandTotal)}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 font-bold text-xs text-white bg-slate-800 px-3 py-2 rounded-xl">
              <span>VIEW BILL</span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onBillSuccess={(sale) => setCompletedSale(sale)}
      />

      {/* Bill Success Modal */}
      {completedSale && (
        <BillSuccessModal
          sale={completedSale}
          onNewBill={() => setCompletedSale(null)}
        />
      )}

      {/* Thermal Receipt Hidden Container for printing */}
      <PrintReceiptContainer sale={completedSale} />
    </div>
  );
};
