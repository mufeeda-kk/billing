import React, { useState } from 'react';
import { Product } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/db';
import { X, Trash2, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';

interface ProductDeleteModalProps {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProductDeleteModal: React.FC<ProductDeleteModalProps> = ({
  product,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMsg(null);
    try {
      const result = await db.deleteOrArchiveProduct(product.id, currentUser.full_name);
      showToast(result.message, result.action === 'archived' ? 'info' : 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete/archive product');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalStock = (product.variants || []).reduce((acc, v) => acc + v.stock_quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-fade-in">
      <div 
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-rose-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trash2 className="w-4 h-4 text-rose-300" />
            <h3 className="font-extrabold text-sm tracking-wide">DELETE / ARCHIVE PRODUCT</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-rose-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5 text-xs">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="font-black text-sm text-slate-900">{product.name}</div>
            <div className="text-[11px] text-slate-500 font-mono">
              SKU: <span className="font-bold text-slate-700">{product.sku}</span> • {product.category_name}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Current Stock: <span className="font-bold text-slate-800">{totalStock} units</span> ({product.variants?.length || 0} variants)
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-slate-700">
            <div className="flex items-center space-x-1.5 font-bold text-amber-900 text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <span>Safe Archival Protection</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-900/90">
              If this product has any historical sales, purchases, or exchange records, it will be <strong>safely archived</strong> rather than permanently deleted.
            </p>
            <p className="text-[11px] leading-relaxed text-amber-900/90">
              Archived products will <strong>no longer appear in billing searches</strong>, while preserving all past financial reports and bill receipts.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="py-2.5 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className="py-2.5 px-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-black rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Delete</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
