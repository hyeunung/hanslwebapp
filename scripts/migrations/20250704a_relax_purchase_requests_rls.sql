-- 20250704a_relax_purchase_requests_rls.sql
-- Purpose: Switch to email-based ownership later, but immediately restore list visibility
-- by allowing authenticated users to SELECT all purchase_requests. This rolls back
-- overly restrictive id-based RLS policies that assumed employees.id = auth.uid().

-- 1. Drop old owner-based select policy if exists
DROP POLICY IF EXISTS select_purchase_requests_by_owner ON purchase_requests;

-- 2. Grant select to all authenticated users
CREATE POLICY allow_all_select_purchase_requests ON purchase_requests
FOR SELECT
TO authenticated
USING (true);

-- NOTE: Update/insert policies remain unchanged.  This migration only addresses list visibility. 