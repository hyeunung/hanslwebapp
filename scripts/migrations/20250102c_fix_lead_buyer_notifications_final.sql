-- 최종 Lead Buyer 알림 시스템 정리 및 통합
-- 기존 중복 트리거들을 정리하고 하나의 통합된 시스템으로 재구축

-- 1단계: 기존 모든 알림 관련 트리거 제거
DROP TRIGGER IF EXISTS trigger_notify_lead_buyer_insert ON purchase_requests;
DROP TRIGGER IF EXISTS trigger_notify_lead_buyer_update ON purchase_requests;
DROP TRIGGER IF EXISTS trigger_notify_lead_buyer_on_purchase_insert ON purchase_requests;

-- 2단계: 기존 알림 관련 함수들 제거
DROP FUNCTION IF EXISTS notify_lead_buyer_on_purchase_request() CASCADE;
DROP FUNCTION IF EXISTS notify_lead_buyer_on_purchase_insert() CASCADE;

-- 3단계: 통합된 Lead Buyer 알림 함수 생성
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
        -- 새 구매 요청 등록 시
        should_notify := TRUE;
        notification_reason := '새 구매 요청 등록';
    ELSIF TG_OP = 'UPDATE' THEN
        -- 선진행 요청 등록 또는 최종승인 완료 시
        IF NEW.progress_type = '선진행' AND (OLD.progress_type IS DISTINCT FROM NEW.progress_type) THEN
            should_notify := TRUE;
            notification_reason := '선진행 요청 등록';
        ELSIF NEW.final_manager_status = 'approved' AND (OLD.final_manager_status IS DISTINCT FROM NEW.final_manager_status) THEN
            should_notify := TRUE;
            notification_reason := '최종승인 완료';
        END IF;
    END IF;
    
    -- 알림이 필요하지 않으면 종료
    IF NOT should_notify THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Lead Buyer 역할을 가진 직원들의 Slack ID 조회
    SELECT array_agg(e.slack_id) 
    INTO lead_buyer_slack_ids
    FROM employees e
    WHERE e.purchase_role @> ARRAY['lead buyer']
      AND e.slack_id IS NOT NULL
      AND e.slack_id != '';
    
    -- Lead Buyer가 없으면 경고 후 종료
    IF lead_buyer_slack_ids IS NULL OR array_length(lead_buyer_slack_ids, 1) = 0 THEN
        RAISE WARNING 'No Lead Buyer found with valid Slack ID for notification: %', notification_reason;
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- 각 Lead Buyer에게 알림 전송
    FOREACH slack_id IN ARRAY lead_buyer_slack_ids
    LOOP
        BEGIN
            -- Block Kit 형태로 구조화된 알림 전송
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
                            'type', 'header',
                            'text', jsonb_build_object(
                                'type', 'plain_text',
                                'text', '🔔 구매 요청 알림'
                            )
                        ),
                        jsonb_build_object('type', 'divider'),
                        jsonb_build_object(
                            'type', 'section',
                            'fields', jsonb_build_array(
                                jsonb_build_object(
                                    'type', 'mrkdwn',
                                    'text', '*📋 발주번호:*' || chr(10) || '`' || NEW.purchase_order_number || '`'
                                ),
                                jsonb_build_object(
                                    'type', 'mrkdwn', 
                                    'text', '*👤 요청자:*' || chr(10) || NEW.requester_name
                                ),
                                jsonb_build_object(
                                    'type', 'mrkdwn',
                                    'text', '*🏢 업체명:*' || chr(10) || COALESCE(NEW.vendor_name, '미정')
                                ),
                                jsonb_build_object(
                                    'type', 'mrkdwn',
                                    'text', '*💰 총액:*' || chr(10) || COALESCE(NEW.total_amount::TEXT, '0') || ' ' || NEW.currency
                                )
                            )
                        ),
                        jsonb_build_object(
                            'type', 'section',
                            'text', jsonb_build_object(
                                'type', 'mrkdwn',
                                'text', '*📌 알림 사유:* ' || notification_reason || chr(10) || 
                                        '*📅 요청일:* ' || NEW.request_date::TEXT || chr(10) ||
                                        '*🔄 진행방식:* ' || NEW.progress_type
                            )
                        ),
                        jsonb_build_object(
                            'type', 'actions',
                            'elements', jsonb_build_array(
                                jsonb_build_object(
                                    'type', 'button',
                                    'text', jsonb_build_object(
                                        'type', 'plain_text',
                                        'text', '📋 상세보기'
                                    ),
                                    'style', 'primary',
                                    'url', 'https://hanslwebapp.vercel.app/purchase/approve',
                                    'action_id', 'view_details'
                                )
                            )
                        ),
                        jsonb_build_object(
                            'type', 'context',
                            'elements', jsonb_build_array(
                                jsonb_build_object(
                                    'type', 'mrkdwn',
                                    'text', '⏰ ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' | 🤖 한슬 구매관리 시스템'
                                )
                            )
                        )
                    )
                )
            );
            
            RAISE NOTICE 'Lead Buyer notification sent to % for %: %', slack_id, notification_reason, NEW.purchase_order_number;
            
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

-- 4단계: 통합된 트리거 생성
CREATE TRIGGER trigger_lead_buyer_notification_unified
    AFTER INSERT OR UPDATE ON purchase_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_lead_buyer_unified();

-- 5단계: 코멘트 추가
COMMENT ON FUNCTION notify_lead_buyer_unified() IS 
'통합된 Lead Buyer 알림 시스템: 구매 요청 등록, 선진행 등록, 최종승인 시 알림 전송';

COMMENT ON TRIGGER trigger_lead_buyer_notification_unified ON purchase_requests IS 
'통합된 Lead Buyer 알림 트리거: 중복 제거 및 Block Kit 형태 알림 지원';

-- 6단계: 확인용 로그
DO $$
BEGIN
    RAISE NOTICE '✅ Lead Buyer 알림 시스템 통합 완료';
    RAISE NOTICE '📋 활성화된 기능: 구매요청등록, 선진행등록, 최종승인완료';
    RAISE NOTICE '👥 대상: Lead Buyer 역할을 가진 모든 직원';
    RAISE NOTICE '📱 형태: Block Kit 구조화된 Slack DM 알림';
END $$;