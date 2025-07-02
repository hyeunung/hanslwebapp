-- Lead Buyer에게 새 구매 요청 알림을 보내는 시스템
-- purchase_requests 테이블에 새 행이 INSERT될 때 트리거 실행

-- 1. Lead Buyer 알림 함수 생성
CREATE OR REPLACE FUNCTION notify_lead_buyer_on_purchase_insert()
RETURNS TRIGGER AS $$
DECLARE
    lead_buyer_slack_ids TEXT[];
    slack_id TEXT;
    message_text TEXT;
    supabase_url TEXT;
    anon_key TEXT;
BEGIN
    -- Supabase URL과 anon key 가져오기
    SELECT current_setting('app.supabase_url', true) INTO supabase_url;
    SELECT current_setting('app.supabase_anon_key', true) INTO anon_key;
    
    -- URL이 없으면 환경변수에서 가져오기
    IF supabase_url IS NULL OR supabase_url = '' THEN
        supabase_url := 'https://qvhbigvdfyvhoegkhvef.supabase.co';
    END IF;
    
    -- anon key가 없으면 기본값 설정 (실제 환경에서는 환경변수 사용)
    IF anon_key IS NULL OR anon_key = '' THEN
        -- 실제 anon key는 환경변수나 설정에서 가져와야 함
        RAISE WARNING 'anon_key not configured properly';
        RETURN NEW;
    END IF;

    -- Lead Buyer 역할을 가진 직원들의 Slack ID 조회
    SELECT array_agg(e.slack_id) 
    INTO lead_buyer_slack_ids
    FROM employees e
    WHERE e.purchase_role @> ARRAY['lead buyer']
      AND e.slack_id IS NOT NULL
      AND e.slack_id != '';
    
    -- Lead Buyer가 없으면 종료
    IF lead_buyer_slack_ids IS NULL OR array_length(lead_buyer_slack_ids, 1) = 0 THEN
        RAISE WARNING 'No Lead Buyer found with valid Slack ID';
        RETURN NEW;
    END IF;
    
    -- 알림 메시지 생성
    message_text := format(
        '🔔 새로운 구매 요청이 등록되었습니다!\n\n' ||
        '📋 발주번호: %s\n' ||
        '👤 요청자: %s\n' ||
        '🏢 업체: %s\n' ||
        '📅 요청일: %s\n' ||
        '💰 총액: %s %s\n\n' ||
        '자세한 내용은 한슬 웹앱에서 확인하세요.',
        NEW.purchase_order_number,
        NEW.requester_name,
        COALESCE(NEW.vendor_name, '미정'),
        NEW.request_date,
        COALESCE(NEW.total_amount::TEXT, '0'),
        NEW.currency
    );
    
    -- 각 Lead Buyer에게 DM 전송
    FOREACH slack_id IN ARRAY lead_buyer_slack_ids
    LOOP
        -- 비동기 HTTP 요청으로 slack-dm-sender Edge Function 호출
        PERFORM net.http_post(
            url := supabase_url || '/functions/v1/slack-dm-sender',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || anon_key
            ),
            body := jsonb_build_object(
                'user_id', slack_id,
                'message', message_text
            )
        );
        
        RAISE NOTICE 'Lead Buyer notification sent to: %', slack_id;
    END LOOP;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- 에러가 발생해도 INSERT는 계속 진행되도록 함
        RAISE WARNING 'Error sending Lead Buyer notification: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 기존 트리거 삭제 (있을 경우)
DROP TRIGGER IF EXISTS trigger_notify_lead_buyer_on_purchase_insert ON purchase_requests;

-- 3. 새 트리거 생성 (INSERT 시에만)
CREATE TRIGGER trigger_notify_lead_buyer_on_purchase_insert
    AFTER INSERT ON purchase_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_lead_buyer_on_purchase_insert();

-- 4. 코멘트 추가
COMMENT ON FUNCTION notify_lead_buyer_on_purchase_insert() IS 
'purchase_requests 테이블에 새 행이 INSERT될 때 Lead Buyer에게 Slack DM 알림을 전송하는 함수';

COMMENT ON TRIGGER trigger_notify_lead_buyer_on_purchase_insert ON purchase_requests IS 
'새 구매 요청 등록 시 Lead Buyer에게 Slack DM 알림을 보내는 트리거';