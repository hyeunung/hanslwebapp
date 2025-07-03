-- Lead Buyer 알림을 완성형으로 복원
-- 간단한 텍스트 + Excel 다운로드 버튼 형태

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
                        -- 발주서 파일 헤더
                        jsonb_build_object(
                            'type', 'section',
                            'text', jsonb_build_object(
                                'type', 'mrkdwn',
                                'text', '📎 *발주서 파일*'
                            )
                        ),
                        -- 간단한 정보 (4줄)
                        jsonb_build_object(
                            'type', 'section',
                            'text', jsonb_build_object(
                                'type', 'mrkdwn',
                                'text', 
                                '🔸 *발주번호:* ' || NEW.purchase_order_number || '\n' ||
                                '🔸 *구매요청자:* ' || NEW.requester_name || '\n' ||
                                '🔸 *업체명:* ' || COALESCE(NEW.vendor_name, '미정') || '\n' ||
                                '🔸 *총액:* ' || COALESCE(NEW.total_amount::TEXT, '0') || ' ' || NEW.currency
                            )
                        ),
                        -- Excel 다운로드 버튼
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

-- 트리거 재생성
CREATE TRIGGER trigger_lead_buyer_notification_unified
    AFTER INSERT OR UPDATE ON purchase_requests
    FOR EACH ROW EXECUTE FUNCTION notify_lead_buyer_unified();

-- 코멘트 업데이트
COMMENT ON FUNCTION notify_lead_buyer_unified() IS 
'Lead Buyer 알림 완성형: 간단한 텍스트 (발주번호, 구매요청자, 업체명, 총액) + Excel 다운로드 버튼';

-- 확인용 로그
DO $$
BEGIN
    RAISE NOTICE '✅ Lead Buyer 알림 완성형 복원 완료';
    RAISE NOTICE '📎 발주서 파일 헤더';
    RAISE NOTICE '🔸 간단한 4줄 정보 (발주번호, 구매요청자, 업체명, 총액)';
    RAISE NOTICE '🔘 Excel 다운로드 버튼';
END $$;