-- 20250702f_allow_delete_purchase_requests.sql
-- Purpose: Allow DELETE operations on purchase_requests for authenticated role via RLS.

-- 1. Drop existing policy if present (idempotent)
DROP POLICY IF EXISTS allow_delete_purchase_requests ON public.purchase_requests;

-- 2. Grant DELETE permission via RLS to authenticated role
CREATE POLICY allow_delete_purchase_requests
ON public.purchase_requests
FOR DELETE
TO authenticated
USING (true);
