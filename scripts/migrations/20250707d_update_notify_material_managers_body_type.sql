-- 20250707d_update_notify_material_managers_body_type.sql
-- Purpose: Remove ::text cast on body in net.http_post call to match pg_net signature.

CREATE OR REPLACE FUNCTION public.notify_material_managers()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_slack_ids TEXT[];
    current_slack_id TEXT;
    item_record RECORD;
    item_count INTEGER;
    total_amount_formatted TEXT;
    block_kit_blocks JSONB;
    supabase_url TEXT := 'https://qvhbigvdfyvhoegkhvef.supabase.co';
    anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg';
BEGIN
    -- Trigger fires when middle_manager_status transitions to 'approved'
    IF TG_OP = 'UPDATE' AND OLD.middle_manager_status IS DISTINCT FROM NEW.middle_manager_status AND NEW.middle_manager_status = 'approved' THEN

        -- Determine target Slack IDs by request type
        IF NEW.request_type = '원자재' THEN
            SELECT array_agg(e.slack_id)
              INTO target_slack_ids
              FROM employees e
              WHERE e.purchase_role @> ARRAY['raw_material_manager']
                AND e.slack_id IS NOT NULL
                AND e.slack_id <> '';
        ELSIF NEW.request_type = '소모품' THEN
            SELECT array_agg(e.slack_id)
              INTO target_slack_ids
              FROM employees e
              WHERE e.purchase_role @> ARRAY['consumable_manager']
                AND e.slack_id IS NOT NULL
                AND e.slack_id <> '';
        ELSE
            RETURN NEW; -- Not applicable type
        END IF;

        IF target_slack_ids IS NULL OR array_length(target_slack_ids,1) = 0 THEN
            RAISE NOTICE 'No target material manager found for request_type %', NEW.request_type;
            RETURN NEW;
        END IF;

        -- Fetch first item and count
        SELECT item_name, specification, unit_price_value, quantity, amount_value, remark
          INTO item_record
          FROM purchase_request_items pri
          WHERE pri.purchase_request_id = NEW.id
          ORDER BY line_number
          LIMIT 1;

        SELECT COUNT(*) INTO item_count
          FROM purchase_request_items pri
          WHERE pri.purchase_request_id = NEW.id;

        -- Format helpers
        total_amount_formatted := '₩' || COALESCE(TO_CHAR(NEW.total_amount, 'FM999,999,999'), '0');

        -- Build Block Kit JSONB (same as before, omitted for brevity)
        -- NOTE: We replicate previous logic but keep identical output
        block_kit_blocks := jsonb_build_array(
            jsonb_build_object('type','header','text',jsonb_build_object('type','plain_text','text','📋 발주서 승인 요청 - ' || COALESCE(NEW.requester_name,'미정'))),
            jsonb_build_object('type','divider'),
            jsonb_build_object('type','section','fields',jsonb_build_array(
              jsonb_build_object('type','mrkdwn','text','*요청유형:*' || E'\n' || COALESCE(NEW.request_type,'미정')),
              jsonb_build_object('type','mrkdwn','text','*결제유형:*' || E'\n' || COALESCE(NEW.payment_category,'미정')),
              jsonb_build_object('type','mrkdwn','text','*업체명:*' || E'\n' || COALESCE(NEW.vendor_name,'미정')),
              jsonb_build_object('type','mrkdwn','text','*담당자:*' || E'\n' || COALESCE(NEW.requester_name,'미정')))),
            jsonb_build_object('type','section','text',jsonb_build_object('type','mrkdwn','text','📦 *주문품목 (' || item_count || '개)*')),
            CASE WHEN item_record IS NOT NULL THEN jsonb_build_object('type','section','text',jsonb_build_object('type','mrkdwn','text','• *1번* - ' || COALESCE(item_record.item_name,'품목명 미정') || E'\n' || '규격: ' || COALESCE(item_record.specification,'규격 미정') || ' | 수량: ' || COALESCE(item_record.quantity::TEXT,'0') || '개 | 단가: ₩' || COALESCE(TO_CHAR(item_record.unit_price_value,'FM999,999,999'),'0') || ' | 합계: ₩' || COALESCE(TO_CHAR(item_record.amount_value,'FM999,999,999'),'0') || CASE WHEN item_record.remark IS NOT NULL AND item_record.remark <> '' THEN ' | 비고: ' || item_record.remark ELSE '' END)) ELSE NULL END,
            CASE WHEN item_count > 1 THEN jsonb_build_object('type','context','elements',jsonb_build_array(jsonb_build_object('type','mrkdwn','text','_나머지 ' || (item_count-1) || '개 품목은 시스템에서 확인하세요._'))) ELSE NULL END,
            jsonb_build_object('type','divider'),
            jsonb_build_object('type','section','fields',jsonb_build_array(
              jsonb_build_object('type','mrkdwn','text','*총 금액:*' || E'\n' || total_amount_formatted),
              jsonb_build_object('type','mrkdwn','text','*결제조건:*' || E'\n' || '월말 정산'))),
            jsonb_build_object('type','actions','elements',jsonb_build_array(
              jsonb_build_object('type','button','style','primary','text',jsonb_build_object('type','plain_text','text','✅ 승인'),'action_id','approve_purchase_request','value',NEW.purchase_order_number::TEXT,'url','https://hanslwebapp.vercel.app/purchase/approve'),
              jsonb_build_object('type','button','style','danger','text',jsonb_build_object('type','plain_text','text','❌ 반려'),'action_id','reject_purchase_request','value',NEW.purchase_order_number::TEXT,'url','https://hanslwebapp.vercel.app/purchase/approve')))
        );

        -- Remove NULL elements
        block_kit_blocks := (SELECT jsonb_agg(e) FROM jsonb_array_elements(block_kit_blocks) AS e WHERE e IS NOT NULL);

        -- Send DM per target
        FOREACH current_slack_id IN ARRAY target_slack_ids LOOP
            PERFORM net.http_post(
                url     := supabase_url || '/functions/v1/slack-dm-sender',
                headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || anon_key),
                body    := jsonb_build_object('user_id', current_slack_id, 'blocks', block_kit_blocks)
            );
            RAISE NOTICE 'Material manager notification sent to % (PO: %)', current_slack_id, NEW.purchase_order_number;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$; 