import React, { useState, useEffect } from 'react';
import { Expense } from '../types';
import { db } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { formatCurrency, formatDateIST } from '../lib/date';
import { 
  Wallet, 
  Plus, 
  X, 
  Calendar, 
  Filter, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Tea & Refreshments',
  'Shop Rent',
  'Electricity & Utilities',
  'Staff Salary & Advance',
  'Carry Bags & Packaging',
  'Alterations & Tailoring',
  'Cleaning & Maintenance',
  'Shop Transportation / Travel',
  'Other'
];

export const ExpensesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useStore();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      const data = await db.getExpenses();
      setExpenses(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!title.trim() || isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid title and positive amount.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await db.createExpense({
        title: title.trim(),
        category,
        amount: amt,
        payment_method: paymentMethod,
        notes: notes.trim(),
        added_by: currentUser.full_name,
        expense_date: expenseDate
      });

      showToast('Expense recorded', 'success');
      setShowAddModal(false);
      // Reset
      setTitle('');
      setAmount('');
      setNotes('');
      loadExpenses();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="pb-24 pt-2 max-w-7xl mx-auto px-3 sm:px-4">
      {/* Header */}
      <div className="sticky top-14 z-30 bg-slate-100/95 backdrop-blur-xs py-2 flex items-center justify-between">
        <div>
          <h1 className="font-black text-base sm:text-lg tracking-wide text-slate-900">
            SHOP EXPENSES
          </h1>
          <p className="text-xs text-slate-500">Track daily store overheads</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow"
        >
          <Plus className="w-4 h-4 text-amber-400 stroke-[3]" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Total Card */}
      <div className="mt-2 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-rose-800">TOTAL EXPENSES RECORDED</div>
          <div className="font-mono font-black text-xl text-rose-900 mt-0.5">
            {formatCurrency(totalExpenseAmount)}
          </div>
        </div>
        <Wallet className="w-8 h-8 text-rose-400 stroke-[1.5]" />
      </div>

      {/* Expenses List */}
      <div className="mt-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-200 rounded-xl animate-pulse" />)}
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Wallet className="w-10 h-10 mx-auto text-slate-400 mb-2 stroke-[1.5]" />
            <p className="font-bold text-sm">No expenses recorded</p>
          </div>
        ) : (
          expenses.map(exp => (
            <div key={exp.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-2xs">
              <div>
                <div className="font-bold text-xs text-slate-900">{exp.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  <span className="font-semibold">{exp.category}</span> • {formatDateIST(exp.expense_date)} • by {exp.added_by}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold font-mono text-xs text-rose-600">
                  - {formatCurrency(exp.amount)}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">
                  {exp.payment_method}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">RECORD SHOP EXPENSE</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="p-4 space-y-3 text-xs">
              {errorMsg && (
                <div className="p-2 bg-rose-50 text-rose-800 rounded-lg flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Expense Title / Item *</label>
                <input
                  type="text"
                  placeholder="e.g. Tea & snacks for staff"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl font-medium"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 150"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-bold font-mono text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Date</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                >
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white uppercase font-bold"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / GPay</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow"
                >
                  {isSubmitting ? 'Saving...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
