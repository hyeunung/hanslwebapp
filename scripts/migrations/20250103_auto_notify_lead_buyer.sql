-- Lead Buyer 자동 알림 트리거 함수 및 트리거 생성

-- 1. Lead Buyer 알림을 위한 트리거 함수 생성
CREATE OR REPLACE FUNCTION notify_lead_buyer_on_purchase_request()
RETURNS TRIGGER AS $$
DECLARE
    should_notify BOOLEAN := FALSE;
    api_url TEXT;
    payload JSON;
BEGIN
    -- 조건 확인: 선진행이거나 일반에서 승인 완료
    IF NEW.progress_type = '선진행' THEN
        should_notify := TRUE;
    ELSIF NEW.progress_type = '일반' AND NEW.final_manager_status = 'approved' THEN
        -- UPDATE의 경우 이전 상태와 비교
        IF TG_OP = 'UPDATE' THEN
            -- final_manager_status가 변경된 경우에만
            IF OLD.final_manager_status IS DISTINCT FROM NEW.final_manager_status THEN
                should_notify := TRUE;
            END IF;
        ELSE
            -- INSERT인 경우 바로 알림
            should_notify := TRUE;
        END IF;
    END IF;

    -- 알림이 필요한 경우 HTTP 요청 전송
    IF should_notify THEN
        -- API URL 설정 (환경에 맞게 수정 필요)
        api_url := 'https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/notify-lead-buyer';
        
        -- 페이로드 구성
        payload := json_build_object(
            'purchaseRequestId', NEW.id,
            'triggerType', TG_OP,
            'progressType', NEW.progress_type,
            'finalManagerStatus', NEW.final_manager_status
        );

        -- Edge Function 호출 (비동기)
        PERFORM
            net.http_post(
                url := api_url,
                headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.supabase_service_role_key', true) || '"}'::jsonb,
                body := payload::jsonb
            );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. INSERT 트리거 생성 (새로운 발주 요청시)
CREATE OR REPLACE TRIGGER trigger_notify_lead_buyer_insert
    AFTER INSERT ON purchase_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_lead_buyer_on_purchase_request();

-- 3. UPDATE 트리거 생성 (승인 상태 변경시)
CREATE OR REPLACE TRIGGER trigger_notify_lead_buyer_update
    AFTER UPDATE OF final_manager_status ON purchase_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_lead_buyer_on_purchase_request();

-- 4. 알림 로그 테이블 생성 (선택사항 - 알림 이력 추적용)
CREATE TABLE IF NOT EXISTS lead_buyer_notifications (
    id BIGSERIAL PRIMARY KEY,
    purchase_request_id BIGINT REFERENCES purchase_requests(id),
    trigger_type TEXT NOT NULL, -- 'INSERT' or 'UPDATE'
    progress_type TEXT,
    final_manager_status TEXT,
    notification_sent_at TIMESTAMPTZ DEFAULT NOW(),
    api_response TEXT,
    success BOOLEAN DEFAULT FALSE
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_lead_buyer_notifications_purchase_request_id 
ON lead_buyer_notifications(purchase_request_id);

CREATE INDEX IF NOT EXISTS idx_lead_buyer_notifications_sent_at 
ON lead_buyer_notifications(notification_sent_at);

COMMENT ON TABLE lead_buyer_notifications IS 'Lead Buyer 알림 이력을 추적하는 테이블';
COMMENT ON FUNCTION notify_lead_buyer_on_purchase_request() IS 'Lead Buyer에게 자동 알림을 전송하는 트리거 함수';