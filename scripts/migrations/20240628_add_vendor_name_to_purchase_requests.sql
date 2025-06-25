-- Add vendor_name column to purchase_requests and keep it in sync with vendor_id

-- 1. Add the column if it does not exist
ALTER TABLE purchase_requests
  ADD COLUMN IF NOT EXISTS vendor_name text;

-- 2. Back-fill existing rows with the current vendor name
UPDATE purchase_requests pr
SET    vendor_name = v.vendor_name
FROM   vendors v
WHERE  v.id = pr.vendor_id;

-- 3. Trigger function to set vendor_name on INSERT / UPDATE
CREATE OR REPLACE FUNCTION set_vendor_name_on_requests()
RETURNS TRIGGER AS $$
BEGIN
  -- Fetch the vendor name based on (new or old) vendor_id
  SELECT vendor_name INTO NEW.vendor_name
  FROM   vendors
  WHERE  id = NEW.vendor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create or replace trigger
DROP TRIGGER IF EXISTS trg_set_vendor_name_on_requests ON purchase_requests;
CREATE TRIGGER trg_set_vendor_name_on_requests
BEFORE INSERT OR UPDATE OF vendor_id ON purchase_requests
FOR EACH ROW EXECUTE FUNCTION set_vendor_name_on_requests(); 