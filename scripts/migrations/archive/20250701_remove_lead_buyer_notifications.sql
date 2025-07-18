-- Migration: Remove Lead Buyer Notification system (triggers, function, table)
-- Drop triggers
DROP TRIGGER IF EXISTS trigger_notify_lead_buyer_insert ON purchase_requests;
DROP TRIGGER IF EXISTS trigger_notify_lead_buyer_update ON purchase_requests;

-- Drop trigger function
DROP FUNCTION IF EXISTS notify_lead_buyer_on_purchase_request() CASCADE;

-- Drop log table
DROP TABLE IF EXISTS lead_buyer_notifications CASCADE; 