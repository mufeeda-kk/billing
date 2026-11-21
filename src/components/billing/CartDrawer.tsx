import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/db';
import { DiscountModal } from './DiscountModal';
import { formatCurrency } from '../../lib/date';
import { Sale } from '../../types';
import { 
  X, 
  Trash2, 
  Plus, 
  Minus, 
  Tag, 
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
    discountType,
    discountValue,
    discountAmount,
    setDiscount,
    subtotal,
    grandTotal,
    paymentMethod,
    setPaymentMethod,
    paidAmountInput,
    setPaidAmountInput,
    paidAmount,
    balanceAmount,
    totalQuantity,
    notes,
    setNotes
  } = useCart();

  const { currentUser } = useAuth();
  const { showToast } = useStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    if (items.length === 0 || isSubmitting) return;

    // Concurrency Lock: Prevent multiple taps
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const createdSale = await db.createSale({
        customer_name: customerName,
        customer_phone: customerPhone,
        items,
        subtotal,
        discount_type: discountType,
        discount_value: discountValue,
        discount_amount: discountAmount,
        grand_total: grandTotal,
        paid_amount: paidAmount,
        payment_method: paymentMethod,
        notes,
        created_by: currentUser.full_name
      });

      // Clear cart & trigger success screen
      clearCart();
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
    <>
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
                  Clear All
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

          {/* Cart Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Empty State */}
            {items.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center px-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
                  <CreditCard className="w-8 h-8 opacity-40" />
                </div>
                <div className="font-bold text-sm text-slate-700">Cart is empty</div>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Tap any product on the screen to choose size, color, and add to bill.
                </p>
              </div>
            ) : (
              /* Item List */
              <div className="space-y-2.5">
                {items.map((item) => (
                  <div 
                    key={item.cart_id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex-1 pr-2">
                      <div className="font-bold text-xs text-slate-900 leading-tight">
                        {item.product_name}
                      </div>
                      <div className="flex items-center space-x-1.5 text-[11px] text-slate-600 mt-1">
                        <span className="font-semibold bg-slate-200 px-1.5 py-0.2 rounded text-slate-800">
                          {item.size}
                        </span>
                        <span>•</span>
                        <span className="font-medium">{item.color}</span>
                        <span>•</span>
                        <span className="text-slate-500 font-mono">{formatCurrency(item.unit_price)}</span>
                      </div>
                    </div>

                    {/* Qty Stepper & Subtotal */}
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => decrementItemQty(item.cart_id)}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const res = incrementItemQty(item.cart_id);
                            if (!res.success) showToast(res.message || 'Out of stock', 'error');
                          }}
                          className="w-6 h-6 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="w-16 text-right">
                        <div className="font-bold text-xs text-slate-900 font-mono">
                          {formatCurrency(item.subtotal)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.cart_id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
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
                {/* Optional Customer Info */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Customer Details (Optional)
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
                        placeholder="10-digit Phone"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Payment Mode
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'cash', label: 'Cash', icon: Banknote },
                      { id: 'upi', label: 'UPI / GPay', icon: QrCode },
                      { id: 'card', label: 'Card', icon: CreditCard },
                      { id: 'split', label: 'Credit/Split', icon: Layers }
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

                {/* Partial Payment input if Split or custom */}
                {paymentMethod === 'split' && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 text-xs">
                    <label className="font-bold text-slate-800 block">
                      Paid Amount (Outstanding balance tracked):
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
                        ⚠️ Outstanding Balance to collect later: {formatCurrency(balanceAmount)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Totals & Checkout Button */}
          {items.length > 0 && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
              {/* Calculations breakdown */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(subtotal)}</span>
                </div>

                <div className="flex justify-between items-center text-slate-600">
                  <button
                    type="button"
                    onClick={() => setShowDiscountModal(true)}
                    className="text-amber-700 hover:text-amber-800 font-bold flex items-center space-x-1 underline"
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>{discountAmount > 0 ? `Discount (${discountType === 'percentage' ? `${discountValue}%` : 'Flat'})` : '+ Add Discount'}</span>
                  </button>
                  <span className={`font-semibold ${discountAmount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {discountAmount > 0 ? `- ${formatCurrency(discountAmount)}` : '₹0'}
                  </span>
                </div>

                <div className="flex justify-between text-slate-900 font-black text-base pt-2 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span className="text-amber-600 font-mono">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              {/* Concurrency-Protected Confirm Button */}
              <button
                type="button"
                disabled={isSubmitting || items.length === 0}
                onClick={handleCheckout}
                className={`w-full py-4 px-4 rounded-xl font-black text-sm tracking-wide shadow-lg flex items-center justify-center space-x-2 transition-all ${
                  isSubmitting
                    ? 'bg-slate-400 text-white cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-600/20'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>GENERATING BILL...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                    <span>GENERATE BILL • {formatCurrency(grandTotal)}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Discount Modal */}
      {showDiscountModal && (
        <DiscountModal
          subtotal={subtotal}
          currentType={discountType}
          currentValue={discountValue}
          onApply={setDiscount}
          onClose={() => setShowDiscountModal(false)}
        />
      )}
    </>
  );
};
