-- 중간관리자 알림에서 Excel 다운로드 버튼 제거하고 파일 첨부만 유지
-- send_beautiful_middle_manager_notification 함수 수정

CREATE OR REPLACE FUNCTION send_beautiful_middle_manager_notification(purchase_id BIGINT)
RETURNS VOID AS $$
DECLARE
    middle_manager_slack_ids TEXT[];
    current_slack_id TEXT;
    po_number TEXT;
    requester_name TEXT;
    vendor_name TEXT;
    request_type TEXT;
    total_amount NUMERIC;
    currency TEXT;
    request_date DATE;
    payment_category TEXT;
    progress_type TEXT;
    response_status integer;
    response_content text;
    block_kit_blocks JSONB;
    first_item_record RECORD;
    item_count INTEGER;
    total_amount_formatted TEXT;
BEGIN
    -- 구매 요청 정보 조회
    SELECT pr.purchase_order_number, pr.requester_name, pr.vendor_name, pr.request_type, 
           pr.total_amount, pr.currency, pr.request_date, pr.payment_category, pr.progress_type
    INTO po_number, requester_name, vendor_name, request_type, total_amount, currency, request_date, payment_category, progress_type
    FROM purchase_requests pr
    WHERE pr.id = purchase_id;
    
    IF NOT FOUND THEN
        RAISE WARNING '구매 요청을 찾을 수 없음 (ID: %)', purchase_id;
        RETURN;
    END IF;

    -- 첫 번째 품목 정보 조회
    SELECT item_name, specification, unit_price_value, quantity, amount_value, remark
    INTO first_item_record
    FROM purchase_request_items
    WHERE purchase_request_id = purchase_id
    ORDER BY line_number
    LIMIT 1;

    -- 전체 품목 수 조회
    SELECT COUNT(*) INTO item_count
    FROM purchase_request_items
    WHERE purchase_request_id = purchase_id;

    -- 금액 포맷팅
    total_amount_formatted := '₩' || COALESCE(TO_CHAR(total_amount, 'FM999,999,999'), '0');

    -- 중간관리자들의 slack_id 조회
    SELECT array_agg(e.slack_id) INTO middle_manager_slack_ids
    FROM employees e
    WHERE e.purchase_role @> ARRAY['middle_manager']
    AND e.slack_id IS NOT NULL;
    
    -- 중간관리자가 없으면 종료
    IF middle_manager_slack_ids IS NULL OR array_length(middle_manager_slack_ids, 1) = 0 THEN
        RAISE WARNING '중간관리자를 찾을 수 없음';
        RETURN;
    END IF;

    -- Block Kit 블록 구성 (Excel 다운로드 버튼 제거, 승인/반려 버튼만 유지)
    block_kit_blocks := jsonb_build_array(
        -- 헤더
        jsonb_build_object(
            'type', 'header',
            'text', jsonb_build_object(
                'type', 'plain_text',
                'text', '📋 발주서 승인 요청 - ' || COALESCE(requester_name, '미정')
            )
        ),
        -- 구분선
        jsonb_build_object('type', 'divider'),
        -- 메인 정보 (2열 레이아웃)
        jsonb_build_object(
            'type', 'section',
            'fields', jsonb_build_array(
                jsonb_build_object('type', 'mrkdwn', 'text', '*요청유형:*' || E'\n' || COALESCE(request_type, '미정')),
                jsonb_build_object('type', 'mrkdwn', 'text', '*결제유형:*' || E'\n' || COALESCE(payment_category, '미정')),
                jsonb_build_object('type', 'mrkdwn', 'text', '*업체명:*' || E'\n' || COALESCE(vendor_name, '미정')),
                jsonb_build_object('type', 'mrkdwn', 'text', '*담당자:*' || E'\n' || COALESCE(requester_name, '미정'))
            )
        ),
        -- 품목 섹션 헤더
        jsonb_build_object(
            'type', 'section',
            'text', jsonb_build_object(
                'type', 'mrkdwn',
                'text', '📦 *주문품목 (' || item_count || '개)*'
            )
        ),
        -- 첫 번째 품목만 표시
        CASE 
            WHEN first_item_record IS NOT NULL THEN
                jsonb_build_object(
                    'type', 'section',
                    'text', jsonb_build_object(
                        'type', 'mrkdwn',
                        'text', 
                        '• *1번* - ' || COALESCE(first_item_record.item_name, '품목명 미정') || E'\n' ||
                        '규격: ' || COALESCE(first_item_record.specification, '규격 미정') || 
                        ' ₩' || COALESCE(TO_CHAR(first_item_record.unit_price_value, 'FM999,999,999'), '0') ||
                        ' | 합계: ₩' || COALESCE(TO_CHAR(first_item_record.amount_value, 'FM999,999,999'), '0') ||
                        CASE WHEN first_item_record.remark IS NOT NULL AND first_item_record.remark != '' 
                             THEN ' | 비고: ' || first_item_record.remark 
                             ELSE '' 
                        END
                    )
                )
            ELSE
                jsonb_build_object(
                    'type', 'section',
                    'text', jsonb_build_object(
                        'type', 'mrkdwn',
                        'text', '• 품목 정보가 없습니다.'
                    )
                )
        END,
        -- 토글 안내 (품목이 2개 이상일 때)
        CASE 
            WHEN item_count > 1 THEN
                jsonb_build_object(
                    'type', 'context',
                    'elements', jsonb_build_array(
                        jsonb_build_object(
                            'type', 'mrkdwn',
                            'text', '_나머지 ' || (item_count - 1) || '개 품목은 첨부된 Excel 파일에서 확인하세요._'
                        )
                    )
                )
            ELSE
                NULL
        END,
        -- 구분선
        jsonb_build_object('type', 'divider'),
        -- 총액 및 결제조건
        jsonb_build_object(
            'type', 'section',
            'fields', jsonb_build_array(
                jsonb_build_object('type', 'mrkdwn', 'text', '*총 금액:*' || E'\n' || total_amount_formatted),
                jsonb_build_object('type', 'mrkdwn', 'text', '*결제조건:*' || E'\n' || '월말 정산')
            )
        ),
        -- 승인/반료 버튼만 유지 (Excel 다운로드 버튼 제거)
        jsonb_build_object(
            'type', 'actions',
            'elements', jsonb_build_array(
                jsonb_build_object(
                    'type', 'button',
                    'style', 'primary',
                    'text', jsonb_build_object('type', 'plain_text', 'text', '✅ 승인'),
                    'action_id', 'approve_purchase_request',
                    'value', po_number::text,
                    'url', 'https://hanslwebapp.vercel.app/purchase/approve'
                ),
                jsonb_build_object(
                    'type', 'button',
                    'style', 'danger',
                    'text', jsonb_build_object('type', 'plain_text', 'text', '❌ 반료'),
                    'action_id', 'reject_purchase_request',
                    'value', po_number::text,
                    'url', 'https://hanslwebapp.vercel.app/purchase/approve'
                )
            )
        ),
        -- 첨부파일 안내 추가
        jsonb_build_object(
            'type', 'context',
            'elements', jsonb_build_array(
                jsonb_build_object(
                    'type', 'mrkdwn',
                    'text', '📎 발주서 Excel 파일이 자동으로 첨부되었습니다 | 🤖 한슬 구매관리 시스템'
                )
            )
        )
    );

    -- NULL 요소 제거
    block_kit_blocks := (
        SELECT jsonb_agg(element)
        FROM jsonb_array_elements(block_kit_blocks) AS element
        WHERE element IS NOT NULL
    );

    -- 각 중간관리자에게 실제 파일 첨부와 함께 알림 전송
    FOREACH current_slack_id IN ARRAY middle_manager_slack_ids
    LOOP
        SELECT status, content INTO response_status, response_content
        FROM http((
            'POST',
            'https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/slack-dm-sender',
            ARRAY[
                http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg'),
                http_header('Content-Type', 'application/json')
            ],
            'application/json',
            jsonb_build_object(
                'user_id', current_slack_id,
                'blocks', block_kit_blocks,
                'purchase_order_number', po_number,
                'with_attachment', true  -- 실제 파일 첨부
            )::text
        ));
        
        RAISE NOTICE '파일 첨부 알림 전송: 대상 %, 발주번호 %, 응답코드: %', current_slack_id, po_number, response_status;
    END LOOP;
    
    RAISE NOTICE '파일 첨부 알림 전송 완료: %', po_number;
END;
$$ LANGUAGE plpgsql;

-- 코멘트 업데이트
COMMENT ON FUNCTION send_beautiful_middle_manager_notification(BIGINT) IS 
'중간관리자 알림: Excel 다운로드 버튼 제거, 실제 파일 첨부만 유지. 승인/반려 버튼 + 파일 첨부';

-- 확인용 로그
DO $$
BEGIN
    RAISE NOTICE '✅ 중간관리자 알림 시스템 수정 완료';
    RAISE NOTICE '❌ Excel 다운로드 버튼 제거됨';
    RAISE NOTICE '📎 실제 파일 첨부만 유지 (with_attachment: true)';
    RAISE NOTICE '🔘 승인/반료 버튼은 유지';
END $$;