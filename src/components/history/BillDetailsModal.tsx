import React, { useState } from 'react';
import { Sale, Exchange } from '../../types';
import { triggerReceiptPrint } from '../../lib/receipt';
import { openWhatsAppShare } from '../../lib/whatsapp';
import { generateAndDownloadBillPdf } from '../../lib/pdf';
import { checkExchangeEligibility, formatCurrency, formatDateTimeIST } from '../../lib/date';
import { ExchangeModal } from '../exchange/ExchangeModal';
import { 
  X, 
  Printer, 
  MessageCircle, 
  Download, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
  User, 
  Phone, 
  ShieldCheck, 
  ShieldAlert 
} from 'lucide-react';

interface BillDetailsModalProps {
  sale: Sale;
  onClose: () => void;
  onRefreshHistory: () => void;
}

export const BillDetailsModal: React.FC<BillDetailsModalProps> = ({
  sale,
  onClose,
  onRefreshHistory
}) => {
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const eligibility = checkExchangeEligibility(sale.created_at);

  const handlePdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await generateAndDownloadBillPdf(sale);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 animate-fade-in"
        onClick={onClose}
      >
        <div 
          className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-wide font-mono">
                  {sale.bill_number}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  sale.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                  sale.status === 'exchanged' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
                  sale.status === 'partially_exchanged' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                  'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}>
                  {sale.status.replace('_', ' ')}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Billed on {formatDateTimeIST(sale.created_at)} by {sale.created_by}
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 7-Day Exchange Status Header Strip */}
          <div className={`px-4 py-2 flex items-center justify-between text-xs font-semibold ${
            eligibility.isEligible ? eligibility.badgeColor : 'bg-rose-50 text-rose-800'
          }`}>
            <div className="flex items-center space-x-1.5">
              {eligibility.isEligible ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />}
              <span>{eligibility.reason}</span>
            </div>
            <div className="text-[11px] font-mono">
              Policy: 7 Days
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 overflow-y-auto space-y-4 text-xs">
            
            {/* Customer Details if available */}
            {(sale.customer_name || sale.customer_phone) && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="font-bold text-slate-900">{sale.customer_name || 'Customer'}</div>
                    {sale.customer_phone && (
                      <div className="text-slate-500 font-mono text-[11px]">{sale.customer_phone}</div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openWhatsAppShare(sale)}
                  className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold text-[11px] flex items-center space-x-1 shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Send Bill</span>
                </button>
              </div>
            )}

            {/* Itemized Table */}
            <div>
              <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1.5">
                Purchased Items ({sale.items?.length || 0})
              </div>
              <div className="border border-slate-200 rounded-xl divide-y bg-slate-50 overflow-hidden">
                {sale.items?.map((item, idx) => (
                  <div key={item.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        {idx + 1}. {item.product_name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Size: <span className="font-semibold text-slate-700">{item.size}</span> | Color: <span className="font-semibold text-slate-700">{item.color}</span> | {item.quantity} x {formatCurrency(item.unit_price)}
                      </div>
                      {item.returned_quantity > 0 && (
                        <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                          ⚠️ {item.returned_quantity} units exchanged/returned
                        </div>
                      )}
                    </div>
                    <div className="font-bold text-slate-900 font-mono text-xs">
                      {formatCurrency(item.subtotal)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="p-3 bg-slate-100 rounded-xl space-y-1 text-slate-700">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-bold">{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discount_amount > 0 && (
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span>Discount ({sale.discount_type}):</span>
                  <span>- {formatCurrency(sale.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 font-black text-sm pt-1 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="font-mono text-amber-600">{formatCurrency(sale.grand_total)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>Payment Mode:</span>
                <span className="font-bold uppercase text-slate-800">{sale.payment_method} ({sale.payment_status})</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Paid Amount:</span>
                <span className="font-bold text-slate-800">{formatCurrency(sale.paid_amount)}</span>
              </div>
              {sale.balance_amount > 0 && (
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>Balance Due:</span>
                  <span>{formatCurrency(sale.balance_amount)}</span>
                </div>
              )}
            </div>

            {/* Actions: Print / PDF / WhatsApp */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => triggerReceiptPrint()}
                className="py-2.5 px-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center space-x-1 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Print Bill</span>
              </button>

              <button
                type="button"
                onClick={() => openWhatsAppShare(sale)}
                className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center space-x-1 shadow-xs"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                disabled={isDownloadingPdf}
                onClick={handlePdf}
                className="py-2.5 px-2 border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold rounded-xl flex items-center justify-center space-x-1"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>{isDownloadingPdf ? '...' : 'PDF'}</span>
              </button>
            </div>

            {/* EXCHANGE ACTION BUTTON (STRICT 7-DAY LOGIC) */}
            <div className="pt-2 border-t border-slate-200">
              <button
                type="button"
                disabled={!eligibility.isEligible || sale.status === 'exchanged'}
                onClick={() => setShowExchangeModal(true)}
                className={`w-full py-3 px-4 rounded-xl font-black tracking-wide text-xs flex items-center justify-center space-x-2 shadow-md transition ${
                  !eligibility.isEligible || sale.status === 'exchanged'
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950'
                }`}
              >
                <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                <span>
                  {sale.status === 'exchanged'
                    ? 'BILL FULLY EXCHANGED'
                    : !eligibility.isEligible
                    ? 'EXCHANGE EXPIRED (EXCEEDED 7 DAYS)'
                    : 'PROCESS CLOTHING EXCHANGE (7 DAYS)'}
                </span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Exchange Flow Modal */}
      {showExchangeModal && (
        <ExchangeModal
          sale={sale}
          onClose={() => setShowExchangeModal(false)}
          onExchangeComplete={() => {
            onRefreshHistory();
            onClose();
          }}
        />
      )}
    </>
  );
};
