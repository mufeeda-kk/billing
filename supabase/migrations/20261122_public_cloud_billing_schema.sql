-- ============================================================================
-- VINTAGE CLOTHING STORE - PUBLIC CLOUD-BASED SHOP MANAGEMENT SCHEMA
-- Migration Date: 2026-11-22
-- Version: 5.0.0 (Public Cloud Access - Zero Login - Unlimited Multi-Device)
--
-- ARCHITECTURE HIGHLIGHTS:
-- 1. ZERO AUTHENTICATION: Direct unauthenticated public access via Supabase anon role.
-- 2. UNLIMITED MULTI-DEVICE: Unlimited phones, tablets & laptops share one central DB.
-- 3. PERMISSIVE RLS: Full read/write policies for anon & authenticated roles.
-- 4. AUTHORITATIVE SERVER BILLING: process_sale_transaction computes totals in DB.
-- 5. DEADLOCK PREVENTION: Variant row locks ordered by variant_id ASC.
-- 6. ONE-ITEM-ONE-STOCK: Simplified inventory model with auto-SKU sequences.
-- 7. ATOMIC BILL CANCELLATION: cancel_sale_transaction restores stock safely.
-- 8. EXPENSES & COGS: Historical purchase_price preserved in sale_items for P&L.
-- 9. SUPABASE REALTIME: Live sync on products, stock, sales, items, and expenses.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS & SEQUENCES
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SEQUENCE IF NOT EXISTS public.sale_bill_seq START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.product_sku_seq START WITH 10001 INCREMENT BY 1;

-- ----------------------------------------------------------------------------
-- 2. CORE BUSINESS TABLES
-- ----------------------------------------------------------------------------

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products (Simplified: 1 product = 1 primary stock record)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    category_name TEXT NOT NULL DEFAULT 'General',
    selling_price NUMERIC(10, 2) NOT NULL CHECK (selling_price >= 0),
    purchase_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (purchase_price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Product Variants (Holds inventory quantity; size 'Regular', color 'Standard' for simple products)
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_sku TEXT UNIQUE NOT NULL,
    size TEXT NOT NULL DEFAULT 'Regular',
    color TEXT NOT NULL DEFAULT 'Standard',
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    low_stock_threshold INT NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    phone TEXT UNIQUE NOT NULL,
    total_purchases NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_purchases >= 0),
    total_bills INT NOT NULL DEFAULT 0 CHECK (total_bills >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sales (Bills)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    discount_type TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none', 'percentage', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_value >= 0),
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    grand_total NUMERIC(10, 2) NOT NULL CHECK (grand_total >= 0),
    paid_amount NUMERIC(10, 2) NOT NULL CHECK (paid_amount >= 0),
    balance_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (balance_amount >= 0),
    payment_method TEXT NOT NULL DEFAULT 'cash',
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
    notes TEXT,
    created_by TEXT NOT NULL DEFAULT 'Shop Staff',
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'exchanged', 'partially_exchanged', 'cancelled')),
    cancellation_reason TEXT,
    cancelled_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sale Items (Stores historical purchase_price for accurate Cost of Goods Sold calculations)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    size TEXT NOT NULL DEFAULT 'Regular',
    color TEXT NOT NULL DEFAULT 'Standard',
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    purchase_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (purchase_price >= 0),
    returned_quantity INT NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock Movements (Complete inventory audit trail)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    change_qty INT NOT NULL,
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    movement_type TEXT NOT NULL,
    reference_id UUID,
    reference_number TEXT,
    reason TEXT,
    performed_by TEXT NOT NULL DEFAULT 'Shop Staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expenses (Shop operating expense tracker for Net Profit calculations)
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'cash',
    notes TEXT,
    added_by TEXT NOT NULL DEFAULT 'Shop Staff',
    expense_date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchases (Supplier Inward Orders)
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT,
    supplier_name TEXT NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'received',
    notes TEXT,
    created_by TEXT NOT NULL DEFAULT 'Shop Staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase Items
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(10, 2) NOT NULL CHECK (unit_cost >= 0),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exchanges
CREATE TABLE IF NOT EXISTS public.exchanges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_sale_id UUID REFERENCES public.sales(id) ON DELETE RESTRICT,
    exchange_bill_number TEXT UNIQUE NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    total_returned_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_new_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    difference_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    created_by TEXT NOT NULL DEFAULT 'Shop Staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exchange Items
CREATE TABLE IF NOT EXISTS public.exchange_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exchange_id UUID NOT NULL REFERENCES public.exchanges(id) ON DELETE CASCADE,
    return_sale_item_id UUID,
    return_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    return_qty INT NOT NULL DEFAULT 0,
    return_unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    new_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    new_qty INT NOT NULL DEFAULT 0,
    new_unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    staff_name TEXT NOT NULL DEFAULT 'Shop Staff',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2B. SCHEMA REPAIR & COMPATIBILITY (Safe ALTER TABLE for Existing Databases)
-- ----------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_name TEXT NOT NULL DEFAULT 'General';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS size TEXT NOT NULL DEFAULT 'Regular';
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT 'Standard';
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS low_stock_threshold INT NOT NULL DEFAULT 5;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'none';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS returned_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00;

-- ----------------------------------------------------------------------------
-- 3. PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_search ON public.products(name, sku, category_name);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active, is_archived);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_bill_number ON public.sales(bill_number);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON public.stock_movements(variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);

-- ----------------------------------------------------------------------------
-- 4. PUBLIC STORED PROCEDURES (NO AUTH GATES - SECURITY DEFINER)
-- ----------------------------------------------------------------------------

-- A. Concurrency-Safe, Deadlock-Free POS Checkout
CREATE OR REPLACE FUNCTION public.process_sale_transaction(
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_discount_type TEXT DEFAULT 'none',
    p_discount_value NUMERIC DEFAULT 0.00,
    p_paid_amount NUMERIC DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'cash',
    p_notes TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::JSONB,
    p_subtotal NUMERIC DEFAULT NULL,
    p_discount_amount NUMERIC DEFAULT NULL,
    p_grand_total NUMERIC DEFAULT NULL,
    p_balance_amount NUMERIC DEFAULT NULL,
    p_payment_status TEXT DEFAULT NULL,
    p_created_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sale_id UUID;
    v_bill_num TEXT;
    v_staff_name TEXT;
    v_item JSONB;
    v_agg RECORD;
    v_prod_rec RECORD;
    v_computed_subtotal NUMERIC(10, 2) := 0.00;
    v_computed_discount NUMERIC(10, 2) := 0.00;
    v_computed_grand_total NUMERIC(10, 2) := 0.00;
    v_computed_balance NUMERIC(10, 2) := 0.00;
    v_payment_status TEXT;
    v_cust_id UUID := NULL;
    v_clean_phone TEXT;
BEGIN
    v_staff_name := COALESCE(NULLIF(trim(p_created_by), ''), 'Shop Staff');

    -- Validate items array
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cart is empty.');
    END IF;

    -- Concurrency-safe unique bill number
    v_bill_num := 'VCS-' || TO_CHAR(now() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD') || '-' || LPAD(nextval('public.sale_bill_seq')::TEXT, 4, '0');

    -- Deadlock-free row-locking: Aggregate cart items by variant_id and lock in ascending sorted order
    CREATE TEMP TABLE temp_cart_agg ON COMMIT DROP AS
    SELECT 
        (elem->>'variant_id')::UUID AS variant_id,
        (elem->>'product_id')::UUID AS product_id,
        SUM((elem->>'quantity')::INT) AS total_quantity
    FROM jsonb_array_elements(p_items) AS elem
    GROUP BY (elem->>'variant_id')::UUID, (elem->>'product_id')::UUID
    ORDER BY (elem->>'variant_id')::UUID ASC;

    -- Verify product status, variant belonging, and stock availability
    FOR v_agg IN SELECT * FROM temp_cart_agg
    LOOP
        IF v_agg.total_quantity <= 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Invalid item quantity: must be greater than zero.');
        END IF;

        SELECT p.id AS product_id, p.name, p.selling_price, p.purchase_price, p.is_active, p.is_archived, pv.stock_quantity
        INTO v_prod_rec
        FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
        WHERE pv.id = v_agg.variant_id
          AND pv.product_id = v_agg.product_id
        FOR UPDATE; -- Prevents concurrent overselling

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Item variant does not match product or no longer exists.');
        END IF;

        IF NOT v_prod_rec.is_active OR v_prod_rec.is_archived THEN
            RETURN jsonb_build_object('success', false, 'error', 'Product "' || v_prod_rec.name || '" is inactive or archived.');
        END IF;

        IF v_prod_rec.stock_quantity < v_agg.total_quantity THEN
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock for "' || v_prod_rec.name || '". In stock: ' || v_prod_rec.stock_quantity || ', requested: ' || v_agg.total_quantity);
        END IF;
    END LOOP;

    -- Authoritative server pricing and subtotal calculation
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT p.selling_price INTO v_prod_rec
        FROM public.products p
        JOIN public.product_variants pv ON pv.product_id = p.id
        WHERE pv.id = (v_item->>'variant_id')::UUID;

        v_computed_subtotal := v_computed_subtotal + (v_prod_rec.selling_price * (v_item->>'quantity')::INT);
    END LOOP;

    -- Authoritative discount calculation
    IF p_discount_type = 'percentage' AND p_discount_value > 0 THEN
        v_computed_discount := ROUND(v_computed_subtotal * (LEAST(100.0, GREATEST(0.0, p_discount_value)) / 100.0), 2);
    ELSIF p_discount_type = 'fixed' AND p_discount_value > 0 THEN
        v_computed_discount := LEAST(v_computed_subtotal, GREATEST(0.0, p_discount_value));
    ELSE
        v_computed_discount := 0.00;
    END IF;

    v_computed_grand_total := GREATEST(0.00, v_computed_subtotal - v_computed_discount);
    v_computed_balance := GREATEST(0.00, v_computed_grand_total - COALESCE(p_paid_amount, v_computed_grand_total));
    v_payment_status := CASE WHEN v_computed_balance = 0.00 THEN 'paid' WHEN p_paid_amount > 0 THEN 'partial' ELSE 'unpaid' END;

    -- Customer Auto-Upsert
    v_clean_phone := regexp_replace(COALESCE(p_customer_phone, ''), '\D', '', 'g');
    IF length(v_clean_phone) >= 10 THEN
        INSERT INTO public.customers (phone, name, total_purchases, total_bills)
        VALUES (v_clean_phone, trim(p_customer_name), v_computed_grand_total, 1)
        ON CONFLICT (phone) DO UPDATE SET
            name = COALESCE(NULLIF(trim(p_customer_name), ''), public.customers.name),
            total_purchases = public.customers.total_purchases + v_computed_grand_total,
            total_bills = public.customers.total_bills + 1,
            updated_at = now()
        RETURNING id INTO v_cust_id;
    END IF;

    -- Insert Sale Record
    INSERT INTO public.sales (
        bill_number, customer_id, customer_name, customer_phone,
        subtotal, discount_type, discount_value, discount_amount,
        grand_total, paid_amount, balance_amount, payment_method,
        payment_status, notes, created_by
    ) VALUES (
        v_bill_num, v_cust_id, trim(p_customer_name), v_clean_phone,
        v_computed_subtotal, COALESCE(p_discount_type, 'none'), COALESCE(p_discount_value, 0.00), v_computed_discount,
        v_computed_grand_total, COALESCE(p_paid_amount, v_computed_grand_total), v_computed_balance, p_payment_method,
        v_payment_status, p_notes, v_staff_name
    ) RETURNING id INTO v_sale_id;

    -- Insert Line Items & Deduct Stock Atomically
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT p.id AS product_id, p.name, p.selling_price, p.purchase_price, pv.stock_quantity
        INTO v_prod_rec
        FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
        WHERE pv.id = (v_item->>'variant_id')::UUID;

        -- Store purchase_price for Cost of Goods Sold tracking
        INSERT INTO public.sale_items (
            sale_id, product_id, variant_id, product_name,
            size, color, quantity, unit_price, discount_amount,
            subtotal, purchase_price
        ) VALUES (
            v_sale_id, v_prod_rec.product_id, (v_item->>'variant_id')::UUID, v_prod_rec.name,
            COALESCE(NULLIF(v_item->>'size', ''), 'Regular'),
            COALESCE(NULLIF(v_item->>'color', ''), 'Standard'),
            (v_item->>'quantity')::INT, v_prod_rec.selling_price,
            0.00, (v_prod_rec.selling_price * (v_item->>'quantity')::INT), v_prod_rec.purchase_price
        );

        -- Deduct stock
        UPDATE public.product_variants
        SET stock_quantity = stock_quantity - (v_item->>'quantity')::INT,
            updated_at = now()
        WHERE id = (v_item->>'variant_id')::UUID;

        -- Record stock movement audit
        INSERT INTO public.stock_movements (
            product_id, variant_id, change_qty, previous_stock, new_stock,
            movement_type, reference_id, reference_number, reason, performed_by
        ) VALUES (
            v_prod_rec.product_id, (v_item->>'variant_id')::UUID,
            -((v_item->>'quantity')::INT), v_prod_rec.stock_quantity, (v_prod_rec.stock_quantity - (v_item->>'quantity')::INT),
            'sale', v_sale_id, v_bill_num, 'Sold via Mobile Bill', v_staff_name
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'bill_number', v_bill_num,
        'grand_total', v_computed_grand_total
    );
END;
$$;

-- B. Atomic Add / Edit Product (1-Item = 1-Stock Architecture)
CREATE OR REPLACE FUNCTION public.save_simple_product(
    p_id UUID DEFAULT NULL,
    p_name TEXT DEFAULT '',
    p_category_name TEXT DEFAULT 'General',
    p_selling_price NUMERIC DEFAULT 0.00,
    p_purchase_price NUMERIC DEFAULT 0.00,
    p_stock_quantity INT DEFAULT 0,
    p_low_stock_threshold INT DEFAULT 5,
    p_is_active BOOLEAN DEFAULT true,
    p_performed_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_prod_id UUID;
    v_sku TEXT;
    v_staff_name TEXT;
    v_variant_id UUID;
    v_curr_stock INT;
    v_clamped_qty INT;
BEGIN
    v_staff_name := COALESCE(NULLIF(trim(p_performed_by), ''), 'Shop Staff');
    v_clamped_qty := GREATEST(0, COALESCE(p_stock_quantity, 0));

    IF p_selling_price < 0 OR p_purchase_price < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Prices cannot be negative.');
    END IF;

    IF p_id IS NOT NULL THEN
        -- UPDATE EXISTING PRODUCT
        UPDATE public.products
        SET name = trim(p_name),
            category_name = COALESCE(NULLIF(trim(p_category_name), ''), 'General'),
            selling_price = p_selling_price,
            purchase_price = COALESCE(p_purchase_price, 0.00),
            is_active = COALESCE(p_is_active, true),
            updated_at = now()
        WHERE id = p_id
        RETURNING id, sku INTO v_prod_id, v_sku;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Product not found.');
        END IF;

        -- Update or create primary variant
        SELECT id, stock_quantity INTO v_variant_id, v_curr_stock
        FROM public.product_variants
        WHERE product_id = p_id
        LIMIT 1;

        IF FOUND THEN
            UPDATE public.product_variants
            SET stock_quantity = v_clamped_qty,
                low_stock_threshold = GREATEST(0, COALESCE(p_low_stock_threshold, 5)),
                updated_at = now()
            WHERE id = v_variant_id;

            IF v_clamped_qty <> v_curr_stock THEN
                INSERT INTO public.stock_movements (
                    product_id, variant_id, change_qty, previous_stock, new_stock,
                    movement_type, reason, performed_by
                ) VALUES (
                    p_id, v_variant_id, (v_clamped_qty - v_curr_stock), v_curr_stock, v_clamped_qty,
                    'adjustment', 'Stock updated via Product Edit', v_staff_name
                );
            END IF;
        ELSE
            INSERT INTO public.product_variants (
                product_id, variant_sku, size, color, stock_quantity, low_stock_threshold
            ) VALUES (
                p_id, v_sku || '-STD', 'Regular', 'Standard', v_clamped_qty, GREATEST(0, COALESCE(p_low_stock_threshold, 5))
            );
        END IF;

        RETURN jsonb_build_object('success', true, 'action', 'updated', 'product_id', p_id);
    ELSE
        -- CREATE NEW PRODUCT with Atomic SKU
        v_sku := 'VCS-' || LPAD(nextval('public.product_sku_seq')::TEXT, 5, '0');

        INSERT INTO public.products (
            name, sku, category_name, selling_price, purchase_price, is_active, is_archived
        ) VALUES (
            trim(p_name), v_sku, COALESCE(NULLIF(trim(p_category_name), ''), 'General'),
            p_selling_price, COALESCE(p_purchase_price, 0.00), true, false
        ) RETURNING id INTO v_prod_id;

        INSERT INTO public.product_variants (
            product_id, variant_sku, size, color, stock_quantity, low_stock_threshold
        ) VALUES (
            v_prod_id, v_sku || '-STD', 'Regular', 'Standard', v_clamped_qty, GREATEST(0, COALESCE(p_low_stock_threshold, 5))
        ) RETURNING id INTO v_variant_id;

        IF v_clamped_qty > 0 THEN
            INSERT INTO public.stock_movements (
                product_id, variant_id, change_qty, previous_stock, new_stock,
                movement_type, reason, performed_by
            ) VALUES (
                v_prod_id, v_variant_id, v_clamped_qty, 0, v_clamped_qty,
                'initial', 'Initial Stock Entry', v_staff_name
            );
        END IF;

        RETURN jsonb_build_object('success', true, 'action', 'created', 'product_id', v_prod_id);
    END IF;
END;
$$;

-- C. Atomic Stock Adjustment Function
CREATE OR REPLACE FUNCTION public.adjust_stock_quantity(
    p_variant_id UUID,
    p_new_quantity INT,
    p_reason TEXT DEFAULT 'Manual adjustment',
    p_performed_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_curr_stock INT;
    v_prod_id UUID;
    v_delta INT;
    v_staff_name TEXT;
    v_clamped_qty INT;
BEGIN
    IF p_new_quantity < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stock quantity cannot be negative.');
    END IF;

    v_staff_name := COALESCE(NULLIF(trim(p_performed_by), ''), 'Shop Staff');
    v_clamped_qty := p_new_quantity;

    SELECT stock_quantity, product_id 
    INTO v_curr_stock, v_prod_id
    FROM public.product_variants 
    WHERE id = p_variant_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item variant not found.');
    END IF;

    v_delta := v_clamped_qty - v_curr_stock;

    UPDATE public.product_variants
    SET stock_quantity = v_clamped_qty,
        updated_at = now()
    WHERE id = p_variant_id;

    INSERT INTO public.stock_movements (
        product_id, variant_id, change_qty, previous_stock, new_stock,
        movement_type, reason, performed_by
    ) VALUES (
        v_prod_id, p_variant_id, v_delta, v_curr_stock, v_clamped_qty,
        'adjustment', COALESCE(p_reason, 'Manual adjustment'), v_staff_name
    );

    RETURN jsonb_build_object('success', true, 'previous_stock', v_curr_stock, 'new_stock', v_clamped_qty);
END;
$$;

-- D. Safe Product Archive / Delete
CREATE OR REPLACE FUNCTION public.delete_or_archive_product(
    p_product_id UUID,
    p_performed_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_has_sales BOOLEAN;
    v_has_purchases BOOLEAN;
    v_has_exchanges BOOLEAN;
    v_staff_name TEXT;
    v_prod_name TEXT;
BEGIN
    v_staff_name := COALESCE(NULLIF(trim(p_performed_by), ''), 'Shop Staff');

    SELECT name INTO v_prod_name FROM public.products WHERE id = p_product_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found.');
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.sale_items WHERE product_id = p_product_id) INTO v_has_sales;
    SELECT EXISTS (SELECT 1 FROM public.purchase_items WHERE product_id = p_product_id) INTO v_has_purchases;
    SELECT EXISTS (
        SELECT 1 FROM public.exchange_items ei
        JOIN public.product_variants pv ON pv.id = ei.return_variant_id OR pv.id = ei.new_variant_id
        WHERE pv.product_id = p_product_id
    ) INTO v_has_exchanges;

    IF v_has_sales OR v_has_purchases OR v_has_exchanges THEN
        -- Safely archive product to preserve billing history integrity
        UPDATE public.products
        SET is_active = false,
            is_archived = true,
            updated_at = now()
        WHERE id = p_product_id;

        INSERT INTO public.activity_logs (action_type, description, entity_type, entity_id, staff_name)
        VALUES ('PRODUCT_ARCHIVED', 'Archived product "' || v_prod_name || '" to protect transaction history.', 'products', p_product_id::TEXT, v_staff_name);

        RETURN jsonb_build_object(
            'success', true,
            'action', 'archived',
            'message', 'Product has existing sales/purchases history. It has been safely archived.'
        );
    ELSE
        -- Safe to delete completely
        DELETE FROM public.products WHERE id = p_product_id;

        INSERT INTO public.activity_logs (action_type, description, entity_type, entity_id, staff_name)
        VALUES ('PRODUCT_DELETED', 'Permanently deleted unused product "' || v_prod_name || '".', 'products', p_product_id::TEXT, v_staff_name);

        RETURN jsonb_build_object(
            'success', true,
            'action', 'deleted',
            'message', 'Product deleted permanently.'
        );
    END IF;
END;
$$;

-- E. Atomic Bill Cancellation with Stock Restoration
CREATE OR REPLACE FUNCTION public.cancel_sale_transaction(
    p_sale_id UUID,
    p_reason TEXT DEFAULT 'Cancelled by staff',
    p_cancelled_by TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sale RECORD;
    v_item RECORD;
    v_restore_qty INT;
    v_current_stock INT;
    v_staff_name TEXT;
BEGIN
    v_staff_name := COALESCE(NULLIF(trim(p_cancelled_by), ''), 'Shop Staff');

    -- Lock sale row for update to prevent concurrent double cancellation
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill not found.');
    END IF;

    IF v_sale.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bill #' || v_sale.bill_number || ' is already cancelled.');
    END IF;

    IF v_sale.status = 'exchanged' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel Bill #' || v_sale.bill_number || ' because items have already been exchanged.');
    END IF;

    -- Atomically restore stock for every item sold (minus any already returned items)
    FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id
    LOOP
        v_restore_qty := v_item.quantity - COALESCE(v_item.returned_quantity, 0);

        IF v_restore_qty > 0 THEN
            SELECT stock_quantity INTO v_current_stock
            FROM public.product_variants
            WHERE id = v_item.variant_id
            FOR UPDATE;

            IF FOUND THEN
                UPDATE public.product_variants
                SET stock_quantity = stock_quantity + v_restore_qty,
                    updated_at = now()
                WHERE id = v_item.variant_id;

                INSERT INTO public.stock_movements (
                    product_id, variant_id, change_qty, previous_stock, new_stock,
                    movement_type, reference_id, reference_number, reason, performed_by
                ) VALUES (
                    v_item.product_id, v_item.variant_id, v_restore_qty,
                    v_current_stock, (v_current_stock + v_restore_qty),
                    'cancellation', p_sale_id, v_sale.bill_number,
                    'Restored from cancelled bill: ' || COALESCE(p_reason, 'Staff cancelled'),
                    v_staff_name
                );
            END IF;
        END IF;
    END LOOP;

    -- Mark bill as cancelled
    UPDATE public.sales
    SET status = 'cancelled',
        cancellation_reason = COALESCE(p_reason, 'Cancelled by staff'),
        cancelled_by = v_staff_name,
        updated_at = now()
    WHERE id = p_sale_id;

    RETURN jsonb_build_object('success', true, 'message', 'Bill #' || v_sale.bill_number || ' cancelled successfully and stock restored.');
END;
$$;

-- Compatibility Stubs for Obsolete Device Security Functions
-- Overwrites all legacy auth functions so they never block or error
CREATE OR REPLACE FUNCTION public.is_authorized_device()
RETURNS BOOLEAN LANGUAGE plpgsql AS $$ BEGIN RETURN true; END; $$;

CREATE OR REPLACE FUNCTION public.get_current_device_name()
RETURNS TEXT LANGUAGE plpgsql AS $$ BEGIN RETURN 'Shop Terminal'; END; $$;

CREATE OR REPLACE FUNCTION public.check_device_status()
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
    RETURN jsonb_build_object('is_authorized', true, 'slot', 1, 'device_name', 'Shop Terminal');
END;
$$;

CREATE OR REPLACE FUNCTION public.enroll_device(p_slot_number INT DEFAULT 1, p_device_name TEXT DEFAULT 'Shop Terminal', p_secret TEXT DEFAULT '')
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
    RETURN jsonb_build_object('success', true, 'message', 'Public cloud mode active.');
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_device_slot(p_slot_number INT DEFAULT 1, p_secret TEXT DEFAULT '')
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
    RETURN jsonb_build_object('success', true, 'message', 'Public cloud mode active.');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_owner_enrollment_secret(p_new_secret TEXT DEFAULT '', p_current_secret TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
    RETURN jsonb_build_object('success', true, 'message', 'Public cloud mode active.');
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (PERMISSIVE PUBLIC CLOUD ACCESS)
-- ----------------------------------------------------------------------------

-- Enable RLS on all business tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop any previous restrictive policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Permissive public policies for both anon and authenticated roles
CREATE POLICY "Public access on categories" ON public.categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access on products" ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access on product_variants" ON public.product_variants FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access on customers" ON public.customers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access on sales" ON public.sales FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access on sale_items" ON public.sale_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access on stock_movements" ON public.stock_movements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access on expenses" ON public.expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access on purchases" ON public.purchases FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access on purchase_items" ON public.purchase_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access on exchanges" ON public.exchanges FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access on exchange_items" ON public.exchange_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public access on activity_logs" ON public.activity_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 6. EXPLICIT GRANTS FOR ANON & AUTHENTICATED ROLES
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. SUPABASE REALTIME LIVE SYNCHRONIZATION
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.products; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sales; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.customers; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.exchanges; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.product_variants REPLICA IDENTITY FULL;
ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.sale_items REPLICA IDENTITY FULL;
ALTER TABLE public.stock_movements REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;

-- Default Categories Seed
INSERT INTO public.categories (name, sort_order) VALUES
('Formal Shirts', 1), ('Casual Shirts', 2), ('T-Shirts & Polos', 3),
('Jeans & Denims', 4), ('Chinos & Trousers', 5), ('Shorts', 6), ('Accessories & Belts', 7)
ON CONFLICT (name) DO NOTHING;
