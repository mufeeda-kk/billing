import React, { useState, useMemo } from 'react';
import { Product, ProductVariant } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/db';
import { X, Plus, Trash2, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight, Sliders } from 'lucide-react';

interface ProductFormModalProps {
  product?: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

const COMMON_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', '36', 'Free Size'];
const COMMON_COLORS = ['Black', 'White', 'Navy Blue', 'Beige', 'Olive Green', 'Grey', 'Maroon', 'Sky Blue'];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  onClose,
  onSuccess
}) => {
  const { currentUser, isOwner } = useAuth();
  const { showToast } = useStore();

  const [name, setName] = useState(product?.name || '');
  const [sku, setSku] = useState(product?.sku || `VCS-${Math.floor(1000 + Math.random() * 9000)}`);
  const [categoryName, setCategoryName] = useState(product?.category_name || 'Casual Shirts');
  const [brand, setBrand] = useState(product?.brand || 'VINTAGE');
  const [sellingPrice, setSellingPrice] = useState(product?.selling_price ? String(product.selling_price) : '');
  const [purchasePrice, setPurchasePrice] = useState(product?.purchase_price ? String(product.purchase_price) : '');
  const [isActive, setIsActive] = useState<boolean>(product ? product.is_active : true);
  const [stockChangeReason, setStockChangeReason] = useState('Stock adjusted during product edit');

  // Initial copy of variants to detect stock changes
  const initialVariantsMap = useMemo(() => {
    const map = new Map<string, number>();
    (product?.variants || []).forEach(v => {
      map.set(v.id, v.stock_quantity);
    });
    return map;
  }, [product]);

  // Variants matrix state
  const [variants, setVariants] = useState<Array<Partial<ProductVariant>>>(
    product?.variants && product.variants.length > 0
      ? product.variants.map(v => ({ ...v }))
      : [
          { size: 'M', color: 'Black', stock_quantity: 5, low_stock_threshold: 2 },
          { size: 'L', color: 'Black', stock_quantity: 5, low_stock_threshold: 2 }
        ]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Check if any variant's stock quantity changed from original
  const hasStockChanges = useMemo(() => {
    if (!product) return false;
    return variants.some(v => {
      if (!v.id) return (v.stock_quantity || 0) > 0;
      const initialStock = initialVariantsMap.get(v.id);
      return initialStock !== undefined && Number(v.stock_quantity) !== initialStock;
    });
  }, [variants, initialVariantsMap, product]);

  const handleAddVariantRow = () => {
    setVariants(prev => [
      ...prev,
      { size: 'M', color: 'White', stock_quantity: 4, low_stock_threshold: 2 }
    ]);
  };

  const handleRemoveVariantRow = (index: number) => {
    if (variants.length <= 1) {
      showToast('A product must have at least one variant', 'error');
      return;
    }
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: string, value: any) => {
    setVariants(prev => prev.map((v, i) => {
      if (i === index) {
        return { ...v, [field]: value };
      }
      return v;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErrorMsg('Product name is required.'); return; }
    if (!sku.trim()) { setErrorMsg('SKU is required.'); return; }
    const sp = parseFloat(sellingPrice);
    if (isNaN(sp) || sp < 0) { setErrorMsg('Valid selling price is required.'); return; }
    const pp = parseFloat(purchasePrice) || 0;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await db.saveProduct(
        {
          id: product?.id,
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          category_name: categoryName,
          brand: brand.trim(),
          selling_price: sp,
          purchase_price: pp,
          is_active: isActive
        },
        variants,
        currentUser.full_name,
        hasStockChanges ? stockChangeReason : undefined
      );

      showToast(product ? 'Product updated successfully' : 'Product added successfully', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save product');
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
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-bold text-sm tracking-wide">
            {product ? 'EDIT PRODUCT & VARIANTS' : 'ADD NEW PRODUCT'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto text-xs">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Active Status Switch */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900">Product Status</div>
              <div className="text-[11px] text-slate-500">
                {isActive ? 'Active (available for billing)' : 'Inactive / Hidden from new bills'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition ${
                isActive 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'bg-slate-300 text-slate-700'
              }`}
            >
              <span>{isActive ? 'ACTIVE' : 'INACTIVE'}</span>
            </button>
          </div>

          {/* Basic Fields */}
          <div className="space-y-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Product Title *</label>
              <input
                type="text"
                placeholder="e.g. Vintage Heavyweight Oversized Tee"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-amber-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">SKU / Code *</label>
                <input
                  type="text"
                  placeholder="e.g. TSH-OVR-010"
                  value={sku}
                  onChange={e => setSku(e.target.value.toUpperCase())}
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono uppercase font-bold"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Category</label>
                <select
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white font-medium"
                >
                  <option value="Oversized T-Shirts">Oversized T-Shirts</option>
                  <option value="Casual Shirts">Casual Shirts</option>
                  <option value="Formal Shirts">Formal Shirts</option>
                  <option value="Polo T-Shirts">Polo T-Shirts</option>
                  <option value="Denim Jeans">Denim Jeans</option>
                  <option value="Cargo Pants">Cargo Pants</option>
                  <option value="Cotton Trousers">Cotton Trousers</option>
                  <option value="Track Pants & Joggers">Track Pants & Joggers</option>
                  <option value="Shorts">Shorts</option>
                  <option value="Winter Hoodies & Jackets">Winter Hoodies & Jackets</option>
                  <option value="Accessories & Belts">Accessories & Belts</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Selling Price (₹) *</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 799"
                  value={sellingPrice}
                  onChange={e => setSellingPrice(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl font-bold font-mono text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Purchase Rate (₹) {isOwner ? '' : '(Protected)'}
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 380"
                  value={purchasePrice}
                  onChange={e => setPurchasePrice(e.target.value)}
                  disabled={!isOwner}
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          {/* Clothing Variants Matrix (Size, Color, Stock, Low Stock Threshold) */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Clothing Stock Variants ({variants.length})
                </h4>
                <p className="text-[10px] text-slate-500">Each size & color has tracked stock & low threshold</p>
              </div>
              <button
                type="button"
                onClick={handleAddVariantRow}
                className="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs flex items-center space-x-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add Variant</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {variants.map((v, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-24">
                      <label className="text-[10px] font-bold text-slate-500 block">Size</label>
                      <input
                        type="text"
                        value={v.size || ''}
                        onChange={e => updateVariant(idx, 'size', e.target.value)}
                        placeholder="M, L, 32"
                        className="w-full p-1.5 border border-slate-300 rounded-lg font-bold text-xs bg-white text-center"
                      />
                    </div>

                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-500 block">Color</label>
                      <input
                        type="text"
                        value={v.color || ''}
                        onChange={e => updateVariant(idx, 'color', e.target.value)}
                        placeholder="Black, White, etc."
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveVariantRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 mt-3"
                      title="Remove variant"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block">Current Stock (Qty)</label>
                      <input
                        type="number"
                        min="0"
                        value={v.stock_quantity ?? 0}
                        onChange={e => updateVariant(idx, 'stock_quantity', Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full p-1.5 border border-slate-300 rounded-lg font-bold font-mono text-xs bg-white text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block">Low Stock Alert At</label>
                      <input
                        type="number"
                        min="1"
                        value={v.low_stock_threshold ?? 2}
                        onChange={e => updateVariant(idx, 'low_stock_threshold', Math.max(1, parseInt(e.target.value, 10) || 2))}
                        className="w-full p-1.5 border border-slate-300 rounded-lg font-mono text-xs bg-white text-center"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* If variant stock was changed, ask for reason */}
            {hasStockChanges && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <label className="font-bold text-amber-900 block text-xs">
                  Stock Adjustment Reason (Audit Record) *
                </label>
                <input
                  type="text"
                  value={stockChangeReason}
                  onChange={e => setStockChangeReason(e.target.value)}
                  placeholder="e.g. Physical store recount, Damaged items removed"
                  className="w-full p-2 border border-amber-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                  required
                />
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold rounded-xl shadow flex items-center justify-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>{isSubmitting ? 'Saving...' : 'Save Product & Variants'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
