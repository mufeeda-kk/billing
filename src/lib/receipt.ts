import { Sale, SHOP_INFO, Exchange } from '../types';
import { formatDateTimeIST } from './date';

/**
 * Triggers browser native thermal receipt printing with pre-formatted CSS
 */
export function triggerReceiptPrint(): void {
  window.print();
}

/**
 * HTML receipt template for thermal printers (58mm or 80mm) and A4 fallback
 */
export function generateThermalReceiptHtml(sale: Sale): string {
  const shop = SHOP_INFO;
  const dateFormatted = formatDateTimeIST(sale.created_at);

  const itemsRows = (sale.items || [])
    .map(
      (item, idx) => `
      <tr>
        <td style="padding: 3px 0; text-align: left; vertical-align: top;">
          <div style="font-weight: 600;">${idx + 1}. ${item.product_name}</div>
          <div style="font-size: 10px; color: #444;">Size: ${item.size} | Color: ${item.color}</div>
          <div style="font-size: 10px;">${item.quantity} x Rs ${item.unit_price}</div>
        </td>
        <td style="padding: 3px 0; text-align: right; vertical-align: top; font-weight: 600;">
          Rs ${item.subtotal}
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <div class="thermal-receipt" style="max-width: 320px; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.3; color: #000; margin: 0 auto; padding: 8px;">
      <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
        <h2 style="margin: 0; font-size: 16px; font-weight: 900; letter-spacing: 0.5px;">${shop.shop_name}</h2>
        <div style="font-size: 11px; margin-top: 2px;">Men's Clothing & Trends</div>
        <div style="font-size: 11px; margin-top: 2px; font-weight: bold;">Ph: ${shop.phones.join(' / ')}</div>
      </div>

      <div style="font-size: 11px; margin-bottom: 6px;">
        <div><strong>Bill No:</strong> ${sale.bill_number}</div>
        <div><strong>Date:</strong> ${dateFormatted}</div>
        ${sale.customer_name ? `<div><strong>Customer:</strong> ${sale.customer_name}</div>` : ''}
        ${sale.customer_phone ? `<div><strong>Phone:</strong> ${sale.customer_phone}</div>` : ''}
        <div><strong>Staff:</strong> ${sale.created_by}</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 6px 0;">
        <thead>
          <tr style="border-bottom: 1px solid #ccc; font-size: 10px;">
            <th style="text-align: left; padding: 3px 0;">ITEM</th>
            <th style="text-align: right; padding: 3px 0;">AMT</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div style="font-size: 11px; margin-top: 4px;">
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span>Subtotal:</span>
          <span>Rs ${sale.subtotal}</span>
        </div>
        ${
          sale.discount_amount > 0
            ? `<div style="display: flex; justify-content: space-between; padding: 2px 0;">
                 <span>Discount:</span>
                 <span>- Rs ${sale.discount_amount}</span>
               </div>`
            : ''
        }
        <div style="display: flex; justify-content: space-between; padding: 4px 0; border-top: 1px solid #000; border-bottom: 1px solid #000; font-weight: 900; font-size: 13px;">
          <span>GRAND TOTAL:</span>
          <span>Rs ${sale.grand_total}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 2px 0; margin-top: 2px;">
          <span>Payment Mode:</span>
          <span>${sale.payment_method.toUpperCase()} (${sale.payment_status.toUpperCase()})</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span>Paid:</span>
          <span>Rs ${sale.paid_amount}</span>
        </div>
        ${
          sale.balance_amount > 0
            ? `<div style="display: flex; justify-content: space-between; padding: 2px 0; color: #b91c1c; font-weight: bold;">
                 <span>Balance Due:</span>
                 <span>Rs ${sale.balance_amount}</span>
               </div>`
            : ''
        }
      </div>

      <div style="border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; text-align: center; font-size: 10px;">
        <div style="font-weight: bold; margin-bottom: 2px;">* 7 DAYS CLOTHING EXCHANGE POLICY *</div>
        <div>Exchange strictly accepted within 7 days.</div>
        <div>Please keep this bill and tags intact.</div>
        <div style="margin-top: 6px; font-weight: bold;">THANK YOU! VISIT AGAIN</div>
      </div>
    </div>
  `;
}
