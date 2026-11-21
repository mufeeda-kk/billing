import React from 'react';
import { Sale } from '../../types';
import { generateThermalReceiptHtml } from '../../lib/receipt';

interface PrintReceiptContainerProps {
  sale: Sale | null;
}

export const PrintReceiptContainer: React.FC<PrintReceiptContainerProps> = ({ sale }) => {
  if (!sale) return null;

  return (
    <div 
      className="print-receipt-container hidden"
      dangerouslySetInnerHTML={{ __html: generateThermalReceiptHtml(sale) }}
    />
  );
};
