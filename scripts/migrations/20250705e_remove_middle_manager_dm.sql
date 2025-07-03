-- 20250705e_remove_middle_manager_dm.sql
-- Purpose: Remove middle-manager Slack DM system (queue table, triggers, functions)

-- 1. Drop HTTP webhook trigger that calls Edge Function (if exists)
DROP TRIGGER IF EXISTS po_dm_queue_insert ON public.po_dm_queue;

-- 2. Drop queue table (cascades policies)
DROP TABLE IF EXISTS public.po_dm_queue CASCADE;

-- 3. Drop purchase_requests trigger that inserted into queue (if exists)
DROP TRIGGER IF EXISTS handle_purchase_request_insert_trigger ON public.purchase_requests;

-- 4. Drop helper function
DROP FUNCTION IF EXISTS public.handle_purchase_request_insert() CASCADE;

-- 5. Optionally drop leftover middle manager notification functions (safe even if absent)
DROP FUNCTION IF EXISTS public.send_beautiful_middle_manager_notification(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.send_simple_middle_manager_notification(BIGINT) CASCADE;

-- 6. Confirmation notice
DO $$ BEGIN RAISE NOTICE '✅ Middle manager DM system removed (queue table, triggers, functions)'; END $$;
