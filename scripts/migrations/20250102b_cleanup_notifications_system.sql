-- notifications 테이블 제거 및 직접 Slack 알림 시스템 구축
-- 사용자 요청: notifications 테이블(큐/저장소)는 제거하되 구매 승인 알림 시스템은 유지
-- 해결책: 알림을 테이블에 저장하지 않고 바로 Slack으로 직접 전송

-- 1. notifications 테이블 삭제 (큐/저장소 역할 불필요)
DROP TABLE IF EXISTS notifications CASCADE;

-- 2. 구매 승인 알림 함수 (직접 Slack 전송 방식)
CREATE OR REPLACE FUNCTION send_purchase_notifications()
RETURNS TRIGGER AS $
DECLARE
    target_slack_ids TEXT[];
    current_slack_id TEXT;
    message_text TEXT;
    vendor_name_text TEXT;
    requester_name_text TEXT;
    total_amount_text TEXT;
BEGIN
    -- 중간관리자 또는 최종관리자 상태가 대기로 변경되었을 때만 알림 전송
    IF NEW.middle_manager_status = 'pending' OR NEW.final_manager_status = 'pending' THEN
        
        -- 업체명 조회
        SELECT v.vendor_name INTO vendor_name_text
        FROM vendors v 
        WHERE v.id = NEW.vendor_id;
        
        -- 구매요청자명 설정
        requester_name_text := COALESCE(NEW.requester_name, '미지정');
        
        -- 총 금액 계산
        SELECT COALESCE(SUM(pri.amount_value), 0)::TEXT INTO total_amount_text
        FROM purchase_request_items pri 
        WHERE pri.purchase_request_id = NEW.id;
        
        -- 알림 메시지 생성
        message_text := format(
            '🔔 새로운 구매 승인 요청이 있습니다\n\n' ||
            '📋 발주번호: %s\n' ||
            '🏢 업체명: %s\n' ||
            '👤 구매요청자: %s\n' ||
            '💰 총 금액: %s원\n' ||
            '📅 요청일: %s\n' ||
            '🔗 승인 처리: https://hanslwebapp.vercel.app/dashboard?tab=approval',
            NEW.purchase_order_number,
            COALESCE(vendor_name_text, '미지정'),
            requester_name_text,
            total_amount_text,
            TO_CHAR(NEW.request_date, 'YYYY-MM-DD')
        );
        
        -- 중간관리자들의 slack_id 조회
        SELECT array_agg(e.slack_id) INTO target_slack_ids
        FROM employees e
        WHERE e.purchase_role @> ARRAY['middle_manager']
        AND e.slack_id IS NOT NULL;
        
        -- 각 중간관리자에게 Slack DM 전송
        FOREACH current_slack_id IN ARRAY target_slack_ids
        LOOP
            PERFORM net.http_post(
                url := 'https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/slack-dm-sender',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg'
                ),
                body := jsonb_build_object(
                    'user_id', current_slack_id,
                    'message', message_text
                )
            );
        END LOOP;
        
        RAISE NOTICE '구매 승인 알림 전송 완료 (발주번호: %)', NEW.purchase_order_number;
    END IF;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- 3. 결제 완료 알림 함수 (Lead Buyer에게 요청유형별 알림)
CREATE OR REPLACE FUNCTION send_payment_completion_notifications()
RETURNS TRIGGER AS $
DECLARE
    lead_buyer_slack_ids TEXT[];
    current_slack_id TEXT;
    message_text TEXT;
    vendor_name_text TEXT;
    requester_name_text TEXT;
    total_amount_text TEXT;
BEGIN
    -- 결제 완료 상태가 변경되었을 때만 알림 전송
    IF OLD.is_payment_completed = FALSE AND NEW.is_payment_completed = TRUE THEN
        
        -- 업체명 조회
        SELECT v.vendor_name INTO vendor_name_text
        FROM vendors v 
        WHERE v.id = NEW.vendor_id;
        
        -- 구매요청자명 설정
        requester_name_text := COALESCE(NEW.requester_name, '미지정');
        
        -- 총 금액 계산
        SELECT COALESCE(SUM(pri.amount_value), 0)::TEXT INTO total_amount_text
        FROM purchase_request_items pri 
        WHERE pri.purchase_request_id = NEW.id;
        
        -- 요청유형에 따른 Lead Buyer 결정
        IF NEW.request_type = '원자재' THEN
            -- 원자재: 양승진에게
            SELECT array_agg(e.slack_id) INTO lead_buyer_slack_ids
            FROM employees e
            WHERE e.name = '양승진' AND e.slack_id IS NOT NULL;
        ELSIF NEW.request_type = '소모품' THEN
            -- 소모품: 황연순에게
            SELECT array_agg(e.slack_id) INTO lead_buyer_slack_ids
            FROM employees e
            WHERE e.name = '황연순' AND e.slack_id IS NOT NULL;
        ELSE
            -- 기타: 모든 Lead Buyer에게
            SELECT array_agg(e.slack_id) INTO lead_buyer_slack_ids
            FROM employees e
            WHERE e.purchase_role @> ARRAY['lead_buyer'] AND e.slack_id IS NOT NULL;
        END IF;
        
        -- 알림 메시지 생성
        message_text := format(
            '💰 결제가 완료되었습니다\n\n' ||
            '📋 발주번호: %s\n' ||
            '🏢 업체명: %s\n' ||
            '👤 구매요청자: %s\n' ||
            '💵 결제 금액: %s원\n' ||
            '📅 결제일: %s\n' ||
            '📦 구매 처리를 진행해주세요',
            NEW.purchase_order_number,
            COALESCE(vendor_name_text, '미지정'),
            requester_name_text,
            total_amount_text,
            TO_CHAR(NEW.payment_completed_at, 'YYYY-MM-DD HH24:MI')
        );
        
        -- Lead Buyer에게 Slack DM 전송
        FOREACH current_slack_id IN ARRAY lead_buyer_slack_ids
        LOOP
            PERFORM net.http_post(
                url := 'https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/slack-dm-sender',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg'
                ),
                body := jsonb_build_object(
                    'user_id', current_slack_id,
                    'message', message_text
                )
            );
        END LOOP;
        
        RAISE NOTICE '결제 완료 알림 전송 완료 (발주번호: %)', NEW.purchase_order_number;
    END IF;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- 4. Block Kit 메시지 생성 함수 (상호작용 가능한 UI)
CREATE OR REPLACE FUNCTION create_purchase_approval_block_kit(p_purchase_request_id BIGINT)
RETURNS JSONB AS $
DECLARE
    purchase_data RECORD;
    vendor_data RECORD;
    items_data TEXT;
    total_amount NUMERIC;
    block_kit_result JSONB;
BEGIN
    -- 구매 요청 정보 조회
    SELECT pr.*, v.vendor_name
    INTO purchase_data
    FROM purchase_requests pr
    LEFT JOIN vendors v ON pr.vendor_id = v.id
    WHERE pr.id = p_purchase_request_id;
    
    -- 데이터가 없으면 NULL 반환
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- 품목 정보 및 총액 계산
    SELECT 
        string_agg(
            format('• %s (수량: %s, 단가: %s원)', 
                item_name, 
                quantity::TEXT, 
                amount_value::TEXT
            ), 
            E'\n'
        ),
        COALESCE(SUM(amount_value), 0)
    INTO items_data, total_amount
    FROM purchase_request_items 
    WHERE purchase_request_id = p_purchase_request_id;
    
    -- 품목이 없으면 NULL 반환
    IF items_data IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Block Kit JSON 생성
    block_kit_result := jsonb_build_object(
        'blocks', jsonb_build_array(
            -- 헤더 섹션
            jsonb_build_object(
                'type', 'header',
                'text', jsonb_build_object(
                    'type', 'plain_text',
                    'text', '🔔 새로운 구매 승인 요청'
                )
            ),
            -- 구분선
            jsonb_build_object('type', 'divider'),
            -- 기본 정보 섹션
            jsonb_build_object(
                'type', 'section',
                'fields', jsonb_build_array(
                    jsonb_build_object(
                        'type', 'mrkdwn',
                        'text', format('*발주번호:*\n%s', purchase_data.purchase_order_number)
                    ),
                    jsonb_build_object(
                        'type', 'mrkdwn',
                        'text', format('*업체명:*\n%s', COALESCE(purchase_data.vendor_name, '미지정'))
                    ),
                    jsonb_build_object(
                        'type', 'mrkdwn',
                        'text', format('*구매요청자:*\n%s', COALESCE(purchase_data.requester_name, '미지정'))
                    ),
                    jsonb_build_object(
                        'type', 'mrkdwn',
                        'text', format('*요청일:*\n%s', TO_CHAR(purchase_data.request_date, 'YYYY-MM-DD'))
                    )
                )
            ),
            -- 품목 정보 섹션
            jsonb_build_object(
                'type', 'section',
                'text', jsonb_build_object(
                    'type', 'mrkdwn',
                    'text', format('*구매 품목:*\n%s', items_data)
                )
            ),
            -- 총액 섹션
            jsonb_build_object(
                'type', 'section',
                'text', jsonb_build_object(
                    'type', 'mrkdwn',
                    'text', format('*총 금액: %s원*', total_amount::TEXT)
                )
            ),
            -- 구분선
            jsonb_build_object('type', 'divider'),
            -- 승인 버튼 섹션
            jsonb_build_object(
                'type', 'actions',
                'elements', jsonb_build_array(
                    jsonb_build_object(
                        'type', 'button',
                        'text', jsonb_build_object(
                            'type', 'plain_text',
                            'text', '✅ 승인'
                        ),
                        'style', 'primary',
                        'action_id', 'approve_purchase',
                        'value', p_purchase_request_id::TEXT
                    ),
                    jsonb_build_object(
                        'type', 'button',
                        'text', jsonb_build_object(
                            'type', 'plain_text',
                            'text', '❌ 반려'
                        ),
                        'style', 'danger',
                        'action_id', 'reject_purchase',
                        'value', p_purchase_request_id::TEXT
                    ),
                    jsonb_build_object(
                        'type', 'button',
                        'text', jsonb_build_object(
                            'type', 'plain_text',
                            'text', '📋 상세보기'
                        ),
                        'action_id', 'view_details',
                        'url', format('https://hanslwebapp.vercel.app/dashboard?tab=approval&id=%s', p_purchase_request_id)
                    )
                )
            )
        )
    );
    
    RETURN block_kit_result;
END;
$ LANGUAGE plpgsql;

-- 5. Block Kit 알림 전송 함수
CREATE OR REPLACE FUNCTION send_block_kit_approval_notification(p_purchase_request_id BIGINT)
RETURNS VOID AS $
DECLARE
    block_kit_data JSONB;
    target_slack_ids TEXT[];
    current_slack_id TEXT;
BEGIN
    -- Block Kit 메시지 생성
    SELECT create_purchase_approval_block_kit(p_purchase_request_id) INTO block_kit_data;
    
    -- 품목이 없으면 처리하지 않음
    IF block_kit_data IS NULL THEN
        RAISE NOTICE 'Block Kit 알림 지연: 품목 데이터가 아직 없음 (ID: %)', p_purchase_request_id;
        RETURN;
    END IF;
    
    -- middle_manager들의 slack_id 조회
    SELECT array_agg(e.slack_id) INTO target_slack_ids
    FROM employees e
    WHERE e.purchase_role @> ARRAY['middle_manager']
    AND e.slack_id IS NOT NULL;
    
    -- 각 middle_manager에게 Block Kit 알림 전송
    FOREACH current_slack_id IN ARRAY target_slack_ids
    LOOP
        -- Slack DM 전송 (Block Kit 포함)
        PERFORM net.http_post(
            url := 'https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/slack-dm-sender',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg'
            ),
            body := jsonb_build_object(
                'user_id', current_slack_id,
                'message', '새로운 구매 승인 요청이 있습니다.',
                'blocks', block_kit_data->'blocks'
            )
        );
    END LOOP;
    
    RAISE NOTICE 'Block Kit 알림 전송 완료 (ID: %)', p_purchase_request_id;
END;
$ LANGUAGE plpgsql;

-- 6. 테스트 함수 (디버깅용)
CREATE OR REPLACE FUNCTION test_simple_notification(target_user_id TEXT DEFAULT 'U08LUE221K4')
RETURNS VOID AS $
BEGIN
    -- 간단한 텍스트 메시지 전송
    PERFORM net.http_post(
        url := 'https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/slack-dm-sender',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg'
        ),
        body := jsonb_build_object(
            'user_id', target_user_id,
            'message', '🧪 알림 시스템 테스트 메시지입니다 - ' || NOW()::TEXT
        )
    );
    
    RAISE NOTICE '테스트 알림 전송 완료 (대상: %)', target_user_id;
END;
$ LANGUAGE plpgsql;

-- 7. 트리거 생성
DROP TRIGGER IF EXISTS purchase_approval_trigger ON purchase_requests;
CREATE TRIGGER purchase_approval_trigger
    AFTER INSERT OR UPDATE ON purchase_requests
    FOR EACH ROW
    EXECUTE FUNCTION send_purchase_notifications();

DROP TRIGGER IF EXISTS payment_completion_trigger ON purchase_requests;
CREATE TRIGGER payment_completion_trigger
    AFTER UPDATE ON purchase_requests
    FOR EACH ROW
    EXECUTE FUNCTION send_payment_completion_notifications();

-- 완료: notifications 테이블 없이 직접 Slack 전송하는 알림 시스템 구축
-- purchase_requests 삭제 시 CASCADE로 purchase_request_items만 자동 삭제됨