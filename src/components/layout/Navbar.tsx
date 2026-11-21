import React from 'react';
import { useCart } from '../../context/CartContext';
import { SHOP_INFO } from '../../types';
import { ShoppingBag, PhoneCall } from 'lucide-react';

interface NavbarProps {
  onOpenCart?: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCart, activeTab, setActiveTab }) => {
  const { totalQuantity } = useCart();

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <div 
          onClick={() => setActiveTab('billing')}
          className="flex items-center space-x-2.5 cursor-pointer select-none"
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

        {/* Right Action: Clean Quick Cart Badge if items present */}
        {totalQuantity > 0 && onOpenCart && (
          <button
            type="button"
            onClick={onOpenCart}
            className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 px-3 py-1.5 rounded-xl font-black text-xs shadow-md transition"
          >
            <ShoppingBag className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Bill ({totalQuantity})</span>
          </button>
        )}
      </div>
    </header>
  );
};
