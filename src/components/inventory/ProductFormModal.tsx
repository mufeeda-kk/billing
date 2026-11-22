import React, { useState } from 'react';
import { Product } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/db';
import { X, AlertCircle, Sparkles } from 'lucide-react';

interface ProductFormModalProps {
  product?: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

const POPULAR_CATEGORIES = [
  'Casual Shirts',
  'Formal Shirts',
  'Oversized T-Shirts',
  'Polo T-Shirts',
  'Denim Jeans',
  'Cotton Trousers',
  'Cargo Pants',
  'Track Pants',
  'Shorts',
  'Winter Wear'
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useStore();

  const [name, setName] = useState(product?.name || '');
  const [categoryName, setCategoryName] = useState(product?.category_name || 'Casual Shirts');
  const [sellingPrice, setSellingPrice] = useState(product?.selling_price ? String(product.selling_price) : '');
  const [purchasePrice, setPurchasePrice] = useState(
    product?.purchase_price !== undefined && product.purchase_price !== null ? String(product.purchase_price) : ''
  );
  const [totalStock, setTotalStock] = useState(
    product ? String(product.total_stock ?? 0) : '10'
  );
  const [lowStockAlert, setLowStockAlert] = useState(
    product?.variants?.[0]?.low_stock_threshold ? String(product.variants[0].low_stock_threshold) : '5'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Product name is required.');
      return;
    }
    const sp = parseFloat(sellingPrice);
    if (isNaN(sp) || sp < 0) {
      setErrorMsg('Valid selling price is required.');
      return;
    }
    const pp = parseFloat(purchasePrice) || 0;
    const stock = parseInt(totalStock, 10);
    if (isNaN(stock) || stock < 0) {
      setErrorMsg('Valid stock quantity is required.');
      return;
    }
    const lowAlert = parseInt(lowStockAlert, 10) || 5;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await db.saveSimpleProduct(
        {
          id: product?.id,
          name: name.trim(),
          category_name: categoryName.trim() || 'General',
          selling_price: sp,
          purchase_price: pp,
          total_stock: stock,
          low_stock_threshold: lowAlert,
          is_active: true
        },
        currentUser.full_name
      );

      showToast(product ? 'Product updated successfully' : 'Product added successfully', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div 
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-extrabold text-sm sm:text-base tracking-wide">
            {product ? 'EDIT PRODUCT' : 'ADD NEW PRODUCT'}
          </h3>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1 rounded-full text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto text-xs sm:text-sm">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex flex-col space-y-2">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium">{errorMsg}</span>
              </div>
              {errorMsg.toLowerCase().includes('settings') && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.dispatchEvent(new CustomEvent('vcs_navigate_tab', { detail: 'settings' }));
                  }}
                  className="self-start text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-3 py-1.5 rounded-lg transition"
                >
                  ➔ Go to Settings to Connect Supabase
                </button>
              )}
            </div>
          )}

          {/* 1. Product Name */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Product Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Vintage Oversized Black T-Shirt"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
            />
          </div>

          {/* 2. Category (Free typing + quick suggestion chips) */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Category (Type freely or select)
            </label>
            <input
              type="text"
              placeholder="e.g. Casual Shirts, Jeans, T-Shirts..."
              value={categoryName}
              onChange={e => setCategoryName(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white mb-1.5"
            />
            {/* Quick Chips */}
            <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-1">
              {POPULAR_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryName(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition select-none whitespace-nowrap ${
                    categoryName.toLowerCase() === cat.toLowerCase()
                      ? 'bg-amber-500 border-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Selling Price & Purchase Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Selling Price (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="699"
                  value={sellingPrice}
                  onChange={e => setSellingPrice(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Purchase Price (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="350 (Optional)"
                  value={purchasePrice}
                  onChange={e => setPurchasePrice(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* 4. Total Stock Quantity & Low Stock Alert */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-800 block mb-1">
                Total Stock Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                placeholder="10"
                value={totalStock}
                onChange={e => setTotalStock(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Low Stock Alert (Qty)
              </label>
              <input
                type="number"
                min="0"
                placeholder="5"
                value={lowStockAlert}
                onChange={e => setLowStockAlert(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-slate-100 flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-md flex items-center justify-center space-x-1.5 transition select-none disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Saving to Cloud...' : (product ? 'UPDATE PRODUCT' : 'SAVE PRODUCT')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
