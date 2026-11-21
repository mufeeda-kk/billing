import React, { useState } from 'react';
import { Sale } from '../../types';
import { triggerReceiptPrint } from '../../lib/receipt';
import { openWhatsAppShare } from '../../lib/whatsapp';
import { generateAndDownloadBillPdf, sharePdfNative } from '../../lib/pdf';
import { formatCurrency, formatDateTimeIST } from '../../lib/date';
import { 
  CheckCircle, 
  Printer, 
  MessageCircle, 
  Download, 
  Share2, 
  PlusCircle, 
  Phone
} from 'lucide-react';

interface BillSuccessModalProps {
  sale: Sale;
  onNewBill: () => void;
  onViewDetails?: () => void;
}

export const BillSuccessModal: React.FC<BillSuccessModalProps> = ({
  sale,
  onNewBill,
  onViewDetails
}) => {
  const [targetPhone, setTargetPhone] = useState(sale.customer_phone || '');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [pdfError, setPdfError] = useState<string | null>(null);

  // Fast WhatsApp sharing (ZERO lag, does not wait for PDF!)
  const handleWhatsAppShare = () => {
    openWhatsAppShare(sale, targetPhone);
  };

  // Thermal Receipt Printing
  const handlePrint = () => {
    triggerReceiptPrint();
  };

  // Direct PDF Download
  const handlePdfDownload = async () => {
    setIsGeneratingPdf(true);
    setPdfError(null);
    try {
      await generateAndDownloadBillPdf(sale);
    } catch (e: any) {
      console.error('PDF error:', e);
      setPdfError(e?.message || 'Could not download PDF. Please check browser permissions.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
      <div 
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Success Banner */}
        <div className="bg-emerald-600 text-white p-5 text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-2">
            <CheckCircle className="w-8 h-8 text-white stroke-[2.5]" />
          </div>
          <h2 className="font-black text-lg tracking-wide">BILL GENERATED!</h2>
          <div className="font-mono text-xs opacity-90 mt-0.5">#{sale.bill_number}</div>
          <div className="text-2xl font-black text-amber-300 mt-2 font-mono">
            {formatCurrency(sale.grand_total)}
          </div>
          <div className="text-[11px] opacity-80 mt-0.5">
            Paid via {sale.payment_method.toUpperCase()} • {formatDateTimeIST(sale.created_at)}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 space-y-3">
          
          {/* 1. WHATSAPP BILL SHARE (Top priority - Instant) */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-900">
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>Share Bill on WhatsApp</span>
            </div>
            
            <div className="flex space-x-1.5">
              <div className="relative flex-1">
                <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="Enter WhatsApp Number"
                  value={targetPhone}
                  onChange={e => setTargetPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-8 pr-2 py-1.5 text-xs border border-emerald-300 rounded-lg bg-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow flex items-center space-x-1"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>
          </div>

          {/* 2. PRINT RECEIPT (Thermal & A4) */}
          <button
            type="button"
            onClick={handlePrint}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold text-xs tracking-wide shadow flex items-center justify-center space-x-2"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>PRINT RECEIPT (58mm / A4)</span>
          </button>

          {/* 3. DOWNLOAD PDF */}
          <button
            type="button"
            disabled={isGeneratingPdf}
            onClick={handlePdfDownload}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center space-x-2 transition"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>{isGeneratingPdf ? 'Downloading PDF...' : 'Download PDF Invoice'}</span>
          </button>

          {pdfError && (
            <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] text-center font-medium">
              {pdfError}
            </div>
          )}

          {/* 4. NEW BILL (Dismiss & Start Next) */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onNewBill}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs tracking-wider shadow-md flex items-center justify-center space-x-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>START NEXT BILL</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
