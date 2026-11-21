import React, { useState } from 'react';
import { Product, ProductVariant } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/db';
import { X, Sliders, CheckCircle2, AlertCircle } from 'lucide-react';

interface StockAdjustModalProps {
  product: Product;
  variant: ProductVariant;
  onClose: () => void;
  onSuccess: () => void;
}

const ADJUST_REASONS = [
  'Physical Store Audit / Recount',
  'Damaged / Defective Garment',
  'Found Extra Stock',
  'Customer Return without Bill',
  'Theft / Shrinkage Loss',
  'Display / Mannequin Usage',
  'Other'
];

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  product,
  variant,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useStore();

  const [newStockInput, setNewStockInput] = useState<string>(String(variant.stock_quantity));
  const [reason, setReason] = useState<string>(ADJUST_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newStock = parseInt(newStockInput, 10);
    if (isNaN(newStock) || newStock < 0) {
      setErrorMsg('Stock quantity cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const finalReason = reason === 'Other' && customReason.trim() ? customReason : reason;
      await db.adjustVariantStock(variant.id, newStock, finalReason, currentUser.full_name);
      showToast(`Stock updated for ${product.name} (${variant.size}/${variant.color})`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div 
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-sm tracking-wide">ADJUST STOCK</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
            <div className="font-bold text-slate-900">{product.name}</div>
            <div className="text-slate-500 font-mono text-[11px]">
              Size: <span className="font-bold text-slate-700">{variant.size}</span> | Color: <span className="font-bold text-slate-700">{variant.color}</span>
            </div>
            <div className="text-slate-500 font-mono text-[11px]">
              Current In-Shop Stock: <span className="font-bold text-amber-700">{variant.stock_quantity} units</span>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">New Verified Stock Count:</label>
            <input
              type="number"
              min="0"
              value={newStockInput}
              onChange={e => setNewStockInput(e.target.value)}
              className="w-full p-2.5 text-base font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Adjustment Reason:</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-xl font-medium bg-white"
            >
              {ADJUST_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {reason === 'Other' && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">Specify Reason:</label>
              <input
                type="text"
                placeholder="Brief reason for audit record"
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-xl"
                required
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black rounded-xl shadow-md flex items-center justify-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Updating...' : 'Save Stock Adjustment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
