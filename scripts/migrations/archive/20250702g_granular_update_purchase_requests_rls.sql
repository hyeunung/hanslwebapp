-- 20250702g_granular_update_purchase_requests_rls.sql
-- Purpose: Fine-grained UPDATE RLS policies on purchase_requests
--   • middle_manager → can set middle_manager_status (approve / reject)
--   • final_approver → can set final_manager_status (approve / reject)
--   • both roles → can set either status to 'rejected'
--   • app_admin → full permissions across all three policies

-- ------------------------------------------------------------------
-- Helper note: auth.uid() returns the current logged-in user's UUID.
-- employees.id is a UUID FK to auth.users.id.
-- employees.purchase_role is a text[] containing roles.
-- ------------------------------------------------------------------

-- ========== 1. middle_manager_status update =================================
DROP POLICY IF EXISTS update_by_middle_manager ON public.purchase_requests;

CREATE POLICY update_by_middle_manager
ON public.purchase_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = auth.uid()
      AND (
        e.purchase_role @> ARRAY['middle_manager']::text[] OR
        e.purchase_role @> ARRAY['app_admin']::text[]
      )
  )
)
WITH CHECK (
  NEW.middle_manager_status IN ('approved','rejected') AND
  NEW.final_manager_status = OLD.final_manager_status
);

-- ========== 2. final_manager_status update ==================================
DROP POLICY IF EXISTS update_by_final_manager ON public.purchase_requests;

CREATE POLICY update_by_final_manager
ON public.purchase_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = auth.uid()
      AND (
        e.purchase_role @> ARRAY['final_approver']::text[] OR
        e.purchase_role @> ARRAY['app_admin']::text[]
      )
  )
)
WITH CHECK (
  NEW.final_manager_status IN ('approved','rejected') AND
  NEW.middle_manager_status = OLD.middle_manager_status
);

-- ========== 3. reject by either role ========================================
DROP POLICY IF EXISTS reject_by_both ON public.purchase_requests;

CREATE POLICY reject_by_both
ON public.purchase_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = auth.uid()
      AND (
        e.purchase_role @> ARRAY['middle_manager']::text[] OR
        e.purchase_role @> ARRAY['final_approver']::text[] OR
        e.purchase_role @> ARRAY['app_admin']::text[]
      )
  )
)
WITH CHECK (
  NEW.middle_manager_status = 'rejected' OR
  NEW.final_manager_status  = 'rejected'
);
