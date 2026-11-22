import { Sale, SHOP_INFO } from '../types';
import { formatDateTimeIST } from './date';

/**
 * Builds clean WhatsApp text message for the bill
 * Designed to execute instantly in micro-seconds with zero lag
 */
export function generateWhatsAppBillMessage(sale: Sale): string {
  const shopName = SHOP_INFO.shop_name;
  const phones = SHOP_INFO.phones.join(' / ');
  const billDate = formatDateTimeIST(sale.created_at);

  let msg = `👕 *${shopName}*\n`;
  msg += `📞 ${phones}\n`;
  msg += `--------------------------------\n`;
  msg += `🧾 *Bill No:* ${sale.bill_number}\n`;
  msg += `📅 *Date:* ${billDate}\n`;

  if (sale.customer_name || sale.customer_phone) {
    msg += `👤 *Customer:* ${sale.customer_name || 'Customer'}`;
    if (sale.customer_phone) msg += ` (${sale.customer_phone})`;
    msg += `\n`;
  }
  msg += `--------------------------------\n`;
  msg += `*ITEMS:*\n`;

  sale.items?.forEach((item, idx) => {
    msg += `${idx + 1}. *${item.product_name}*\n`;
    msg += `   Size: *${item.size}* | Color: *${item.color}*\n`;
    msg += `   ${item.quantity} x ₹${item.unit_price} = *₹${item.subtotal}*\n`;
  });

  msg += `--------------------------------\n`;
  msg += `Subtotal: ₹${sale.subtotal}\n`;

  if (sale.discount_amount > 0) {
    msg += `Discount: -₹${sale.discount_amount}`;
    if (sale.discount_type === 'percentage') {
      msg += ` (${sale.discount_value}%)`;
    }
    msg += `\n`;
  }

  msg += `*Grand Total: ₹${sale.grand_total}*\n`;
  msg += `Paid Amount: ₹${sale.paid_amount}\n`;
  if (sale.balance_amount > 0) {
    msg += `Balance Due: ₹${sale.balance_amount}\n`;
  }
  msg += `Payment: *${sale.payment_method.toUpperCase()}* (${sale.payment_status.toUpperCase()})\n`;
  msg += `Billed by: ${sale.created_by}\n`;

  msg += `--------------------------------\n`;
  msg += `ℹ️ *EXCHANGE POLICY:*\n`;
  msg += `• Exchange accepted strictly within *7 days* of purchase.\n`;
  msg += `• Please bring this bill receipt and tags intact.\n\n`;
  msg += `🙏 *Thank you for shopping at ${shopName}!*`;

  return msg;
}

/**
 * Normalizes phone number into international format for WhatsApp wa.me
 * If 10 digits provided, defaults to India (+91)
 */
export function normalizeWhatsAppNumber(rawPhone?: string): string {
  if (!rawPhone) return '';
  const cleaned = rawPhone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return cleaned;
  }
  return cleaned;
}

/**
 * Opens WhatsApp instantly without blocking the UI
 */
export function openWhatsAppShare(sale: Sale, targetPhone?: string): void {
  const message = generateWhatsAppBillMessage(sale);
  const phoneToUse = targetPhone || sale.customer_phone || '';
  const cleanPhone = normalizeWhatsAppNumber(phoneToUse);

  let url: string;
  if (cleanPhone) {
    url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  } else {
    // Open generic share selector if no phone is specified
    url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
