-- 2025-06-27: 트리거 HTTP 호출 방식 수정

-- 자동 업로드 함수 수정 (응답 파싱 제거)
CREATE OR REPLACE FUNCTION auto_upload_purchase_order()
RETURNS TRIGGER AS $$
DECLARE
    should_auto_upload BOOLEAN := FALSE;
BEGIN
    -- 자동 업로드 조건 확인
    IF TG_OP = 'INSERT' AND NEW.progress_type = '선진행' THEN
        should_auto_upload := TRUE;
    ELSIF TG_OP = 'UPDATE' AND NEW.final_manager_status = 'approved' AND (OLD.final_manager_status IS DISTINCT FROM NEW.final_manager_status) THEN
        should_auto_upload := TRUE;
    END IF;
    
    -- 자동 업로드 실행
    IF should_auto_upload THEN
        BEGIN
            -- 전용 업로드 API 호출 (응답 파싱 없이 단순 요청)
            PERFORM net.http_post(
                url := format('https://work.hansl.com/api/upload-po/%s', NEW.purchase_order_number),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'User-Agent', 'Auto-Upload-Trigger/1.0'
                ),
                body := '{}'::jsonb
            );
            
            RAISE NOTICE '발주서 자동 업로드 요청 전송: %', NEW.purchase_order_number;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '발주서 자동 업로드 실패: % - %', NEW.purchase_order_number, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 변경사항 요약:
-- 1. HTTP 응답 파싱 로직 제거
-- 2. 단순한 PERFORM 방식으로 변경
-- 3. 안정적인 요청 전송에 집중