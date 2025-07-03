-- 20250702e_allow_insert_purchase_requests.sql
-- Purpose: Allow INSERTs on purchase_requests for authenticated role via RLS.

-- 1. Drop existing policy if present (idempotent)
DROP POLICY IF EXISTS allow_insert_purchase_requests ON public.purchase_requests;

-- 2. Grant INSERT permission via RLS to authenticated role
CREATE POLICY allow_insert_purchase_requests
ON public.purchase_requests
FOR INSERT
TO authenticated
WITH CHECK (true);
