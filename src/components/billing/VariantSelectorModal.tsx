import React, { useState } from 'react';
import { Product, ProductVariant } from '../../types';
import { X, Check, Plus, Minus, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/date';

interface VariantSelectorModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product, variant: ProductVariant, qty: number) => { success: boolean; message?: string };
}

export const VariantSelectorModal: React.FC<VariantSelectorModalProps> = ({
  product,
  onClose,
  onAddToCart
}) => {
  const variants = product.variants || [];

  // Get unique sizes and colors
  const sizes = Array.from(new Set(variants.map(v => v.size)));
  const colors = Array.from(new Set(variants.map(v => v.color)));

  const [selectedSize, setSelectedSize] = useState<string>(sizes[0] || '');
  const [selectedColor, setSelectedColor] = useState<string>(colors[0] || '');
  const [quantity, setQuantity] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Match the active variant
  const activeVariant = variants.find(
    v => v.size === selectedSize && v.color === selectedColor
  ) || variants.find(v => v.size === selectedSize) || variants[0];

  const availableStock = activeVariant?.stock_quantity ?? 0;
  const isOutOfStock = availableStock <= 0;

  const handleConfirm = () => {
    if (!activeVariant || isOutOfStock) return;
    const res = onAddToCart(product, activeVariant, quantity);
    if (!res.success) {
      setErrorMsg(res.message || 'Unable to add item');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
      <div 
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base line-clamp-1">{product.name}</h3>
            <div className="text-xs text-amber-400 font-mono mt-0.5">
              {product.sku} • {formatCurrency(product.selling_price)}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Size Selection */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Select Size
            </label>
            <div className="grid grid-cols-4 gap-2">
              {sizes.map(size => {
                const isSelected = selectedSize === size;
                // Calculate stock for this size
                const sizeStock = variants
                  .filter(v => v.size === size)
                  .reduce((sum, v) => sum + v.stock_quantity, 0);

                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => { setSelectedSize(size); setErrorMsg(null); }}
                    className={`py-2 px-1 text-center rounded-lg border text-xs font-bold transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500 text-slate-950 shadow'
                        : sizeStock > 0
                        ? 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                        : 'border-slate-100 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <div>{size}</div>
                    <div className="text-[10px] font-normal opacity-75">{sizeStock} left</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Select Color
            </label>
            <div className="flex flex-wrap gap-2">
              {colors.map(color => {
                const isSelected = selectedColor === color;
                const matchVar = variants.find(v => v.size === selectedSize && v.color === color);
                const hasStock = matchVar ? matchVar.stock_quantity > 0 : false;

                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => { setSelectedColor(color); setErrorMsg(null); }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center space-x-1.5 ${
                      isSelected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : hasStock
                        ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                        : 'border-slate-100 bg-slate-100 text-slate-400 opacity-60'
                    }`}
                  >
                    <span>{color}</span>
                    {matchVar && (
                      <span className="text-[10px] opacity-75">({matchVar.stock_quantity})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stock Status & Quantity Stepper */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">Available Stock</div>
              <div className={`text-sm font-bold ${isOutOfStock ? 'text-rose-600' : availableStock <= 2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {isOutOfStock ? 'Out of Stock' : `${availableStock} units in shop`}
              </div>
            </div>

            {/* Quantity Stepper */}
            {!isOutOfStock && (
              <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8 rounded-lg bg-white shadow-xs flex items-center justify-center font-bold text-slate-700 active:bg-slate-200"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-bold text-sm text-slate-900">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                  className="w-8 h-8 rounded-lg bg-white shadow-xs flex items-center justify-center font-bold text-slate-700 active:bg-slate-200"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Button */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            disabled={isOutOfStock || !activeVariant}
            onClick={handleConfirm}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide transition-all shadow-md flex items-center justify-center space-x-2 ${
              isOutOfStock || !activeVariant
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950'
            }`}
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>
              {isOutOfStock 
                ? 'Item Out of Stock' 
                : `Add to Bill • ${formatCurrency(product.selling_price * quantity)}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
