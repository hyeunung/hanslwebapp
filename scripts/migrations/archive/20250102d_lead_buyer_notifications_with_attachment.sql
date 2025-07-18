-- Lead Buyer 알림에 발주서 파일 첨부 기능 추가
-- Storage에서 발주번호와 동일한 이름의 파일을 찾아서 DM에 첨부

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
    
    -- 각 Lead Buyer에게 파일 첨부 DM 전송
    FOREACH slack_id IN ARRAY lead_buyer_slack_ids
    LOOP
        BEGIN
            -- Storage에서 파일 찾아서 첨부 + Block Kit 메시지 함께 전송
            PERFORM net.http_post(
                url := supabase_url || '/functions/v1/slack-dm-sender',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || anon_key
                ),
                body := jsonb_build_object(
                    'user_id', slack_id,
                    'purchase_order_number', NEW.purchase_order_number,
                    'requester_name', NEW.requester_name,
                    'vendor_name', COALESCE(NEW.vendor_name, '미정'),
                    'request_date', NEW.request_date::TEXT,
                    'total_amount', COALESCE(NEW.total_amount::TEXT, '0'),
                    'currency', NEW.currency,
                    'with_attachment', true,  -- 파일 첨부 활성화
                    'blocks', jsonb_build_array(
                        jsonb_build_object(
                            'type', 'header',
                            'text', jsonb_build_object(
                                'type', 'plain_text',
                                'text', '🔔 구매 요청 알림 + 발주서 첨부'
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
                                        '*🔄 진행방식:* ' || NEW.progress_type || chr(10) ||
                                        '*📎 첨부파일:* ' || NEW.purchase_order_number || '.xlsx'
                            )
                        ),
                        jsonb_build_object(
                            'type', 'context',
                            'elements', jsonb_build_array(
                                jsonb_build_object(
                                    'type', 'mrkdwn',
                                    'text', '📁 Storage에서 발주서 파일을 찾아 자동 첨부합니다 | ⏰ ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' | 🤖 한슬 구매관리 시스템'
                                )
                            )
                        )
                    )
                )
            );
            
            RAISE NOTICE 'Lead Buyer notification with attachment sent to % for %: %', slack_id, notification_reason, NEW.purchase_order_number;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to send notification with attachment to %: %', slack_id, SQLERRM;
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

-- 코멘트 업데이트
COMMENT ON FUNCTION notify_lead_buyer_unified() IS 
'통합된 Lead Buyer 알림 시스템: Storage에서 발주번호로 파일을 찾아 자동 첨부하여 DM 전송';

-- 확인용 로그
DO $$
BEGIN
    RAISE NOTICE '✅ Lead Buyer 알림 시스템 - 파일 첨부 기능 추가 완료';
    RAISE NOTICE '📎 Storage에서 발주번호.xlsx 파일을 자동으로 찾아서 첨부';
    RAISE NOTICE '📱 Block Kit 메시지 + 실제 파일 첨부 동시 전송';
    RAISE NOTICE '🔍 파일 없을 시 자동으로 fallback 메시지 전송';
END $$;