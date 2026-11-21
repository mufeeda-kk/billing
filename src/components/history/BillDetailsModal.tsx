import React, { useState } from 'react';
import { Sale, Exchange } from '../../types';
import { triggerReceiptPrint } from '../../lib/receipt';
import { openWhatsAppShare } from '../../lib/whatsapp';
import { generateAndDownloadBillPdf } from '../../lib/pdf';
import { checkExchangeEligibility, formatCurrency, formatDateTimeIST } from '../../lib/date';
import { ExchangeModal } from '../exchange/ExchangeModal';
import { CancelBillModal } from './CancelBillModal';
import { EditBillModal } from './EditBillModal';
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
  ShieldAlert,
  Ban,
  Edit3,
  AlertTriangle
} from 'lucide-react';

interface BillDetailsModalProps {
  sale: Sale;
  onClose: () => void;
  onRefreshHistory: () => void;
}

export const BillDetailsModal: React.FC<BillDetailsModalProps> = ({
  sale: initialSale,
  onClose,
  onRefreshHistory
}) => {
  const [currentSale, setCurrentSale] = useState<Sale>(initialSale);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const isCancelled = currentSale.status === 'cancelled';
  const eligibility = checkExchangeEligibility(currentSale.created_at, isCancelled);

  const handlePdf = async () => {
    setIsDownloadingPdf(true);
    setPdfError(null);
    try {
      await generateAndDownloadBillPdf(currentSale);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      setPdfError(err?.message || 'Failed to download PDF invoice.');
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
          <div className={`px-4 py-3.5 text-white flex items-center justify-between ${
            isCancelled ? 'bg-rose-950' : 'bg-slate-900'
          }`}>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-wide font-mono">
                  {currentSale.bill_number}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  isCancelled ? 'bg-rose-600 text-white' :
                  currentSale.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                  currentSale.status === 'exchanged' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
                  'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}>
                  {currentSale.status.replace('_', ' ')}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Billed on {formatDateTimeIST(currentSale.created_at)} by {currentSale.created_by}
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cancelled Banner if cancelled */}
          {isCancelled ? (
            <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-900 text-xs flex items-start space-x-2">
              <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-black text-rose-950">THIS BILL HAS BEEN CANCELLED</div>
                <div className="text-[11px] mt-0.5">
                  Reason: <span className="font-semibold italic">"{currentSale.cancellation_reason || 'Cancelled by staff'}"</span>
                </div>
                <div className="text-[10px] text-rose-700 mt-0.5 font-mono">
                  Cancelled by {currentSale.cancelled_by || 'Staff'} • Stock was restored to inventory.
                </div>
              </div>
            </div>
          ) : (
            /* 7-Day Exchange Status Header Strip */
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
          )}

          {/* Body Content */}
          <div className="p-4 overflow-y-auto space-y-4 text-xs">
            
            {/* Customer Details if available */}
            {(currentSale.customer_name || currentSale.customer_phone) && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="font-bold text-slate-900">{currentSale.customer_name || 'Customer'}</div>
                    {currentSale.customer_phone && (
                      <div className="text-slate-500 font-mono text-[11px]">{currentSale.customer_phone}</div>
                    )}
                  </div>
                </div>
                {!isCancelled && (
                  <button
                    type="button"
                    onClick={() => openWhatsAppShare(currentSale)}
                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold text-[11px] flex items-center space-x-1 shadow-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Send Bill</span>
                  </button>
                )}
              </div>
            )}

            {/* Itemized Table */}
            <div>
              <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1.5">
                Purchased Items ({currentSale.items?.length || 0})
              </div>
              <div className="border border-slate-200 rounded-xl divide-y bg-slate-50 overflow-hidden">
                {currentSale.items?.map((item, idx) => (
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
                <span className="font-bold">{formatCurrency(currentSale.subtotal)}</span>
              </div>
              {currentSale.discount_amount > 0 && (
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span>Discount ({currentSale.discount_type}):</span>
                  <span>- {formatCurrency(currentSale.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 font-black text-sm pt-1 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="font-mono text-amber-600">{formatCurrency(currentSale.grand_total)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>Payment Mode:</span>
                <span className="font-bold uppercase text-slate-800">{currentSale.payment_method} ({currentSale.payment_status})</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Paid Amount:</span>
                <span className="font-bold text-slate-800">{formatCurrency(currentSale.paid_amount)}</span>
              </div>
              {currentSale.balance_amount > 0 && (
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>Balance Due:</span>
                  <span>{formatCurrency(currentSale.balance_amount)}</span>
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
                disabled={isCancelled}
                onClick={() => openWhatsAppShare(currentSale)}
                className={`py-2.5 px-2 font-bold rounded-xl flex items-center justify-center space-x-1 shadow-xs ${
                  isCancelled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
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

            {pdfError && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] text-center font-medium">
                {pdfError}
              </div>
            )}

            {/* EDIT & CANCEL BILL BUTTONS (CLEARLY VISIBLE ACTIONS) */}
            {!isCancelled && (
              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-xl flex items-center justify-center space-x-1.5 border border-slate-300 shadow-2xs"
                >
                  <Edit3 className="w-4 h-4 text-slate-700" />
                  <span>Edit Bill</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold rounded-xl flex items-center justify-center space-x-1.5 shadow-2xs"
                >
                  <Ban className="w-4 h-4 text-rose-600" />
                  <span>Cancel Bill</span>
                </button>
              </div>
            )}

            {/* EXCHANGE ACTION BUTTON (STRICT 7-DAY LOGIC) */}
            {!isCancelled && (
              <div className="pt-1">
                <button
                  type="button"
                  disabled={!eligibility.isEligible || currentSale.status === 'exchanged'}
                  onClick={() => setShowExchangeModal(true)}
                  className={`w-full py-3 px-4 rounded-xl font-black tracking-wide text-xs flex items-center justify-center space-x-2 shadow-md transition ${
                    !eligibility.isEligible || currentSale.status === 'exchanged'
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950'
                  }`}
                >
                  <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {currentSale.status === 'exchanged'
                      ? 'BILL FULLY EXCHANGED'
                      : !eligibility.isEligible
                      ? 'EXCHANGE EXPIRED (EXCEEDED 7 DAYS)'
                      : 'PROCESS CLOTHING EXCHANGE (7 DAYS)'}
                  </span>
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Exchange Flow Modal */}
      {showExchangeModal && (
        <ExchangeModal
          sale={currentSale}
          onClose={() => setShowExchangeModal(false)}
          onExchangeComplete={() => {
            onRefreshHistory();
            onClose();
          }}
        />
      )}

      {/* Cancel Bill Modal */}
      {showCancelModal && (
        <CancelBillModal
          sale={currentSale}
          onClose={() => setShowCancelModal(false)}
          onSuccess={(cancelled) => {
            setCurrentSale(cancelled);
            onRefreshHistory();
          }}
        />
      )}

      {/* Edit Bill Modal */}
      {showEditModal && (
        <EditBillModal
          sale={currentSale}
          onClose={() => setShowEditModal(false)}
          onSuccess={(updated) => {
            setCurrentSale(updated);
            onRefreshHistory();
          }}
        />
      )}
    </>
  );
};
