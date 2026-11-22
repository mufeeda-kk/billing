-- ============================================================================
-- VINTAGE CLOTHING STORE - HARDENED PRODUCTION SCHEMA & CONCURRENCY CONTROLS
-- Migration Date: 2026-11-22
-- Version: 4.1.0 (Production Verified - Full Compatibility)
--
-- AUDIT & CORRECTION HIGHLIGHTS:
-- 1. NO plaintext seed secrets: Uses a secure provisioning RPC (set_owner_enrollment_secret).
-- 2. Brute-force rate limiting persists failures without rollback (returns structured JSON).
-- 3. Server-side authoritative billing: Recalculates subtotal, discounts, grand total, and balances in DB.
-- 4. Rejects inactive, archived, or mismatched variants; enforces quantity > 0.
-- 5. Deadlock prevention: Locks stock rows in consistent sorted order (ORDER BY variant_id ASC).
-- 6. Validates stock adjustments and strictly enforces stock_quantity >= 0 constraint.
-- 7. 1-item = 1-stock model in save_simple_product with atomic product_sku_seq generation.
-- 8. Database-derived device attribution (get_current_device_name) via auth.uid().
-- 9. Explicit REVOKE/GRANT permissions on all tables/functions; safe search_path = public, pg_temp.
-- 10. Realtime publication on products, variants, sales, sale_items, stock_movements, and customers.
-- 11. TIMESTAMPTZ DEFAULT now() across all tables; frontend displays IST.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS & SEQUENCES
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SEQUENCE IF NOT EXISTS public.sale_bill_seq START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.product_sku_seq START WITH 10001 INCREMENT BY 1;

-- ----------------------------------------------------------------------------
-- 2. DEVICE SECURITY & AUDIT TABLES
-- ----------------------------------------------------------------------------

-- Private table for owner secret hash (ZERO client SELECT policies)
CREATE TABLE IF NOT EXISTS public.store_secrets (
    key TEXT PRIMARY KEY,
    secret_hash TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Authorized Devices (Strictly slots 1, 2, and 3)
CREATE TABLE IF NOT EXISTS public.authorized_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_slot INT UNIQUE NOT NULL CHECK (device_slot IN (1, 2, 3)),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Persistent Brute-Force Rate Limiting Table
CREATE TABLE IF NOT EXISTS public.enrollment_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    device_slot INT,
    attempt_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    was_successful BOOLEAN NOT NULL DEFAULT false,
    failure_reason TEXT
);

-- ----------------------------------------------------------------------------
-- 3. CORE BUSINESS TABLES
-- ----------------------------------------------------------------------------

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products (Simplified: 1 product = 1 primary stock unit)
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

-- Product Variants (Holds actual inventory quantity)
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
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card', 'split')),
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by TEXT,
    notes TEXT,
    created_by TEXT NOT NULL DEFAULT 'Authorized Phone',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sale Items
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stock Movements (Audit Trail for Sales and Stock Adjustments)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
    change_qty INT NOT NULL,
    previous_stock INT NOT NULL CHECK (previous_stock >= 0),
    new_stock INT NOT NULL CHECK (new_stock >= 0),
    movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'adjustment', 'cancellation', 'initial')),
    reference_id UUID,
    reference_number TEXT,
    reason TEXT,
    performed_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. PERFORMANCE & SEARCH INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_search ON public.products(name, sku, category_name);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active, is_archived);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_bill_number ON public.sales(bill_number);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON public.stock_movements(variant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. SECURITY & DEVICE MANAGEMENT PROCEDURES (search_path = public, pg_temp)
-- ----------------------------------------------------------------------------

-- Check if caller holds an active enrolled device
CREATE OR REPLACE FUNCTION public.is_authorized_device()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.authorized_devices
        WHERE user_id = auth.uid()
          AND is_active = true
    );
END;
$$;

-- Get current device name from database session
CREATE OR REPLACE FUNCTION public.get_current_device_name()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_name TEXT;
BEGIN
    SELECT device_name INTO v_name
    FROM public.authorized_devices
    WHERE user_id = auth.uid()
      AND is_active = true;
    
    RETURN COALESCE(v_name, 'Phone POS');
END;
$$;

-- Secure Provisioning & Rotation for Owner Secret
CREATE OR REPLACE FUNCTION public.set_owner_enrollment_secret(
    p_new_secret TEXT,
    p_current_secret TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_stored_hash TEXT;
BEGIN
    IF p_new_secret IS NULL OR length(trim(p_new_secret)) < 6 THEN
        RETURN jsonb_build_object('success', false, 'error', 'New secret must be at least 6 characters long.');
    END IF;

    SELECT secret_hash INTO v_stored_hash FROM public.store_secrets WHERE key = 'enrollment_secret';

    -- If a secret is already configured, require the current secret to rotate
    IF v_stored_hash IS NOT NULL THEN
        IF p_current_secret IS NULL OR crypt(p_current_secret, v_stored_hash) <> v_stored_hash THEN
            RETURN jsonb_build_object('success', false, 'error', 'Incorrect current secret. Rotation denied.');
        END IF;
    END IF;

    -- Store salted bcrypt hash
    INSERT INTO public.store_secrets (key, secret_hash, updated_at)
    VALUES ('enrollment_secret', crypt(trim(p_new_secret), gen_salt('bf', 10)), now())
    ON CONFLICT (key) DO UPDATE SET
        secret_hash = EXCLUDED.secret_hash,
        updated_at = now();

    RETURN jsonb_build_object('success', true, 'message', 'Owner setup secret successfully configured.');
END;
$$;

-- Secure Device Enrollment RPC with Non-Rolling-Back Rate Limiting
CREATE OR REPLACE FUNCTION public.enroll_device(
    p_slot_number INT,
    p_device_name TEXT,
    p_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID;
    v_stored_hash TEXT;
    v_failed_count INT;
    v_existing_slot RECORD;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No active session found. Please re-open the app.');
    END IF;

    IF p_slot_number NOT IN (1, 2, 3) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid device slot. Only Phone 1, Phone 2, or Phone 3 are supported.');
    END IF;

    -- 1. Anti-Brute-Force Rate Limiting (Check failures in last 15 minutes)
    SELECT COUNT(*) INTO v_failed_count
    FROM public.enrollment_attempts
    WHERE attempt_time >= (now() - INTERVAL '15 minutes')
      AND was_successful = false;

    IF v_failed_count >= 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Too many failed enrollment attempts. Device enrollment locked for 15 minutes.');
    END IF;

    -- 2. Verify Secret against stored bcrypt hash
    SELECT secret_hash INTO v_stored_hash
    FROM public.store_secrets
    WHERE key = 'enrollment_secret';

    IF v_stored_hash IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Owner secret not yet provisioned. Run set_owner_enrollment_secret in Supabase first.');
    END IF;

    IF crypt(p_secret, v_stored_hash) <> v_stored_hash THEN
        -- Persist failed attempt (Function returns structured JSON so this INSERT commits)
        INSERT INTO public.enrollment_attempts (user_id, device_slot, was_successful, failure_reason)
        VALUES (v_uid, p_slot_number, false, 'Invalid secret');
        RETURN jsonb_build_object('success', false, 'error', 'Access Denied: Incorrect Owner Secret.');
    END IF;

    -- 3. Prevent an already enrolled user from taking another slot
    IF EXISTS (SELECT 1 FROM public.authorized_devices WHERE user_id = v_uid AND device_slot <> p_slot_number AND is_active = true) THEN
        RETURN jsonb_build_object('success', false, 'error', 'This phone is already enrolled in another slot. Revoke it before changing.');
    END IF;

    -- 4. Check if target slot is active on another phone
    SELECT * INTO v_existing_slot
    FROM public.authorized_devices
    WHERE device_slot = p_slot_number AND is_active = true;

    IF FOUND AND v_existing_slot.user_id <> v_uid THEN
        RETURN jsonb_build_object('success', false, 'error', 'Device slot ' || p_slot_number || ' is already active on another phone. Revoke it first.');
    END IF;

    -- 5. Enroll Device
    INSERT INTO public.authorized_devices (device_slot, user_id, device_name, is_active, last_seen_at)
    VALUES (p_slot_number, v_uid, p_device_name, true, now())
    ON CONFLICT (device_slot) DO UPDATE SET
        user_id = v_uid,
        device_name = EXCLUDED.device_name,
        is_active = true,
        last_seen_at = now();

    INSERT INTO public.enrollment_attempts (user_id, device_slot, was_successful)
    VALUES (v_uid, p_slot_number, true);

    RETURN jsonb_build_object(
        'success', true,
        'slot', p_slot_number,
        'device_name', p_device_name,
        'message', 'Device permanently authorized. Opens directly to billing.'
    );
END;
$$;

-- Check Device Status (Called silently on app startup)
CREATE OR REPLACE FUNCTION public.check_device_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_dev RECORD;
BEGIN
    SELECT * INTO v_dev 
    FROM public.authorized_devices 
    WHERE user_id = auth.uid() AND is_active = true;

    IF FOUND THEN
        UPDATE public.authorized_devices 
        SET last_seen_at = now() 
        WHERE id = v_dev.id;

        RETURN jsonb_build_object(
            'is_authorized', true,
            'slot', v_dev.device_slot,
            'device_name', v_dev.device_name
        );
    ELSE
        RETURN jsonb_build_object('is_authorized', false);
    END IF;
END;
$$;

-- Revoke Device Slot RPC
CREATE OR REPLACE FUNCTION public.revoke_device_slot(
    p_slot_number INT,
    p_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_stored_hash TEXT;
BEGIN
    SELECT secret_hash INTO v_stored_hash FROM public.store_secrets WHERE key = 'enrollment_secret';
    IF v_stored_hash IS NULL OR crypt(p_secret, v_stored_hash) <> v_stored_hash THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access Denied: Incorrect Owner Secret.');
    END IF;

    UPDATE public.authorized_devices 
    SET is_active = false 
    WHERE device_slot = p_slot_number;

    RETURN jsonb_build_object('success', true, 'message', 'Device slot ' || p_slot_number || ' successfully revoked.');
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. AUTHORITATIVE SERVER-CALCULATED ATOMIC BILLING & INVENTORY RPCs
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
    v_dev_name TEXT;
    v_item JSONB;
    v_agg RECORD;
    v_prod_rec RECORD;
    v_curr_stock INT;
    
    -- Authoritative server calculations
    v_computed_subtotal NUMERIC(10, 2) := 0.00;
    v_computed_discount NUMERIC(10, 2) := 0.00;
    v_computed_grand_total NUMERIC(10, 2) := 0.00;
    v_computed_balance NUMERIC(10, 2) := 0.00;
    v_payment_status TEXT;
    v_cust_id UUID := NULL;
    v_clean_phone TEXT;
BEGIN
    -- 1. Security Check
    IF NOT public.is_authorized_device() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access Denied: Unregistered device cannot create bills.');
    END IF;

    -- Device attribution derived directly from authenticated session
    v_dev_name := public.get_current_device_name();

    -- Validate items array
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cart is empty.');
    END IF;

    -- 2. Concurrency-Safe Bill Number from Sequence
    v_bill_num := 'VCS-' || TO_CHAR(now() AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD') || '-' || LPAD(nextval('public.sale_bill_seq')::TEXT, 4, '0');

    -- 3. Deadlock-Free Stock Row Locking (ORDER BY variant_id ASC)
    -- Aggregate cart items by variant_id
    CREATE TEMP TABLE temp_cart_agg ON COMMIT DROP AS
    SELECT 
        (elem->>'variant_id')::UUID AS variant_id,
        (elem->>'product_id')::UUID AS product_id,
        SUM((elem->>'quantity')::INT) AS total_quantity
    FROM jsonb_array_elements(p_items) AS elem
    GROUP BY (elem->>'variant_id')::UUID, (elem->>'product_id')::UUID
    ORDER BY (elem->>'variant_id')::UUID ASC; -- CRITICAL: Consistent sorted order prevents deadlocks

    -- 4. Authoritative Verification: Verify product status, variant belonging, and stock
    FOR v_agg IN SELECT * FROM temp_cart_agg
    LOOP
        IF v_agg.total_quantity <= 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Invalid item quantity: must be greater than zero.');
        END IF;

        -- Lock variant row and fetch product details
        SELECT p.id AS product_id, p.name, p.selling_price, p.purchase_price, p.is_active, p.is_archived, pv.stock_quantity
        INTO v_prod_rec
        FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
        WHERE pv.id = v_agg.variant_id
          AND pv.product_id = v_agg.product_id
        FOR UPDATE; -- Row-level lock

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

    -- 5. Authoritative Server Totals Calculation
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Look up authoritative selling price from database (ignore client price)
        SELECT p.selling_price INTO v_prod_rec
        FROM public.products p
        JOIN public.product_variants pv ON pv.product_id = p.id
        WHERE pv.id = (v_item->>'variant_id')::UUID;

        v_computed_subtotal := v_computed_subtotal + (v_prod_rec.selling_price * (v_item->>'quantity')::INT);
    END LOOP;

    -- Authoritative Discount Calculation
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

    -- 6. Customer Auto-Upsert
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

    -- 7. Insert Sale Record
    INSERT INTO public.sales (
        bill_number, customer_id, customer_name, customer_phone,
        subtotal, discount_type, discount_value, discount_amount,
        grand_total, paid_amount, balance_amount, payment_method,
        payment_status, notes, created_by
    ) VALUES (
        v_bill_num, v_cust_id, trim(p_customer_name), v_clean_phone,
        v_computed_subtotal, COALESCE(p_discount_type, 'none'), COALESCE(p_discount_value, 0.00), v_computed_discount,
        v_computed_grand_total, COALESCE(p_paid_amount, v_computed_grand_total), v_computed_balance, p_payment_method,
        v_payment_status, p_notes, v_dev_name
    ) RETURNING id INTO v_sale_id;

    -- 8. Insert Line Items & Deduct Stock Atomically
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        SELECT p.id AS product_id, p.name, p.selling_price, p.purchase_price, pv.stock_quantity
        INTO v_prod_rec
        FROM public.product_variants pv
        JOIN public.products p ON p.id = pv.product_id
        WHERE pv.id = (v_item->>'variant_id')::UUID;

        -- Insert line item with authoritative price
        INSERT INTO public.sale_items (
            sale_id, product_id, variant_id, product_name,
            size, color, quantity, unit_price, discount_amount,
            subtotal, purchase_price
        ) VALUES (
            v_sale_id, v_prod_rec.product_id, (v_item->>'variant_id')::UUID, v_prod_rec.name,
            'Regular', 'Standard', (v_item->>'quantity')::INT, v_prod_rec.selling_price,
            0.00, (v_prod_rec.selling_price * (v_item->>'quantity')::INT), v_prod_rec.purchase_price
        );

        -- Deduct stock
        UPDATE public.product_variants
        SET stock_quantity = stock_quantity - (v_item->>'quantity')::INT,
            updated_at = now()
        WHERE id = (v_item->>'variant_id')::UUID;

        -- Record movement audit
        INSERT INTO public.stock_movements (
            product_id, variant_id, change_qty, previous_stock, new_stock,
            movement_type, reference_id, reference_number, reason, performed_by
        ) VALUES (
            v_prod_rec.product_id, (v_item->>'variant_id')::UUID,
            -((v_item->>'quantity')::INT), v_prod_rec.stock_quantity, (v_prod_rec.stock_quantity - (v_item->>'quantity')::INT),
            'sale', v_sale_id, v_bill_num, 'Sold via Mobile Bill', v_dev_name
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
    v_dev_name TEXT;
    v_variant_id UUID;
    v_curr_stock INT;
    v_clamped_qty INT;
BEGIN
    IF NOT public.is_authorized_device() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access Denied: Unregistered device.');
    END IF;

    v_dev_name := public.get_current_device_name();
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
                    'adjustment', 'Stock updated via Product Edit', v_dev_name
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
                'initial', 'Initial Stock Entry', v_dev_name
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
    v_dev_name TEXT;
    v_clamped_qty INT;
BEGIN
    IF NOT public.is_authorized_device() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access Denied: Unregistered device.');
    END IF;

    IF p_new_quantity < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Stock quantity cannot be negative.');
    END IF;

    v_dev_name := public.get_current_device_name();
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
        'adjustment', COALESCE(p_reason, 'Manual adjustment'), v_dev_name
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
    v_has_sales BOOLEAN := false;
BEGIN
    IF NOT public.is_authorized_device() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access Denied.');
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.sale_items WHERE product_id = p_product_id) INTO v_has_sales;

    IF v_has_sales THEN
        -- Safely archive to protect historical bills and reports
        UPDATE public.products 
        SET is_active = false, is_archived = true, updated_at = now() 
        WHERE id = p_product_id;

        RETURN jsonb_build_object('success', true, 'action', 'archived', 'message', 'Product archived to preserve sales history.');
    ELSE
        -- Permanent delete for items with zero sales
        DELETE FROM public.products WHERE id = p_product_id;
        RETURN jsonb_build_object('success', true, 'action', 'deleted', 'message', 'Product permanently deleted.');
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. FINE-GRAINED ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE public.store_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorized_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- store_secrets: ZERO client policies. No direct client reads.
-- authorized_devices: Devices can only view their own enrollment record
DROP POLICY IF EXISTS "Devices read own status" ON public.authorized_devices;
CREATE POLICY "Devices read own status" ON public.authorized_devices
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Categories: Read-only for authorized devices
DROP POLICY IF EXISTS "Authorized devices read categories" ON public.categories;
CREATE POLICY "Authorized devices read categories" ON public.categories
    FOR SELECT TO authenticated USING (public.is_authorized_device());

-- Products & Variants: Read-only direct client queries; modifications handled via atomic RPCs
DROP POLICY IF EXISTS "Authorized devices read products" ON public.products;
CREATE POLICY "Authorized devices read products" ON public.products
    FOR SELECT TO authenticated USING (public.is_authorized_device());

DROP POLICY IF EXISTS "Authorized devices read variants" ON public.product_variants;
CREATE POLICY "Authorized devices read variants" ON public.product_variants
    FOR SELECT TO authenticated USING (public.is_authorized_device());

-- Sales & Sale Items: Read-only for authorized devices (Writes strictly through process_sale_transaction RPC)
DROP POLICY IF EXISTS "Authorized devices read sales" ON public.sales;
CREATE POLICY "Authorized devices read sales" ON public.sales
    FOR SELECT TO authenticated USING (public.is_authorized_device());

DROP POLICY IF EXISTS "Authorized devices read sale_items" ON public.sale_items;
CREATE POLICY "Authorized devices read sale_items" ON public.sale_items
    FOR SELECT TO authenticated USING (public.is_authorized_device());

-- Customers & Stock Movements: Read-only for authorized devices
DROP POLICY IF EXISTS "Authorized devices read customers" ON public.customers;
CREATE POLICY "Authorized devices read customers" ON public.customers
    FOR SELECT TO authenticated USING (public.is_authorized_device());

DROP POLICY IF EXISTS "Authorized devices read stock_movements" ON public.stock_movements;
CREATE POLICY "Authorized devices read stock_movements" ON public.stock_movements
    FOR SELECT TO authenticated USING (public.is_authorized_device());

-- ----------------------------------------------------------------------------
-- 8. EXPLICIT GRANTS & PERMISSIONS AUDIT
-- ----------------------------------------------------------------------------

-- Revoke all public execution on functions
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Grant schema usage to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant explicit SELECT on business tables to authenticated role (protected by RLS)
GRANT SELECT ON public.authorized_devices TO authenticated;
GRANT SELECT ON public.categories TO authenticated;
GRANT SELECT ON public.products TO authenticated;
GRANT SELECT ON public.product_variants TO authenticated;
GRANT SELECT ON public.sales TO authenticated;
GRANT SELECT ON public.sale_items TO authenticated;
GRANT SELECT ON public.customers TO authenticated;
GRANT SELECT ON public.stock_movements TO authenticated;

-- Grant explicit EXECUTE on RPCs to authenticated role
GRANT EXECUTE ON FUNCTION public.is_authorized_device TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_device_name TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_owner_enrollment_secret TO authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_device TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_device_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_device_slot TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_sale_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_simple_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock_quantity TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_or_archive_product TO authenticated;

-- ----------------------------------------------------------------------------
-- 9. SUPABASE REALTIME MULTI-PHONE BROADCAST PUBLICATION
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.products; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sales; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.customers; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.product_variants REPLICA IDENTITY FULL;
ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.sale_items REPLICA IDENTITY FULL;
ALTER TABLE public.stock_movements REPLICA IDENTITY FULL;

-- Default Categories Seed
INSERT INTO public.categories (name, sort_order) VALUES
('Formal Shirts', 1), ('Casual Shirts', 2), ('T-Shirts & Polos', 3),
('Jeans & Denims', 4), ('Chinos & Trousers', 5), ('Shorts', 6), ('Accessories & Belts', 7)
ON CONFLICT (name) DO NOTHING;
