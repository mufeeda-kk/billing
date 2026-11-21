import React, { useState, useMemo } from 'react';
import { Sale, Product, ProductVariant, Exchange } from '../../types';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/db';
import { checkExchangeEligibility, formatCurrency, formatDateTimeIST } from '../../lib/date';
import { 
  X, 
  RotateCcw, 
  AlertCircle, 
  Plus, 
  Minus, 
  Search, 
  CheckCircle2, 
  Loader2, 
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

interface ExchangeModalProps {
  sale: Sale;
  onClose: () => void;
  onExchangeComplete: (exchange: Exchange) => void;
}

interface ReturnSelection {
  sale_item_id: string;
  variant_id: string;
  product_id: string;
  product_name: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  max_returnable: number;
}

interface ReplacementSelection {
  product_id: string;
  variant_id: string;
  product_name: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  available_stock: number;
}

export const ExchangeModal: React.FC<ExchangeModalProps> = ({
  sale,
  onClose,
  onExchangeComplete
}) => {
  const { products, showToast, refreshProducts } = useStore();
  const { currentUser } = useAuth();

  // 1. Strict 7-Day Eligibility Check
  const eligibility = checkExchangeEligibility(sale.created_at);

  // Return items selection state
  const [returnItems, setReturnItems] = useState<ReturnSelection[]>([]);
  // Replacement items selection state
  const [replacementItems, setReplacementItems] = useState<ReplacementSelection[]>([]);

  // Replacement search state
  const [replSearch, setReplSearch] = useState('');
  const [selectedReplProd, setSelectedReplProd] = useState<Product | null>(null);
  const [replSize, setReplSize] = useState('');
  const [replColor, setReplColor] = useState('');
  const [replQty, setReplQty] = useState(1);

  // Settlement selection
  const [settlementOption, setSettlementOption] = useState<'collected_extra' | 'refunded_cash' | 'refunded_upi' | 'store_credit'>('collected_extra');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('cash');
  const [exchangeNotes, setExchangeNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Toggle or change quantity of returned item
  const handleToggleReturnItem = (item: any) => {
    const existing = returnItems.find(r => r.sale_item_id === item.id);
    const maxReturnable = item.quantity - (item.returned_quantity || 0);

    if (maxReturnable <= 0) return;

    if (existing) {
      setReturnItems(prev => prev.filter(r => r.sale_item_id !== item.id));
    } else {
      setReturnItems(prev => [
        ...prev,
        {
          sale_item_id: item.id,
          variant_id: item.variant_id,
          product_id: item.product_id,
          product_name: item.product_name,
          size: item.size,
          color: item.color,
          quantity: 1,
          unit_price: item.unit_price,
          max_returnable: maxReturnable
        }
      ]);
    }
  };

  const updateReturnQty = (saleItemId: string, newQty: number) => {
    setReturnItems(prev => prev.map(r => {
      if (r.sale_item_id === saleItemId) {
        const clamped = Math.min(r.max_returnable, Math.max(1, newQty));
        return { ...r, quantity: clamped };
      }
      return r;
    }));
  };

  // Replacement item addition
  const handleAddReplacement = () => {
    if (!selectedReplProd || !replSize || !replColor) return;
    const variant = selectedReplProd.variants?.find(v => v.size === replSize && v.color === replColor);
    if (!variant || variant.stock_quantity <= 0) {
      showToast('Variant out of stock', 'error');
      return;
    }

    const newItem: ReplacementSelection = {
      product_id: selectedReplProd.id,
      variant_id: variant.id,
      product_name: selectedReplProd.name,
      size: variant.size,
      color: variant.color,
      quantity: replQty,
      unit_price: selectedReplProd.selling_price,
      available_stock: variant.stock_quantity
    };

    setReplacementItems(prev => [...prev, newItem]);
    // Reset selection
    setSelectedReplProd(null);
    setReplSearch('');
    setReplQty(1);
  };

  const removeReplacement = (index: number) => {
    setReplacementItems(prev => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const returnTotalValue = useMemo(() => {
    return returnItems.reduce((sum, r) => sum + (r.unit_price * r.quantity), 0);
  }, [returnItems]);

  const replacementTotalValue = useMemo(() => {
    return replacementItems.reduce((sum, r) => sum + (r.unit_price * r.quantity), 0);
  }, [replacementItems]);

  const priceDifference = replacementTotalValue - returnTotalValue;

  // Submit Exchange
  const handleSubmitExchange = async () => {
    if (!eligibility.isEligible) {
      setErrorMsg(eligibility.reason || 'Exchange period has expired.');
      return;
    }
    if (returnItems.length === 0) {
      setErrorMsg('Please select at least one item being returned.');
      return;
    }
    if (replacementItems.length === 0) {
      setErrorMsg('Please select at least one replacement clothing item.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let settlementType: any = 'none';
      if (priceDifference > 0) {
        settlementType = 'collected_extra';
      } else if (priceDifference < 0) {
        settlementType = settlementOption;
      }

      const exchangeResult = await db.processExchange({
        original_sale_id: sale.id,
        returns: returnItems,
        replacements: replacementItems,
        settlement_type: settlementType,
        payment_method: priceDifference > 0 ? paymentMethod : undefined,
        processed_by: currentUser.full_name,
        notes: exchangeNotes
      });

      await refreshProducts();
      showToast(`Exchange #${exchangeResult.exchange_number} completed successfully!`, 'success');
      onExchangeComplete(exchangeResult);
      onClose();
    } catch (err: any) {
      console.error('Exchange error:', err);
      setErrorMsg(err?.message || 'Failed to process exchange.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered replacement search
  const filteredReplProducts = useMemo(() => {
    if (!replSearch.trim()) return [];
    const q = replSearch.toLowerCase().trim();
    return products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.sku.toLowerCase().includes(q) ||
      p.category_name.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [products, replSearch]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 animate-fade-in overflow-y-auto">
      <div 
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-extrabold text-sm sm:text-base tracking-wide">
                CLOTHING EXCHANGE (7-DAY POLICY)
              </h2>
              <div className="text-[11px] text-slate-400 font-mono">
                Bill #{sale.bill_number} • {formatDateTimeIST(sale.created_at)}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 7-Day Eligibility Banner */}
        <div className={`px-4 py-2.5 flex items-center space-x-2 text-xs font-bold border-b ${
          eligibility.isEligible ? eligibility.badgeColor : 'bg-rose-100 text-rose-800 border-rose-200'
        }`}>
          {eligibility.isEligible ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-700" />
          )}
          <span>{eligibility.reason}</span>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: SELECT ITEMS TO RETURN */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                1. Select Returned Item(s)
              </h3>
              <span className="text-xs font-mono font-bold text-rose-600">
                Return Value: {formatCurrency(returnTotalValue)}
              </span>
            </div>

            <div className="space-y-2">
              {sale.items?.map(item => {
                const maxReturnable = item.quantity - (item.returned_quantity || 0);
                const isSelected = returnItems.some(r => r.sale_item_id === item.id);
                const activeReturn = returnItems.find(r => r.sale_item_id === item.id);
                const isAlreadyFullyReturned = maxReturnable <= 0;

                return (
                  <div 
                    key={item.id}
                    className={`p-3 rounded-xl border text-xs transition ${
                      isAlreadyFullyReturned 
                        ? 'bg-slate-100 border-slate-200 opacity-60' 
                        : isSelected 
                        ? 'bg-rose-50/60 border-rose-300' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center space-x-2.5 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          disabled={isAlreadyFullyReturned}
                          checked={isSelected}
                          onChange={() => handleToggleReturnItem(item)}
                          className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                        />
                        <div>
                          <div className="font-bold text-slate-900">{item.product_name}</div>
                          <div className="text-[11px] text-slate-500">
                            Size: <span className="font-semibold text-slate-700">{item.size}</span> | Color: <span className="font-semibold text-slate-700">{item.color}</span> | Rate: {formatCurrency(item.unit_price)}
                          </div>
                        </div>
                      </label>

                      {/* Stepper if selected */}
                      {isSelected && activeReturn && (
                        <div className="flex items-center space-x-1.5 bg-white border border-rose-200 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => updateReturnQty(item.id, activeReturn.quantity - 1)}
                            className="w-6 h-6 flex items-center justify-center font-bold text-slate-600"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center font-bold text-slate-900 font-mono">
                            {activeReturn.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateReturnQty(item.id, activeReturn.quantity + 1)}
                            className="w-6 h-6 flex items-center justify-center font-bold text-slate-600"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {isAlreadyFullyReturned && (
                        <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded font-bold text-slate-600">
                          Already Exchanged
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 2: SELECT REPLACEMENT ITEM */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                2. Select Replacement Item(s)
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-600">
                New Value: {formatCurrency(replacementTotalValue)}
              </span>
            </div>

            {/* Replacement Search */}
            {!selectedReplProd ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search replacement product from catalog..."
                    value={replSearch}
                    onChange={e => setReplSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {filteredReplProducts.length > 0 && (
                  <div className="border border-slate-200 rounded-xl divide-y bg-white shadow-xs max-h-40 overflow-y-auto">
                    {filteredReplProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedReplProd(p);
                          const firstVar = p.variants?.[0];
                          if (firstVar) {
                            setReplSize(firstVar.size);
                            setReplColor(firstVar.color);
                          }
                        }}
                        className="p-2.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{p.sku} • {p.category_name}</div>
                        </div>
                        <div className="font-bold text-slate-800 font-mono">
                          {formatCurrency(p.selling_price)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Configure Replacement Variant */
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-slate-900">{selectedReplProd.name}</div>
                    <div className="text-amber-600 font-mono font-bold">
                      {formatCurrency(selectedReplProd.selling_price)}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedReplProd(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    Change
                  </button>
                </div>

                {/* Size & Color Picker */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">SIZE</label>
                    <select
                      value={replSize}
                      onChange={e => setReplSize(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-xs"
                    >
                      {Array.from(new Set(selectedReplProd.variants?.map(v => v.size))).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">COLOR</label>
                    <select
                      value={replColor}
                      onChange={e => setReplColor(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-xs"
                    >
                      {Array.from(new Set(selectedReplProd.variants?.map(v => v.color))).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddReplacement}
                  className="w-full py-2 bg-slate-900 text-amber-400 font-bold rounded-lg hover:bg-slate-800 text-xs shadow-xs"
                >
                  + Add to Replacement List
                </button>
              </div>
            )}

            {/* List of Chosen Replacements */}
            {replacementItems.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {replacementItems.map((repl, idx) => (
                  <div key={idx} className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{repl.product_name}</div>
                      <div className="text-[11px] text-slate-600">
                        {repl.size} / {repl.color} • {repl.quantity} x {formatCurrency(repl.unit_price)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold font-mono text-slate-900">
                        {formatCurrency(repl.unit_price * repl.quantity)}
                      </span>
                      <button
                        onClick={() => removeReplacement(idx)}
                        className="text-rose-500 hover:text-rose-700 font-bold p-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* STEP 3: DIFFERENCE CALCULATION & SETTLEMENT */}
          {returnItems.length > 0 && replacementItems.length > 0 && (
            <div className="p-3 bg-slate-100 rounded-xl space-y-2 text-xs border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Total Return Credit:</span>
                <span className="font-bold text-slate-800">{formatCurrency(returnTotalValue)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Replacement Total:</span>
                <span className="font-bold text-slate-800">{formatCurrency(replacementTotalValue)}</span>
              </div>

              {/* Price Difference Status */}
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black">
                <span>Difference:</span>
                <span className={priceDifference > 0 ? 'text-rose-600' : priceDifference < 0 ? 'text-emerald-700' : 'text-slate-900'}>
                  {priceDifference > 0 && `Customer to Pay: + ${formatCurrency(priceDifference)}`}
                  {priceDifference < 0 && `Store Owes Balance: - ${formatCurrency(Math.abs(priceDifference))}`}
                  {priceDifference === 0 && 'Even Exchange (₹0)'}
                </span>
              </div>

              {/* Payment or Balance Settlement Options */}
              {priceDifference > 0 && (
                <div className="pt-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">Collect Difference Via:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['cash', 'upi', 'card'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`py-1.5 rounded-lg border font-bold text-xs uppercase ${
                          paymentMethod === m ? 'bg-slate-900 text-amber-400' : 'bg-white text-slate-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {priceDifference < 0 && (
                <div className="pt-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">Settlement Option for Balance:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSettlementOption('refunded_cash')}
                      className={`py-1.5 rounded-lg border font-bold text-[11px] ${
                        settlementOption === 'refunded_cash' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
                      }`}
                    >
                      Refund Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettlementOption('refunded_upi')}
                      className={`py-1.5 rounded-lg border font-bold text-[11px] ${
                        settlementOption === 'refunded_upi' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
                      }`}
                    >
                      Refund UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettlementOption('store_credit')}
                      className={`py-1.5 rounded-lg border font-bold text-[11px] ${
                        settlementOption === 'store_credit' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
                      }`}
                    >
                      Store Credit
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            disabled={!eligibility.isEligible || returnItems.length === 0 || replacementItems.length === 0 || isSubmitting}
            onClick={handleSubmitExchange}
            className={`w-full py-3.5 px-4 rounded-xl font-black text-xs tracking-wider shadow-md flex items-center justify-center space-x-2 transition ${
              !eligibility.isEligible || returnItems.length === 0 || replacementItems.length === 0 || isSubmitting
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>PROCESSING EXCHANGE...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>CONFIRM & COMPLETE EXCHANGE</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
