import React, { useState, useEffect } from 'react';
import { Purchase, Product } from '../types';
import { db } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { formatCurrency, formatDateIST } from '../lib/date';
import { 
  PackagePlus, 
  Plus, 
  Trash2, 
  X, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

export const PurchasePage: React.FC = () => {
  const { currentUser } = useAuth();
  const { products, refreshProducts, showToast } = useStore();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New purchase entry form
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{
    product_id: string;
    variant_id: string;
    product_name: string;
    size: string;
    color: string;
    quantity: number;
    unit_cost: number;
  }>>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadPurchases = async () => {
    setIsLoading(true);
    try {
      const list = await db.getPurchases();
      setPurchases(list);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, []);

  const handleAddItemRow = () => {
    const firstProd = products[0];
    const firstVar = firstProd?.variants?.[0];
    if (!firstProd || !firstVar) return;

    setItems(prev => [
      ...prev,
      {
        product_id: firstProd.id,
        variant_id: firstVar.id,
        product_name: firstProd.name,
        size: firstVar.size,
        color: firstVar.color,
        quantity: 10,
        unit_cost: firstProd.purchase_price || 300
      }
    ]);
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setErrorMsg('Please add at least one stock item to receive.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await db.createPurchase({
        supplier_name: supplierName.trim() || undefined,
        invoice_number: invoiceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        purchased_by: currentUser.full_name,
        items
      });

      await refreshProducts();
      showToast('New stock arrival recorded and inventory updated!', 'success');
      setShowAddModal(false);
      // Reset
      setSupplierName('');
      setInvoiceNumber('');
      setItems([]);
      loadPurchases();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to record purchase entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pb-24 pt-2 max-w-7xl mx-auto px-3 sm:px-4">
      <div className="sticky top-14 z-30 bg-slate-100/95 backdrop-blur-xs py-2 flex items-center justify-between">
        <div>
          <h1 className="font-black text-base sm:text-lg tracking-wide text-slate-900">
            STOCK PURCHASE ENTRY
          </h1>
          <p className="text-xs text-slate-500">Receive new clothing stock into shop inventory</p>
        </div>

        <button
          onClick={() => {
            handleAddItemRow();
            setShowAddModal(true);
          }}
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>New Stock Entry</span>
        </button>
      </div>

      {/* History */}
      <div className="mt-3 space-y-2.5">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-20 bg-slate-200 rounded-xl animate-pulse" />)}
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <PackagePlus className="w-10 h-10 mx-auto text-slate-400 mb-2 stroke-[1.5]" />
            <p className="font-bold text-sm">No stock purchase entries yet</p>
          </div>
        ) : (
          purchases.map(p => (
            <div key={p.id} className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-slate-900">
                    {p.supplier_name ? `Supplier: ${p.supplier_name}` : 'Stock Inward'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Inv: {p.invoice_number || 'N/A'} • {formatDateIST(p.purchase_date)} • by {p.purchased_by}
                  </div>
                </div>
                <div className="font-mono font-black text-xs text-emerald-700">
                  {formatCurrency(p.total_amount)}
                </div>
              </div>

              <div className="border border-slate-100 rounded-xl p-2 bg-slate-50 text-[11px] space-y-1">
                {p.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-slate-700">
                    <span>
                      {item.product_name} ({item.size}/{item.color})
                    </span>
                    <span className="font-bold font-mono">
                      +{item.quantity} pcs @ ₹{item.unit_cost}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Purchase Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">NEW STOCK INWARD ENTRY</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="p-4 space-y-3 text-xs overflow-y-auto">
              {errorMsg && (
                <div className="p-2 bg-rose-50 text-rose-800 rounded-lg flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Supplier / Mill Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Tirupur Garments Hub"
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Supplier Invoice #</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-8821"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase text-[11px] text-slate-700">Stock Received:</span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-amber-700 font-bold hover:underline"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {items.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <select
                          value={`${item.product_id}|${item.variant_id}`}
                          onChange={e => {
                            const [pId, vId] = e.target.value.split('|');
                            const prod = products.find(p => p.id === pId);
                            const v = prod?.variants?.find(v => v.id === vId);
                            if (prod && v) {
                              setItems(prev => prev.map((itm, i) => i === idx ? {
                                ...itm,
                                product_id: prod.id,
                                variant_id: v.id,
                                product_name: prod.name,
                                size: v.size,
                                color: v.color,
                                unit_cost: prod.purchase_price || itm.unit_cost
                              } : itm));
                            }
                          }}
                          className="flex-1 p-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                        >
                          {products.map(p => (
                            <optgroup key={p.id} label={p.name}>
                              {p.variants?.map(v => (
                                <option key={v.id} value={`${p.id}|${v.id}`}>
                                  {p.name} - {v.size} ({v.color})
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                          className="ml-2 text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Quantity Received</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => {
                              const q = parseInt(e.target.value, 10) || 1;
                              setItems(prev => prev.map((itm, i) => i === idx ? { ...itm, quantity: q } : itm));
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded-lg font-bold font-mono text-center"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block">Unit Cost (₹)</label>
                          <input
                            type="number"
                            min="0"
                            value={item.unit_cost}
                            onChange={e => {
                              const c = parseFloat(e.target.value) || 0;
                              setItems(prev => prev.map((itm, i) => i === idx ? { ...itm, unit_cost: c } : itm));
                            }}
                            className="w-full p-1.5 border border-slate-300 rounded-lg font-mono font-bold text-center"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || items.length === 0}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow flex items-center justify-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Updating Inventory...' : 'Receive Stock & Update Inventory'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
