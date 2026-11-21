-- ============================================================================
-- VINTAGE CLOTHING STORE - COMPLETE SUPABASE POSTGRESQL SCHEMA & RPCs
-- Shop Name: VINTAGE CLOTHING STORE
-- Phones: 9072808380, 9744223557
-- Supports 3 Concurrent Users, Realtime Sync, RLS, Variant Inventory,
-- Atomic Checkout, and 7-Day Strict Clothing Exchange Window
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. STAFF PROFILES (3 Authorized Users)
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff')),
    pin_code TEXT DEFAULT '1234',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata', now())
);

-- 2. PRODUCT CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata', now())
);

-- 3. PRODUCTS (Base item without size/color)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    category_name TEXT NOT NULL DEFAULT 'General',
    brand TEXT DEFAULT 'VINTAGE',
    purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(10,2) NOT NULL CHECK (selling_price >= 0),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata', now())
);

-- 4. PRODUCT VARIANTS (Variant-aware clothing: Size + Color stock)
CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_sku TEXT UNIQUE NOT NULL,
    size TEXT NOT NULL,   -- e.g. 'S', 'M', 'L', 'XL', 'XXL', '30', '32', '34', '36', 'Free Size'
    color TEXT NOT NULL,  -- e.g. 'Black', 'White', 'Navy Blue', 'Beige', 'Olive Green', 'Maroon'
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    low_stock_threshold INT NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata', now()),
    CONSTRAINT unique_product_size_color UNIQUE (product_id, size, color)
);

-- 5. CUSTOMERS (Optional for fast checkout)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    phone TEXT UNIQUE,
    notes TEXT,
    total_purchases NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_bills INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata', now())
);

-- 6. SALES (BILLS)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_phone TEXT,
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    discount_type TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none', 'percentage', 'fixed')),
    discount_value NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(10,2) NOT NULL CHECK (grand_total >= 0),
    paid_amount NUMERIC(10,2) NOT NULL CHECK (paid_amount >= 0),
    balance_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card', 'split')),
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'exchanged', 'partially_exchanged', 'cancelled')),
    cancellation_reason TEXT,
    notes TEXT,
    created_by TEXT NOT NULL DEFAULT 'Staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata', now())
);

-- 7. SALE ITEMS
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id),
    product_name TEXT NOT NULL,
    size TEXT NOT NULL,
    color TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    returned_quantity INT NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0 AND returned_quantity <= quantity)
);

-- 8. EXCHANGES (7-day clothing exchange)
CREATE TABLE IF NOT EXISTS public.exchanges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exchange_number TEXT UNIQUE NOT NULL,
    original_sale_id UUID NOT NULL REFERENCES public.sales(id),
    original_bill_number TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    return_total_value NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    replacement_total_value NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    difference_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00, -- +ve: customer pays extra, -ve: store owes refund/credit
    settlement_type TEXT NOT NULL CHECK (settlement_type IN ('none', 'collected_extra', 'refunded_cash', 'refunded_upi', 'store_credit')),
    payment_method TEXT,
    processed_by TEXT NOT NULL DEFAULT 'Staff',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata', now())
);

-- 9. EXCHANGE ITEMS (Tracks returned vs replacement items)
CREATE TABLE IF NOT EXISTS public.exchange_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exchange_id UUID NOT NULL REFERENCES public.exchanges(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('return', 'replacement')),
    sale_item_id UUID REFERENCES public.sale_items(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES public.products(id),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id),
    product_name TEXT NOT NULL,
    size TEXT NOT NULL,
    color TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(10,2) NOT NULL
);

-- 10. STOCK MOVEMENTS (Complete audit trail of all inventory changes)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    change_qty INT NOT NULL, -- positive for restock/returns, negative for sales
    previous_stock INT NOT NULL,
    new_stock INT NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'exchange_return', 'exchange_replacement', 'purchase', 'adjustment', 'cancellation')),
    reference_id UUID,
    reference_number TEXT,
    reason TEXT,
    performed_by TEXT NOT NULL DEFAULT 'Staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata', now())
);

-- 11. STOCK PURCHASES (New inventory arrival)
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT,
    supplier_name TEXT,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    purchased_by TEXT NOT NULL DEFAULT 'Staff',
    purchase_date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata', now())
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id),
    product_name TEXT NOT NULL,
    size TEXT NOT NULL,
    color TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(10,2) NOT NULL CHECK (unit_cost >= 0),
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0)
);

-- 12. EXPENSES (Shop expense tracker)
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'cash',
    notes TEXT,
    added_by TEXT NOT NULL DEFAULT 'Staff',
    expense_date DATE NOT NULL DEFAULT (CURRENT_DATE AT TIME ZONE 'Asia/Kolkata'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata', now())
);

-- 13. ACTIVITY LOGS (Shop action audit trail)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    staff_name TEXT NOT NULL DEFAULT 'Staff',
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Asia/Kolkata', now())
);

-- ============================================================================
-- INDEXES FOR FAST QUERYING & PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_bill_number ON public.sales(bill_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer_phone ON public.sales(customer_phone);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_exchanges_original_sale ON public.exchanges(original_sale_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant ON public.stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);

-- ============================================================================
-- STORED PROCEDURES / RPCs FOR ATOMIC CONCURRENCY
-- ============================================================================

-- Function 1: Generate Sequential Bill Number
CREATE OR REPLACE FUNCTION public.generate_bill_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    today_str TEXT;
    daily_count INT;
    new_bill_number TEXT;
BEGIN
    today_str := to_char(timezone('Asia/Kolkata', now()), 'YYYYMMDD');
    SELECT COUNT(*) + 1 INTO daily_count 
    FROM public.sales 
    WHERE bill_number LIKE 'VCS-' || today_str || '-%';
    
    new_bill_number := 'VCS-' || today_str || '-' || lpad(daily_count::TEXT, 4, '0');
    RETURN new_bill_number;
END;
$$;

-- Function 2: ATOMIC SALE CHECKOUT (With Row-level Locks to prevent race conditions)
CREATE OR REPLACE FUNCTION public.process_sale_transaction(
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_subtotal NUMERIC,
    p_discount_type TEXT,
    p_discount_value NUMERIC,
    p_discount_amount NUMERIC,
    p_grand_total NUMERIC,
    p_paid_amount NUMERIC,
    p_balance_amount NUMERIC,
    p_payment_method TEXT,
    p_payment_status TEXT,
    p_notes TEXT,
    p_created_by TEXT,
    p_items JSONB
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_bill_number TEXT;
    v_sale_id UUID;
    v_item JSONB;
    v_variant_id UUID;
    v_product_id UUID;
    v_qty INT;
    v_unit_price NUMERIC;
    v_discount NUMERIC;
    v_subtotal NUMERIC;
    v_purchase_price NUMERIC;
    v_current_stock INT;
    v_p_name TEXT;
    v_size TEXT;
    v_color TEXT;
    v_customer_id UUID := NULL;
BEGIN
    -- 1. Generate unique sequential bill number
    v_bill_number := public.generate_bill_number();

    -- 2. Upsert customer record if phone provided
    IF p_customer_phone IS NOT NULL AND length(trim(p_customer_phone)) > 0 THEN
        SELECT id INTO v_customer_id FROM public.customers WHERE phone = trim(p_customer_phone);
        IF v_customer_id IS NULL THEN
            INSERT INTO public.customers (name, phone, total_purchases, total_bills)
            VALUES (COALESCE(p_customer_name, 'Valued Customer'), trim(p_customer_phone), p_grand_total, 1)
            RETURNING id INTO v_customer_id;
        ELSE
            UPDATE public.customers
            SET total_purchases = total_purchases + p_grand_total,
                total_bills = total_bills + 1,
                name = COALESCE(p_customer_name, name)
            WHERE id = v_customer_id;
        END IF;
    END IF;

    -- 3. Insert Sale Master Record
    INSERT INTO public.sales (
        bill_number, customer_id, customer_name, customer_phone,
        subtotal, discount_type, discount_value, discount_amount,
        grand_total, paid_amount, balance_amount, payment_method,
        payment_status, status, notes, created_by
    ) VALUES (
        v_bill_number, v_customer_id, p_customer_name, p_customer_phone,
        p_subtotal, p_discount_type, p_discount_value, p_discount_amount,
        p_grand_total, p_paid_amount, p_balance_amount, p_payment_method,
        p_payment_status, 'completed', p_notes, p_created_by
    ) RETURNING id INTO v_sale_id;

    -- 4. Process Each Item: Lock row, verify stock, decrement stock, record movements
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_variant_id := (v_item->>'variant_id')::UUID;
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::INT;
        v_unit_price := (v_item->>'unit_price')::NUMERIC;
        v_discount := COALESCE((v_item->>'discount_amount')::NUMERIC, 0.00);
        v_subtotal := (v_item->>'subtotal')::NUMERIC;
        v_purchase_price := COALESCE((v_item->>'purchase_price')::NUMERIC, 0.00);
        v_p_name := v_item->>'product_name';
        v_size := v_item->>'size';
        v_color := v_item->>'color';

        -- Lock variant row for update to guarantee concurrency safety
        SELECT stock_quantity INTO v_current_stock
        FROM public.product_variants
        WHERE id = v_variant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product variant not found: % (% - %)', v_p_name, v_size, v_color;
        END IF;

        IF v_current_stock < v_qty THEN
            RAISE EXCEPTION 'Insufficient stock for % (% - %). Available: %, Requested: %', 
                v_p_name, v_size, v_color, v_current_stock, v_qty;
        END IF;

        -- Deduct stock
        UPDATE public.product_variants
        SET stock_quantity = stock_quantity - v_qty,
            updated_at = timezone('Asia/Kolkata', now())
        WHERE id = v_variant_id;

        -- Insert sale item
        INSERT INTO public.sale_items (
            sale_id, product_id, variant_id, product_name,
            size, color, quantity, unit_price, discount_amount,
            subtotal, purchase_price, returned_quantity
        ) VALUES (
            v_sale_id, v_product_id, v_variant_id, v_p_name,
            v_size, v_color, v_qty, v_unit_price, v_discount,
            v_subtotal, v_purchase_price, 0
        );

        -- Record stock movement
        INSERT INTO public.stock_movements (
            product_id, variant_id, change_qty, previous_stock, new_stock,
            movement_type, reference_id, reference_number, reason, performed_by
        ) VALUES (
            v_product_id, v_variant_id, -v_qty, v_current_stock, (v_current_stock - v_qty),
            'sale', v_sale_id, v_bill_number, 'Billed to customer', p_created_by
        );
    END LOOP;

    -- 5. Record Activity Log
    INSERT INTO public.activity_logs (
        action_type, description, entity_type, entity_id, staff_name, metadata
    ) VALUES (
        'BILL_CREATED',
        'Created Bill #' || v_bill_number || ' for Rs ' || p_grand_total || ' (' || p_payment_method || ')',
        'sales',
        v_sale_id::TEXT,
        p_created_by,
        jsonb_build_object('bill_number', v_bill_number, 'grand_total', p_grand_total, 'item_count', jsonb_array_length(p_items))
    );

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'bill_number', v_bill_number,
        'grand_total', p_grand_total
    );
END;
$$;

-- Function 3: ATOMIC 7-DAY CLOTHING EXCHANGE TRANSACTION
CREATE OR REPLACE FUNCTION public.process_exchange_transaction(
    p_original_sale_id UUID,
    p_returns JSONB,        -- [{sale_item_id, variant_id, product_id, quantity, unit_price, product_name, size, color}]
    p_replacements JSONB,   -- [{variant_id, product_id, quantity, unit_price, product_name, size, color}]
    p_settlement_type TEXT, -- 'none', 'collected_extra', 'refunded_cash', 'refunded_upi', 'store_credit'
    p_payment_method TEXT,
    p_processed_by TEXT,
    p_notes TEXT
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_sale RECORD;
    v_exchange_number TEXT;
    v_exchange_id UUID;
    v_today_str TEXT;
    v_exc_count INT;
    v_return_item JSONB;
    v_repl_item JSONB;
    v_return_total NUMERIC := 0.00;
    v_repl_total NUMERIC := 0.00;
    v_diff NUMERIC := 0.00;
    v_current_stock INT;
    v_sale_item RECORD;
    v_all_returned BOOLEAN := TRUE;
    v_item_cursor RECORD;
BEGIN
    -- 1. Fetch original sale with lock
    SELECT * INTO v_sale FROM public.sales WHERE id = p_original_sale_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Original bill not found';
    END IF;

    -- 2. ENFORCE 7-DAY STRICT EXCHANGE RULE
    IF v_sale.created_at < (timezone('Asia/Kolkata', now()) - INTERVAL '7 days') THEN
        RAISE EXCEPTION 'Exchange period expired. Exchanges are strictly permitted within 7 days of purchase. Bill date: %', 
            to_char(v_sale.created_at, 'DD/MM/YYYY');
    END IF;

    -- 3. Calculate Return Total & Validate Quantities
    FOR v_return_item IN SELECT * FROM jsonb_array_elements(p_returns)
    LOOP
        SELECT * INTO v_sale_item 
        FROM public.sale_items 
        WHERE id = (v_return_item->>'sale_item_id')::UUID 
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Sale item not found for return: %', v_return_item->>'product_name';
        END IF;

        IF (v_sale_item.returned_quantity + (v_return_item->>'quantity')::INT) > v_sale_item.quantity THEN
            RAISE EXCEPTION 'Cannot return % units of %. Max returnable: %',
                (v_return_item->>'quantity')::INT,
                v_sale_item.product_name,
                (v_sale_item.quantity - v_sale_item.returned_quantity);
        END IF;

        v_return_total := v_return_total + ((v_return_item->>'unit_price')::NUMERIC * (v_return_item->>'quantity')::INT);
    END LOOP;

    -- 4. Calculate Replacement Total & Check Replacement Stocks
    FOR v_repl_item IN SELECT * FROM jsonb_array_elements(p_replacements)
    LOOP
        v_repl_total := v_repl_total + ((v_repl_item->>'unit_price')::NUMERIC * (v_repl_item->>'quantity')::INT);

        SELECT stock_quantity INTO v_current_stock
        FROM public.product_variants
        WHERE id = (v_repl_item->>'variant_id')::UUID
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Replacement variant not found';
        END IF;

        IF v_current_stock < (v_repl_item->>'quantity')::INT THEN
            RAISE EXCEPTION 'Insufficient stock for replacement % (% - %). Available: %',
                v_repl_item->>'product_name', v_repl_item->>'size', v_repl_item->>'color', v_current_stock;
        END IF;
    END LOOP;

    v_diff := v_repl_total - v_return_total;

    -- 5. Generate Exchange Number
    v_today_str := to_char(timezone('Asia/Kolkata', now()), 'YYYYMMDD');
    SELECT COUNT(*) + 1 INTO v_exc_count 
    FROM public.exchanges 
    WHERE exchange_number LIKE 'EXC-' || v_today_str || '-%';
    v_exchange_number := 'EXC-' || v_today_str || '-' || lpad(v_exc_count::TEXT, 4, '0');

    -- 6. Insert Exchange Master Record
    INSERT INTO public.exchanges (
        exchange_number, original_sale_id, original_bill_number,
        customer_name, customer_phone, return_total_value, replacement_total_value,
        difference_amount, settlement_type, payment_method, processed_by, notes
    ) VALUES (
        v_exchange_number, p_original_sale_id, v_sale.bill_number,
        v_sale.customer_name, v_sale.customer_phone, v_return_total, v_repl_total,
        v_diff, p_settlement_type, p_payment_method, p_processed_by, p_notes
    ) RETURNING id INTO v_exchange_id;

    -- 7. Process Returns: Update sale_items returned_quantity and RESTORE stock
    FOR v_return_item IN SELECT * FROM jsonb_array_elements(p_returns)
    LOOP
        UPDATE public.sale_items
        SET returned_quantity = returned_quantity + (v_return_item->>'quantity')::INT
        WHERE id = (v_return_item->>'sale_item_id')::UUID;

        -- Get current stock
        SELECT stock_quantity INTO v_current_stock
        FROM public.product_variants
        WHERE id = (v_return_item->>'variant_id')::UUID
        FOR UPDATE;

        -- Restore stock (+qty)
        UPDATE public.product_variants
        SET stock_quantity = stock_quantity + (v_return_item->>'quantity')::INT,
            updated_at = timezone('Asia/Kolkata', now())
        WHERE id = (v_return_item->>'variant_id')::UUID;

        -- Record exchange item
        INSERT INTO public.exchange_items (
            exchange_id, item_type, sale_item_id, product_id, variant_id,
            product_name, size, color, quantity, unit_price, total_price
        ) VALUES (
            v_exchange_id, 'return', (v_return_item->>'sale_item_id')::UUID,
            (v_return_item->>'product_id')::UUID, (v_return_item->>'variant_id')::UUID,
            v_return_item->>'product_name', v_return_item->>'size', v_return_item->>'color',
            (v_return_item->>'quantity')::INT, (v_return_item->>'unit_price')::NUMERIC,
            ((v_return_item->>'unit_price')::NUMERIC * (v_return_item->>'quantity')::INT)
        );

        -- Stock movement
        INSERT INTO public.stock_movements (
            product_id, variant_id, change_qty, previous_stock, new_stock,
            movement_type, reference_id, reference_number, reason, performed_by
        ) VALUES (
            (v_return_item->>'product_id')::UUID, (v_return_item->>'variant_id')::UUID,
            (v_return_item->>'quantity')::INT, v_current_stock, (v_current_stock + (v_return_item->>'quantity')::INT),
            'exchange_return', v_exchange_id, v_exchange_number, 'Customer exchange return', p_processed_by
        );
    END LOOP;

    -- 8. Process Replacements: Deduct replacement stock
    FOR v_repl_item IN SELECT * FROM jsonb_array_elements(p_replacements)
    LOOP
        SELECT stock_quantity INTO v_current_stock
        FROM public.product_variants
        WHERE id = (v_repl_item->>'variant_id')::UUID
        FOR UPDATE;

        -- Deduct stock (-qty)
        UPDATE public.product_variants
        SET stock_quantity = stock_quantity - (v_repl_item->>'quantity')::INT,
            updated_at = timezone('Asia/Kolkata', now())
        WHERE id = (v_repl_item->>'variant_id')::UUID;

        -- Record replacement item
        INSERT INTO public.exchange_items (
            exchange_id, item_type, sale_item_id, product_id, variant_id,
            product_name, size, color, quantity, unit_price, total_price
        ) VALUES (
            v_exchange_id, 'replacement', NULL,
            (v_repl_item->>'product_id')::UUID, (v_repl_item->>'variant_id')::UUID,
            v_repl_item->>'product_name', v_repl_item->>'size', v_repl_item->>'color',
            (v_repl_item->>'quantity')::INT, (v_repl_item->>'unit_price')::NUMERIC,
            ((v_repl_item->>'unit_price')::NUMERIC * (v_repl_item->>'quantity')::INT)
        );

        -- Stock movement
        INSERT INTO public.stock_movements (
            product_id, variant_id, change_qty, previous_stock, new_stock,
            movement_type, reference_id, reference_number, reason, performed_by
        ) VALUES (
            (v_repl_item->>'product_id')::UUID, (v_repl_item->>'variant_id')::UUID,
            -(v_repl_item->>'quantity')::INT, v_current_stock, (v_current_stock - (v_repl_item->>'quantity')::INT),
            'exchange_replacement', v_exchange_id, v_exchange_number, 'Customer exchange replacement', p_processed_by
        );
    END LOOP;

    -- 9. Determine if original bill is fully or partially exchanged
    FOR v_item_cursor IN SELECT quantity, returned_quantity FROM public.sale_items WHERE sale_id = p_original_sale_id
    LOOP
        IF v_item_cursor.returned_quantity < v_item_cursor.quantity THEN
            v_all_returned := FALSE;
        END IF;
    END LOOP;

    UPDATE public.sales
    SET status = CASE WHEN v_all_returned THEN 'exchanged' ELSE 'partially_exchanged' END,
        updated_at = timezone('Asia/Kolkata', now())
    WHERE id = p_original_sale_id;

    -- 10. Activity log
    INSERT INTO public.activity_logs (
        action_type, description, entity_type, entity_id, staff_name, metadata
    ) VALUES (
        'EXCHANGE_PROCESSED',
        'Processed Exchange #' || v_exchange_number || ' for Bill #' || v_sale.bill_number,
        'exchanges',
        v_exchange_id::TEXT,
        p_processed_by,
        jsonb_build_object('exchange_number', v_exchange_number, 'bill_number', v_sale.bill_number, 'difference', v_diff)
    );

    RETURN jsonb_build_object(
        'success', true,
        'exchange_id', v_exchange_id,
        'exchange_number', v_exchange_number,
        'difference_amount', v_diff,
        'settlement_type', p_settlement_type
    );
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- All 3 authenticated staff share all tables (sales, inventory, exchanges, etc.)
-- ============================================================================
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users and anon users with app authorization to read/write shared data
CREATE POLICY "Allow all operations for staff" ON public.staff_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for variants" ON public.product_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for sale_items" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for exchanges" ON public.exchanges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for exchange_items" ON public.exchange_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for stock_movements" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for purchases" ON public.purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for purchase_items" ON public.purchase_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime publication on crucial tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.exchanges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;

-- ============================================================================
-- INITIAL SEED DATA (Shop Categories & Staff)
-- ============================================================================
INSERT INTO public.categories (name, sort_order) VALUES
('Formal Shirts', 1),
('Casual Shirts', 2),
('Oversized T-Shirts', 3),
('Polo T-Shirts', 4),
('Denim Jeans', 5),
('Cotton Trousers', 6),
('Cargo Pants', 7),
('Track Pants & Joggers', 8),
('Shorts', 9),
('Winter Hoodies & Jackets', 10),
('Accessories & Belts', 11)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.staff_profiles (email, full_name, role, pin_code) VALUES
('staff1@vintageclothing.in', 'Vintage Staff 1', 'staff', '1111'),
('staff2@vintageclothing.in', 'Vintage Staff 2', 'staff', '2222'),
('owner@vintageclothing.in', 'Store Owner', 'owner', '9999')
ON CONFLICT (email) DO NOTHING;
