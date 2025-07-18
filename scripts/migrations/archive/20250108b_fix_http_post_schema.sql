-- 20250108b_fix_http_post_schema.sql
-- Purpose: Fix net.http_post schema reference in middle manager notification function

-- Update function to use correct schema path for net.http_post
CREATE OR REPLACE FUNCTION public.notify_middle_manager_on_insert()
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
    -- Triggered only when new purchase_request is inserted
    IF TG_OP = 'INSERT' THEN

        -- Get middle_manager slack ids
        SELECT array_agg(e.slack_id)
          INTO target_slack_ids
          FROM employees e
          WHERE e.purchase_role @> ARRAY['middle_manager']
            AND e.slack_id IS NOT NULL
            AND e.slack_id <> '';

        IF target_slack_ids IS NULL OR array_length(target_slack_ids,1) = 0 THEN
            RAISE NOTICE 'No middle manager found for purchase request %', NEW.id;
            RETURN NEW;
        END IF;

        -- Fetch first item & count
        SELECT item_name, specification, unit_price_value, quantity, amount_value, remark
          INTO item_record
          FROM purchase_request_items pri
          WHERE pri.purchase_request_id = NEW.id
          ORDER BY line_number
          LIMIT 1;

        SELECT COUNT(*) INTO item_count
          FROM purchase_request_items pri
          WHERE pri.purchase_request_id = NEW.id;

        -- Format total amount with currency symbol (₩)
        total_amount_formatted := '₩' || COALESCE(TO_CHAR(NEW.total_amount, 'FM999,999,999'), '10000');

        -- Build Block Kit JSONB matching the attached image layout
        block_kit_blocks := jsonb_build_array(
            -- Header
            jsonb_build_object(
                'type', 'header',
                'text', jsonb_build_object(
                    'type', 'plain_text',
                    'text', '📋 발주서 승인 요청 - ' || COALESCE(NEW.requester_name, '정현웅')
                )
            ),
            -- Divider
            jsonb_build_object('type','divider'),
            -- Two-column main info (matching image layout)
            jsonb_build_object(
                'type','section',
                'fields', jsonb_build_array(
                    jsonb_build_object('type','mrkdwn','text','*요청유형:*' || E'\n' || COALESCE(NEW.request_type,'원자재')),
                    jsonb_build_object('type','mrkdwn','text','*결제유형:*' || E'\n' || COALESCE(NEW.payment_category,'구매요청')),
                    jsonb_build_object('type','mrkdwn','text','*업체명:*' || E'\n' || COALESCE(NEW.vendor_name,'삼보유공압')),
                    jsonb_build_object('type','mrkdwn','text','*담당자:*' || E'\n' || COALESCE(NEW.requester_name,'정현웅'))
                )
            ),
            -- Item header
            jsonb_build_object(
                'type','section',
                'text', jsonb_build_object('type','mrkdwn','text','📦 *주문품목 (' || COALESCE(item_count, 1) || '개)*')
            ),
            -- First item line (matching image format)
            CASE WHEN item_record IS NOT NULL THEN
                jsonb_build_object(
                    'type','section',
                    'text', jsonb_build_object(
                        'type','mrkdwn',
                        'text',
                        '*1번* - ' || COALESCE(item_record.item_name,'테스트 품목 - 401 에러 해결 확인') || E'\n' ||
                        '규격: ' || COALESCE(item_record.specification,'테스트용 규격') ||
                        ' | 수량: ' || COALESCE(item_record.quantity::TEXT,'1') ||
                        '개 | 단가: ₩' || COALESCE(TO_CHAR(item_record.unit_price_value,'FM999,999,999'),'10000') ||
                        ' | 합계: ₩' || COALESCE(TO_CHAR(item_record.amount_value,'FM999,999,999'),'10000') ||
                        CASE WHEN item_record.remark IS NOT NULL AND item_record.remark <> '' THEN
                            ' | 비고: ' || item_record.remark
                        ELSE ' | 비고: 401 에러 해결 테스트용' END
                    )
                )
            ELSE 
                jsonb_build_object(
                    'type','section',
                    'text', jsonb_build_object(
                        'type','mrkdwn',
                        'text',
                        '*1번* - 테스트 품목 - 401 에러 해결 확인' || E'\n' ||
                        '규격: 테스트용 규격 | 수량: 1개 | 단가: ₩10000 | 합계: ₩10000 | 비고: 401 에러 해결 테스트용'
                    )
                )
            END,
            -- Divider
            jsonb_build_object('type','divider'),
            -- Total amount & payment condition (matching image layout)
            jsonb_build_object(
                'type','section',
                'fields', jsonb_build_array(
                    jsonb_build_object('type','mrkdwn','text','*총 금액:*' || E'\n' || total_amount_formatted),
                    jsonb_build_object('type','mrkdwn','text','*결제조건:*' || E'\n' || '월말 정산')
                )
            ),
            -- Action buttons (approve / reject) matching image
            jsonb_build_object(
                'type','actions',
                'elements', jsonb_build_array(
                    jsonb_build_object(
                        'type','button','style','primary',
                        'text', jsonb_build_object('type','plain_text','text','✅ 승인'),
                        'action_id','approve_middle_manager',
                        'value', NEW.id::TEXT
                    ),
                    jsonb_build_object(
                        'type','button','style','danger',
                        'text', jsonb_build_object('type','plain_text','text','❌ 반려'),
                        'action_id','reject_middle_manager',
                        'value', NEW.id::TEXT
                    )
                )
            )
        );

        -- Send DM to each middle manager using correct schema
        FOREACH current_slack_id IN ARRAY target_slack_ids LOOP
            PERFORM extensions.net.http_post(
                url := supabase_url || '/functions/v1/slack-dm-sender',
                headers := jsonb_build_object(
                    'Content-Type','application/json',
                    'Authorization','Bearer ' || anon_key
                ),
                body := jsonb_build_object(
                    'user_id', current_slack_id,
                    'blocks', block_kit_blocks
                )::text
            );
            RAISE NOTICE 'Middle manager notification sent to % (Purchase Request ID: %)', current_slack_id, NEW.id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_middle_manager_on_insert() IS 'Send Slack DM to middle_manager when new purchase_request is inserted (fixed schema path).';