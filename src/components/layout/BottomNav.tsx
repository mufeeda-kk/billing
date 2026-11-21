import React from 'react';
import { 
  ShoppingBag, 
  Receipt, 
  Boxes, 
  BarChart3, 
  Menu 
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useStore } from '../../context/StoreContext';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenMoreMenu: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, onOpenMoreMenu }) => {
  const { totalQuantity } = useCart();
  const { lowStockCount } = useStore();

  const navItems = [
    {
      id: 'billing',
      label: 'New Bill',
      icon: ShoppingBag,
      badge: totalQuantity > 0 ? totalQuantity : null
    },
    {
      id: 'history',
      label: 'Bills',
      icon: Receipt,
      badge: null
    },
    {
      id: 'inventory',
      label: 'Stock',
      icon: Boxes,
      badge: lowStockCount > 0 ? '!' : null,
      badgeColor: 'bg-amber-500 text-slate-950'
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      badge: null
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-2xl safe-area-pb">
      <div className="max-w-md mx-auto grid grid-cols-5 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 transition-colors select-none ${
                isActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {item.badge !== null && (
                  <span className={`absolute -top-1.5 -right-2.5 text-[10px] font-black px-1.5 py-0.2 rounded-full border border-slate-900 ${
                    item.badgeColor || 'bg-rose-500 text-white'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute top-0 w-8 h-0.5 bg-amber-400 rounded-full" />
              )}
            </button>
          );
        })}

        {/* More Menu Option for Expenses, Stock Purchase, Customers, Activity, Settings */}
        <button
          onClick={onOpenMoreMenu}
          className={`flex flex-col items-center justify-center py-1 select-none transition-colors ${
            ['purchases', 'expenses', 'customers', 'activity', 'settings'].includes(activeTab)
              ? 'text-amber-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Menu className="w-5 h-5 stroke-[1.8]" />
          <span className="text-[10px] mt-1 font-medium tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
};
