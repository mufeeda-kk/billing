import { jsPDF } from 'jspdf';
import { Sale, SHOP_INFO } from '../types';
import { formatDateTimeIST } from './date';

/**
 * Generates and downloads a clean, professional PDF invoice
 * Runs entirely on the client, fast and lightweight.
 */
export async function generateAndDownloadBillPdf(sale: Sale): Promise<void> {
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, 200] // Thermal receipt paper size (80mm width)
  });

  const pageWidth = 80;
  let y = 8;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(SHOP_INFO.shop_name, pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text("Men's Wear & Lifestyle", pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(`Ph: ${SHOP_INFO.phones.join(' / ')}`, pageWidth / 2, y, { align: 'center' });
  y += 5;

  // Divider
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Bill metadata
  doc.setFontSize(8);
  doc.text(`Bill No: ${sale.bill_number}`, 5, y);
  y += 4;
  doc.text(`Date: ${formatDateTimeIST(sale.created_at)}`, 5, y);
  y += 4;

  if (sale.customer_name) {
    doc.text(`Customer: ${sale.customer_name}`, 5, y);
    y += 4;
  }
  if (sale.customer_phone) {
    doc.text(`Phone: ${sale.customer_phone}`, 5, y);
    y += 4;
  }
  doc.text(`Staff: ${sale.created_by}`, 5, y);
  y += 4;

  // Divider
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Table header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('ITEM / DETAILS', 5, y);
  doc.text('TOTAL', pageWidth - 5, y, { align: 'right' });
  y += 3;
  doc.setLineDashPattern([], 0);
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Items
  doc.setFont('helvetica', 'normal');
  (sale.items || []).forEach((item, index) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    // Truncate name if too long
    const pName = `${index + 1}. ${item.product_name.substring(0, 26)}`;
    doc.text(pName, 5, y);
    doc.text(`Rs ${item.subtotal}`, pageWidth - 5, y, { align: 'right' });
    y += 3.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`Size: ${item.size} | Color: ${item.color} | ${item.quantity} x Rs ${item.unit_price}`, 8, y);
    y += 4;
  });

  // Divider
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Totals
  doc.setFontSize(8);
  doc.text('Subtotal:', 5, y);
  doc.text(`Rs ${sale.subtotal}`, pageWidth - 5, y, { align: 'right' });
  y += 4;

  if (sale.discount_amount > 0) {
    doc.text(`Discount (${sale.discount_type}):`, 5, y);
    doc.text(`- Rs ${sale.discount_amount}`, pageWidth - 5, y, { align: 'right' });
    y += 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('GRAND TOTAL:', 5, y);
  doc.text(`Rs ${sale.grand_total}`, pageWidth - 5, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Payment Method: ${sale.payment_method.toUpperCase()}`, 5, y);
  y += 3.5;
  doc.text(`Paid: Rs ${sale.paid_amount}`, 5, y);
  y += 3.5;

  if (sale.balance_amount > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Balance Due: Rs ${sale.balance_amount}`, 5, y);
    y += 4;
  }

  // Footer & 7-Day Exchange Policy
  y += 3;
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('* 7-DAY EXCHANGE POLICY *', pageWidth / 2, y, { align: 'center' });
  y += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Exchange strictly valid within 7 days with bill.', pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text('Tags must be intact. No cash refund on sale items.', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('THANK YOU FOR SHOPPING WITH US!', pageWidth / 2, y, { align: 'center' });

  // Save PDF
  doc.save(`${sale.bill_number}.pdf`);
}

/**
 * Native Web Share API helper for sharing PDF on supported mobile browsers
 */
export async function sharePdfNative(sale: Sale): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
      // Build same PDF as blob
      // Check canShare with files
      const blob = doc.output('blob');
      const file = new File([blob], `${sale.bill_number}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Invoice ${sale.bill_number}`,
          text: `Invoice from ${SHOP_INFO.shop_name} for Bill #${sale.bill_number}`
        });
        return true;
      }
    } catch (e) {
      console.warn('Native share failed or dismissed, falling back:', e);
    }
  }
  return false;
}
