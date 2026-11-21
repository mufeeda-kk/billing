# VINTAGE CLOTHING STORE
## Mobile-First Billing & Inventory Management System

Production-ready shop management web application built for **VINTAGE CLOTHING STORE**.
Optimized for one-handed smartphone operation, fast checkout, variant-aware clothing stock, atomic concurrency, 7-day clothing exchanges, and instant WhatsApp bill sharing.

---

### Shop Details (Included in Invoices, Thermal Receipts & WhatsApp)
- **Store Name:** VINTAGE CLOTHING STORE
- **Contact Numbers:** 
  - `9072808380`
  - `9744223557`
- **Location:** Men's Wear & Lifestyle, Kerala, India
- **Timezone:** `Asia/Kolkata` (IST)

---

### Key Features

1. **Lightning-Fast Mobile Billing (Primary View)**:
   - Instant search by product name, SKU, or barcode.
   - Variant-aware clothing selection (Size + Color) with live stock counters.
   - One-handed quantity stepper and quick cart drawer.
   - Optional customer name & phone (does not slow down billing).
   - Flexible optional discount (Percentage % or Flat ₹) with automatic calculation and cap validation.
   - Payment modes: Cash, UPI / GPay, Card, Split / Credit (with outstanding balance tracking).
   - Atomic checkout prevention: locks submission to prevent duplicate bills upon multiple taps.

2. **Instant Thermal Print, WhatsApp & PDF Sharing**:
   - **WhatsApp Sharing**: Generates prefilled `wa.me` message in microseconds with zero lag (no external subscription or delay).
   - **Thermal Printer Receipt**: Formatted specifically for standard 58mm and 80mm thermal receipt printers with one-click print.
   - **PDF Invoice**: Fast client-side generation using `jsPDF` with native Web Share API support on iOS/Android.

3. **Strict 7-Day Clothing Exchange Workflow**:
   - Policy strictly enforced both on UI and PostgreSQL database level: exchange is blocked if > 7 days have passed from the original bill date.
   - Partial exchange supported: select which items to return with quantity limits (cannot return more than purchased).
   - Select replacement clothing items with instant variant stock checks.
   - Difference calculation:
     - Replacement > Return: Collects extra payment via Cash/UPI/Card.
     - Replacement < Return: Gives customer Cash refund, UPI refund, or Store Credit.
     - Replacement = Return: Even exchange.
   - Atomically restores returned stock (+qty) and deducts replacement stock (-qty).

4. **Variant-Aware Clothing Inventory**:
   - Each size/color combination (e.g. Oversized Tee: Black / L) is tracked as an individual variant stock unit.
   - Low-stock warnings and out-of-stock badges.
   - Stock adjustments with mandatory audit reason.
   - Stock Purchase Entry: Inward new clothing shipments from suppliers to increase inventory.

5. **3 Concurrent Users with Shared Live Data**:
   - Built for 3 staff members operating simultaneously from 3 different mobile phones.
   - Shared cloud database via Supabase (PostgreSQL + Realtime).
   - Row-level database locks (`SELECT ... FOR UPDATE`) in `process_sale_transaction` to prevent race conditions when two staff try to sell the last garment piece at the same time.
   - Fallback shared live mode via `BroadcastChannel` for instant multi-tab testing.

6. **Sales & Profit Reports**:
   - Daily (Today/Yesterday), Weekly, Monthly, and Custom date ranges.
   - Total revenue, items sold, total discounts given.
   - Cash vs UPI vs Card payment splits.
   - Gross profit estimate (Selling price - Purchase cost).
   - Integrated shop expense tracker (Net Profit = Gross Profit - Expenses).
   - Top-selling clothing items and popular size breakdowns.

---

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend & Database**: Supabase (PostgreSQL + Realtime + Row Level Security)
- **PDF Generation**: jsPDF
- **Icons**: Lucide React

---

### Supabase Cloud Setup (3-Step Quick Guide)

1. Create a free Supabase project at [https://supabase.com](https://supabase.com).
2. Go to **SQL Editor** in your Supabase dashboard and run the entire script in:
   ```text
   supabase/migrations/20261121_initial_schema.sql
   ```
   *(This creates all tables, foreign keys, row-level locks, RLS policies, and stored procedures for atomic checkout and 7-day exchanges).*
3. Copy your project **URL** and **anon public key** from Supabase Settings -> API, and either:
   - Create a `.env` file based on `.env.example`:
     ```env
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key-here
     ```
   - **OR** simply paste them directly inside the app under **More -> Settings**!

---

### Development & Build Commands

```bash
# Install dependencies
npm install

# Start local mobile dev server
npm run dev

# Build production bundle
npm run build

# Preview production build
npm run preview
```
