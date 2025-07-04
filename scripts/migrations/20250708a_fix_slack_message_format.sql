-- 슬랙 메시지 형식 개선: 이모티콘 변경 및 이스케이프 문자 수정
-- 🔢 → # 으로 변경, \n 표시 문제 해결

-- 1. 중간관리자 INSERT 알림 함수 개선
CREATE OR REPLACE FUNCTION notify_middle_manager_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY definer
AS $$
DECLARE
    target_slack_ids TEXT[];
    current_slack_id TEXT;
    item_record RECORD;
    item_count INTEGER;
    total_amount_formatted TEXT;
    block_kit_blocks JSONB;
    additional_items_hint JSONB := NULL;
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

        -- INCREASED wait time to 3 seconds for accurate item counting
        PERFORM pg_sleep(3.0);

        -- Fetch first item & count
        SELECT item_name, specification, unit_price_value, quantity, amount_value, remark
          INTO item_record
          FROM purchase_request_items pri
          WHERE pri.purchase_request_id = NEW.id
          ORDER BY pri.line_number
          LIMIT 1;

        SELECT COUNT(*)
          INTO item_count
          FROM purchase_request_items pri
          WHERE pri.purchase_request_id = NEW.id;

        -- If still no items found, wait 1 more second and retry
        IF item_count = 0 THEN
            PERFORM pg_sleep(1.0);
            SELECT COUNT(*)
              INTO item_count
              FROM purchase_request_items pri
              WHERE pri.purchase_request_id = NEW.id;
            
            -- Retry fetching first item
            SELECT item_name, specification, unit_price_value, quantity, amount_value, remark
              INTO item_record
              FROM purchase_request_items pri
              WHERE pri.purchase_request_id = NEW.id
              ORDER BY pri.line_number
              LIMIT 1;
        END IF;

        -- Format total amount with currency symbol (₩)
        total_amount_formatted := '₩' || COALESCE(TO_CHAR(NEW.total_amount, 'FM999,999,999'), '0');

        -- Build Block Kit JSONB - CHANGED: 🔢 → #
        block_kit_blocks := jsonb_build_array(
            -- Header
            jsonb_build_object(
                'type', 'header',
                'text', jsonb_build_object(
                    'type', 'plain_text',
                    'text', '📋 발주서 승인 요청 - ' || COALESCE(NEW.requester_name, '정현웅')
                )
            ),
            -- Purchase Order Number (CHANGED EMOJI: 🔢 → #)
            jsonb_build_object(
                'type','section',
                'text', jsonb_build_object(
                    'type','mrkdwn',
                    'text','# *발주번호:* ' || COALESCE(NEW.purchase_order_number, 'PO-' || NEW.id::TEXT)
                )
            ),
            -- Divider
            jsonb_build_object('type','divider'),
            -- Two-column main info - FIXED: 이스케이프 문자 수정
            jsonb_build_object(
                'type','section',
                'fields', jsonb_build_array(
                    jsonb_build_object('type','mrkdwn','text','*요청유형:*' || E'\n' || COALESCE(NEW.request_type,'원자재')),
                    jsonb_build_object('type','mrkdwn','text','*결제유형:*' || E'\n' || COALESCE(NEW.payment_category,'구매요청')),
                    jsonb_build_object('type','mrkdwn','text','*업체명:*' || E'\n' || COALESCE(NEW.vendor_name,'삼보유공압')),
                    jsonb_build_object('type','mrkdwn','text','*담당자:*' || E'\n' || COALESCE(NEW.requester_name,'정현웅'))
                )
            ),
            -- Item header (show actual count)
            jsonb_build_object(
                'type','section',
                'text', jsonb_build_object('type','mrkdwn','text','📦 *주문품목 (' || COALESCE(item_count,0) || '개)*')
            ),
            -- First item line or message when no items - FIXED: 이스케이프 문자 수정
            CASE WHEN item_record IS NOT NULL THEN
                jsonb_build_object(
                    'type','section',
                    'text', jsonb_build_object(
                        'type','mrkdwn',
                        'text',
                        '*1번* - ' || COALESCE(item_record.item_name,'품목명 없음') || E'\n' ||
                        '규격: ' || COALESCE(item_record.specification,'규격 없음') ||
                        ' | 수량: ' || COALESCE(item_record.quantity::TEXT,'0') ||
                        '개 | 단가: ₩' || COALESCE(TO_CHAR(item_record.unit_price_value::NUMERIC,'FM999,999,999'),'0') ||
                        ' | 합계: ₩' || COALESCE(TO_CHAR(item_record.amount_value::NUMERIC,'FM999,999,999'),'0') ||
                        CASE WHEN item_record.remark IS NOT NULL AND item_record.remark <> '' THEN
                            ' | 비고: ' || item_record.remark
                        ELSE '' END
                    )
                )
            ELSE 
                jsonb_build_object(
                    'type','section',
                    'text', jsonb_build_object(
                        'type','mrkdwn',
                        'text', '_품목 정보가 아직 등록되지 않았습니다._'
                    )
                )
            END,
            -- Divider
            jsonb_build_object('type','divider'),
            -- Total amount & payment condition - FIXED: 이스케이프 문자 수정
            jsonb_build_object(
                'type','section',
                'fields', jsonb_build_array(
                    jsonb_build_object('type','mrkdwn','text','*총 금액:*' || E'\n' || total_amount_formatted),
                    jsonb_build_object('type','mrkdwn','text','*결제조건:*' || E'\n' || COALESCE(NEW.payment_category, '월말 정산'))
                )
            ),
            -- Action buttons
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

        -- Add hint for additional items ONLY if count > 1
        IF item_count > 1 THEN
            additional_items_hint := jsonb_build_object(
                'type','context',
                'elements', jsonb_build_array(
                    jsonb_build_object('type','mrkdwn','text','_나머지 ' || (item_count-1) || '개 품목은 웹앱에서 확인하세요._')
                )
            );
            -- Insert the hint before divider
            block_kit_blocks := jsonb_insert(block_kit_blocks, '{-3}', additional_items_hint);
        END IF;

        -- Send DM to each middle manager
        FOREACH current_slack_id IN ARRAY target_slack_ids LOOP
            PERFORM public.http_post_wrapper(
                url_param := supabase_url || '/functions/v1/slack-dm-sender',
                headers_param := jsonb_build_object(
                    'Content-Type','application/json',
                    'Authorization','Bearer ' || anon_key
                ),
                body_param := jsonb_build_object(
                    'user_id', current_slack_id,
                    'blocks', block_kit_blocks
                )::text
            );
            RAISE NOTICE 'Middle manager notification sent to % (Purchase Request ID: %, Item Count: %)', current_slack_id, NEW.id, COALESCE(item_count,0);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

-- 2. explicit 알림 함수도 동일하게 수정
CREATE OR REPLACE FUNCTION notify_middle_manager_explicit(purchase_request_id_param INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY definer
AS $$
DECLARE
    target_slack_ids TEXT[];
    current_slack_id TEXT;
    item_record RECORD;
    item_count INTEGER;
    total_amount_formatted TEXT;
    purchase_request RECORD;
    block_kit_blocks JSONB;
    additional_items_hint JSONB := NULL;
    supabase_url TEXT := 'https://qvhbigvdfyvhoegkhvef.supabase.co';
    anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg';
    result_data JSONB;
BEGIN
    -- Get purchase request details
    SELECT * INTO purchase_request
    FROM purchase_requests 
    WHERE id = purchase_request_id_param;

    IF purchase_request IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Purchase request not found');
    END IF;

    -- Get middle_manager slack ids
    SELECT array_agg(e.slack_id)
      INTO target_slack_ids
      FROM employees e
      WHERE e.purchase_role @> ARRAY['middle_manager']
        AND e.slack_id IS NOT NULL
        AND e.slack_id <> '';

    IF target_slack_ids IS NULL OR array_length(target_slack_ids,1) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No middle managers found');
    END IF;

    -- Get ACCURATE item count (no timing issues!)
    SELECT COUNT(*) INTO item_count
    FROM purchase_request_items pri
    WHERE pri.purchase_request_id = purchase_request_id_param;

    -- Get first item
    SELECT item_name, specification, unit_price_value, quantity, amount_value, remark
      INTO item_record
      FROM purchase_request_items pri
      WHERE pri.purchase_request_id = purchase_request_id_param
      ORDER BY pri.line_number
      LIMIT 1;

    -- Format total amount
    total_amount_formatted := '₩' || COALESCE(TO_CHAR(purchase_request.total_amount, 'FM999,999,999'), '0');

    -- Build Block Kit (base blocks) - CHANGED: 🔢 → #
    block_kit_blocks := jsonb_build_array(
        jsonb_build_object('type', 'header', 'text', jsonb_build_object('type', 'plain_text', 'text', '📋 발주서 승인 요청 - ' || COALESCE(purchase_request.requester_name, '정현웅'))),
        jsonb_build_object('type','section', 'text', jsonb_build_object('type','mrkdwn', 'text','# *발주번호:* ' || COALESCE(purchase_request.purchase_order_number, 'PO-' || purchase_request.id::TEXT))),
        jsonb_build_object('type','divider'),
        jsonb_build_object('type','section', 'fields', jsonb_build_array(
            jsonb_build_object('type','mrkdwn','text','*요청유형:*' || E'\n' || COALESCE(purchase_request.request_type,'원자재')),
            jsonb_build_object('type','mrkdwn','text','*결제유형:*' || E'\n' || COALESCE(purchase_request.payment_category,'구매요청')),
            jsonb_build_object('type','mrkdwn','text','*업체명:*' || E'\n' || COALESCE(purchase_request.vendor_name,'삼보유공압')),
            jsonb_build_object('type','mrkdwn','text','*담당자:*' || E'\n' || COALESCE(purchase_request.requester_name,'정현웅'))
        )),
        jsonb_build_object('type','section', 'text', jsonb_build_object('type','mrkdwn','text','📦 *주문품목 (' || item_count || '개)*')),
        CASE WHEN item_record IS NOT NULL THEN
            jsonb_build_object('type','section', 'text', jsonb_build_object('type','mrkdwn', 'text',
                '*1번* - ' || COALESCE(item_record.item_name,'품목명 없음') || E'\n' ||
                '규격: ' || COALESCE(item_record.specification,'규격 없음') ||
                ' | 수량: ' || COALESCE(item_record.quantity::TEXT,'0') ||
                '개 | 단가: ₩' || COALESCE(TO_CHAR(item_record.unit_price_value::NUMERIC,'FM999,999,999'),'0') ||
                ' | 합계: ₩' || COALESCE(TO_CHAR(item_record.amount_value::NUMERIC,'FM999,999,999'),'0') ||
                CASE WHEN item_record.remark IS NOT NULL AND item_record.remark <> '' THEN ' | 비고: ' || item_record.remark ELSE '' END
            ))
        ELSE
            jsonb_build_object('type','section', 'text', jsonb_build_object('type','mrkdwn','text','_품목 정보가 아직 등록되지 않았습니다._'))
        END
    );

    -- Add hint for additional items ONLY if count > 1
    IF item_count > 1 THEN
        additional_items_hint := jsonb_build_object(
            'type','context',
            'elements', jsonb_build_array(
                jsonb_build_object('type','mrkdwn','text','_나머지 ' || (item_count-1) || '개 품목은 웹앱에서 확인하세요._')
            )
        );
        block_kit_blocks := block_kit_blocks || jsonb_build_array(additional_items_hint);
    END IF;

    -- Add final sections
    block_kit_blocks := block_kit_blocks || jsonb_build_array(
        jsonb_build_object('type','divider'),
        jsonb_build_object('type','section', 'fields', jsonb_build_array(
            jsonb_build_object('type','mrkdwn','text','*총 금액:*' || E'\n' || total_amount_formatted),
            jsonb_build_object('type','mrkdwn','text','*결제조건:*' || E'\n' || COALESCE(purchase_request.payment_category, '월말 정산'))
        )),
        jsonb_build_object('type','actions', 'elements', jsonb_build_array(
            jsonb_build_object('type','button','style','primary', 'text', jsonb_build_object('type','plain_text','text','✅ 승인'), 'action_id','approve_middle_manager', 'value', purchase_request.id::TEXT),
            jsonb_build_object('type','button','style','danger', 'text', jsonb_build_object('type','plain_text','text','❌ 반려'), 'action_id','reject_middle_manager', 'value', purchase_request.id::TEXT)
        ))
    );

    -- Send DM with ACCURATE item count
    FOREACH current_slack_id IN ARRAY target_slack_ids LOOP
        PERFORM public.http_post_wrapper(
            url_param := supabase_url || '/functions/v1/slack-dm-sender',
            headers_param := jsonb_build_object('Content-Type','application/json', 'Authorization','Bearer ' || anon_key),
            body_param := jsonb_build_object('user_id', current_slack_id, 'blocks', block_kit_blocks)::text
        );
    END LOOP;

    -- Return success result
    result_data := jsonb_build_object(
        'success', true,
        'purchase_request_id', purchase_request_id_param,
        'item_count', item_count,
        'middle_managers_notified', array_length(target_slack_ids,1),
        'slack_ids', target_slack_ids
    );

    RETURN result_data;
END;
$$;