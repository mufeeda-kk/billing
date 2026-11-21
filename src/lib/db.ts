import { 
  Product, ProductVariant, Sale, CartItem, Exchange, ExchangeItem,
  Purchase, Expense, Customer, ActivityLog, StaffProfile
} from '../types';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { checkExchangeEligibility } from './date';

// BroadcastChannel for instant multi-tab sync on the same device
const storeChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('vcs_store_sync_channel') 
  : null;

// Helper to notify other tabs on this device and components in current window
function notifyChange(type: string, data?: any) {
  if (storeChannel) {
    try {
      storeChannel.postMessage({ type, data, timestamp: Date.now() });
    } catch (e) {
      // Ignore broadcast errors
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vcs_store_update', { detail: { type, data } }));
  }
}

// Attach listener to cross-tab updates
if (storeChannel) {
  storeChannel.onmessage = (event) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vcs_store_update', { detail: event.data }));
    }
  };
}

function ensureSupabase() {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    throw new Error('Supabase cloud database is not connected. Please enter your Supabase URL and Key in Settings.');
  }
  return supabase;
}

// ============================================================================
// AUTHORITATIVE SUPABASE DATA ACCESS LAYER (SHARED FOR ALL USERS)
// ============================================================================

export const db = {
  // --------------------------------------------------------------------------
  // PRODUCTS & VARIANTS
  // --------------------------------------------------------------------------
  async getProducts(search?: string, category?: string, includeArchived = false): Promise<Product[]> {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) {
      return [];
    }

    try {
      let query = supabase
        .from('products')
        .select('*, variants:product_variants(*)')
        .order('name');

      if (!includeArchived) {
        query = query.eq('is_active', true).eq('is_archived', false);
      }

      if (category && category !== 'All') {
        query = query.ilike('category_name', category);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Supabase getProducts error:', error);
        throw new Error(`Cloud database error: ${error.message}`);
      }

      let items: Product[] = (data || []).map((p: any) => ({
        ...p,
        total_stock: (p.variants || []).reduce((acc: number, v: any) => acc + (v.stock_quantity || 0), 0)
      }));

      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        items = items.filter(p => 
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category_name.toLowerCase().includes(q) ||
          p.variants?.some((v: any) => 
            v.size?.toLowerCase().includes(q) || 
            v.color?.toLowerCase().includes(q) || 
            v.variant_sku?.toLowerCase().includes(q)
          )
        );
      }

      return items;
    } catch (err: any) {
      console.error('Error fetching products:', err);
      throw err;
    }
  },

  async getProductById(id: string): Promise<Product | null> {
    const supabase = ensureSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return {
      ...data,
      total_stock: (data.variants || []).reduce((acc: number, v: any) => acc + (v.stock_quantity || 0), 0)
    };
  },

  async saveSimpleProduct(
    productData: {
      id?: string;
      name: string;
      category_name: string;
      selling_price: number;
      purchase_price?: number;
      total_stock: number;
      low_stock_threshold?: number;
      is_active?: boolean;
    },
    staffName: string
  ): Promise<Product> {
    const supabase = ensureSupabase();
    const isEdit = Boolean(productData.id);
    const sku = `VCS-${Math.floor(1000 + Math.random() * 9000)}`;

    let prodId = productData.id;

    if (isEdit && prodId) {
      // 1. Update existing product
      const { data: updatedProd, error: updateErr } = await supabase
        .from('products')
        .update({
          name: productData.name.trim(),
          category_name: productData.category_name.trim() || 'General',
          selling_price: productData.selling_price,
          purchase_price: productData.purchase_price || 0,
          is_active: productData.is_active ?? true,
          updated_at: new Date().toISOString()
        })
        .eq('id', prodId)
        .select()
        .single();

      if (updateErr) {
        throw new Error(`Failed to update product: ${updateErr.message}`);
      }

      // 2. Update primary variant stock
      const { data: existingVars, error: varFetchErr } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', prodId);

      if (varFetchErr) {
        throw new Error(`Failed to fetch variants: ${varFetchErr.message}`);
      }

      if (existingVars && existingVars.length > 0) {
        const primaryVar = existingVars[0];
        const { error: varUpErr } = await supabase
          .from('product_variants')
          .update({
            stock_quantity: Math.max(0, productData.total_stock),
            low_stock_threshold: productData.low_stock_threshold || 5,
            updated_at: new Date().toISOString()
          })
          .eq('id', primaryVar.id);

        if (varUpErr) {
          throw new Error(`Failed to update variant stock: ${varUpErr.message}`);
        }
      } else {
        const { error: varInErr } = await supabase
          .from('product_variants')
          .insert({
            product_id: prodId,
            variant_sku: `${updatedProd.sku || sku}-STD`,
            size: 'Regular',
            color: 'Standard',
            stock_quantity: Math.max(0, productData.total_stock),
            low_stock_threshold: productData.low_stock_threshold || 5
          });

        if (varInErr) {
          throw new Error(`Failed to create product variant: ${varInErr.message}`);
        }
      }
    } else {
      // Insert new product
      const { data: newProd, error: insertErr } = await supabase
        .from('products')
        .insert({
          name: productData.name.trim(),
          sku: sku,
          category_name: productData.category_name.trim() || 'General',
          brand: 'VINTAGE',
          purchase_price: productData.purchase_price || 0,
          selling_price: productData.selling_price,
          is_active: true,
          is_archived: false
        })
        .select()
        .single();

      if (insertErr || !newProd) {
        throw new Error(`Failed to add product: ${insertErr?.message || 'Database insert failed'}`);
      }

      prodId = newProd.id;

      // Insert primary variant
      const { error: varErr } = await supabase
        .from('product_variants')
        .insert({
          product_id: prodId,
          variant_sku: `${sku}-STD`,
          size: 'Regular',
          color: 'Standard',
          stock_quantity: Math.max(0, productData.total_stock),
          low_stock_threshold: productData.low_stock_threshold || 5
        });

      if (varErr) {
        throw new Error(`Failed to save variant stock: ${varErr.message}`);
      }
    }

    // Fetch full saved product with variants from Supabase
    const { data: savedData, error: fetchErr } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('id', prodId)
      .single();

    if (fetchErr || !savedData) {
      throw new Error(`Failed to retrieve saved product: ${fetchErr?.message || 'Not found'}`);
    }

    const finalProduct: Product = {
      ...savedData,
      total_stock: (savedData.variants || []).reduce((acc: number, v: any) => acc + (v.stock_quantity || 0), 0)
    };

    // Log activity
    await this.logActivity(
      isEdit ? 'PRODUCT_EDITED' : 'PRODUCT_ADDED',
      `${isEdit ? 'Updated' : 'Added'} product "${finalProduct.name}" (Stock: ${finalProduct.total_stock}, Price: ₹${finalProduct.selling_price})`,
      'product',
      prodId,
      staffName
    );

    notifyChange('PRODUCT_UPDATE', finalProduct);
    return finalProduct;
  },

  async saveProduct(
    productData: Partial<Product>, 
    variantsData: Partial<ProductVariant>[], 
    staffName: string,
    stockChangeReason?: string
  ): Promise<Product> {
    const supabase = ensureSupabase();
    let prodId = productData.id;
    const isEdit = Boolean(prodId);
    const sku = productData.sku || `VCS-${Math.floor(1000 + Math.random() * 9000)}`;

    if (isEdit && prodId) {
      // Update product
      const { error: updateErr } = await supabase
        .from('products')
        .update({
          name: productData.name?.trim(),
          sku: sku,
          category_name: productData.category_name?.trim() || 'General',
          brand: productData.brand || 'VINTAGE',
          purchase_price: productData.purchase_price || 0,
          selling_price: productData.selling_price || 0,
          is_active: productData.is_active ?? true,
          is_archived: productData.is_archived ?? false,
          updated_at: new Date().toISOString()
        })
        .eq('id', prodId);

      if (updateErr) {
        throw new Error(`Failed to update product: ${updateErr.message}`);
      }

      // Update or insert variants
      for (const v of variantsData) {
        if (v.id) {
          await supabase.from('product_variants').update({
            size: v.size || 'Regular',
            color: v.color || 'Standard',
            stock_quantity: Math.max(0, Number(v.stock_quantity) || 0),
            low_stock_threshold: v.low_stock_threshold || 2,
            updated_at: new Date().toISOString()
          }).eq('id', v.id);
        } else {
          await supabase.from('product_variants').insert({
            product_id: prodId,
            variant_sku: v.variant_sku || `${sku}-${v.size}-${v.color}`.toUpperCase(),
            size: v.size || 'Regular',
            color: v.color || 'Standard',
            stock_quantity: Math.max(0, Number(v.stock_quantity) || 0),
            low_stock_threshold: v.low_stock_threshold || 2
          });
        }
      }
    } else {
      // Insert product
      const { data: newProd, error: insertErr } = await supabase
        .from('products')
        .insert({
          name: productData.name?.trim() || 'New Product',
          sku: sku,
          category_name: productData.category_name?.trim() || 'General',
          brand: productData.brand || 'VINTAGE',
          purchase_price: productData.purchase_price || 0,
          selling_price: productData.selling_price || 0,
          is_active: productData.is_active ?? true,
          is_archived: false
        })
        .select()
        .single();

      if (insertErr || !newProd) {
        throw new Error(`Failed to create product: ${insertErr?.message}`);
      }

      prodId = newProd.id;

      for (const v of variantsData) {
        await supabase.from('product_variants').insert({
          product_id: prodId,
          variant_sku: v.variant_sku || `${sku}-${v.size || 'REG'}-${v.color || 'STD'}`.toUpperCase(),
          size: v.size || 'Regular',
          color: v.color || 'Standard',
          stock_quantity: Math.max(0, Number(v.stock_quantity) || 0),
          low_stock_threshold: v.low_stock_threshold || 2
        });
      }
    }

    const { data: savedData, error: fetchErr } = await supabase
      .from('products')
      .select('*, variants:product_variants(*)')
      .eq('id', prodId)
      .single();

    if (fetchErr || !savedData) {
      throw new Error(`Failed to load saved product: ${fetchErr?.message}`);
    }

    const finalProduct: Product = {
      ...savedData,
      total_stock: (savedData.variants || []).reduce((acc: number, v: any) => acc + (v.stock_quantity || 0), 0)
    };

    await this.logActivity(
      isEdit ? 'PRODUCT_EDITED' : 'PRODUCT_ADDED',
      `${isEdit ? 'Updated' : 'Added'} product "${finalProduct.name}" (${finalProduct.sku})`,
      'product',
      prodId,
      staffName
    );

    notifyChange('PRODUCT_UPDATE', finalProduct);
    return finalProduct;
  },

  async deleteOrArchiveProduct(productId: string, staffName: string): Promise<{ action: 'deleted' | 'archived'; message: string }> {
    const supabase = ensureSupabase();

    // Check if stored procedure exists
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('delete_or_archive_product', {
        p_product_id: productId,
        p_performed_by: staffName
      });

      if (!rpcErr && rpcData) {
        notifyChange('PRODUCT_UPDATE', { id: productId, deleted: true });
        return {
          action: rpcData.action || 'archived',
          message: rpcData.message || 'Product processed successfully.'
        };
      }
    } catch {
      // Fallback to direct check
    }

    // Direct check for history in sales, purchases, exchanges
    const [salesRes, purchRes, excRes] = await Promise.all([
      supabase.from('sale_items').select('id').eq('product_id', productId).limit(1),
      supabase.from('purchase_items').select('id').eq('product_id', productId).limit(1),
      supabase.from('exchange_items').select('id').eq('product_id', productId).limit(1)
    ]);

    const hasSales = Boolean(salesRes.data && salesRes.data.length > 0);
    const hasPurch = Boolean(purchRes.data && purchRes.data.length > 0);
    const hasExc = Boolean(excRes.data && excRes.data.length > 0);
    const hasHistory = hasSales || hasPurch || hasExc;

    if (hasHistory) {
      // Archive / soft-delete
      const { error: archErr } = await supabase
        .from('products')
        .update({
          is_active: false,
          is_archived: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (archErr) throw new Error(`Failed to archive product: ${archErr.message}`);

      await this.logActivity(
        'PRODUCT_ARCHIVED',
        'Archived product because it has past transaction history. Bills and reports remain preserved.',
        'product',
        productId,
        staffName
      );

      notifyChange('PRODUCT_UPDATE', { id: productId, archived: true });
      return {
        action: 'archived',
        message: 'Product has transaction history and was safely archived. It will not appear in new billing.'
      };
    } else {
      // Permanent delete
      await supabase.from('product_variants').delete().eq('product_id', productId);
      const { error: delErr } = await supabase.from('products').delete().eq('id', productId);
      if (delErr) throw new Error(`Failed to delete product: ${delErr.message}`);

      await this.logActivity(
        'PRODUCT_DELETED',
        'Permanently deleted unused product.',
        'product',
        productId,
        staffName
      );

      notifyChange('PRODUCT_UPDATE', { id: productId, deleted: true });
      return {
        action: 'deleted',
        message: 'Product permanently deleted.'
      };
    }
  },

  async adjustVariantStock(variantId: string, newStock: number, reason: string, staffName: string): Promise<void> {
    const supabase = ensureSupabase();

    const { data: vData, error: fetchErr } = await supabase
      .from('product_variants')
      .select('*, product:products(*)')
      .eq('id', variantId)
      .single();

    if (fetchErr || !vData) {
      throw new Error(`Variant not found: ${fetchErr?.message || ''}`);
    }

    const oldStock = vData.stock_quantity;
    const clampedStock = Math.max(0, newStock);

    const { error: upErr } = await supabase
      .from('product_variants')
      .update({
        stock_quantity: clampedStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', variantId);

    if (upErr) throw new Error(`Failed to adjust stock: ${upErr.message}`);

    await this.logActivity(
      'STOCK_ADJUSTED',
      `Adjusted stock of ${vData.product?.name || 'Item'} (${vData.size}/${vData.color}) from ${oldStock} to ${clampedStock}. Reason: ${reason}`,
      'stock',
      variantId,
      staffName
    );

    notifyChange('STOCK_UPDATE', { variantId, newStock: clampedStock });
  },

  // --------------------------------------------------------------------------
  // SALES / BILLS
  // --------------------------------------------------------------------------
  async getSales(filter?: { dateRange?: string; search?: string; status?: string; paymentMethod?: string }): Promise<Sale[]> {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) {
      return [];
    }

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
      if (error) {
        console.error('Supabase getSales error:', error);
        throw new Error(`Failed to load sales: ${error.message}`);
      }

      let list: Sale[] = data || [];

      // Filter in memory for search & dateRange
      if (filter?.search && filter.search.trim()) {
        const q = filter.search.toLowerCase().trim();
        list = list.filter(s => 
          s.bill_number.toLowerCase().includes(q) ||
          s.customer_name?.toLowerCase().includes(q) ||
          s.customer_phone?.includes(q) ||
          s.items?.some(i => i.product_name.toLowerCase().includes(q))
        );
      }

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

      return list;
    } catch (err: any) {
      console.error('Error fetching sales:', err);
      throw err;
    }
  },

  async getSaleById(id: string): Promise<Sale | null> {
    const supabase = ensureSupabase();
    const { data, error } = await supabase
      .from('sales')
      .select('*, items:sale_items(*)')
      .or(`id.eq.${id},bill_number.eq.${id}`)
      .single();

    if (error || !data) return null;
    return data;
  },

  // ATOMIC SALE CREATION
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
    const supabase = ensureSupabase();

    // 1. Live concurrency check: Query actual stock from Supabase for all items
    const variantIds = saleData.items.map(i => i.variant_id);
    const { data: dbVariants, error: varErr } = await supabase
      .from('product_variants')
      .select('id, stock_quantity, size, color')
      .in('id', variantIds);

    if (varErr) {
      throw new Error(`Failed to check stock: ${varErr.message}`);
    }

    for (const item of saleData.items) {
      const v = dbVariants?.find(v => v.id === item.variant_id);
      if (!v) {
        throw new Error(`Item "${item.product_name}" is no longer available in the database.`);
      }
      if (v.stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for "${item.product_name}". Only ${v.stock_quantity} left in store, but ${item.quantity} requested.`);
      }
    }

    // 2. Try atomic stored procedure if installed
    try {
      const { data: rpcResult, error: rpcErr } = await supabase.rpc('process_sale_transaction', {
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

      if (!rpcErr && rpcResult && rpcResult.sale_id) {
        const { data: dbSale } = await supabase
          .from('sales')
          .select('*, items:sale_items(*)')
          .eq('id', rpcResult.sale_id)
          .single();

        if (dbSale) {
          notifyChange('BILL_CREATED', dbSale);
          return dbSale;
        }
      }
    } catch {
      // Fall through to direct table transaction
    }

    // 3. Direct table transaction on Supabase
    const today = new Date();
    const dateCode = today.toISOString().slice(0, 10).replace(/-/g, '');
    const { count } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .ilike('bill_number', `VCS-${dateCode}%`);

    const billNumber = `VCS-${dateCode}-${String((count || 0) + 1).padStart(4, '0')}`;
    const balanceAmount = Math.max(0, saleData.grand_total - saleData.paid_amount);

    // Insert sale
    const { data: newSaleRow, error: saleErr } = await supabase
      .from('sales')
      .insert({
        bill_number: billNumber,
        customer_name: saleData.customer_name?.trim() || null,
        customer_phone: saleData.customer_phone?.trim() || null,
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
        notes: saleData.notes || null,
        created_by: saleData.created_by
      })
      .select()
      .single();

    if (saleErr || !newSaleRow) {
      throw new Error(`Failed to record bill in database: ${saleErr?.message || 'Database error'}`);
    }

    // Insert sale items
    const saleItemsToInsert = saleData.items.map(item => ({
      sale_id: newSaleRow.id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      product_name: item.product_name,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: item.discount_amount || 0,
      subtotal: item.subtotal,
      purchase_price: item.purchase_price || 0,
      returned_quantity: 0
    }));

    const { error: itemsErr } = await supabase.from('sale_items').insert(saleItemsToInsert);
    if (itemsErr) {
      throw new Error(`Failed to save bill items: ${itemsErr.message}`);
    }

    // Decrement stock in product_variants
    for (const item of saleData.items) {
      const v = dbVariants?.find(v => v.id === item.variant_id);
      const currentStock = v ? v.stock_quantity : 0;
      await supabase.from('product_variants').update({
        stock_quantity: Math.max(0, currentStock - item.quantity),
        updated_at: new Date().toISOString()
      }).eq('id', item.variant_id);
    }

    // Customer record
    if (saleData.customer_phone?.trim()) {
      const phone = saleData.customer_phone.trim();
      const { data: existingCust } = await supabase.from('customers').select('*').eq('phone', phone).single();
      if (existingCust) {
        await supabase.from('customers').update({
          total_purchases: (existingCust.total_purchases || 0) + saleData.grand_total,
          total_bills: (existingCust.total_bills || 0) + 1,
          name: saleData.customer_name?.trim() || existingCust.name
        }).eq('id', existingCust.id);
      } else {
        await supabase.from('customers').insert({
          name: saleData.customer_name?.trim() || 'Customer',
          phone: phone,
          total_purchases: saleData.grand_total,
          total_bills: 1
        });
      }
    }

    // Activity log
    await this.logActivity(
      'BILL_CREATED',
      `Created Bill #${billNumber} for ₹${saleData.grand_total} (${saleData.payment_method.toUpperCase()})`,
      'sales',
      newSaleRow.id,
      saleData.created_by,
      { bill_number: billNumber, total: saleData.grand_total }
    );

    // Fetch canonical saved bill
    const { data: finalSale } = await supabase
      .from('sales')
      .select('*, items:sale_items(*)')
      .eq('id', newSaleRow.id)
      .single();

    notifyChange('BILL_CREATED', finalSale || newSaleRow);
    return finalSale || newSaleRow;
  },

  // ATOMIC BILL CANCELLATION
  async cancelSale(saleId: string, reason: string, staffName: string): Promise<Sale> {
    const supabase = ensureSupabase();

    const { data: sale, error: fetchErr } = await supabase
      .from('sales')
      .select('*, items:sale_items(*)')
      .eq('id', saleId)
      .single();

    if (fetchErr || !sale) {
      throw new Error('Bill not found in database.');
    }

    if (sale.status === 'cancelled') {
      throw new Error(`Bill #${sale.bill_number} is already cancelled. Duplicate cancellation blocked.`);
    }

    if (sale.status === 'exchanged') {
      throw new Error(`Cannot cancel Bill #${sale.bill_number} because items have already been exchanged.`);
    }

    if (!reason || !reason.trim()) {
      throw new Error('A cancellation reason is required.');
    }

    // Try stored procedure
    try {
      const { error: rpcErr } = await supabase.rpc('cancel_sale_transaction', {
        p_sale_id: saleId,
        p_reason: reason.trim(),
        p_cancelled_by: staffName
      });

      if (!rpcErr) {
        const { data: updatedSale } = await supabase
          .from('sales')
          .select('*, items:sale_items(*)')
          .eq('id', saleId)
          .single();

        if (updatedSale) {
          notifyChange('BILL_CANCELLED', updatedSale);
          notifyChange('STOCK_UPDATE', { reason: 'Bill cancelled' });
          return updatedSale;
        }
      }
    } catch {
      // Fall through to direct table transaction
    }

    // Direct update:
    // 1. Restore stock in product_variants
    for (const item of (sale.items || [])) {
      const restoreQty = item.quantity - (item.returned_quantity || 0);
      if (restoreQty > 0) {
        const { data: vRow } = await supabase
          .from('product_variants')
          .select('stock_quantity')
          .eq('id', item.variant_id)
          .single();

        if (vRow) {
          await supabase.from('product_variants').update({
            stock_quantity: vRow.stock_quantity + restoreQty,
            updated_at: new Date().toISOString()
          }).eq('id', item.variant_id);
        }
      }
    }

    // 2. Mark bill as cancelled
    const { data: updatedSale, error: upErr } = await supabase
      .from('sales')
      .update({
        status: 'cancelled',
        cancellation_reason: reason.trim(),
        cancelled_by: staffName,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', saleId)
      .select('*, items:sale_items(*)')
      .single();

    if (upErr) throw new Error(`Failed to cancel bill: ${upErr.message}`);

    await this.logActivity(
      'BILL_CANCELLED',
      `Cancelled Bill #${sale.bill_number}. Reason: ${reason.trim()}`,
      'sales',
      saleId,
      staffName,
      { bill_number: sale.bill_number, reason: reason.trim(), grand_total: sale.grand_total }
    );

    notifyChange('BILL_CANCELLED', updatedSale);
    notifyChange('STOCK_UPDATE', { reason: 'Bill cancelled' });
    return updatedSale;
  },

  // ATOMIC BILL EDIT
  async editSale(saleId: string, updatedData: {
    customer_name?: string;
    customer_phone?: string;
    subtotal: number;
    discount_type: any;
    discount_value: number;
    discount_amount: number;
    grand_total: number;
    paid_amount: number;
    payment_method: any;
    notes?: string;
    edit_reason?: string;
    items: Array<{
      id?: string;
      product_id: string;
      variant_id: string;
      product_name: string;
      size: string;
      color: string;
      quantity: number;
      unit_price: number;
      discount_amount?: number;
      subtotal: number;
      purchase_price?: number;
    }>;
  }, staffName: string): Promise<Sale> {
    const supabase = ensureSupabase();

    const { data: sale, error: fetchErr } = await supabase
      .from('sales')
      .select('*, items:sale_items(*)')
      .eq('id', saleId)
      .single();

    if (fetchErr || !sale) throw new Error('Bill not found');
    if (sale.status === 'cancelled') throw new Error('Cannot edit a cancelled bill.');

    // 1. Calculate stock deltas
    const oldItemsMap = new Map<string, number>();
    (sale.items || []).forEach((i: any) => {
      oldItemsMap.set(i.variant_id, (oldItemsMap.get(i.variant_id) || 0) + i.quantity);
    });

    const newItemsMap = new Map<string, number>();
    updatedData.items.forEach(i => {
      newItemsMap.set(i.variant_id, (newItemsMap.get(i.variant_id) || 0) + i.quantity);
    });

    // Verify stock for increases
    for (const [variantId, newQty] of newItemsMap.entries()) {
      const oldQty = oldItemsMap.get(variantId) || 0;
      const delta = newQty - oldQty;
      if (delta > 0) {
        const { data: vRow } = await supabase.from('product_variants').select('stock_quantity').eq('id', variantId).single();
        const available = vRow ? vRow.stock_quantity : 0;
        if (available < delta) {
          throw new Error(`Insufficient stock for item. Available: ${available}, Additional requested: ${delta}`);
        }
      }
    }

    // Try RPC
    try {
      const { error: rpcErr } = await supabase.rpc('edit_sale_transaction', {
        p_sale_id: saleId,
        p_customer_name: updatedData.customer_name || null,
        p_customer_phone: updatedData.customer_phone || null,
        p_subtotal: updatedData.subtotal,
        p_discount_type: updatedData.discount_type,
        p_discount_value: updatedData.discount_value,
        p_discount_amount: updatedData.discount_amount,
        p_grand_total: updatedData.grand_total,
        p_paid_amount: updatedData.paid_amount,
        p_payment_method: updatedData.payment_method,
        p_notes: updatedData.notes || null,
        p_edited_by: staffName,
        p_edit_reason: updatedData.edit_reason || 'Bill details edited',
        p_items: updatedData.items
      });

      if (!rpcErr) {
        const { data: updatedSale } = await supabase
          .from('sales')
          .select('*, items:sale_items(*)')
          .eq('id', saleId)
          .single();

        if (updatedSale) {
          notifyChange('BILL_UPDATED', updatedSale);
          notifyChange('STOCK_UPDATE', { reason: 'Bill edited' });
          return updatedSale;
        }
      }
    } catch {
      // Fall through to direct table transaction
    }

    // Direct table updates:
    // Update stock deltas
    for (const [variantId, newQty] of newItemsMap.entries()) {
      const oldQty = oldItemsMap.get(variantId) || 0;
      const delta = newQty - oldQty;
      if (delta !== 0) {
        const { data: vRow } = await supabase.from('product_variants').select('stock_quantity').eq('id', variantId).single();
        if (vRow) {
          await supabase.from('product_variants').update({
            stock_quantity: Math.max(0, vRow.stock_quantity - delta),
            updated_at: new Date().toISOString()
          }).eq('id', variantId);
        }
      }
    }

    // Restock removed items
    for (const [variantId, oldQty] of oldItemsMap.entries()) {
      if (!newItemsMap.has(variantId)) {
        const { data: vRow } = await supabase.from('product_variants').select('stock_quantity').eq('id', variantId).single();
        if (vRow) {
          await supabase.from('product_variants').update({
            stock_quantity: vRow.stock_quantity + oldQty,
            updated_at: new Date().toISOString()
          }).eq('id', variantId);
        }
      }
    }

    // Delete old sale items & reinsert new
    await supabase.from('sale_items').delete().eq('sale_id', saleId);
    await supabase.from('sale_items').insert(
      updatedData.items.map(item => ({
        sale_id: saleId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product_name,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount || 0,
        subtotal: item.subtotal,
        purchase_price: item.purchase_price || 0,
        returned_quantity: 0
      }))
    );

    // Update sale
    const balanceAmount = Math.max(0, updatedData.grand_total - updatedData.paid_amount);
    const { data: finalSale, error: saleUpErr } = await supabase
      .from('sales')
      .update({
        customer_name: updatedData.customer_name?.trim() || null,
        customer_phone: updatedData.customer_phone?.trim() || null,
        subtotal: updatedData.subtotal,
        discount_type: updatedData.discount_type,
        discount_value: updatedData.discount_value,
        discount_amount: updatedData.discount_amount,
        grand_total: updatedData.grand_total,
        paid_amount: updatedData.paid_amount,
        balance_amount: balanceAmount,
        payment_method: updatedData.payment_method,
        payment_status: balanceAmount === 0 ? 'paid' : (updatedData.paid_amount > 0 ? 'partial' : 'unpaid'),
        notes: updatedData.notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', saleId)
      .select('*, items:sale_items(*)')
      .single();

    if (saleUpErr) throw new Error(`Failed to update bill: ${saleUpErr.message}`);

    await this.logActivity(
      'BILL_EDITED',
      `Edited Bill #${sale.bill_number}. Reason: ${updatedData.edit_reason || 'Updated bill'}`,
      'sales',
      saleId,
      staffName
    );

    notifyChange('BILL_UPDATED', finalSale);
    notifyChange('STOCK_UPDATE', { reason: 'Bill edited' });
    return finalSale;
  },

  // --------------------------------------------------------------------------
  // 7-DAY STRICT CLOTHING EXCHANGE
  // --------------------------------------------------------------------------
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
    const supabase = ensureSupabase();

    const { data: sale, error: fetchErr } = await supabase
      .from('sales')
      .select('*, items:sale_items(*)')
      .eq('id', params.original_sale_id)
      .single();

    if (fetchErr || !sale) throw new Error('Original bill not found');
    if (sale.status === 'cancelled') throw new Error(`Bill #${sale.bill_number} is cancelled. Cancelled bills cannot be exchanged.`);

    // Strict 7-day rule check
    const eligibility = checkExchangeEligibility(sale.created_at, false);
    if (!eligibility.isEligible) {
      throw new Error(eligibility.reason || 'Exchange is strictly permitted within 7 days of original bill date.');
    }

    // Verify replacement stock in Supabase
    for (const repl of params.replacements) {
      const { data: vRow } = await supabase.from('product_variants').select('stock_quantity').eq('id', repl.variant_id).single();
      const currentStock = vRow ? vRow.stock_quantity : 0;
      if (currentStock < repl.quantity) {
        throw new Error(`Insufficient stock for replacement "${repl.product_name}". Available: ${currentStock}`);
      }
    }

    const returnTotal = params.returns.reduce((sum, r) => sum + (r.unit_price * r.quantity), 0);
    const replTotal = params.replacements.reduce((sum, r) => sum + (r.unit_price * r.quantity), 0);
    const diff = replTotal - returnTotal;

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { count } = await supabase.from('exchanges').select('*', { count: 'exact', head: true });
    const excNumber = `EXC-${todayStr}-${String((count || 0) + 1).padStart(4, '0')}`;

    // Insert exchange
    const { data: excRow, error: excErr } = await supabase
      .from('exchanges')
      .insert({
        exchange_number: excNumber,
        original_sale_id: sale.id,
        original_bill_number: sale.bill_number,
        customer_name: sale.customer_name || null,
        customer_phone: sale.customer_phone || null,
        return_total_value: returnTotal,
        replacement_total_value: replTotal,
        difference_amount: diff,
        settlement_type: params.settlement_type,
        payment_method: params.payment_method || null,
        processed_by: params.processed_by,
        notes: params.notes || null
      })
      .select()
      .single();

    if (excErr || !excRow) throw new Error(`Failed to record exchange: ${excErr?.message}`);

    // Insert exchange items
    const excItemsToInsert = [
      ...params.returns.map(r => ({
        exchange_id: excRow.id,
        item_type: 'return',
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
      ...params.replacements.map(r => ({
        exchange_id: excRow.id,
        item_type: 'replacement',
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

    await supabase.from('exchange_items').insert(excItemsToInsert);

    // Update returned_quantity on sale_items & restore stock
    for (const ret of params.returns) {
      const saleItem = sale.items?.find((i: any) => i.id === ret.sale_item_id);
      if (saleItem) {
        await supabase.from('sale_items').update({
          returned_quantity: (saleItem.returned_quantity || 0) + ret.quantity
        }).eq('id', saleItem.id);
      }

      const { data: vRow } = await supabase.from('product_variants').select('stock_quantity').eq('id', ret.variant_id).single();
      if (vRow) {
        await supabase.from('product_variants').update({
          stock_quantity: vRow.stock_quantity + ret.quantity,
          updated_at: new Date().toISOString()
        }).eq('id', ret.variant_id);
      }
    }

    // Deduct stock for replacements
    for (const repl of params.replacements) {
      const { data: vRow } = await supabase.from('product_variants').select('stock_quantity').eq('id', repl.variant_id).single();
      if (vRow) {
        await supabase.from('product_variants').update({
          stock_quantity: Math.max(0, vRow.stock_quantity - repl.quantity),
          updated_at: new Date().toISOString()
        }).eq('id', repl.variant_id);
      }
    }

    // Update sale status
    await supabase.from('sales').update({
      status: 'exchanged',
      updated_at: new Date().toISOString()
    }).eq('id', sale.id);

    await this.logActivity(
      'EXCHANGE_PROCESSED',
      `Processed Exchange #${excNumber} for Bill #${sale.bill_number} (Diff: ₹${diff})`,
      'exchanges',
      excRow.id,
      params.processed_by
    );

    const { data: finalExchange } = await supabase
      .from('exchanges')
      .select('*, items:exchange_items(*)')
      .eq('id', excRow.id)
      .single();

    notifyChange('EXCHANGE_PROCESSED', finalExchange);
    notifyChange('STOCK_UPDATE', { reason: 'Exchange processed' });
    return finalExchange || excRow;
  },

  async getExchanges(): Promise<Exchange[]> {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('exchanges')
      .select('*, items:exchange_items(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching exchanges:', error);
      return [];
    }
    return data || [];
  },

  // --------------------------------------------------------------------------
  // EXPENSES
  // --------------------------------------------------------------------------
  async getExpenses(startDate?: string, endDate?: string): Promise<Expense[]> {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) return [];

    let query = supabase.from('expenses').select('*').order('expense_date', { ascending: false });
    if (startDate) query = query.gte('expense_date', startDate);
    if (endDate) query = query.lte('expense_date', endDate);

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching expenses:', error);
      return [];
    }
    return data || [];
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
    const supabase = ensureSupabase();

    const { data: newExp, error } = await supabase
      .from('expenses')
      .insert({
        title: data.title.trim(),
        category: data.category,
        amount: Number(data.amount),
        payment_method: data.payment_method,
        notes: data.notes || null,
        added_by: data.added_by,
        expense_date: data.expense_date || new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (error || !newExp) {
      throw new Error(`Failed to record expense: ${error?.message}`);
    }

    await this.logActivity(
      'EXPENSE_ADDED',
      `Added expense "${newExp.title}" for ₹${newExp.amount}`,
      'expense',
      newExp.id,
      data.added_by
    );

    notifyChange('EXPENSE_UPDATE', newExp);
    return newExp;
  },

  // --------------------------------------------------------------------------
  // PURCHASES (STOCK INWARD)
  // --------------------------------------------------------------------------
  async getPurchases(): Promise<Purchase[]> {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('purchases')
      .select('*, items:purchase_items(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching purchases:', error);
      return [];
    }
    return data || [];
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
    const supabase = ensureSupabase();
    const totalAmount = purchaseData.items.reduce((sum, i) => sum + (i.unit_cost * i.quantity), 0);

    const { data: newPurch, error: purchErr } = await supabase
      .from('purchases')
      .insert({
        invoice_number: purchaseData.invoice_number || null,
        supplier_name: purchaseData.supplier_name || null,
        total_amount: totalAmount,
        notes: purchaseData.notes || null,
        purchased_by: purchaseData.purchased_by,
        purchase_date: new Date().toISOString().split('T')[0]
      })
      .select()
      .single();

    if (purchErr || !newPurch) throw new Error(`Failed to create purchase: ${purchErr?.message}`);

    const purchaseItems = purchaseData.items.map(i => ({
      purchase_id: newPurch.id,
      product_id: i.product_id,
      variant_id: i.variant_id,
      product_name: i.product_name,
      size: i.size,
      color: i.color,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      subtotal: i.unit_cost * i.quantity
    }));

    await supabase.from('purchase_items').insert(purchaseItems);

    // Increase stock for each variant
    for (const item of purchaseData.items) {
      const { data: vRow } = await supabase.from('product_variants').select('stock_quantity').eq('id', item.variant_id).single();
      if (vRow) {
        await supabase.from('product_variants').update({
          stock_quantity: vRow.stock_quantity + item.quantity,
          updated_at: new Date().toISOString()
        }).eq('id', item.variant_id);
      }
    }

    await this.logActivity(
      'PURCHASE_ADDED',
      `Received stock purchase (${purchaseData.items.length} items, total ₹${totalAmount})`,
      'purchase',
      newPurch.id,
      purchaseData.purchased_by
    );

    const { data: finalPurch } = await supabase
      .from('purchases')
      .select('*, items:purchase_items(*)')
      .eq('id', newPurch.id)
      .single();

    notifyChange('STOCK_UPDATE', finalPurch || newPurch);
    return finalPurch || newPurch;
  },

  // --------------------------------------------------------------------------
  // CUSTOMERS
  // --------------------------------------------------------------------------
  async getCustomers(query?: string): Promise<Customer[]> {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) return [];

    let q = supabase.from('customers').select('*').order('total_purchases', { ascending: false });
    if (query && query.trim()) {
      q = q.or(`name.ilike.%${query.trim()}%,phone.ilike.%${query.trim()}%`);
    }

    const { data, error } = await q;
    if (error) {
      console.error('Error fetching customers:', error);
      return [];
    }
    return data || [];
  },

  // --------------------------------------------------------------------------
  // ACTIVITY LOGS
  // --------------------------------------------------------------------------
  async getActivityLogs(limit = 50): Promise<ActivityLog[]> {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) return [];

    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching activity logs:', error);
      return [];
    }
    return data || [];
  },

  async logActivity(
    action_type: string, 
    description: string, 
    entity_type?: string, 
    entity_id?: string, 
    staff_name = 'Staff', 
    metadata?: any
  ): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) return;

    try {
      await supabase.from('activity_logs').insert({
        action_type,
        description,
        entity_type: entity_type || null,
        entity_id: entity_id ? String(entity_id) : null,
        staff_name,
        metadata: metadata || null
      });
    } catch {
      // Activity log failures must not block business operations
    }
  },

  // --------------------------------------------------------------------------
  // SALES REPORT AGGREGATOR
  // --------------------------------------------------------------------------
  async getSalesReportSummary(dateRange: string, customStart?: string, customEnd?: string) {
    const [allSales, allExpenses] = await Promise.all([
      this.getSales({ dateRange: dateRange === 'custom' ? undefined : dateRange }),
      this.getExpenses(customStart, customEnd)
    ]);

    let filteredSales = allSales.filter(s => s.status !== 'cancelled');
    let filteredExpenses = allExpenses;

    if (dateRange === 'custom' && customStart && customEnd) {
      filteredSales = filteredSales.filter(s => {
        const d = s.created_at.split('T')[0];
        return d >= customStart && d <= customEnd;
      });
    }

    const totalSales = filteredSales.reduce((sum, s) => sum + s.grand_total, 0);
    const totalDiscounts = filteredSales.reduce((sum, s) => sum + s.discount_amount, 0);
    const totalBills = filteredSales.length;

    let itemsSoldCount = 0;
    let estimatedCost = 0;
    const sizeBreakdown: Record<string, number> = {};
    const productSalesMap: Record<string, { name: string; qty: number; revenue: number }> = {};

    filteredSales.forEach(s => {
      s.items?.forEach(item => {
        itemsSoldCount += item.quantity;
        estimatedCost += (item.purchase_price || 0) * item.quantity;

        // Size stats
        if (item.size) {
          sizeBreakdown[item.size] = (sizeBreakdown[item.size] || 0) + item.quantity;
        }

        // Product stats
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
