-- Drop purchase_request_view since we now use direct table queries
-- This view is no longer needed as we changed to direct table query approach like approval management

DROP VIEW IF EXISTS purchase_request_view;