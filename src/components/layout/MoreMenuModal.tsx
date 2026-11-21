import React from 'react';
import { 
  PackagePlus, 
  Wallet, 
  Users, 
  Activity, 
  Settings, 
  X,
  ChevronRight
} from 'lucide-react';

interface MoreMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

export const MoreMenuModal: React.FC<MoreMenuModalProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  if (!isOpen) return null;

  const menuItems = [
    {
      id: 'purchases',
      label: 'Purchases',
      desc: 'Receive new stock into inventory',
      icon: PackagePlus,
      color: 'text-emerald-600 bg-emerald-50'
    },
    {
      id: 'expenses',
      label: 'Expenses',
      desc: 'Track daily tea, rent, utilities',
      icon: Wallet,
      color: 'text-rose-600 bg-rose-50'
    },
    {
      id: 'customers',
      label: 'Customers',
      desc: 'Customer details & purchase history',
      icon: Users,
      color: 'text-blue-600 bg-blue-50'
    },
    {
      id: 'activity',
      label: 'Activity Log',
      desc: 'Staff activity & audit trail',
      icon: Activity,
      color: 'text-amber-600 bg-amber-50'
    },
    {
      id: 'settings',
      label: 'Settings',
      desc: 'Supabase cloud & shop settings',
      icon: Settings,
      color: 'text-slate-700 bg-slate-100'
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-extrabold text-sm tracking-wide">STORE MANAGEMENT</h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 divide-y divide-slate-100">
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer rounded-xl transition select-none"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-900">{item.label}</div>
                    <div className="text-[11px] text-slate-500">{item.desc}</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
