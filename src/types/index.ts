export type PaymentMethod = 'cash' | 'upi' | 'card' | 'split';
export type PaymentStatus = 'paid' | 'partial' | 'unpaid';
export type SaleStatus = 'completed' | 'exchanged' | 'partially_exchanged' | 'cancelled';
export type DiscountType = 'none' | 'percentage' | 'fixed';
export type StaffRole = 'owner' | 'manager' | 'staff';

export interface StaffProfile {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  pin_code?: string;
  is_active: boolean;
  created_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  sort_order: number;
  created_at?: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_sku: string;
  size: string;
  color: string;
  stock_quantity: number;
  low_stock_threshold: number;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category_id?: string;
  category_name: string;
  brand?: string;
  purchase_price: number;
  selling_price: number;
  image_url?: string;
  is_active: boolean;
  is_archived?: boolean;
  created_at?: string;
  updated_at?: string;
  variants?: ProductVariant[];
  total_stock?: number;
  low_stock_threshold?: number;
}

export interface CartItem {
  cart_id: string; // unique for this cart line
  product_id: string;
  variant_id: string;
  product_name: string;
  sku: string;
  variant_sku: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  purchase_price: number;
  discount_amount: number;
  subtotal: number; // (unit_price * quantity) - discount_amount
  available_stock: number;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  subtotal: number;
  purchase_price: number;
  returned_quantity: number;
}

export interface Sale {
  id: string;
  bill_number: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  grand_total: number;
  paid_amount: number;
  balance_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: SaleStatus;
  cancellation_reason?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  items?: SaleItem[];
}

export type ExchangeSettlementType = 'none' | 'collected_extra' | 'refunded_cash' | 'refunded_upi' | 'store_credit';

export interface ExchangeItem {
  id: string;
  exchange_id: string;
  item_type: 'return' | 'replacement';
  sale_item_id?: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Exchange {
  id: string;
  exchange_number: string;
  original_sale_id: string;
  original_bill_number: string;
  customer_name?: string;
  customer_phone?: string;
  return_total_value: number;
  replacement_total_value: number;
  difference_amount: number; // >0: customer pays extra, <0: shop owes refund/credit
  settlement_type: ExchangeSettlementType;
  payment_method?: PaymentMethod;
  processed_by: string;
  notes?: string;
  created_at: string;
  items?: ExchangeItem[];
}

export interface StockMovement {
  id: string;
  product_id: string;
  variant_id: string;
  product_name?: string;
  size?: string;
  color?: string;
  change_qty: number;
  previous_stock: number;
  new_stock: number;
  movement_type: 'sale' | 'exchange_return' | 'exchange_replacement' | 'purchase' | 'adjustment' | 'cancellation';
  reference_id?: string;
  reference_number?: string;
  reason?: string;
  performed_by: string;
  created_at: string;
}

export interface PurchaseItem {
  id?: string;
  purchase_id?: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  size: string;
  color: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
}

export interface Purchase {
  id: string;
  invoice_number?: string;
  supplier_name?: string;
  total_amount: number;
  notes?: string;
  purchased_by: string;
  purchase_date: string;
  created_at: string;
  items?: PurchaseItem[];
}

export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  payment_method: string;
  notes?: string;
  added_by: string;
  expense_date: string;
  created_at: string;
}

export interface Customer {
  id: string;
  name?: string;
  phone: string;
  notes?: string;
  total_purchases: number;
  total_bills: number;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  action_type: string;
  description: string;
  entity_type?: string;
  entity_id?: string;
  staff_name: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface StoreConfig {
  shop_name: string;
  phones: string[];
  address: string;
  gstin?: string;
  thermal_printer_width: '58mm' | '80mm';
}

export const SHOP_INFO: StoreConfig = {
  shop_name: 'VINTAGE CLOTHING STORE',
  phones: ['9072808380', '9744223557'],
  address: "Men's Wear & Trends, Kerala, India",
  thermal_printer_width: '58mm'
};
