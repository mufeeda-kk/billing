import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { CartProvider } from './context/CartContext';
import { Navbar } from './components/layout/Navbar';
import { BottomNav } from './components/layout/BottomNav';
import { MoreMenuModal } from './components/layout/MoreMenuModal';
import { CartDrawer } from './components/billing/CartDrawer';
import { BillSuccessModal } from './components/billing/BillSuccessModal';
import { PrintReceiptContainer } from './components/billing/PrintReceiptContainer';
import { Sale } from './types';

// Pages
import { BillingPage } from './pages/BillingPage';
import { BillHistoryPage } from './pages/BillHistoryPage';
import { InventoryPage } from './pages/InventoryPage';
import { ReportsPage } from './pages/ReportsPage';
import { PurchasePage } from './pages/PurchasePage';
import { ExpensesPage } from './pages/ExpensesPage';
import { CustomersPage } from './pages/CustomersPage';
import { ActivityLogPage } from './pages/ActivityLogPage';
import { SettingsPage } from './pages/SettingsPage';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('billing');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isGlobalCartOpen, setIsGlobalCartOpen] = useState(false);
  const [globalCompletedSale, setGlobalCompletedSale] = useState<Sale | null>(null);

  const renderActivePage = () => {
    switch (activeTab) {
      case 'billing':
        return <BillingPage />;
      case 'history':
        return <BillHistoryPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'reports':
        return <ReportsPage />;
      case 'purchases':
        return <PurchasePage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'customers':
        return <CustomersPage />;
      case 'activity':
        return <ActivityLogPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <BillingPage />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 selection:bg-amber-500 selection:text-white">
      {/* Top Mobile-First Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCart={() => setIsGlobalCartOpen(true)}
      />

      {/* Main Page Body */}
      <main className="flex-1 w-full">
        {renderActivePage()}
      </main>

      {/* Bottom Thumb-Friendly Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenMoreMenu={() => setIsMoreMenuOpen(true)}
      />

      {/* More Sub-Menu Drawer */}
      <MoreMenuModal
        isOpen={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
      />

      {/* Global Cart Drawer (Accessible from Navbar on any screen) */}
      <CartDrawer
        isOpen={isGlobalCartOpen}
        onClose={() => setIsGlobalCartOpen(false)}
        onBillSuccess={(sale) => setGlobalCompletedSale(sale)}
      />

      {/* Post-Bill Success Modal */}
      {globalCompletedSale && (
        <BillSuccessModal
          sale={globalCompletedSale}
          onNewBill={() => {
            setGlobalCompletedSale(null);
            setActiveTab('billing');
          }}
        />
      )}

      {/* Print Receipt Container */}
      <PrintReceiptContainer sale={globalCompletedSale} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <StoreProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </StoreProvider>
    </AuthProvider>
  );
};

export default App;
