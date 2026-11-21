import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/db';
import { formatCurrency } from '../../lib/date';
import { Sale } from '../../types';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Layers, 
  User, 
  Phone, 
  CheckCircle2, 
  AlertTriangle,
  Loader2
} from 'lucide-react';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBillSuccess: (sale: Sale) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  onBillSuccess
}) => {
  const {
    items,
    incrementItemQty,
    decrementItemQty,
    removeFromCart,
    clearCart,
    customerName,
    customerPhone,
    setCustomerName,
    setCustomerPhone,
    discountAmount,
    setDirectDiscount,
    subtotal,
    grandTotal,
    paymentMethod,
    setPaymentMethod,
    paidAmountInput,
    setPaidAmountInput,
    paidAmount,
    balanceAmount,
    totalQuantity,
    notes
  } = useCart();

  const { currentUser } = useAuth();
  const { showToast } = useStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [discountStr, setDiscountStr] = useState<string>(discountAmount > 0 ? String(discountAmount) : '');

  if (!isOpen) return null;

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDiscountStr(raw);
    const parsed = parseFloat(raw);
    if (isNaN(parsed) || parsed <= 0) {
      setDirectDiscount(0);
    } else {
      const capped = Math.min(subtotal, parsed);
      setDirectDiscount(capped);
    }
  };

  const handleCheckout = async () => {
    if (items.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const createdSale = await db.createSale({
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        items,
        subtotal,
        discount_type: discountAmount > 0 ? 'fixed' : 'none',
        discount_value: discountAmount,
        discount_amount: discountAmount,
        grand_total: grandTotal,
        paid_amount: paidAmount,
        payment_method: paymentMethod,
        notes,
        created_by: currentUser.full_name
      });

      // Clear cart & trigger success modal
      clearCart();
      setDiscountStr('');
      onClose();
      onBillSuccess(createdSale);
    } catch (err: any) {
      console.error('Bill creation failed:', err);
      const msg = err?.message || 'Failed to generate bill. Please check stock and retry.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full sm:max-w-md bg-white h-full shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <h2 className="font-extrabold text-base tracking-wide">CURRENT BILL</h2>
            <span className="bg-amber-500 text-slate-950 text-xs px-2 py-0.5 rounded-full font-bold">
              {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1"
              >
                Clear
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
                <CreditCard className="w-8 h-8 opacity-40" />
              </div>
              <div className="font-bold text-sm text-slate-700">Bill is empty</div>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Tap the + button on any product in the billing screen to add it here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div 
                  key={item.cart_id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs"
                >
                  <div className="flex-1 pr-2">
                    <div className="font-bold text-xs sm:text-sm text-slate-900 leading-snug">
                      {item.product_name}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 font-mono">
                      {formatCurrency(item.unit_price)} each
                    </div>
                  </div>

                  {/* Quantity Stepper & Subtotal */}
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => decrementItemQty(item.cart_id)}
                        className="w-7 h-7 rounded flex items-center justify-center text-slate-700 hover:bg-slate-100 active:bg-slate-200"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-black text-slate-900 font-mono">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const res = incrementItemQty(item.cart_id);
                          if (!res.success) showToast(res.message || 'Out of stock', 'error');
                        }}
                        className="w-7 h-7 rounded flex items-center justify-center text-slate-700 hover:bg-slate-100 active:bg-slate-200"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="w-16 text-right">
                      <div className="font-black text-xs sm:text-sm text-slate-900 font-mono">
                        {formatCurrency(item.subtotal)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.cart_id)}
                      className="text-slate-400 hover:text-rose-600 p-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <>
              {/* Optional Customer Information */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Customer Information (Optional)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Customer Name"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="Phone Number"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Mode */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Payment Mode
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'cash', label: 'Cash', icon: Banknote },
                    { id: 'upi', label: 'UPI / GPay', icon: QrCode },
                    { id: 'card', label: 'Card', icon: CreditCard },
                    { id: 'split', label: 'Balance/Split', icon: Layers }
                  ].map(m => {
                    const Icon = m.icon;
                    const isSel = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
                        className={`py-2 px-1 text-center rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center space-y-1 ${
                          isSel 
                            ? 'bg-slate-900 border-slate-900 text-amber-400 shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[10px] leading-tight">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Partial / Split payment */}
              {paymentMethod === 'split' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
                  <label className="font-bold text-slate-800 block">
                    Paid Amount Now:
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-600">₹</span>
                    <input
                      type="number"
                      value={paidAmountInput}
                      onChange={e => setPaidAmountInput(e.target.value)}
                      placeholder={`Full amount: ${grandTotal}`}
                      className="flex-1 px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  {balanceAmount > 0 && (
                    <div className="text-[11px] text-rose-700 font-bold">
                      Outstanding Balance to collect later: {formatCurrency(balanceAmount)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer: Simplified Discount, Totals & Generate Bill */}
        {items.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
            {/* Calculation Breakdown */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Subtotal:</span>
                <span className="font-bold font-mono text-slate-800">{formatCurrency(subtotal)}</span>
              </div>

              {/* PRIORITY 4: SIMPLE DISCOUNT AMOUNT INPUT */}
              <div className="flex justify-between items-center py-1 border-t border-b border-slate-200">
                <label className="font-bold text-slate-800 text-xs">
                  Discount Amount:
                </label>
                <div className="flex items-center space-x-1 w-32">
                  <span className="text-xs font-bold text-slate-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    max={subtotal}
                    placeholder="0"
                    value={discountStr}
                    onChange={handleDiscountChange}
                    className="w-full text-right font-black text-xs sm:text-sm bg-white border border-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-xs text-rose-600 font-semibold">
                  <span>Discount:</span>
                  <span className="font-mono font-bold">- {formatCurrency(discountAmount)}</span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-between items-center text-slate-900 font-black text-base pt-1">
                <span>Grand Total:</span>
                <span className="text-amber-600 font-mono text-lg">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Generate Bill Button (Concurrency Lock) */}
            <button
              type="button"
              disabled={isSubmitting || items.length === 0}
              onClick={handleCheckout}
              className={`w-full py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm tracking-wide shadow-lg flex items-center justify-center space-x-2 transition-all ${
                isSubmitting
                  ? 'bg-slate-400 text-white cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-600/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>GENERATING BILL...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>GENERATE BILL • {formatCurrency(grandTotal)}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
