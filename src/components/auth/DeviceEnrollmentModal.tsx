import React, { useState } from 'react';
import { Smartphone, ShieldCheck, Lock, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const DeviceEnrollmentModal: React.FC = () => {
  const { enrollDevice, isCheckingAuth } = useAuth();
  const [selectedSlot, setSelectedSlot] = useState<number>(1);
  const [passphrase, setPassphrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const slotOptions = [
    { slot: 1, name: 'Phone 1 (Counter POS)', label: 'Main Counter Phone' },
    { slot: 2, name: 'Phone 2 (Floor Staff)', label: 'Floor Sales Staff' },
    { slot: 3, name: 'Phone 3 (Floor Staff)', label: 'Floor Sales Staff' }
  ];

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) {
      setErrorMsg('Please enter the Owner Setup Passphrase.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const slotInfo = slotOptions.find(s => s.slot === selectedSlot);
    const deviceName = slotInfo ? slotInfo.name : `Phone ${selectedSlot}`;

    const res = await enrollDevice(selectedSlot, deviceName, passphrase.trim());
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.message);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center animate-spin mb-4">
          <Loader2 className="w-6 h-6" />
        </div>
        <div className="text-white font-bold text-sm">Connecting to Store Cloud...</div>
        <div className="text-slate-400 text-xs mt-1">Verifying authorized device session</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
            <Smartphone className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-black tracking-wide text-white">
            VINTAGE CLOTHING STORE
          </h2>
          <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
            One-Time Device Authorization
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Authorize this phone to connect to the live shared cloud database. Once enrolled, the app opens directly to Billing with zero login screens.
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 flex items-start space-x-2 text-rose-300 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1 font-medium">{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleEnroll} className="space-y-4">
          {/* Slot Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              Select Device Slot (Maximum 3 Phones):
            </label>
            <div className="grid grid-cols-1 gap-2">
              {slotOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.slot}
                  onClick={() => setSelectedSlot(opt.slot)}
                  className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                    selectedSlot === opt.slot
                      ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-sm'
                      : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedSlot === opt.slot ? 'border-amber-500' : 'border-slate-500'
                    }`}>
                      {selectedSlot === opt.slot && (
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{opt.name}</div>
                      <div className="text-[10px] text-slate-400">{opt.label}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-slate-900/80 px-2 py-0.5 rounded-lg text-slate-400">
                    Slot #{opt.slot}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Passphrase Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              Store Owner Setup Secret:
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter secret from Supabase SQL migration"
                className="w-full pl-9 pr-10 py-3 bg-slate-950 border border-slate-700 rounded-2xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Only required once. Staff will never need to enter this during normal billing.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !passphrase.trim()}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs tracking-wider uppercase rounded-2xl shadow-lg transition flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authorizing Device...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                <span>Authorize & Open Billing</span>
              </>
            )}
          </button>
        </form>

        <div className="border-t border-slate-800 pt-3 text-center">
          <p className="text-[10px] text-slate-400">
            Hardware-backed persistent session: This phone will stay connected across app restarts and browser reloads.
          </p>
        </div>
      </div>
    </div>
  );
};
