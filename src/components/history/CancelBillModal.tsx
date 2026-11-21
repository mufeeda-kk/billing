import React, { useState } from 'react';
import { Sale } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/db';
import { formatCurrency, formatDateTimeIST } from '../../lib/date';
import { 
  X, 
  Ban, 
  AlertTriangle, 
  RotateCcw, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';

interface CancelBillModalProps {
  sale: Sale;
  onClose: () => void;
  onSuccess: (updatedSale: Sale) => void;
}

const COMMON_CANCEL_REASONS = [
  'Customer changed mind before leaving shop',
  'Accidental duplicate bill created',
  'Payment declined / Cash not received',
  'Wrong items / sizes billed by mistake',
  'Customer requested complete cancellation',
  'Other'
];

export const CancelBillModal: React.FC<CancelBillModalProps> = ({
  sale,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const { showToast, refreshProducts } = useStore();

  const [selectedReason, setSelectedReason] = useState(COMMON_CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const finalReason = selectedReason === 'Other' ? customReason.trim() : selectedReason;

  const handleCancelBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalReason) {
      setErrorMsg('Please specify a cancellation reason.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const cancelledSale = await db.cancelSale(sale.id, finalReason, currentUser.full_name);
      await refreshProducts();
      showToast(`Bill #${sale.bill_number} cancelled. Stock restored to inventory.`, 'success');
      onSuccess(cancelledSale);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to cancel bill.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
      <div 
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-rose-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Ban className="w-5 h-5 text-rose-300" />
            <h3 className="font-extrabold text-sm tracking-wide">CANCEL BILL RECEIPT</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-rose-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleCancelBill} className="p-4 space-y-3.5 text-xs">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Bill Overview */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-mono font-black text-slate-900 text-sm">#{sale.bill_number}</span>
              <span className="font-mono font-black text-rose-600 text-sm">{formatCurrency(sale.grand_total)}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Customer: <span className="font-bold text-slate-700">{sale.customer_name || 'Walk-in'}</span>
              {sale.customer_phone && ` (${sale.customer_phone})`}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Billed: {formatDateTimeIST(sale.created_at)} by {sale.created_by}
            </div>
          </div>

          {/* Items Stock Restoration Notice */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
            <div className="flex items-center space-x-1.5 font-bold text-emerald-900 text-xs">
              <RotateCcw className="w-4 h-4 text-emerald-700" />
              <span>Automatic Stock Restoration</span>
            </div>
            <p className="text-[11px] text-emerald-800">
              The following garment quantities will be automatically restored to store stock:
            </p>
            <div className="space-y-1 pt-1 border-t border-emerald-200/60 font-mono text-[11px]">
              {sale.items?.map((item, idx) => {
                const qtyToRestore = item.quantity - (item.returned_quantity || 0);
                if (qtyToRestore <= 0) return null;
                return (
                  <div key={idx} className="flex justify-between text-emerald-950">
                    <span className="truncate max-w-[200px]">{item.product_name} ({item.size}/{item.color})</span>
                    <span className="font-bold">+{qtyToRestore} pcs</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Reason for Cancellation *
            </label>
            <select
              value={selectedReason}
              onChange={e => setSelectedReason(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-medium"
            >
              {COMMON_CANCEL_REASONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {selectedReason === 'Other' && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">Enter Reason *</label>
              <input
                type="text"
                placeholder="Reason for audit log..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-xl font-medium"
                required
                autoFocus
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="py-2.5 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !finalReason}
              className="py-2.5 px-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-black rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cancelling...</span>
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4" />
                  <span>Confirm Cancel</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
