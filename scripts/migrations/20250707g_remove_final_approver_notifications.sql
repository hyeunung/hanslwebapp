-- 20250707g_remove_final_approver_notifications.sql
-- Purpose: Completely remove database triggers and functions responsible for Slack DM notifications
--          to final approvers / material managers, without affecting other parts of the system.
--          This migration is fully reversible via version control.

-- 1. Drop triggers
DROP TRIGGER IF EXISTS material_manager_notify_trigger ON purchase_requests;
DROP TRIGGER IF EXISTS po_dm_queue_insert ON public.po_dm_queue;

-- 2. Drop helper functions (if they exist)
DROP FUNCTION IF EXISTS public.notify_material_managers();
DROP FUNCTION IF EXISTS public.send_block_kit_approval_notification(BIGINT);
DROP FUNCTION IF EXISTS public.create_purchase_approval_block_kit(BIGINT);
DROP FUNCTION IF EXISTS public.handle_purchase_request_insert();

-- 3. Optionally drop queue table (kept for safety, but uncomment to remove)
-- DROP TABLE IF EXISTS public.po_dm_queue CASCADE; 