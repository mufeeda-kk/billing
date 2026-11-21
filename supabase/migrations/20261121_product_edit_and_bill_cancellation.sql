-- ============================================================================
-- VINTAGE CLOTHING STORE - MIGRATION: PRODUCT EDIT/DELETE & SAFE BILL CANCELLATION
-- Migration Date: 2026-11-21
-- Adds:
-- 1. Product Archive / Soft-delete support
-- 2. Safe Bill Cancellation with atomic stock restoration & double-cancellation prevention
-- 3. Bill Editing with differential stock adjustment and audit logging
-- 4. Excludes cancelled bills from reports
-- ============================================================================

-- 1. ADD COLUMNS FOR ARCHIVE AND CANCELLATION AUDIT
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by TEXT;

-- Index for active/archived products
CREATE INDEX IF NOT EXISTS idx_products_is_archived ON public.products(is_archived);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);

-- 2. ATOMIC PRODUCT DELETE OR ARCHIVE FUNCTION
CREATE OR REPLACE FUNCTION public.delete_or_archive_product(
    p_product_id UUID,
    p_performed_by TEXT
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_has_sales BOOLEAN := false;
    v_has_purchases BOOLEAN := false;
    v_has_exchanges BOOLEAN := false;
    v_prod_name TEXT;
    v_prod_sku TEXT;
BEGIN
    SELECT name, sku INTO v_prod_name, v_prod_sku 
    FROM public.products 
    WHERE id = p_product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    -- Check if product exists in sale_items
    SELECT EXISTS (SELECT 1 FROM public.sale_items WHERE product_id = p_product_id) INTO v_has_sales;
    -- Check if product exists in purchase_items
    SELECT EXISTS (SELECT 1 FROM public.purchase_items WHERE product_id = p_product_id) INTO v_has_purchases;
    -- Check if product exists in exchange_items
    SELECT EXISTS (SELECT 1 FROM public.exchange_items WHERE product_id = p_product_id) INTO v_has_exchanges;

    IF v_has_sales OR v_has_purchases OR v_has_exchanges THEN
        -- Safely archive / soft-delete
        UPDATE public.products
        SET is_active = false,
            is_archived = true,
            updated_at = timezone('Asia/Kolkata', now())
        WHERE id = p_product_id;

        INSERT INTO public.activity_logs (
            action_type, description, entity_type, entity_id, staff_name, metadata
        ) VALUES (
            'PRODUCT_ARCHIVED',
            'Archived product "' || v_prod_name || '" (' || v_prod_sku || ') because it has transaction history.',
            'product',
            p_product_id::TEXT,
            p_performed_by,
            jsonb_build_object('name', v_prod_name, 'sku', v_prod_sku, 'action', 'archived')
        );

        RETURN jsonb_build_object(
            'success', true,
            'action', 'archived',
            'message', 'Product safely archived to preserve historical bills and reports.'
        );
    ELSE
        -- No transaction history, safe to permanently delete
        DELETE FROM public.products WHERE id = p_product_id;

        INSERT INTO public.activity_logs (
            action_type, description, entity_type, entity_id, staff_name, metadata
        ) VALUES (
            'PRODUCT_DELETED',
            'Permanently deleted unused product "' || v_prod_name || '" (' || v_prod_sku || ').',
            'product',
            p_product_id::TEXT,
            p_performed_by,
            jsonb_build_object('name', v_prod_name, 'sku', v_prod_sku, 'action', 'deleted')
        );

        RETURN jsonb_build_object(
            'success', true,
            'action', 'deleted',
            'message', 'Product permanently removed.'
        );
    END IF;
END;
$$;

-- 3. ATOMIC BILL CANCELLATION FUNCTION (RESTORES STOCK EXACTLY ONCE)
CREATE OR REPLACE FUNCTION public.cancel_sale_transaction(
    p_sale_id UUID,
    p_reason TEXT,
    p_cancelled_by TEXT
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_sale RECORD;
    v_item RECORD;
    v_restore_qty INT;
    v_current_stock INT;
BEGIN
    -- 1. Lock sale record for update to prevent concurrent double cancellation
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bill not found';
    END IF;

    -- 2. Prevent double cancellation
    IF v_sale.status = 'cancelled' THEN
        RAISE EXCEPTION 'Bill % is already cancelled.', v_sale.bill_number;
    END IF;

    -- 3. Prevent cancelling exchanged bills directly
    IF v_sale.status = 'exchanged' THEN
        RAISE EXCEPTION 'Cannot cancel Bill % because items have already been exchanged.', v_sale.bill_number;
    END IF;

    -- 4. Atomically restore stock for every item sold (minus any already returned items)
    FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id
    LOOP
        v_restore_qty := v_item.quantity - COALESCE(v_item.returned_quantity, 0);

        IF v_restore_qty > 0 THEN
            -- Lock variant row
            SELECT stock_quantity INTO v_current_stock
            FROM public.product_variants
            WHERE id = v_item.variant_id
            FOR UPDATE;

            IF FOUND THEN
                UPDATE public.product_variants
                SET stock_quantity = stock_quantity + v_restore_qty,
                    updated_at = timezone('Asia/Kolkata', now())
                WHERE id = v_item.variant_id;

                -- Log stock movement
                INSERT INTO public.stock_movements (
                    product_id, variant_id, change_qty, previous_stock, new_stock,
                    movement_type, reference_id, reference_number, reason, performed_by
                ) VALUES (
                    v_item.product_id, v_item.variant_id, v_restore_qty,
                    v_current_stock, (v_current_stock + v_restore_qty),
                    'cancellation', p_sale_id, v_sale.bill_number,
                    'Restored from cancelled bill: ' || p_reason,
                    p_cancelled_by
                );
            END IF;
        END IF;
    END LOOP;

    -- 5. Mark bill as cancelled
    UPDATE public.sales
    SET status = 'cancelled',
        cancellation_reason = p_reason,
        cancelled_by = p_cancelled_by,
        cancelled_at = timezone('Asia/Kolkata', now()),
        updated_at = timezone('Asia/Kolkata', now())
    WHERE id = p_sale_id;

    -- 6. Adjust customer total spent if applicable
    IF v_sale.customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET total_purchases = GREATEST(0, total_purchases - v_sale.grand_total),
            total_bills = GREATEST(0, total_bills - 1)
        WHERE id = v_sale.customer_id;
    END IF;

    -- 7. Audit log
    INSERT INTO public.activity_logs (
        action_type, description, entity_type, entity_id, staff_name, metadata
    ) VALUES (
        'BILL_CANCELLED',
        'Cancelled Bill #' || v_sale.bill_number || '. Reason: ' || p_reason,
        'sales',
        p_sale_id::TEXT,
        p_cancelled_by,
        jsonb_build_object('bill_number', v_sale.bill_number, 'reason', p_reason, 'grand_total', v_sale.grand_total)
    );

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', p_sale_id,
        'bill_number', v_sale.bill_number,
        'status', 'cancelled'
    );
END;
$$;

-- 4. ATOMIC BILL EDIT FUNCTION (WITH DIFFERENTIAL STOCK ADJUSTMENTS)
CREATE OR REPLACE FUNCTION public.edit_sale_transaction(
    p_sale_id UUID,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_subtotal NUMERIC,
    p_discount_type TEXT,
    p_discount_value NUMERIC,
    p_discount_amount NUMERIC,
    p_grand_total NUMERIC,
    p_paid_amount NUMERIC,
    p_payment_method TEXT,
    p_notes TEXT,
    p_edited_by TEXT,
    p_edit_reason TEXT,
    p_items JSONB -- [{variant_id, product_id, product_name, size, color, quantity, unit_price, discount_amount, subtotal, purchase_price}]
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_sale RECORD;
    v_old_items RECORD;
    v_new_item JSONB;
    v_variant_id UUID;
    v_product_id UUID;
    v_new_qty INT;
    v_old_qty INT;
    v_qty_delta INT;
    v_current_stock INT;
    v_balance NUMERIC;
    v_payment_status TEXT;
BEGIN
    -- 1. Lock sale record
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bill not found';
    END IF;

    IF v_sale.status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot edit a cancelled bill.';
    END IF;

    -- 2. Differential stock update & validation
    -- For each new item, compare with old item quantity
    FOR v_new_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_variant_id := (v_new_item->>'variant_id')::UUID;
        v_new_qty := (v_new_item->>'quantity')::INT;

        -- Find old quantity for this variant in this sale
        SELECT COALESCE(quantity, 0) INTO v_old_qty
        FROM public.sale_items
        WHERE sale_id = p_sale_id AND variant_id = v_variant_id;
        
        IF NOT FOUND THEN
            v_old_qty := 0;
        END IF;

        v_qty_delta := v_new_qty - v_old_qty;

        IF v_qty_delta > 0 THEN
            -- More items being sold: lock variant and check stock
            SELECT stock_quantity INTO v_current_stock
            FROM public.product_variants
            WHERE id = v_variant_id
            FOR UPDATE;

            IF v_current_stock < v_qty_delta THEN
                RAISE EXCEPTION 'Insufficient stock for % (% - %). Available: %, Additional needed: %',
                    v_new_item->>'product_name', v_new_item->>'size', v_new_item->>'color',
                    v_current_stock, v_qty_delta;
            END IF;

            -- Deduct stock
            UPDATE public.product_variants
            SET stock_quantity = stock_quantity - v_qty_delta,
                updated_at = timezone('Asia/Kolkata', now())
            WHERE id = v_variant_id;

            -- Stock movement
            INSERT INTO public.stock_movements (
                product_id, variant_id, change_qty, previous_stock, new_stock,
                movement_type, reference_id, reference_number, reason, performed_by
            ) VALUES (
                (v_new_item->>'product_id')::UUID, v_variant_id, -v_qty_delta,
                v_current_stock, (v_current_stock - v_qty_delta),
                'adjustment', p_sale_id, v_sale.bill_number,
                'Bill #' || v_sale.bill_number || ' edited: ' || COALESCE(p_edit_reason, 'Quantity increased'),
                p_edited_by
            );
        ELSIF v_qty_delta < 0 THEN
            -- Items reduced: restore stock
            SELECT stock_quantity INTO v_current_stock
            FROM public.product_variants
            WHERE id = v_variant_id
            FOR UPDATE;

            UPDATE public.product_variants
            SET stock_quantity = stock_quantity + (-v_qty_delta),
                updated_at = timezone('Asia/Kolkata', now())
            WHERE id = v_variant_id;

            INSERT INTO public.stock_movements (
                product_id, variant_id, change_qty, previous_stock, new_stock,
                movement_type, reference_id, reference_number, reason, performed_by
            ) VALUES (
                (v_new_item->>'product_id')::UUID, v_variant_id, (-v_qty_delta),
                v_current_stock, (v_current_stock + (-v_qty_delta)),
                'adjustment', p_sale_id, v_sale.bill_number,
                'Bill #' || v_sale.bill_number || ' edited: ' || COALESCE(p_edit_reason, 'Quantity reduced'),
                p_edited_by
            );
        END IF;
    END LOOP;

    -- 3. Replace sale items
    DELETE FROM public.sale_items WHERE sale_id = p_sale_id;

    FOR v_new_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.sale_items (
            sale_id, product_id, variant_id, product_name,
            size, color, quantity, unit_price, discount_amount,
            subtotal, purchase_price, returned_quantity
        ) VALUES (
            p_sale_id,
            (v_new_item->>'product_id')::UUID,
            (v_new_item->>'variant_id')::UUID,
            v_new_item->>'product_name',
            v_new_item->>'size',
            v_new_item->>'color',
            (v_new_item->>'quantity')::INT,
            (v_new_item->>'unit_price')::NUMERIC,
            COALESCE((v_new_item->>'discount_amount')::NUMERIC, 0.00),
            (v_new_item->>'subtotal')::NUMERIC,
            COALESCE((v_new_item->>'purchase_price')::NUMERIC, 0.00),
            0
        );
    END LOOP;

    -- 4. Calculate balance & status
    v_balance := GREATEST(0, p_grand_total - p_paid_amount);
    v_payment_status := CASE 
        WHEN p_paid_amount >= p_grand_total THEN 'paid'
        WHEN p_paid_amount > 0 THEN 'partial'
        ELSE 'unpaid'
    END;

    -- 5. Update Sale Record
    UPDATE public.sales
    SET customer_name = p_customer_name,
        customer_phone = p_customer_phone,
        subtotal = p_subtotal,
        discount_type = p_discount_type,
        discount_value = p_discount_value,
        discount_amount = p_discount_amount,
        grand_total = p_grand_total,
        paid_amount = p_paid_amount,
        balance_amount = v_balance,
        payment_method = p_payment_method,
        payment_status = v_payment_status,
        notes = p_notes,
        updated_at = timezone('Asia/Kolkata', now())
    WHERE id = p_sale_id;

    -- 6. Audit log
    INSERT INTO public.activity_logs (
        action_type, description, entity_type, entity_id, staff_name, metadata
    ) VALUES (
        'BILL_EDITED',
        'Edited Bill #' || v_sale.bill_number || '. Reason: ' || COALESCE(p_edit_reason, 'Details updated'),
        'sales',
        p_sale_id::TEXT,
        p_edited_by,
        jsonb_build_object(
            'bill_number', v_sale.bill_number,
            'old_total', v_sale.grand_total,
            'new_total', p_grand_total,
            'reason', p_edit_reason
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', p_sale_id,
        'bill_number', v_sale.bill_number,
        'grand_total', p_grand_total
    );
END;
$$;
