-- 2025-06-27: 자동 업로드 조건 수정 (파일 중복 방지)

-- 자동 업로드 함수 수정 (조건 개선)
CREATE OR REPLACE FUNCTION auto_upload_purchase_order()
RETURNS TRIGGER AS $$
DECLARE
    should_auto_upload BOOLEAN := FALSE;
BEGIN
    -- 자동 업로드 조건 확인 (중복 방지)
    IF TG_OP = 'INSERT' AND NEW.progress_type = '선진행' THEN
        should_auto_upload := TRUE;
    ELSIF TG_OP = 'UPDATE' 
          AND NEW.progress_type = '일반' 
          AND NEW.final_manager_status = 'approved' 
          AND (OLD.final_manager_status IS DISTINCT FROM NEW.final_manager_status) THEN
        should_auto_upload := TRUE;
    END IF;
    
    -- 자동 업로드 실행
    IF should_auto_upload THEN
        BEGIN
            -- 전용 업로드 API 호출
            PERFORM net.http_post(
                url := format('https://work.hansl.com/api/upload-po/%s', NEW.purchase_order_number),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'User-Agent', 'Auto-Upload-Trigger/1.0'
                ),
                body := '{}'::jsonb
            );
            
            RAISE NOTICE '발주서 자동 업로드 요청 전송: % (조건: %)', 
                         NEW.purchase_order_number, 
                         CASE WHEN TG_OP = 'INSERT' THEN '선진행_생성' ELSE '일반_최종승인' END;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '발주서 자동 업로드 실패: % - %', NEW.purchase_order_number, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 변경사항:
-- 1. UPDATE 트리거 조건에 progress_type='일반' 추가
-- 2. 중복 업로드 방지 (선진행은 INSERT시만, 일반은 최종승인시만)
-- 3. 로그 메시지에 조건 구분 추가