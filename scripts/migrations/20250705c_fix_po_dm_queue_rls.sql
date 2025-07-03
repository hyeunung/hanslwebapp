-- 20250705c_fix_po_dm_queue_rls.sql
-- Purpose: Recreate handle_purchase_request_insert with SECURITY DEFINER to bypass RLS for po_dm_queue insert

-- 1. Drop existing function (if any)
DROP FUNCTION IF EXISTS handle_purchase_request_insert();

-- 2. Recreate with SECURITY DEFINER
CREATE OR REPLACE FUNCTION handle_purchase_request_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert into queue
    INSERT INTO po_dm_queue(purchase_request_id, purchase_order_number)
    VALUES (NEW.id, NEW.purchase_order_number);

    -- Notify listeners
    PERFORM pg_notify('po_dm_queue', NEW.purchase_order_number);

    RETURN NEW;
END;
$$;

-- 3. Grant execute to application roles if necessary
GRANT EXECUTE ON FUNCTION handle_purchase_request_insert() TO authenticated, anon, service_role;
