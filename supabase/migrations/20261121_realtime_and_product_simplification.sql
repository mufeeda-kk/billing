-- ============================================================================
-- VINTAGE CLOTHING STORE - REALTIME PUBLICATION & MULTI-USER SYNC MIGRATION
-- Migration Date: 2026-11-21
-- Purpose:
-- 1. Ensure all essential tables are included in Supabase Realtime publication
--    (products, product_variants, sales, sale_items, purchases, expenses, activity_logs)
-- 2. Add atomic helper for simplified product creation
-- ============================================================================

DO $$
BEGIN
    -- Ensure products table is published for Realtime
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    -- Ensure product_variants table is published for Realtime
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    -- Ensure sales table is published for Realtime
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    -- Ensure sale_items table is published for Realtime
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    -- Ensure purchases table is published for Realtime
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    -- Ensure expenses table is published for Realtime
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    -- Ensure activity_logs table is published for Realtime
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- Enable REPLICA IDENTITY FULL on products, product_variants, and sales
-- so UPDATE and DELETE events include full row data for realtime subscribers
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.product_variants REPLICA IDENTITY FULL;
ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.purchases REPLICA IDENTITY FULL;
