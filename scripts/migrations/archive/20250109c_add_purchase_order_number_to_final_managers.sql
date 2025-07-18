-- 20250109c_add_purchase_order_number_to_final_managers.sql
-- Purpose: Material Manager 알림 메시지에 발주번호 섹션 추가 (중간관리자와 100% 동일하게)
-- 문제: 헤더 다음 발주번호 섹션이 누락되어 있었음

-- Final Manager 알림 함수 수정 (발주번호 섹션 추가)
CREATE OR REPLACE FUNCTION public.notify_final_managers_on_approval()
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
    -- 트리거 조건: middle_manager_status가 'approved'로 변경될 때만 실행
    IF TG_OP = 'UPDATE' AND OLD.middle_manager_status IS DISTINCT FROM NEW.middle_manager_status AND NEW.middle_manager_status = 'approved' THEN

        -- 분기 로직: request_type에 따라 대상 선택
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
            -- 해당하지 않는 요청 유형이면 종료
            RETURN NEW;
        END IF;

        IF target_slack_ids IS NULL OR array_length(target_slack_ids,1) = 0 THEN
            RAISE NOTICE 'No final manager found for request_type % (Purchase Request ID: %)', NEW.request_type, NEW.id;
            RETURN NEW;
        END IF;

        -- 첫 번째 품목 정보 조회
        SELECT item_name, specification, unit_price_value, quantity, amount_value, remark
          INTO item_record
          FROM purchase_request_items pri
          WHERE pri.purchase_request_id = NEW.id
          ORDER BY line_number
          LIMIT 1;

        -- 전체 품목 수 조회
        SELECT COUNT(*) INTO item_count
          FROM purchase_request_items pri
          WHERE pri.purchase_request_id = NEW.id;

        -- 총 금액 포맷팅 (₩ 기호 포함)
        total_amount_formatted := '₩' || COALESCE(TO_CHAR(NEW.total_amount, 'FM999,999,999'), '0');

        -- 품목이 2개 이상일 경우 힌트 메시지 추가
        IF item_count > 1 THEN
            additional_items_hint := jsonb_build_object(
                'type','context',
                'elements', jsonb_build_array(
                    jsonb_build_object(
                        'type','mrkdwn',
                        'text', '_나머지 ' || (item_count-1) || '개 품목은 시스템에서 확인하세요._'
                    )
                )
            );
        END IF;

        -- Block Kit 메시지 구성 (중간관리자와 100% 동일한 구조 + 발주번호 섹션 추가)
        block_kit_blocks := jsonb_build_array(
            -- 헤더
            jsonb_build_object(
                'type','header',
                'text', jsonb_build_object(
                    'type','plain_text',
                    'text','📋 발주서 승인 요청 - ' || COALESCE(NEW.requester_name,'미정')
                )
            ),
            -- ✅ 발주번호 섹션 추가 (헤더 바로 아래, 구분선 위에)
            jsonb_build_object(
                'type','section',
                'text', jsonb_build_object(
                    'type','mrkdwn',
                    'text','🔢 *발주번호:* ' || COALESCE(NEW.purchase_order_number, 'PO-' || NEW.id::TEXT)
                )
            ),
            -- 구분선
            jsonb_build_object('type','divider'),
            -- 2열 정보 섹션
            jsonb_build_object(
                'type','section',
                'fields', jsonb_build_array(
                    jsonb_build_object('type','mrkdwn','text','*요청유형:*' || E'\n' || COALESCE(NEW.request_type,'미정')),
                    jsonb_build_object('type','mrkdwn','text','*결제유형:*' || E'\n' || COALESCE(NEW.payment_category,'미정')),
                    jsonb_build_object('type','mrkdwn','text','*업체명:*' || E'\n' || COALESCE(NEW.vendor_name,'미정')),
                    jsonb_build_object('type','mrkdwn','text','*담당자:*' || E'\n' || COALESCE(NEW.requester_name,'미정'))
                )
            ),
            -- 품목 헤더
            jsonb_build_object(
                'type','section',
                'text', jsonb_build_object('type','mrkdwn','text','📦 *주문품목 (' || item_count || '개)*')
            ),
            -- 첫 번째 품목 정보 (있는 경우)
            CASE 
                WHEN item_record IS NOT NULL THEN
                    jsonb_build_object(
                        'type','section',
                        'text', jsonb_build_object(
                            'type','mrkdwn',
                            'text','• *# 1* - ' || COALESCE(item_record.item_name,'품목명 미정') || E'\n' ||
                                  '규격: ' || COALESCE(item_record.specification,'규격 미정') || ' | ' ||
                                  '수량: ' || item_record.quantity || '개 | ' ||
                                  '단가: ₩' || COALESCE(TO_CHAR(item_record.unit_price_value,'FM999,999,999'),'0') || ' | ' ||
                                  '합계: ₩' || COALESCE(TO_CHAR(item_record.amount_value,'FM999,999,999'),'0')
                        )
                    )
                ELSE NULL
            END,
            -- 추가 품목 힌트 (2개 이상일 경우)
            additional_items_hint,
            -- 구분선
            jsonb_build_object('type','divider'),
            -- 총액 및 결제조건
            jsonb_build_object(
                'type','section',
                'fields', jsonb_build_array(
                    jsonb_build_object('type','mrkdwn','text','*총 금액:*' || E'\n' || total_amount_formatted),
                    jsonb_build_object('type','mrkdwn','text','*결제조건:*' || E'\n' || '월말 정산')
                )
            ),
            -- 승인/반료 버튼 (final_manager용 action_id)
            jsonb_build_object(
                'type','actions',
                'elements', jsonb_build_array(
                    jsonb_build_object(
                        'type','button','style','primary',
                        'text', jsonb_build_object('type','plain_text','text','✅ 승인'),
                        'action_id','approve_final_manager',
                        'value', NEW.id::TEXT
                    ),
                    jsonb_build_object(
                        'type','button','style','danger',
                        'text', jsonb_build_object('type','plain_text','text','❌ 반료'),
                        'action_id','reject_final_manager',
                        'value', NEW.id::TEXT
                    )
                )
            )
        );

        -- NULL 요소 제거
        block_kit_blocks := (
            SELECT jsonb_agg(elem) FROM jsonb_array_elements(block_kit_blocks) AS elem WHERE elem IS NOT NULL
        );

        -- 각 Final Manager에게 DM 전송
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
            RAISE NOTICE 'Final manager notification sent to % (Purchase Request ID: %, Item Count: %, Request Type: %, Purchase Order: %)', current_slack_id, NEW.id, COALESCE(item_count,0), NEW.request_type, COALESCE(NEW.purchase_order_number, 'PO-' || NEW.id::TEXT);
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_final_managers_on_approval() IS 'Send Slack DM to raw_material_manager or consumable_manager when middle_manager_status becomes approved. Now includes purchase_order_number section.';

-- 확인용 로그
DO $$
BEGIN
    RAISE NOTICE '✅ Material Manager 알림 메시지에 발주번호 섹션 추가 완료';
    RAISE NOTICE '📋 헤더 → 발주번호 → 구분선 → 2열 정보 순서로 구성';
    RAISE NOTICE '🔢 발주번호 표시: 🔢 *발주번호:* [PURCHASE_ORDER_NUMBER]';
    RAISE NOTICE '🎯 중간관리자 알림과 100%% 동일한 구조로 완성';
END $$; 