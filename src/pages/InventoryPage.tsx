import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '../context/StoreContext';
import { Product, ProductVariant } from '../types';
import { db } from '../lib/db';
import { ProductFormModal } from '../components/inventory/ProductFormModal';
import { ProductDeleteModal } from '../components/inventory/ProductDeleteModal';
import { StockAdjustModal } from '../components/inventory/StockAdjustModal';
import { formatCurrency } from '../lib/date';
import { 
  Search, 
  Boxes, 
  Plus, 
  AlertTriangle, 
  Sliders, 
  Edit3, 
  Trash2, 
  Archive, 
  CheckCircle,
  Tag
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const { refreshProducts: refreshStoreProducts, lowStockCount } = useStore();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'low_stock' | 'archived'>('active');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [adjustingTarget, setAdjustingTarget] = useState<{ product: Product; variant: ProductVariant } | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await db.getProducts(undefined, undefined, true); // Include archived
      setAllProducts(data);
    } catch (e) {
      console.error('Error fetching inventory:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();

    const handleUpdate = () => {
      fetchProducts();
    };
    window.addEventListener('vcs_store_update', handleUpdate);
    return () => window.removeEventListener('vcs_store_update', handleUpdate);
  }, [fetchProducts]);

  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(allProducts.map(p => p.category_name))).filter(Boolean)];
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    let result = allProducts;

    if (activeTab === 'active') {
      result = result.filter(p => p.is_active && !p.is_archived);
    } else if (activeTab === 'low_stock') {
      result = result.filter(p => p.is_active && !p.is_archived && p.variants?.some(v => v.stock_quantity <= (v.low_stock_threshold || 2)));
    } else if (activeTab === 'archived') {
      result = result.filter(p => !p.is_active || p.is_archived);
    }

    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category_name.toLowerCase() === selectedCategory.toLowerCase());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.variants?.some(v => v.size.toLowerCase().includes(q) || v.color.toLowerCase().includes(q) || v.variant_sku.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allProducts, activeTab, selectedCategory, searchQuery]);

  const archivedCount = useMemo(() => {
    return allProducts.filter(p => !p.is_active || p.is_archived).length;
  }, [allProducts]);

  const activeCount = useMemo(() => {
    return allProducts.filter(p => p.is_active && !p.is_archived).length;
  }, [allProducts]);

  return (
    <div className="pb-24 pt-2 max-w-7xl mx-auto px-3 sm:px-4">
      {/* Header & Controls */}
      <div className="sticky top-14 z-30 bg-slate-100/95 backdrop-blur-xs py-2 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-black text-base sm:text-lg tracking-wide text-slate-900">
              INVENTORY & STOCK
            </h1>
            <p className="text-xs text-slate-500">Variant-aware clothing stock management</p>
          </div>

          <button
            onClick={() => setIsAddingNew(true)}
            className="px-3 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center space-x-1.5 shadow-md"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add Product</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search stock by product, SKU, size, or color..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-amber-500 shadow-xs"
          />
        </div>

        {/* Tab switchers: Active vs Low Stock vs Archived */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => setActiveTab('active')}
            className={`py-2 text-xs font-bold rounded-xl border transition ${
              activeTab === 'active' ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setActiveTab('low_stock')}
            className={`py-2 text-xs font-bold rounded-xl border transition flex items-center justify-center space-x-1 ${
              activeTab === 'low_stock' ? 'bg-rose-600 text-white border-rose-600 shadow-xs' : 'bg-white border-slate-200 text-rose-700'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low ({lowStockCount})</span>
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`py-2 text-xs font-bold rounded-xl border transition flex items-center justify-center space-x-1 ${
              activeTab === 'archived' ? 'bg-slate-700 text-white border-slate-700 shadow-xs' : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archived ({archivedCount})</span>
          </button>
        </div>

        {/* Categories */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pt-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                selectedCategory === cat ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product List */}
      <div className="mt-3 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-200 rounded-2xl animate-pulse" />)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Boxes className="w-10 h-10 mx-auto text-slate-400 mb-2 stroke-[1.5]" />
            <p className="font-bold text-sm">No products found</p>
          </div>
        ) : (
          filteredProducts.map(product => {
            const totalStock = (product.variants || []).reduce((acc, v) => acc + v.stock_quantity, 0);
            const isArchived = !product.is_active || product.is_archived;

            return (
              <div 
                key={product.id}
                className={`bg-white border rounded-2xl p-4 shadow-xs space-y-3 transition-all ${
                  isArchived ? 'border-slate-300 bg-slate-50/70 opacity-80' : 'border-slate-200'
                }`}
              >
                {/* Header with Title and Prominent Action Buttons */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-2">
                    <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
                      <span>{product.sku}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700">{product.category_name}</span>
                      {isArchived && (
                        <span className="bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded">
                          ARCHIVED
                        </span>
                      )}
                    </div>
                    <h3 className="font-black text-sm sm:text-base text-slate-900 mt-0.5">{product.name}</h3>
                    <div className="font-black text-xs text-amber-600 font-mono mt-0.5">
                      {formatCurrency(product.selling_price)}
                    </div>
                  </div>

                  {/* Edit and Delete Buttons */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={() => setEditingProduct(product)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center space-x-1 border border-slate-200 shadow-2xs"
                      title="Edit Product Details"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-700" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setDeletingProduct(product)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition"
                      title="Delete / Archive Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className={`px-2 py-1 rounded-lg font-mono font-black text-xs ${
                      totalStock <= 0 ? 'bg-rose-100 text-rose-800' : totalStock <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {totalStock} in stock
                    </div>
                  </div>
                </div>

                {/* Variants Breakdown Table */}
                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y bg-slate-50 text-xs">
                  {product.variants?.map(variant => {
                    const isLow = variant.stock_quantity <= (variant.low_stock_threshold || 2);
                    const isOut = variant.stock_quantity <= 0;

                    return (
                      <div key={variant.id} className="p-2.5 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-black bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-900 font-mono">
                            {variant.size}
                          </span>
                          <span className="font-semibold text-slate-700">{variant.color}</span>
                          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                            (SKU: {variant.variant_sku})
                          </span>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className={`font-mono font-bold ${
                            isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'
                          }`}>
                            {isOut ? 'Out of stock' : `${variant.stock_quantity} pcs`}
                          </span>

                          <button
                            onClick={() => setAdjustingTarget({ product, variant })}
                            className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md font-bold text-[11px] text-slate-700 flex items-center space-x-1"
                          >
                            <Sliders className="w-3 h-3 text-slate-500" />
                            <span>Adjust</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {(isAddingNew || editingProduct) && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => { setIsAddingNew(false); setEditingProduct(null); }}
          onSuccess={() => {
            fetchProducts();
            refreshStoreProducts();
          }}
        />
      )}

      {/* Product Delete / Archive Modal */}
      {deletingProduct && (
        <ProductDeleteModal
          product={deletingProduct}
          onClose={() => setDeletingProduct(null)}
          onSuccess={() => {
            fetchProducts();
            refreshStoreProducts();
          }}
        />
      )}

      {/* Quick Stock Adjustment Modal */}
      {adjustingTarget && (
        <StockAdjustModal
          product={adjustingTarget.product}
          variant={adjustingTarget.variant}
          onClose={() => setAdjustingTarget(null)}
          onSuccess={() => {
            fetchProducts();
            refreshStoreProducts();
          }}
        />
      )}
    </div>
  );
};
