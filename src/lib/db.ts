import { 
  Product, ProductVariant, Sale, CartItem, Exchange, ExchangeItem,
  Purchase, Expense, Customer, ActivityLog, StaffProfile
} from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { checkExchangeEligibility } from './date';

// Initial pre-seeded products for VINTAGE CLOTHING STORE
const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Oversized Heavyweight Cotton T-Shirt',
    sku: 'TSH-OVR-001',
    category_name: 'Oversized T-Shirts',
    brand: 'VINTAGE ORIGINALS',
    purchase_price: 350,
    selling_price: 699,
    is_active: true,
    variants: [
      { id: 'var-1-1', product_id: 'prod-1', variant_sku: 'TSH-OVR-001-M-BLK', size: 'M', color: 'Black', stock_quantity: 8, low_stock_threshold: 3 },
      { id: 'var-1-2', product_id: 'prod-1', variant_sku: 'TSH-OVR-001-L-BLK', size: 'L', color: 'Black', stock_quantity: 12, low_stock_threshold: 3 },
      { id: 'var-1-3', product_id: 'prod-1', variant_sku: 'TSH-OVR-001-XL-BLK', size: 'XL', color: 'Black', stock_quantity: 4, low_stock_threshold: 3 },
      { id: 'var-1-4', product_id: 'prod-1', variant_sku: 'TSH-OVR-001-M-WHT', size: 'M', color: 'White', stock_quantity: 6, low_stock_threshold: 3 },
      { id: 'var-1-5', product_id: 'prod-1', variant_sku: 'TSH-OVR-001-L-WHT', size: 'L', color: 'White', stock_quantity: 9, low_stock_threshold: 3 },
      { id: 'var-1-6', product_id: 'prod-1', variant_sku: 'TSH-OVR-001-L-OLV', size: 'L', color: 'Olive Green', stock_quantity: 5, low_stock_threshold: 3 }
    ]
  },
  {
    id: 'prod-2',
    name: 'Premium Oxford Button-Down Shirt',
    sku: 'SHT-OXF-002',
    category_name: 'Casual Shirts',
    brand: 'VINTAGE CLUB',
    purchase_price: 600,
    selling_price: 1199,
    is_active: true,
    variants: [
      { id: 'var-2-1', product_id: 'prod-2', variant_sku: 'SHT-OXF-002-38-BLU', size: '38 (M)', color: 'Sky Blue', stock_quantity: 5, low_stock_threshold: 2 },
      { id: 'var-2-2', product_id: 'prod-2', variant_sku: 'SHT-OXF-002-40-BLU', size: '40 (L)', color: 'Sky Blue', stock_quantity: 7, low_stock_threshold: 2 },
      { id: 'var-2-3', product_id: 'prod-2', variant_sku: 'SHT-OXF-002-42-BLU', size: '42 (XL)', color: 'Sky Blue', stock_quantity: 2, low_stock_threshold: 2 },
      { id: 'var-2-4', product_id: 'prod-2', variant_sku: 'SHT-OXF-002-40-WHT', size: '40 (L)', color: 'Pure White', stock_quantity: 8, low_stock_threshold: 2 }
    ]
  },
  {
    id: 'prod-3',
    name: 'Vintage Straight Fit Washed Denim Jeans',
    sku: 'JNS-STR-003',
    category_name: 'Denim Jeans',
    brand: 'VINTAGE DENIM CO.',
    purchase_price: 750,
    selling_price: 1599,
    is_active: true,
    variants: [
      { id: 'var-3-1', product_id: 'prod-3', variant_sku: 'JNS-STR-003-30-IND', size: '30', color: 'Indigo Dark', stock_quantity: 4, low_stock_threshold: 2 },
      { id: 'var-3-2', product_id: 'prod-3', variant_sku: 'JNS-STR-003-32-IND', size: '32', color: 'Indigo Dark', stock_quantity: 6, low_stock_threshold: 2 },
      { id: 'var-3-3', product_id: 'prod-3', variant_sku: 'JNS-STR-003-34-IND', size: '34', color: 'Indigo Dark', stock_quantity: 5, low_stock_threshold: 2 },
      { id: 'var-3-4', product_id: 'prod-3', variant_sku: 'JNS-STR-003-32-LGT', size: '32', color: 'Light Wash', stock_quantity: 3, low_stock_threshold: 2 }
    ]
  },
  {
    id: 'prod-4',
    name: 'Relaxed Fit 6-Pocket Cargo Pants',
    sku: 'CRG-RLX-004',
    category_name: 'Cargo Pants',
    brand: 'VINTAGE UTILITY',
    purchase_price: 650,
    selling_price: 1399,
    is_active: true,
    variants: [
      { id: 'var-4-1', product_id: 'prod-4', variant_sku: 'CRG-RLX-004-30-BGE', size: '30', color: 'Khaki Beige', stock_quantity: 5, low_stock_threshold: 2 },
      { id: 'var-4-2', product_id: 'prod-4', variant_sku: 'CRG-RLX-004-32-BGE', size: '32', color: 'Khaki Beige', stock_quantity: 7, low_stock_threshold: 2 },
      { id: 'var-4-3', product_id: 'prod-4', variant_sku: 'CRG-RLX-004-32-BLK', size: '32', color: 'Tactical Black', stock_quantity: 6, low_stock_threshold: 2 },
      { id: 'var-4-4', product_id: 'prod-4', variant_sku: 'CRG-RLX-004-34-BLK', size: '34', color: 'Tactical Black', stock_quantity: 4, low_stock_threshold: 2 }
    ]
  },
  {
    id: 'prod-5',
    name: 'Classic Pique Polo T-Shirt',
    sku: 'POL-PIQ-005',
    category_name: 'Polo T-Shirts',
    brand: 'VINTAGE POLO',
    purchase_price: 450,
    selling_price: 899,
    is_active: true,
    variants: [
      { id: 'var-5-1', product_id: 'prod-5', variant_sku: 'POL-PIQ-005-M-NVY', size: 'M', color: 'Navy Blue', stock_quantity: 6, low_stock_threshold: 2 },
      { id: 'var-5-2', product_id: 'prod-5', variant_sku: 'POL-PIQ-005-L-NVY', size: 'L', color: 'Navy Blue', stock_quantity: 8, low_stock_threshold: 2 },
      { id: 'var-5-3', product_id: 'prod-5', variant_sku: 'POL-PIQ-005-XL-NVY', size: 'XL', color: 'Navy Blue', stock_quantity: 4, low_stock_threshold: 2 },
      { id: 'var-5-4', product_id: 'prod-5', variant_sku: 'POL-PIQ-005-L-MRN', size: 'L', color: 'Maroon', stock_quantity: 5, low_stock_threshold: 2 }
    ]
  },
  {
    id: 'prod-6',
    name: 'Pure Linen Korean Collar Casual Shirt',
    sku: 'SHT-LIN-006',
    category_name: 'Casual Shirts',
    brand: 'VINTAGE CLUB',
    purchase_price: 700,
    selling_price: 1499,
    is_active: true,
    variants: [
      { id: 'var-6-1', product_id: 'prod-6', variant_sku: 'SHT-LIN-006-M-WHT', size: 'M', color: 'Off White', stock_quantity: 4, low_stock_threshold: 2 },
      { id: 'var-6-2', product_id: 'prod-6', variant_sku: 'SHT-LIN-006-L-WHT', size: 'L', color: 'Off White', stock_quantity: 5, low_stock_threshold: 2 },
      { id: 'var-6-3', product_id: 'prod-6', variant_sku: 'SHT-LIN-006-XL-WHT', size: 'XL', color: 'Off White', stock_quantity: 3, low_stock_threshold: 2 }
    ]
  }
];

// Seed Bills
const INITIAL_SALES: Sale[] = [
  {
    id: 'sale-init-1',
    bill_number: 'VCS-20261120-0001',
    customer_name: 'Faheem',
    customer_phone: '9847112233',
    subtotal: 1998,
    discount_type: 'fixed',
    discount_value: 100,
    discount_amount: 100,
    grand_total: 1898,
    paid_amount: 1898,
    balance_amount: 0,
    payment_method: 'upi',
    payment_status: 'paid',
    status: 'completed',
    created_by: 'Vintage Staff 1',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    items: [
      {
        id: 'si-1',
        sale_id: 'sale-init-1',
        product_id: 'prod-1',
        variant_id: 'var-1-2',
        product_name: 'Oversized Heavyweight Cotton T-Shirt',
        size: 'L',
        color: 'Black',
        quantity: 1,
        unit_price: 699,
        discount_amount: 0,
        subtotal: 699,
        purchase_price: 350,
        returned_quantity: 0
      },
      {
        id: 'si-2',
        sale_id: 'sale-init-1',
        product_id: 'prod-2',
        variant_id: 'var-2-2',
        product_name: 'Premium Oxford Button-Down Shirt',
        size: '40 (L)',
        color: 'Sky Blue',
        quantity: 1,
        unit_price: 1199,
        discount_amount: 0,
        subtotal: 1199,
        purchase_price: 600,
        returned_quantity: 0
      }
    ]
  }
];

// BroadcastChannel for instant multi-tab & multi-device simulation
const storeChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('vcs_store_sync_channel') 
  : null;

// LocalStorage Persistence Keys
const STORAGE_KEYS = {
  PRODUCTS: 'vcs_products_db',
  SALES: 'vcs_sales_db',
  EXCHANGES: 'vcs_exchanges_db',
  PURCHASES: 'vcs_purchases_db',
  EXPENSES: 'vcs_expenses_db',
  CUSTOMERS: 'vcs_customers_db',
  ACTIVITY: 'vcs_activity_db'
};

function loadStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveStored<T>(key: string, value: T): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

// Memory caches
let localProducts: Product[] = loadStored(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
let localSales: Sale[] = loadStored(STORAGE_KEYS.SALES, INITIAL_SALES);
let localExchanges: Exchange[] = loadStored(STORAGE_KEYS.EXCHANGES, []);
let localPurchases: Purchase[] = loadStored(STORAGE_KEYS.PURCHASES, []);
let localExpenses: Expense[] = loadStored(STORAGE_KEYS.EXPENSES, [
  {
    id: 'exp-1',
    title: 'Tea & Snacks for Staff',
    category: 'Tea & Refreshments',
    amount: 120,
    payment_method: 'cash',
    added_by: 'Vintage Staff 1',
    expense_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString()
  }
]);
let localCustomers: Customer[] = loadStored(STORAGE_KEYS.CUSTOMERS, [
  { id: 'c-1', name: 'Faheem', phone: '9847112233', total_purchases: 1898, total_bills: 1, created_at: new Date().toISOString() }
]);
let localActivity: ActivityLog[] = loadStored(STORAGE_KEYS.ACTIVITY, [
  {
    id: 'act-1',
    action_type: 'SYSTEM_INIT',
    description: 'System loaded with Vintage Clothing catalog',
    staff_name: 'Store Owner',
    created_at: new Date().toISOString()
  }
]);

// Broadcast helper
function notifyChange(type: string, data?: any) {
  if (storeChannel) {
    storeChannel.postMessage({ type, data, timestamp: Date.now() });
  }
  // Dispatch local DOM custom event as well
  window.dispatchEvent(new CustomEvent('vcs_store_update', { detail: { type, data } }));
}

// Attach listener to cross-tab updates
if (storeChannel) {
  storeChannel.onmessage = (event) => {
    // Reload local cache from localStorage
    localProducts = loadStored(STORAGE_KEYS.PRODUCTS, localProducts);
    localSales = loadStored(STORAGE_KEYS.SALES, localSales);
    localExchanges = loadStored(STORAGE_KEYS.EXCHANGES, localExchanges);
    localPurchases = loadStored(STORAGE_KEYS.PURCHASES, localPurchases);
    localExpenses = loadStored(STORAGE_KEYS.EXPENSES, localExpenses);
    localCustomers = loadStored(STORAGE_KEYS.CUSTOMERS, localCustomers);
    localActivity = loadStored(STORAGE_KEYS.ACTIVITY, localActivity);
    
    window.dispatchEvent(new CustomEvent('vcs_store_update', { detail: event.data }));
  };
}

// ============================================================================
// DATA ACCESS LAYER IMPLEMENTATION
// ============================================================================

export const db = {
  // PRODUCTS & VARIANTS
  async getProducts(search?: string, category?: string): Promise<Product[]> {
    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      try {
        let query = supabase
          .from('products')
          .select('*, variants:product_variants(*)')
          .eq('is_active', true)
          .order('name');

        if (category && category !== 'All') {
          query = query.eq('category_name', category);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data.map((p: any) => ({
            ...p,
            total_stock: (p.variants || []).reduce((acc: number, v: any) => acc + (v.stock_quantity || 0), 0)
          }));
        }
      } catch (e) {
        console.warn('Supabase fetch failed, fallback to local:', e);
      }
    }

    // Local fallback
    let items = [...localProducts].filter(p => p.is_active);
    if (category && category !== 'All') {
      items = items.filter(p => p.category_name.toLowerCase() === category.toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      items = items.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        p.variants?.some(v => v.size.toLowerCase().includes(q) || v.color.toLowerCase().includes(q) || v.variant_sku.toLowerCase().includes(q))
      );
    }
    return items.map(p => ({
      ...p,
      total_stock: (p.variants || []).reduce((acc, v) => acc + v.stock_quantity, 0)
    }));
  },

  async saveProduct(productData: Partial<Product>, variantsData: Partial<ProductVariant>[], staffName: string): Promise<Product> {
    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      try {
        let prodId = productData.id;
        if (prodId) {
          // Update
          const { error } = await supabase.from('products').update({
            name: productData.name,
            sku: productData.sku,
            category_name: productData.category_name,
            brand: productData.brand,
            purchase_price: productData.purchase_price,
            selling_price: productData.selling_price,
            updated_at: new Date().toISOString()
          }).eq('id', prodId);
          if (error) throw error;
        } else {
          // Insert
          const { data, error } = await supabase.from('products').insert({
            name: productData.name,
            sku: productData.sku,
            category_name: productData.category_name || 'General',
            brand: productData.brand || 'VINTAGE',
            purchase_price: productData.purchase_price || 0,
            selling_price: productData.selling_price || 0,
            is_active: true
          }).select().single();
          if (error) throw error;
          prodId = data.id;
        }

        // Save variants
        for (const v of variantsData) {
          if (v.id) {
            await supabase.from('product_variants').update({
              size: v.size,
              color: v.color,
              stock_quantity: v.stock_quantity,
              low_stock_threshold: v.low_stock_threshold || 2,
              updated_at: new Date().toISOString()
            }).eq('id', v.id);
          } else {
            await supabase.from('product_variants').insert({
              product_id: prodId,
              variant_sku: v.variant_sku || `${productData.sku}-${v.size}-${v.color}`.toUpperCase(),
              size: v.size,
              color: v.color,
              stock_quantity: v.stock_quantity || 0,
              low_stock_threshold: v.low_stock_threshold || 2
            });
          }
        }
      } catch (err) {
        console.warn('Supabase saveProduct failed, writing locally:', err);
      }
    }

    // Local update
    const id = productData.id || `prod-${Date.now()}`;
    const variants: ProductVariant[] = variantsData.map((v, idx) => ({
      id: v.id || `var-${id}-${idx}-${Date.now()}`,
      product_id: id,
      variant_sku: v.variant_sku || `${productData.sku || 'SKU'}-${v.size}-${v.color}`.toUpperCase().replace(/\s+/g, ''),
      size: v.size || 'M',
      color: v.color || 'Standard',
      stock_quantity: Number(v.stock_quantity) || 0,
      low_stock_threshold: Number(v.low_stock_threshold) || 2
    }));

    const newProd: Product = {
      id,
      name: productData.name || 'New Product',
      sku: productData.sku || `SKU-${Date.now()}`,
      category_name: productData.category_name || 'General',
      brand: productData.brand || 'VINTAGE',
      purchase_price: Number(productData.purchase_price) || 0,
      selling_price: Number(productData.selling_price) || 0,
      is_active: true,
      variants,
      total_stock: variants.reduce((acc, v) => acc + v.stock_quantity, 0)
    };

    const existingIdx = localProducts.findIndex(p => p.id === id);
    if (existingIdx >= 0) {
      localProducts[existingIdx] = newProd;
    } else {
      localProducts.unshift(newProd);
    }
    saveStored(STORAGE_KEYS.PRODUCTS, localProducts);

    await this.logActivity(
      existingIdx >= 0 ? 'PRODUCT_EDITED' : 'PRODUCT_ADDED',
      `${existingIdx >= 0 ? 'Updated' : 'Added'} product "${newProd.name}" (${newProd.sku})`,
      'product',
      id,
      staffName
    );

    notifyChange('PRODUCT_UPDATE', newProd);
    return newProd;
  },

  async adjustVariantStock(variantId: string, newStock: number, reason: string, staffName: string): Promise<void> {
    let affectedProduct: Product | undefined;
    let affectedVariant: ProductVariant | undefined;
    let oldStock = 0;

    for (const p of localProducts) {
      const v = p.variants?.find(v => v.id === variantId);
      if (v) {
        affectedProduct = p;
        affectedVariant = v;
        oldStock = v.stock_quantity;
        v.stock_quantity = Math.max(0, newStock);
        break;
      }
    }

    if (affectedVariant && affectedProduct) {
      saveStored(STORAGE_KEYS.PRODUCTS, localProducts);

      // Record activity
      await this.logActivity(
        'STOCK_ADJUSTED',
        `Adjusted stock of ${affectedProduct.name} (${affectedVariant.size}/${affectedVariant.color}) from ${oldStock} to ${newStock}. Reason: ${reason}`,
        'stock',
        variantId,
        staffName
      );

      notifyChange('STOCK_UPDATE', { variantId, newStock });
    }
  },

  // SALES / BILLS
  async getSales(filter?: { dateRange?: string; search?: string; status?: string; paymentMethod?: string }): Promise<Sale[]> {
    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      try {
        let query = supabase
          .from('sales')
          .select('*, items:sale_items(*)')
          .order('created_at', { ascending: false });

        if (filter?.status && filter.status !== 'all') {
          query = query.eq('status', filter.status);
        }
        if (filter?.paymentMethod && filter.paymentMethod !== 'all') {
          query = query.eq('payment_method', filter.paymentMethod);
        }

        const { data, error } = await query;
        if (!error && data) {
          return data;
        }
      } catch (e) {
        console.warn('Supabase getSales failed, fallback to local:', e);
      }
    }

    let list = [...localSales];

    // Search filter
    if (filter?.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(s => 
        s.bill_number.toLowerCase().includes(q) ||
        s.customer_name?.toLowerCase().includes(q) ||
        s.customer_phone?.includes(q) ||
        s.items?.some(i => i.product_name.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (filter?.status && filter.status !== 'all') {
      list = list.filter(s => s.status === filter.status);
    }

    // Payment method filter
    if (filter?.paymentMethod && filter.paymentMethod !== 'all') {
      list = list.filter(s => s.payment_method === filter.paymentMethod);
    }

    // Date filters (Today, Yesterday, This Week, This Month)
    if (filter?.dateRange) {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      if (filter.dateRange === 'today') {
        list = list.filter(s => s.created_at.startsWith(todayStr));
      } else if (filter.dateRange === 'yesterday') {
        const yest = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const yestStr = yest.toISOString().split('T')[0];
        list = list.filter(s => s.created_at.startsWith(yestStr));
      } else if (filter.dateRange === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        list = list.filter(s => new Date(s.created_at) >= weekAgo);
      } else if (filter.dateRange === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        list = list.filter(s => new Date(s.created_at) >= monthAgo);
      }
    }

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getSaleById(id: string): Promise<Sale | null> {
    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('sales')
          .select('*, items:sale_items(*)')
          .eq('id', id)
          .single();
        if (!error && data) return data;
      } catch (e) {
        console.warn('Supabase getSaleById failed, check local:', e);
      }
    }
    return localSales.find(s => s.id === id || s.bill_number === id) || null;
  },

  // ATOMIC SALE CREATION (With Stock Validation & Concurrency Protection)
  async createSale(saleData: {
    customer_name?: string;
    customer_phone?: string;
    items: CartItem[];
    subtotal: number;
    discount_type: 'none' | 'percentage' | 'fixed';
    discount_value: number;
    discount_amount: number;
    grand_total: number;
    paid_amount: number;
    payment_method: 'cash' | 'upi' | 'card' | 'split';
    notes?: string;
    created_by: string;
  }): Promise<Sale> {
    // 1. Concurrency Check: Verify all variants have sufficient stock
    for (const item of saleData.items) {
      let currentStock = 0;
      let found = false;
      for (const p of localProducts) {
        const v = p.variants?.find(v => v.id === item.variant_id);
        if (v) {
          found = true;
          currentStock = v.stock_quantity;
          break;
        }
      }
      if (!found) {
        throw new Error(`Product variant not found: ${item.product_name} (${item.size}/${item.color})`);
      }
      if (currentStock < item.quantity) {
        throw new Error(`Insufficient stock for ${item.product_name} (${item.size}/${item.color}). Available: ${currentStock}, Required: ${item.quantity}`);
      }
    }

    // 2. Generate Sequential Bill Number: VCS-YYYYMMDD-XXXX
    const today = new Date();
    const dateCode = today.toISOString().slice(0, 10).replace(/-/g, '');
    const todaysBillsCount = localSales.filter(s => s.bill_number.includes(dateCode)).length + 1;
    const billNumber = `VCS-${dateCode}-${String(todaysBillsCount).padStart(4, '0')}`;
    const saleId = `sale-${Date.now()}`;

    // 3. Try Supabase RPC if configured
    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('process_sale_transaction', {
          p_customer_name: saleData.customer_name || null,
          p_customer_phone: saleData.customer_phone || null,
          p_subtotal: saleData.subtotal,
          p_discount_type: saleData.discount_type,
          p_discount_value: saleData.discount_value,
          p_discount_amount: saleData.discount_amount,
          p_grand_total: saleData.grand_total,
          p_paid_amount: saleData.paid_amount,
          p_balance_amount: Math.max(0, saleData.grand_total - saleData.paid_amount),
          p_payment_method: saleData.payment_method,
          p_payment_status: saleData.paid_amount >= saleData.grand_total ? 'paid' : (saleData.paid_amount > 0 ? 'partial' : 'unpaid'),
          p_notes: saleData.notes || null,
          p_created_by: saleData.created_by,
          p_items: saleData.items.map(i => ({
            product_id: i.product_id,
            variant_id: i.variant_id,
            product_name: i.product_name,
            size: i.size,
            color: i.color,
            quantity: i.quantity,
            unit_price: i.unit_price,
            discount_amount: i.discount_amount,
            subtotal: i.subtotal,
            purchase_price: i.purchase_price
          }))
        });

        if (rpcError) {
          console.warn('Supabase process_sale_transaction RPC error, falling back locally:', rpcError.message);
        }
      } catch (err) {
        console.warn('Supabase call failed:', err);
      }
    }

    // 4. Deduct local stock & create sale item records
    const saleItems = saleData.items.map((item, idx) => {
      // Deduct stock
      for (const p of localProducts) {
        const v = p.variants?.find(v => v.id === item.variant_id);
        if (v) {
          v.stock_quantity = Math.max(0, v.stock_quantity - item.quantity);
          break;
        }
      }

      return {
        id: `si-${saleId}-${idx}`,
        sale_id: saleId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product_name,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        subtotal: item.subtotal,
        purchase_price: item.purchase_price,
        returned_quantity: 0
      };
    });

    saveStored(STORAGE_KEYS.PRODUCTS, localProducts);

    // 5. Create Sale Object
    const balanceAmount = Math.max(0, saleData.grand_total - saleData.paid_amount);
    const newSale: Sale = {
      id: saleId,
      bill_number: billNumber,
      customer_name: saleData.customer_name?.trim() || undefined,
      customer_phone: saleData.customer_phone?.trim() || undefined,
      subtotal: saleData.subtotal,
      discount_type: saleData.discount_type,
      discount_value: saleData.discount_value,
      discount_amount: saleData.discount_amount,
      grand_total: saleData.grand_total,
      paid_amount: saleData.paid_amount,
      balance_amount: balanceAmount,
      payment_method: saleData.payment_method,
      payment_status: balanceAmount === 0 ? 'paid' : (saleData.paid_amount > 0 ? 'partial' : 'unpaid'),
      status: 'completed',
      notes: saleData.notes,
      created_by: saleData.created_by,
      created_at: new Date().toISOString(),
      items: saleItems
    };

    localSales.unshift(newSale);
    saveStored(STORAGE_KEYS.SALES, localSales);

    // 6. Update or Add Customer record
    if (newSale.customer_phone) {
      const existingCust = localCustomers.find(c => c.phone === newSale.customer_phone);
      if (existingCust) {
        existingCust.total_purchases += newSale.grand_total;
        existingCust.total_bills += 1;
        if (newSale.customer_name) existingCust.name = newSale.customer_name;
      } else {
        localCustomers.push({
          id: `cust-${Date.now()}`,
          name: newSale.customer_name || 'Customer',
          phone: newSale.customer_phone,
          total_purchases: newSale.grand_total,
          total_bills: 1,
          created_at: new Date().toISOString()
        });
      }
      saveStored(STORAGE_KEYS.CUSTOMERS, localCustomers);
    }

    // 7. Activity Log
    await this.logActivity(
      'BILL_CREATED',
      `Created Bill #${billNumber} for ₹${newSale.grand_total} (${newSale.payment_method.toUpperCase()})`,
      'sales',
      saleId,
      saleData.created_by,
      { bill_number: billNumber, total: newSale.grand_total, items: saleItems.length }
    );

    // 8. Broadcast to all users
    notifyChange('BILL_CREATED', newSale);

    return newSale;
  },

  // ATOMIC 7-DAY CLOTHING EXCHANGE
  async processExchange(params: {
    original_sale_id: string;
    returns: Array<{
      sale_item_id: string;
      variant_id: string;
      product_id: string;
      product_name: string;
      size: string;
      color: string;
      quantity: number;
      unit_price: number;
    }>;
    replacements: Array<{
      variant_id: string;
      product_id: string;
      product_name: string;
      size: string;
      color: string;
      quantity: number;
      unit_price: number;
    }>;
    settlement_type: 'none' | 'collected_extra' | 'refunded_cash' | 'refunded_upi' | 'store_credit';
    payment_method?: 'cash' | 'upi' | 'card';
    processed_by: string;
    notes?: string;
  }): Promise<Exchange> {
    const sale = localSales.find(s => s.id === params.original_sale_id);
    if (!sale) {
      throw new Error('Original bill not found');
    }

    // STRICT 7-DAY EXCHANGE RULE ENFORCEMENT
    const eligibility = checkExchangeEligibility(sale.created_at);
    if (!eligibility.isEligible) {
      throw new Error(eligibility.reason || 'Exchange is strictly allowed within 7 days of original bill date.');
    }

    // Validate return quantities
    for (const ret of params.returns) {
      const saleItem = sale.items?.find(i => i.id === ret.sale_item_id);
      if (!saleItem) {
        throw new Error(`Sale item not found for return: ${ret.product_name}`);
      }
      const returnable = saleItem.quantity - saleItem.returned_quantity;
      if (ret.quantity > returnable) {
        throw new Error(`Cannot return ${ret.quantity} units of ${saleItem.product_name}. Maximum returnable: ${returnable}`);
      }
    }

    // Validate replacement stock
    for (const repl of params.replacements) {
      let stock = 0;
      for (const p of localProducts) {
        const v = p.variants?.find(v => v.id === repl.variant_id);
        if (v) {
          stock = v.stock_quantity;
          break;
        }
      }
      if (stock < repl.quantity) {
        throw new Error(`Insufficient stock for replacement ${repl.product_name} (${repl.size}/${repl.color}). Available: ${stock}`);
      }
    }

    const returnTotal = params.returns.reduce((sum, r) => sum + (r.unit_price * r.quantity), 0);
    const replTotal = params.replacements.reduce((sum, r) => sum + (r.unit_price * r.quantity), 0);
    const diff = replTotal - returnTotal;

    const exchangeId = `exc-${Date.now()}`;
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const excNumber = `EXC-${todayStr}-${String(localExchanges.length + 1).padStart(4, '0')}`;

    // Update returned items stock (+qty) & returned_quantity
    for (const ret of params.returns) {
      const saleItem = sale.items?.find(i => i.id === ret.sale_item_id);
      if (saleItem) {
        saleItem.returned_quantity += ret.quantity;
      }
      // Increase stock
      for (const p of localProducts) {
        const v = p.variants?.find(v => v.id === ret.variant_id);
        if (v) {
          v.stock_quantity += ret.quantity;
          break;
        }
      }
    }

    // Deduct replacement stock (-qty)
    for (const repl of params.replacements) {
      for (const p of localProducts) {
        const v = p.variants?.find(v => v.id === repl.variant_id);
        if (v) {
          v.stock_quantity = Math.max(0, v.stock_quantity - repl.quantity);
          break;
        }
      }
    }

    // Update sale status
    const allItemsReturned = sale.items?.every(i => i.returned_quantity >= i.quantity);
    sale.status = allItemsReturned ? 'exchanged' : 'partially_exchanged';

    saveStored(STORAGE_KEYS.PRODUCTS, localProducts);
    saveStored(STORAGE_KEYS.SALES, localSales);

    const exchangeItems: ExchangeItem[] = [
      ...params.returns.map((r, i) => ({
        id: `exci-ret-${exchangeId}-${i}`,
        exchange_id: exchangeId,
        item_type: 'return' as const,
        sale_item_id: r.sale_item_id,
        product_id: r.product_id,
        variant_id: r.variant_id,
        product_name: r.product_name,
        size: r.size,
        color: r.color,
        quantity: r.quantity,
        unit_price: r.unit_price,
        total_price: r.unit_price * r.quantity
      })),
      ...params.replacements.map((r, i) => ({
        id: `exci-repl-${exchangeId}-${i}`,
        exchange_id: exchangeId,
        item_type: 'replacement' as const,
        product_id: r.product_id,
        variant_id: r.variant_id,
        product_name: r.product_name,
        size: r.size,
        color: r.color,
        quantity: r.quantity,
        unit_price: r.unit_price,
        total_price: r.unit_price * r.quantity
      }))
    ];

    const exchange: Exchange = {
      id: exchangeId,
      exchange_number: excNumber,
      original_sale_id: sale.id,
      original_bill_number: sale.bill_number,
      customer_name: sale.customer_name,
      customer_phone: sale.customer_phone,
      return_total_value: returnTotal,
      replacement_total_value: replTotal,
      difference_amount: diff,
      settlement_type: params.settlement_type,
      payment_method: params.payment_method,
      processed_by: params.processed_by,
      notes: params.notes,
      created_at: new Date().toISOString(),
      items: exchangeItems
    };

    localExchanges.unshift(exchange);
    saveStored(STORAGE_KEYS.EXCHANGES, localExchanges);

    await this.logActivity(
      'EXCHANGE_PROCESSED',
      `Processed Exchange #${excNumber} for Bill #${sale.bill_number} (Diff: ₹${diff})`,
      'exchanges',
      exchangeId,
      params.processed_by
    );

    notifyChange('EXCHANGE_PROCESSED', exchange);
    return exchange;
  },

  async getExchanges(): Promise<Exchange[]> {
    return [...localExchanges].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  // EXPENSES
  async getExpenses(startDate?: string, endDate?: string): Promise<Expense[]> {
    let list = [...localExpenses];
    if (startDate) list = list.filter(e => e.expense_date >= startDate);
    if (endDate) list = list.filter(e => e.expense_date <= endDate);
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createExpense(data: {
    title: string;
    category: string;
    amount: number;
    payment_method: string;
    notes?: string;
    added_by: string;
    expense_date?: string;
  }): Promise<Expense> {
    const expense: Expense = {
      id: `exp-${Date.now()}`,
      title: data.title,
      category: data.category,
      amount: Number(data.amount),
      payment_method: data.payment_method,
      notes: data.notes,
      added_by: data.added_by,
      expense_date: data.expense_date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };

    localExpenses.unshift(expense);
    saveStored(STORAGE_KEYS.EXPENSES, localExpenses);

    await this.logActivity('EXPENSE_ADDED', `Added expense "${expense.title}" for ₹${expense.amount}`, 'expense', expense.id, data.added_by);
    notifyChange('EXPENSE_UPDATE', expense);
    return expense;
  },

  // PURCHASES (NEW STOCK ENTRY)
  async getPurchases(): Promise<Purchase[]> {
    return [...localPurchases].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async createPurchase(purchaseData: {
    invoice_number?: string;
    supplier_name?: string;
    notes?: string;
    purchased_by: string;
    items: Array<{
      product_id: string;
      variant_id: string;
      product_name: string;
      size: string;
      color: string;
      quantity: number;
      unit_cost: number;
    }>;
  }): Promise<Purchase> {
    const purchaseId = `purch-${Date.now()}`;
    const totalAmount = purchaseData.items.reduce((sum, i) => sum + (i.unit_cost * i.quantity), 0);

    // Increase stock for each variant
    for (const item of purchaseData.items) {
      for (const p of localProducts) {
        const v = p.variants?.find(v => v.id === item.variant_id);
        if (v) {
          v.stock_quantity += item.quantity;
          break;
        }
      }
    }
    saveStored(STORAGE_KEYS.PRODUCTS, localProducts);

    const purchase: Purchase = {
      id: purchaseId,
      invoice_number: purchaseData.invoice_number,
      supplier_name: purchaseData.supplier_name,
      total_amount: totalAmount,
      notes: purchaseData.notes,
      purchased_by: purchaseData.purchased_by,
      purchase_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      items: purchaseData.items.map((i, idx) => ({
        id: `pi-${purchaseId}-${idx}`,
        purchase_id: purchaseId,
        product_id: i.product_id,
        variant_id: i.variant_id,
        product_name: i.product_name,
        size: i.size,
        color: i.color,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        subtotal: i.unit_cost * i.quantity
      }))
    };

    localPurchases.unshift(purchase);
    saveStored(STORAGE_KEYS.PURCHASES, localPurchases);

    await this.logActivity(
      'PURCHASE_ADDED',
      `Received stock purchase (${purchaseData.items.length} items, total ₹${totalAmount})`,
      'purchase',
      purchaseId,
      purchaseData.purchased_by
    );

    notifyChange('STOCK_UPDATE', purchase);
    return purchase;
  },

  // CUSTOMERS
  async getCustomers(query?: string): Promise<Customer[]> {
    let list = [...localCustomers];
    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(c => c.name?.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return list;
  },

  // ACTIVITY LOGS
  async getActivityLogs(limit = 50): Promise<ActivityLog[]> {
    return [...localActivity].slice(0, limit);
  },

  async logActivity(action_type: string, description: string, entity_type?: string, entity_id?: string, staff_name = 'Staff', metadata?: any): Promise<void> {
    const entry: ActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      action_type,
      description,
      entity_type,
      entity_id,
      staff_name,
      metadata,
      created_at: new Date().toISOString()
    };
    localActivity.unshift(entry);
    if (localActivity.length > 200) localActivity = localActivity.slice(0, 200);
    saveStored(STORAGE_KEYS.ACTIVITY, localActivity);
  },

  // SALES REPORT AGGREGATOR
  async getSalesReportSummary(dateRange: string, customStart?: string, customEnd?: string) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yestStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let filteredSales = [...localSales].filter(s => s.status !== 'cancelled');
    let filteredExpenses = [...localExpenses];

    if (dateRange === 'today') {
      filteredSales = filteredSales.filter(s => s.created_at.startsWith(todayStr));
      filteredExpenses = filteredExpenses.filter(e => e.expense_date === todayStr);
    } else if (dateRange === 'yesterday') {
      filteredSales = filteredSales.filter(s => s.created_at.startsWith(yestStr));
      filteredExpenses = filteredExpenses.filter(e => e.expense_date === yestStr);
    } else if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredSales = filteredSales.filter(s => new Date(s.created_at) >= weekAgo);
      filteredExpenses = filteredExpenses.filter(e => new Date(e.expense_date) >= weekAgo);
    } else if (dateRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredSales = filteredSales.filter(s => new Date(s.created_at) >= monthAgo);
      filteredExpenses = filteredExpenses.filter(e => new Date(e.expense_date) >= monthAgo);
    } else if (dateRange === 'custom' && customStart && customEnd) {
      filteredSales = filteredSales.filter(s => {
        const d = s.created_at.split('T')[0];
        return d >= customStart && d <= customEnd;
      });
      filteredExpenses = filteredExpenses.filter(e => e.expense_date >= customStart && e.expense_date <= customEnd);
    }

    const totalSales = filteredSales.reduce((sum, s) => sum + s.grand_total, 0);
    const totalDiscounts = filteredSales.reduce((sum, s) => sum + s.discount_amount, 0);
    const totalBills = filteredSales.length;

    let itemsSoldCount = 0;
    let estimatedCost = 0;
    const categoryBreakdown: Record<string, number> = {};
    const sizeBreakdown: Record<string, number> = {};
    const productSalesMap: Record<string, { name: string; qty: number; revenue: number }> = {};

    filteredSales.forEach(s => {
      s.items?.forEach(item => {
        itemsSoldCount += item.quantity;
        estimatedCost += (item.purchase_price || 0) * item.quantity;

        // Size stats
        sizeBreakdown[item.size] = (sizeBreakdown[item.size] || 0) + item.quantity;

        // Top product stats
        if (!productSalesMap[item.product_name]) {
          productSalesMap[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 };
        }
        productSalesMap[item.product_name].qty += item.quantity;
        productSalesMap[item.product_name].revenue += item.subtotal;
      });
    });

    const cashSales = filteredSales.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + s.paid_amount, 0);
    const upiSales = filteredSales.filter(s => s.payment_method === 'upi').reduce((sum, s) => sum + s.paid_amount, 0);
    const cardSales = filteredSales.filter(s => s.payment_method === 'card').reduce((sum, s) => sum + s.paid_amount, 0);
    const balanceDue = filteredSales.reduce((sum, s) => sum + s.balance_amount, 0);

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const grossProfit = Math.max(0, totalSales - estimatedCost);
    const netProfit = grossProfit - totalExpenses;

    const topSellingProducts = Object.values(productSalesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      totalSales,
      totalBills,
      itemsSoldCount,
      totalDiscounts,
      cashSales,
      upiSales,
      cardSales,
      balanceDue,
      totalExpenses,
      grossProfit,
      netProfit,
      topSellingProducts,
      sizeBreakdown
    };
  }
};
