import React, { useState, useMemo } from 'react';
import { Sale, PaymentMethod, DiscountType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/db';
import { formatCurrency, formatDateTimeIST } from '../../lib/date';
import { 
  X, 
  Edit3, 
  Plus, 
  Minus, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  User, 
  Phone, 
  Tag, 
  CreditCard 
} from 'lucide-react';

interface EditBillModalProps {
  sale: Sale;
  onClose: () => void;
  onSuccess: (updatedSale: Sale) => void;
}

export const EditBillModal: React.FC<EditBillModalProps> = ({
  sale,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const { products, showToast, refreshProducts } = useStore();

  const [customerName, setCustomerName] = useState(sale.customer_name || '');
  const [customerPhone, setCustomerPhone] = useState(sale.customer_phone || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(sale.payment_method);
  const [paidAmountInput, setPaidAmountInput] = useState(String(sale.paid_amount));
  const [discountType, setDiscountType] = useState<DiscountType>(sale.discount_type);
  const [discountValue, setDiscountValue] = useState<number>(sale.discount_value);
  const [notes, setNotes] = useState(sale.notes || '');
  const [editReason, setEditReason] = useState('Customer bill details updated');

  // Items in bill
  const [items, setItems] = useState(
    (sale.items || []).map(i => ({
      ...i,
      quantity: i.quantity,
      unit_price: i.unit_price,
      subtotal: i.subtotal
    }))
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    if (discountType === 'none' || discountValue <= 0 || subtotal <= 0) return 0;
    if (discountType === 'percentage') {
      const pct = Math.min(100, Math.max(0, discountValue));
      return Math.round((subtotal * pct) / 100);
    }
    if (discountType === 'fixed') {
      return Math.min(subtotal, Math.max(0, discountValue));
    }
    return 0;
  }, [discountType, discountValue, subtotal]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const paidAmount = useMemo(() => {
    const num = parseFloat(paidAmountInput);
    return isNaN(num) ? grandTotal : Math.max(0, num);
  }, [paidAmountInput, grandTotal]);

  const balanceAmount = useMemo(() => {
    return Math.max(0, grandTotal - paidAmount);
  }, [grandTotal, paidAmount]);

  // Stepper handlers
  const handleUpdateQty = (variantId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(variantId);
      return;
    }

    // Check available stock
    const oldItem = sale.items?.find(i => i.variant_id === variantId);
    const oldQty = oldItem ? oldItem.quantity : 0;
    const delta = newQty - oldQty; // additional units needed

    if (delta > 0) {
      let currentStock = 0;
      for (const p of products) {
        const v = p.variants?.find(v => v.id === variantId);
        if (v) {
          currentStock = v.stock_quantity;
          break;
        }
      }
      if (currentStock < delta) {
        setErrorMsg(`Only ${currentStock} additional pieces available in store for this garment.`);
        return;
      }
    }

    setErrorMsg(null);
    setItems(prev => prev.map(item => {
      if (item.variant_id === variantId) {
        return {
          ...item,
          quantity: newQty,
          subtotal: newQty * item.unit_price
        };
      }
      return item;
    }));
  };

  const handleRemoveItem = (variantId: string) => {
    if (items.length <= 1) {
      setErrorMsg('A bill must have at least one item. If the customer cancelled the entire purchase, use the Cancel Bill feature instead.');
      return;
    }
    setItems(prev => prev.filter(i => i.variant_id !== variantId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setErrorMsg('Bill must contain at least one item.');
      return;
    }
    if (!editReason.trim()) {
      setErrorMsg('Please specify an audit reason for editing this bill.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const updatedSale = await db.editSale(
        sale.id,
        {
          customer_name: customerName,
          customer_phone: customerPhone,
          subtotal,
          discount_type: discountType,
          discount_value: discountValue,
          discount_amount: discountAmount,
          grand_total: grandTotal,
          paid_amount: paidAmount,
          payment_method: paymentMethod,
          notes,
          edit_reason: editReason.trim(),
          items
        },
        currentUser.full_name
      );

      await refreshProducts();
      showToast(`Bill #${sale.bill_number} updated successfully!`, 'success');
      onSuccess(updatedSale);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update bill.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Edit3 className="w-4 h-4 text-amber-400" />
            <div>
              <h3 className="font-extrabold text-sm tracking-wide">
                EDIT BILL #{sale.bill_number}
              </h3>
              <div className="text-[10px] text-slate-400 font-mono">
                Original Date: {formatDateTimeIST(sale.created_at)}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto text-xs">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Details */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Customer Information
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-lg bg-white font-medium"
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
                  className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded-lg bg-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Items Stepper List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Billed Items ({items.length})
              </div>
              <span className="text-[10px] text-slate-500">Stock updates automatically</span>
            </div>

            <div className="border border-slate-200 rounded-xl divide-y bg-slate-50 overflow-hidden">
              {items.map(item => (
                <div key={item.variant_id} className="p-3 flex items-center justify-between">
                  <div className="flex-1 pr-2">
                    <div className="font-bold text-slate-900 text-xs">{item.product_name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Size: <span className="font-bold text-slate-700">{item.size}</span> | Color: <span className="font-bold text-slate-700">{item.color}</span> | {formatCurrency(item.unit_price)} each
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.variant_id, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 rounded"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-bold font-mono text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.variant_id, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100 rounded"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="w-16 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(item.subtotal)}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.variant_id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Discount Settings */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Bill Discount
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => { setDiscountType('none'); setDiscountValue(0); }}
                className={`py-1.5 rounded-lg border font-bold text-xs ${
                  discountType === 'none' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
                }`}
              >
                No Discount
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('fixed')}
                className={`py-1.5 rounded-lg border font-bold text-xs ${
                  discountType === 'fixed' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-white text-slate-700'
                }`}
              >
                Flat ₹ Off
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('percentage')}
                className={`py-1.5 rounded-lg border font-bold text-xs ${
                  discountType === 'percentage' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-white text-slate-700'
                }`}
              >
                Percentage %
              </button>
            </div>

            {discountType !== 'none' && (
              <div className="flex items-center space-x-2 pt-1">
                <label className="text-[11px] font-bold text-slate-600">Value:</label>
                <input
                  type="number"
                  min="0"
                  max={discountType === 'percentage' ? 100 : subtotal}
                  value={discountValue}
                  onChange={e => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-28 p-1.5 border border-slate-300 rounded-lg font-mono font-bold bg-white text-xs"
                />
                <span className="text-[11px] font-bold text-rose-600">
                  (- {formatCurrency(discountAmount)})
                </span>
              </div>
            )}
          </div>

          {/* Payment & Totals */}
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-bold">{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount:</span>
                <span className="font-bold">- {formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-slate-900 font-black text-sm pt-1 border-t border-slate-200">
              <span>New Grand Total:</span>
              <span className="text-amber-600 font-mono text-base">{formatCurrency(grandTotal)}</span>
            </div>

            <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-600 block mb-1 text-[11px]">Payment Mode</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full p-1.5 border border-slate-300 rounded-lg bg-white font-bold uppercase text-xs"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / GPay</option>
                  <option value="card">Card</option>
                  <option value="split">Split / Credit</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1 text-[11px]">Paid Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={paidAmountInput}
                  onChange={e => setPaidAmountInput(e.target.value)}
                  className="w-full p-1.5 border border-slate-300 rounded-lg bg-white font-mono font-bold text-xs"
                />
              </div>
            </div>

            {balanceAmount > 0 && (
              <div className="text-[11px] font-bold text-rose-700">
                ⚠️ Balance Due: {formatCurrency(balanceAmount)}
              </div>
            )}
          </div>

          {/* Mandatory Edit Reason for Audit Trail */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Reason for Bill Edit (Audit Record) *
            </label>
            <input
              type="text"
              placeholder="e.g. Corrected quantity / Customer added an item / Adjusted payment mode"
              value={editReason}
              onChange={e => setEditReason(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-black rounded-xl shadow-md flex items-center justify-center space-x-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>SAVE BILL CHANGES & RECONCILE STOCK</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
