import React, { useState } from 'react';
import { DiscountType } from '../../types';
import { X, Percent, IndianRupee, Check } from 'lucide-react';
import { formatCurrency } from '../../lib/date';

interface DiscountModalProps {
  subtotal: number;
  currentType: DiscountType;
  currentValue: number;
  onApply: (type: DiscountType, value: number) => void;
  onClose: () => void;
}

export const DiscountModal: React.FC<DiscountModalProps> = ({
  subtotal,
  currentType,
  currentValue,
  onApply,
  onClose
}) => {
  const [type, setType] = useState<DiscountType>(currentType);
  const [valInput, setValInput] = useState<string>(currentValue > 0 ? String(currentValue) : '');

  const numericVal = parseFloat(valInput) || 0;

  // Calculate projected discount amount
  let discountAmount = 0;
  if (type === 'percentage') {
    discountAmount = Math.round((subtotal * Math.min(100, numericVal)) / 100);
  } else if (type === 'fixed') {
    discountAmount = Math.min(subtotal, numericVal);
  }

  const projectedTotal = Math.max(0, subtotal - discountAmount);

  const handleSave = () => {
    if (type === 'none' || numericVal <= 0) {
      onApply('none', 0);
    } else {
      onApply(type, numericVal);
    }
    onClose();
  };

  const handleRemove = () => {
    onApply('none', 0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
      <div 
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-bold text-sm tracking-wide">APPLY BILL DISCOUNT (OPTIONAL)</h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Subtotal reminder */}
          <div className="bg-slate-100 p-2.5 rounded-lg flex justify-between items-center text-xs">
            <span className="text-slate-600 font-medium">Original Subtotal:</span>
            <span className="text-slate-900 font-bold">{formatCurrency(subtotal)}</span>
          </div>

          {/* Discount Type Toggle */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => { setType('none'); setValInput(''); }}
              className={`py-2 text-xs font-bold rounded-lg border transition ${
                type === 'none' ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              No Discount
            </button>
            <button
              type="button"
              onClick={() => setType('fixed')}
              className={`py-2 text-xs font-bold rounded-lg border transition flex items-center justify-center space-x-1 ${
                type === 'fixed' ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <IndianRupee className="w-3.5 h-3.5" />
              <span>Flat ₹ Off</span>
            </button>
            <button
              type="button"
              onClick={() => setType('percentage')}
              className={`py-2 text-xs font-bold rounded-lg border transition flex items-center justify-center space-x-1 ${
                type === 'percentage' ? 'bg-amber-500 border-amber-500 text-slate-950' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Percentage %</span>
            </button>
          </div>

          {/* Input & Quick Chips */}
          {type !== 'none' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {type === 'percentage' ? 'Discount Percentage (%)' : 'Discount Amount (₹)'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max={type === 'percentage' ? 100 : subtotal}
                    value={valInput}
                    onChange={e => setValInput(e.target.value)}
                    placeholder={type === 'percentage' ? 'e.g. 10' : 'e.g. 100'}
                    className="w-full text-base font-bold px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    autoFocus
                  />
                  <span className="absolute right-3 top-3 text-xs font-bold text-slate-400">
                    {type === 'percentage' ? '%' : 'INR'}
                  </span>
                </div>
              </div>

              {/* Quick shortcut chips */}
              <div className="flex flex-wrap gap-1.5">
                {type === 'percentage'
                  ? [5, 10, 15, 20, 25].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setValInput(String(p))}
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-amber-100 text-slate-800 text-xs font-semibold"
                      >
                        {p}%
                      </button>
                    ))
                  : [50, 100, 150, 200, 500].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setValInput(String(amt))}
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-amber-100 text-slate-800 text-xs font-semibold"
                      >
                        ₹{amt}
                      </button>
                    ))}
              </div>

              {/* Calculation Summary */}
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Discount Amount:</span>
                  <span className="font-bold text-rose-600">- {formatCurrency(discountAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-extrabold text-sm pt-1 border-t border-amber-200">
                  <span>Final Bill Total:</span>
                  <span>{formatCurrency(projectedTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex space-x-2">
          {currentValue > 0 && (
            <button
              type="button"
              onClick={handleRemove}
              className="py-3 px-3 rounded-xl border border-rose-300 text-rose-700 font-bold text-xs hover:bg-rose-50"
            >
              Clear Discount
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-xs tracking-wide shadow flex items-center justify-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Apply to Bill</span>
          </button>
        </div>
      </div>
    </div>
  );
};
