-- 20250705a_create_po_dm_queue.sql
-- Purpose: introduce queue table for middle-manager DM + file upload processing

-- 1. Create queue table
CREATE TABLE IF NOT EXISTS po_dm_queue (
    id BIGSERIAL PRIMARY KEY,
    purchase_request_id BIGINT NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
    purchase_order_number TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending', -- pending | success | failed
    retry_count INTEGER DEFAULT 0,
    error TEXT
);

-- 2. Enable RLS and allow only service_role
ALTER TABLE po_dm_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS po_dm_queue_access ON po_dm_queue;
CREATE POLICY po_dm_queue_access ON po_dm_queue
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. Update trigger function: replace http/upload loop with queue insert + NOTIFY
CREATE OR REPLACE FUNCTION handle_purchase_request_insert()
RETURNS TRIGGER AS $$
DECLARE
BEGIN
    -- Insert DM queue entry immediately
    INSERT INTO po_dm_queue(purchase_request_id, purchase_order_number)
    VALUES (NEW.id, NEW.purchase_order_number);

    -- Notify listeners (Edge Function) for near-real-time processing
    PERFORM pg_notify('po_dm_queue', NEW.purchase_order_number);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
