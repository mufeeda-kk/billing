import { jsPDF } from 'jspdf';
import { Sale, SHOP_INFO } from '../types';
import { formatDateTimeIST } from './date';

/**
 * Builds the jsPDF document instance with all shop details, items, and totals.
 * Uses dynamic page length based on items so receipts never get cut off.
 */
function buildBillPdfDoc(sale: Sale): jsPDF {
  const items = sale.items || [];
  // Calculate dynamic receipt height in mm (thermal paper style: 80mm width)
  const baseHeight = 135;
  const itemHeight = items.length * 10;
  const extraFieldsHeight = (sale.customer_name ? 5 : 0) + 
                            (sale.customer_phone ? 5 : 0) + 
                            (sale.discount_amount > 0 ? 5 : 0) + 
                            (sale.balance_amount > 0 ? 5 : 0);
  const totalHeight = Math.max(160, baseHeight + itemHeight + extraFieldsHeight);

  const doc = new jsPDF({
    unit: 'mm',
    format: [80, totalHeight]
  });

  const pageWidth = 80;
  let y = 8;

  // Header - Shop Name
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

  // Divider line
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Bill metadata
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Bill No: ${sale.bill_number}`, 5, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
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
  doc.text(`Staff: ${sale.created_by || 'Staff'}`, 5, y);
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
  items.forEach((item, index) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const pName = `${index + 1}. ${item.product_name.substring(0, 26)}`;
    doc.text(pName, 5, y);
    doc.text(`Rs. ${Number(item.subtotal).toFixed(2)}`, pageWidth - 5, y, { align: 'right' });
    y += 3.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const details = item.size && item.size !== 'Regular' && item.size !== 'Standard'
      ? `${item.quantity} x Rs. ${Number(item.unit_price).toFixed(2)} (${item.size})`
      : `${item.quantity} x Rs. ${Number(item.unit_price).toFixed(2)}`;
    doc.text(details, 8, y);
    y += 4.5;
  });

  // Divider
  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, y, pageWidth - 5, y);
  y += 4;

  // Totals
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 5, y);
  doc.text(`Rs. ${Number(sale.subtotal).toFixed(2)}`, pageWidth - 5, y, { align: 'right' });
  y += 4;

  if (sale.discount_amount > 0) {
    doc.text('Discount:', 5, y);
    doc.text(`- Rs. ${Number(sale.discount_amount).toFixed(2)}`, pageWidth - 5, y, { align: 'right' });
    y += 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('GRAND TOTAL:', 5, y);
  doc.text(`Rs. ${Number(sale.grand_total).toFixed(2)}`, pageWidth - 5, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Payment Method: ${(sale.payment_method || 'CASH').toUpperCase()}`, 5, y);
  y += 3.5;
  doc.text(`Paid: Rs. ${Number(sale.paid_amount || sale.grand_total).toFixed(2)}`, 5, y);
  y += 3.5;

  if (sale.balance_amount > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Balance Due: Rs. ${Number(sale.balance_amount).toFixed(2)}`, 5, y);
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
  doc.text('Exchange strictly valid within 7 days with original bill.', pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text('Tags must be intact. No cash refunds.', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('THANK YOU FOR SHOPPING WITH US!', pageWidth / 2, y, { align: 'center' });

  return doc;
}

/**
 * Generates and downloads a clean, professional PDF invoice.
 * Bulletproof on both mobile browsers (Android/iOS) and desktop.
 */
export async function generateAndDownloadBillPdf(sale: Sale): Promise<void> {
  try {
    const doc = buildBillPdfDoc(sale);
    const fileName = `${sale.bill_number || 'bill'}.pdf`;

    // Generate PDF blob
    const pdfBlob = doc.output('blob');

    if (typeof window !== 'undefined') {
      const blobUrl = URL.createObjectURL(pdfBlob);

      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 1000);
    }
  } catch (err: any) {
    console.error('generateAndDownloadBillPdf failed:', err);
    throw new Error(err?.message || 'Could not generate PDF bill. Please check browser permissions.');
  }
}

/**
 * Native Web Share API helper for sharing PDF on supported mobile browsers
 */
export async function sharePdfNative(sale: Sale): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const doc = buildBillPdfDoc(sale);
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
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.warn('Native share failed or dismissed, fallback available:', e);
      }
    }
  }
  return false;
}
