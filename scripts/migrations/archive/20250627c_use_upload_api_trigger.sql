-- 2025-06-27: 전용 업로드 API 사용으로 트리거 수정

-- 자동 업로드 함수 수정
CREATE OR REPLACE FUNCTION auto_upload_purchase_order()
RETURNS TRIGGER AS $$
DECLARE
    should_auto_upload BOOLEAN := FALSE;
    upload_response JSONB;
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
            -- 전용 업로드 API 호출하여 Storage 업로드
            PERFORM net.http_post(
                url := format('https://work.hansl.com/api/upload-po/%s', NEW.purchase_order_number),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'User-Agent', 'Auto-Upload-Trigger/1.0'
                ),
                body := '{}'::jsonb
            );
            
            RAISE NOTICE '발주서 자동 업로드 요청 완료: %', NEW.purchase_order_number;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '발주서 자동 업로드 실패: % - %', NEW.purchase_order_number, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 변경사항 요약:
-- 1. 전용 업로드 API (/api/upload-po) 호출로 변경
-- 2. POST 방식으로 호출하여 더 안정적인 업로드