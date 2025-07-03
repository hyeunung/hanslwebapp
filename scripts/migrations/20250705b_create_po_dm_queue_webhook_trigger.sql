-- Migration: Create webhook trigger to call Edge Function process-po-dm-worker on po_dm_queue INSERT

-- Ensure previous trigger is removed to avoid duplicates
DROP TRIGGER IF EXISTS po_dm_queue_insert ON public.po_dm_queue;

-- Create new trigger using supabase_functions.http_request (pg_net) to call Edge Function asynchronously
CREATE TRIGGER po_dm_queue_insert
AFTER INSERT ON public.po_dm_queue
FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(
  'https://qvhbigvdfyvhoegkhvef.functions.supabase.co/process-po-dm-worker',  -- Edge Function URL
  'POST',
  '{"Content-Type":"application/json"}',
  '{}',
  '1000'  -- timeout in ms
);
