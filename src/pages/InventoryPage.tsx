import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Product, ProductVariant } from '../types';
import { ProductFormModal } from '../components/inventory/ProductFormModal';
import { StockAdjustModal } from '../components/inventory/StockAdjustModal';
import { formatCurrency } from '../lib/date';
import { 
  Search, 
  Boxes, 
  Plus, 
  AlertTriangle, 
  Sliders, 
  Edit3, 
  CheckCircle,
  Tag
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const { products, refreshProducts, lowStockCount } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'low_stock'>('all');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [adjustingTarget, setAdjustingTarget] = useState<{ product: Product; variant: ProductVariant } | null>(null);

  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(products.map(p => p.category_name))).filter(Boolean)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (activeTab === 'low_stock') {
      result = result.filter(p => p.variants?.some(v => v.stock_quantity <= (v.low_stock_threshold || 2)));
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
  }, [products, activeTab, selectedCategory, searchQuery]);

  return (
    <div className="pb-24 pt-2 max-w-7xl mx-auto px-3 sm:px-4">
      {/* Header & Controls */}
      <div className="sticky top-14 z-30 bg-slate-100/95 backdrop-blur-xs py-2 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-black text-base sm:text-lg tracking-wide text-slate-900">
              INVENTORY & STOCK
            </h1>
            <p className="text-xs text-slate-500">Variant-aware clothing stock</p>
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
            placeholder="Search stock by product, variant SKU, size, or color..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-amber-500 shadow-xs"
          />
        </div>

        {/* Tab switchers: All vs Low Stock */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
              activeTab === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            All Products ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('low_stock')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl border transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'low_stock' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white border-slate-200 text-rose-700'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Stock Alert ({lowStockCount})</span>
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
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Boxes className="w-10 h-10 mx-auto text-slate-400 mb-2 stroke-[1.5]" />
            <p className="font-bold text-sm">No products found</p>
          </div>
        ) : (
          filteredProducts.map(product => {
            const totalStock = (product.variants || []).reduce((acc, v) => acc + v.stock_quantity, 0);

            return (
              <div 
                key={product.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
                      <span>{product.sku}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700">{product.category_name}</span>
                    </div>
                    <h3 className="font-black text-sm text-slate-900 mt-0.5">{product.name}</h3>
                    <div className="font-black text-xs text-amber-600 font-mono mt-0.5">
                      {formatCurrency(product.selling_price)}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setEditingProduct(product)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                      title="Edit Product"
                    >
                      <Edit3 className="w-4 h-4" />
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
                            ({variant.variant_sku})
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
          onSuccess={refreshProducts}
        />
      )}

      {/* Quick Stock Adjustment Modal */}
      {adjustingTarget && (
        <StockAdjustModal
          product={adjustingTarget.product}
          variant={adjustingTarget.variant}
          onClose={() => setAdjustingTarget(null)}
          onSuccess={refreshProducts}
        />
      )}
    </div>
  );
};
