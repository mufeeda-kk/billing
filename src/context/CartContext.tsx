import React, { createContext, useContext, useState, useMemo } from 'react';
import { CartItem, Product, ProductVariant, DiscountType, PaymentMethod } from '../types';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, variant: ProductVariant, qty?: number) => { success: boolean; message?: string };
  addSimpleProductToCart: (product: Product, qty?: number) => { success: boolean; message?: string };
  updateItemQty: (cartId: string, quantity: number) => { success: boolean; message?: string };
  incrementItemQty: (cartId: string) => { success: boolean; message?: string };
  decrementItemQty: (cartId: string) => void;
  removeFromCart: (cartId: string) => void;
  clearCart: () => void;

  customerName: string;
  customerPhone: string;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;

  discountAmount: number;
  setDirectDiscount: (amount: number) => void;

  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;

  paidAmountInput: string;
  setPaidAmountInput: (val: string) => void;

  notes: string;
  setNotes: (notes: string) => void;

  // Computed calculations
  subtotal: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  totalQuantity: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [directDiscountInput, setDirectDiscountInput] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [notes, setNotes] = useState('');

  // Calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  }, [items]);

  const totalQuantity = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  // Discount cannot exceed subtotal and defaults to 0
  const discountAmount = useMemo(() => {
    if (directDiscountInput <= 0 || subtotal <= 0) return 0;
    return Math.min(subtotal, Math.max(0, directDiscountInput));
  }, [directDiscountInput, subtotal]);

  const setDirectDiscount = (amount: number) => {
    const val = isNaN(amount) ? 0 : Math.max(0, amount);
    setDirectDiscountInput(val);
  };

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const paidAmount = useMemo(() => {
    if (paidAmountInput === '') return grandTotal; // Default full paid
    const num = parseFloat(paidAmountInput);
    return isNaN(num) ? 0 : Math.max(0, num);
  }, [paidAmountInput, grandTotal]);

  const balanceAmount = useMemo(() => {
    return Math.max(0, grandTotal - paidAmount);
  }, [grandTotal, paidAmount]);

  const addToCart = (product: Product, variant: ProductVariant, qty = 1): { success: boolean; message?: string } => {
    const existing = items.find(i => i.variant_id === variant.id);
    const existingQty = existing ? existing.quantity : 0;
    const targetQty = existingQty + qty;

    if (targetQty > variant.stock_quantity) {
      return { 
        success: false, 
        message: `Only ${variant.stock_quantity} available in stock for ${product.name}.` 
      };
    }

    if (existing) {
      setItems(prev => prev.map(item => {
        if (item.variant_id === variant.id) {
          const newQty = item.quantity + qty;
          return {
            ...item,
            quantity: newQty,
            subtotal: newQty * item.unit_price
          };
        }
        return item;
      }));
    } else {
      const newItem: CartItem = {
        cart_id: `cart-${Date.now()}-${variant.id}`,
        product_id: product.id,
        variant_id: variant.id,
        product_name: product.name,
        sku: product.sku,
        variant_sku: variant.variant_sku,
        size: variant.size || 'Regular',
        color: variant.color || 'Standard',
        quantity: qty,
        unit_price: product.selling_price,
        purchase_price: product.purchase_price || 0,
        discount_amount: 0,
        subtotal: qty * product.selling_price,
        available_stock: variant.stock_quantity
      };
      setItems(prev => [...prev, newItem]);
    }
    return { success: true };
  };

  // Direct 1-tap add for simple billing (no size/color modals)
  const addSimpleProductToCart = (product: Product, qty = 1): { success: boolean; message?: string } => {
    const availableVariant = product.variants?.find(v => v.stock_quantity > 0) || product.variants?.[0] || {
      id: `var-${product.id}`,
      product_id: product.id,
      variant_sku: `${product.sku || 'SKU'}-STD`,
      size: 'Regular',
      color: 'Standard',
      stock_quantity: product.total_stock ?? 0,
      low_stock_threshold: 5
    };

    const totalAvailable = product.total_stock ?? availableVariant.stock_quantity;
    if (totalAvailable <= 0) {
      return { success: false, message: `"${product.name}" is out of stock.` };
    }

    return addToCart(product, availableVariant, qty);
  };

  const updateItemQty = (cartId: string, quantity: number): { success: boolean; message?: string } => {
    const item = items.find(i => i.cart_id === cartId);
    if (!item) return { success: false, message: 'Item not found in cart' };

    if (quantity <= 0) {
      removeFromCart(cartId);
      return { success: true };
    }

    if (quantity > item.available_stock) {
      return { 
        success: false, 
        message: `Only ${item.available_stock} available in stock for ${item.product_name}.` 
      };
    }

    setItems(prev => prev.map(i => {
      if (i.cart_id === cartId) {
        return {
          ...i,
          quantity,
          subtotal: quantity * i.unit_price
        };
      }
      return i;
    }));

    return { success: true };
  };

  const incrementItemQty = (cartId: string): { success: boolean; message?: string } => {
    const item = items.find(i => i.cart_id === cartId);
    if (!item) return { success: false, message: 'Item not found' };
    return updateItemQty(cartId, item.quantity + 1);
  };

  const decrementItemQty = (cartId: string) => {
    const item = items.find(i => i.cart_id === cartId);
    if (!item) return;
    if (item.quantity <= 1) {
      removeFromCart(cartId);
    } else {
      updateItemQty(cartId, item.quantity - 1);
    }
  };

  const removeFromCart = (cartId: string) => {
    setItems(prev => prev.filter(i => i.cart_id !== cartId));
  };

  const clearCart = () => {
    setItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDirectDiscountInput(0);
    setPaidAmountInput('');
    setNotes('');
  };

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      addSimpleProductToCart,
      updateItemQty,
      incrementItemQty,
      decrementItemQty,
      removeFromCart,
      clearCart,
      customerName,
      customerPhone,
      setCustomerName,
      setCustomerPhone,
      discountAmount,
      setDirectDiscount,
      paymentMethod,
      setPaymentMethod,
      paidAmountInput,
      setPaidAmountInput,
      notes,
      setNotes,
      subtotal,
      grandTotal,
      paidAmount,
      balanceAmount,
      totalQuantity
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
