-- 20250705d_set_handle_purchase_request_insert_security_definer.sql
-- Purpose: Change handle_purchase_request_insert to SECURITY DEFINER to bypass RLS on po_dm_queue

ALTER FUNCTION public.handle_purchase_request_insert() SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.handle_purchase_request_insert() TO authenticated, anon, service_role;
