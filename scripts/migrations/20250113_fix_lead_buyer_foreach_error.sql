-- 20250113_fix_lead_buyer_foreach_error.sql
-- Purpose: Fix FOREACH error by correcting lead_buyer → lead buyer (space instead of underscore)
-- Issue: FOREACH expression must not be null error when clicking purchase complete button

-- 1. Fix send_payment_completion_notifications function
CREATE OR REPLACE FUNCTION send_payment_completion_notifications()
RETURNS TRIGGER AS $$
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
        
        -- 모든 Lead Buyer에게 통합 알림 전송 (공백 사용으로 수정)
        SELECT array_agg(e.slack_id) INTO lead_buyer_slack_ids
        FROM employees e
        WHERE e.purchase_role @> ARRAY['lead buyer'] AND e.slack_id IS NOT NULL;
        
        -- NULL 체크 추가 (안전성 강화)
        IF lead_buyer_slack_ids IS NULL OR array_length(lead_buyer_slack_ids, 1) = 0 THEN
            RAISE NOTICE 'No Lead Buyer found with valid Slack ID for payment completion notification';
            RETURN NEW;
        END IF;
        
        -- 알림 메시지 생성
        message_text := format(
            E'💰 결제가 완료되었습니다\n\n' ||
            E'📋 발주번호: %s\n' ||
            E'🏢 업체명: %s\n' ||
            E'👤 구매요청자: %s\n' ||
            E'💵 결제 금액: %s원\n' ||
            E'📅 결제일: %s\n' ||
            E'📦 구매 처리를 진행해주세요',
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
$$ LANGUAGE plpgsql;

-- 2. Fix notify_lead_buyer_unified function
CREATE OR REPLACE FUNCTION notify_lead_buyer_unified()
RETURNS TRIGGER AS $$
DECLARE
    lead_buyer_slack_ids TEXT[];
    slack_id TEXT;
    supabase_url TEXT := 'https://qvhbigvdfyvhoegkhvef.supabase.co';
    anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg';
    should_notify BOOLEAN := FALSE;
    notification_reason TEXT;
BEGIN
    -- 알림 조건 판별
    IF TG_OP = 'INSERT' THEN
        IF NEW.progress_type = '선진행' THEN
            should_notify := TRUE;
            notification_reason := '선진행 요청 등록';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.final_manager_status = 'approved'
           AND OLD.final_manager_status IS DISTINCT FROM NEW.final_manager_status
           AND (NEW.progress_type IS NULL OR NEW.progress_type <> '선진행') THEN
            should_notify := TRUE;
            notification_reason := '최종승인 완료';
        END IF;
    END IF;

    -- 알림이 필요하지 않으면 종료
    IF NOT should_notify THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Lead Buyer 역할을 가진 직원들의 Slack ID 조회 (공백 사용으로 수정)
    SELECT array_agg(e.slack_id) 
    INTO lead_buyer_slack_ids
    FROM employees e
    WHERE e.purchase_role @> ARRAY['lead buyer']
      AND e.slack_id IS NOT NULL
      AND e.slack_id != '';
    
    -- NULL 체크 추가 (안전성 강화)
    IF lead_buyer_slack_ids IS NULL OR array_length(lead_buyer_slack_ids, 1) = 0 THEN
        RAISE WARNING 'No Lead Buyer found with valid Slack ID for notification: %', notification_reason;
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- 각 Lead Buyer에게 간단한 텍스트 + Excel 다운로드 버튼 전송
    FOREACH slack_id IN ARRAY lead_buyer_slack_ids
    LOOP
        BEGIN
            -- 간단한 Block Kit 메시지 (완성형)
            PERFORM net.http_post(
                url := supabase_url || '/functions/v1/slack-dm-sender',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || anon_key
                ),
                body := jsonb_build_object(
                    'user_id', slack_id,
                    'blocks', jsonb_build_array(
                        jsonb_build_object(
                            'type', 'section',
                            'text', jsonb_build_object(
                                'type', 'mrkdwn',
                                'text', format('📋 *발주번호:* %s\n👤 *구매요청자:* %s\n🏢 *업체명:* %s\n💰 *총액:* %s %s\n📅 *%s*',
                                    NEW.purchase_order_number,
                                    NEW.requester_name,
                                    COALESCE(NEW.vendor_name, '미정'),
                                    COALESCE(NEW.total_amount::TEXT, '0'),
                                    NEW.currency,
                                    notification_reason
                                )
                            )
                        ),
                        jsonb_build_object(
                            'type', 'actions',
                            'elements', jsonb_build_array(
                                jsonb_build_object(
                                    'type', 'button',
                                    'text', jsonb_build_object(
                                        'type', 'plain_text',
                                        'text', 'Excel 다운로드'
                                    ),
                                    'style', 'primary',
                                    'url', 'https://hanslwebapp.vercel.app/api/excel/download/' || NEW.purchase_order_number,
                                    'action_id', 'excel_download'
                                )
                            )
                        )
                    )
                )
            );
            
            RAISE NOTICE 'Lead Buyer simple notification sent to % for %: %', slack_id, notification_reason, NEW.purchase_order_number;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to send notification to %: %', slack_id, SQLERRM;
        END;
    END LOOP;
    
    RETURN COALESCE(NEW, OLD);
    
EXCEPTION
    WHEN OTHERS THEN
        -- 알림 전송 실패가 구매 요청 처리를 방해하지 않도록 함
        RAISE WARNING 'Error in Lead Buyer notification system: %', SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 3. 트리거 재생성 (기존 트리거 유지)
-- payment_completion_trigger는 이미 존재하므로 수정하지 않음
-- trigger_lead_buyer_notification_unified는 이미 존재하므로 수정하지 않음

-- 4. 코멘트 추가
COMMENT ON FUNCTION send_payment_completion_notifications() IS 
'결제 완료 알림 시스템: lead_buyer → lead buyer (공백) 수정, NULL 체크 추가';

COMMENT ON FUNCTION notify_lead_buyer_unified() IS 
'Lead Buyer 통합 알림 시스템: lead_buyer → lead buyer (공백) 수정, NULL 체크 추가';

-- 5. 확인용 로그
DO $$
BEGIN
    RAISE NOTICE '✅ FOREACH 에러 수정 완료';
    RAISE NOTICE '🔧 변경사항: lead_buyer → lead buyer (언더스코어 → 공백)';
    RAISE NOTICE '🛡️ 안전성 강화: NULL 체크 추가';
    RAISE NOTICE '📋 영향 함수: send_payment_completion_notifications, notify_lead_buyer_unified';
END $$; 