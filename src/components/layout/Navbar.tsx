import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { useCart } from '../../context/CartContext';
import { SHOP_INFO } from '../../types';
import { 
  ShoppingBag, 
  UserCheck, 
  Wifi, 
  WifiOff, 
  ChevronDown, 
  Sparkles,
  PhoneCall
} from 'lucide-react';

interface NavbarProps {
  onOpenCart?: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCart, activeTab, setActiveTab }) => {
  const { currentUser, allStaff, switchUser } = useAuth();
  const { isOnline, isSupabaseLive, connectionStatus, lowStockCount } = useStore();
  const { totalQuantity } = useCart();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <div 
          onClick={() => setActiveTab('billing')}
          className="flex items-center space-x-2 cursor-pointer select-none"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black text-sm tracking-wider shadow">
            VCS
          </div>
          <div>
            <div className="font-extrabold text-sm sm:text-base tracking-wide flex items-center space-x-1.5 leading-none">
              <span>{SHOP_INFO.shop_name}</span>
            </div>
            <div className="text-[10px] text-amber-400 font-medium flex items-center space-x-1 mt-0.5">
              <span>MEN'S WEAR</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 flex items-center">
                <PhoneCall className="w-2.5 h-2.5 mr-0.5" /> 9072808380
              </span>
            </div>
          </div>
        </div>

        {/* Right Actions: Sync status, Staff Switcher, Cart Badge */}
        <div className="flex items-center space-x-2">
          
          {/* Realtime Sync Status Pill */}
          <button 
            type="button"
            onClick={() => setActiveTab('settings')}
            title={
              connectionStatus === 'connected' ? 'Connected to Supabase Cloud' :
              connectionStatus === 'syncing' ? 'Syncing with Supabase Cloud...' :
              'Offline / Supabase not connected. Click to open Settings.'
            }
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
              connectionStatus === 'connected'
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
                : connectionStatus === 'syncing'
                ? 'bg-amber-950/90 border-amber-500 text-amber-300 animate-pulse'
                : 'bg-rose-950/90 border-rose-500 text-rose-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-emerald-400' :
              connectionStatus === 'syncing' ? 'bg-amber-400 animate-ping' :
              'bg-rose-400'
            }`} />
            <span>
              {connectionStatus === 'connected' ? 'Connected' :
               connectionStatus === 'syncing' ? 'Syncing...' : 'Offline'}
            </span>
          </button>

          {/* Staff Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-700 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition-all"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
              <span className="max-w-[90px] sm:max-w-none truncate">{currentUser.full_name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserDropdown && (
              <div 
                className="absolute right-0 mt-1.5 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 animate-fade-in"
                onClick={() => setShowUserDropdown(false)}
              >
                <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] text-slate-400 font-medium">
                  SWITCH ACTIVE STAFF (3 USERS)
                </div>
                {allStaff.map(staff => (
                  <button
                    key={staff.id}
                    onClick={() => switchUser(staff.id)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800 transition ${
                      currentUser.id === staff.id ? 'bg-slate-800 text-amber-400 font-bold' : 'text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${currentUser.id === staff.id ? 'bg-amber-400' : 'bg-slate-600'}`} />
                      <span>{staff.full_name}</span>
                    </div>
                    <span className="text-[10px] uppercase text-slate-400 font-mono">{staff.role}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart Floating Button (Primary for Mobile Billing) */}
          <button
            onClick={onOpenCart}
            className={`relative flex items-center justify-center p-2 rounded-lg font-bold transition-all ${
              totalQuantity > 0 
                ? 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-lg shadow-amber-500/20' 
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="Open Cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalQuantity > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow border-2 border-slate-900">
                {totalQuantity}
              </span>
            )}
          </button>

        </div>
      </div>
    </header>
  );
};
