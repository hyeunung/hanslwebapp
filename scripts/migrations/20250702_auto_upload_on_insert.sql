-- 2025-07-02: 자동 업로드 조건 제거 – 발주 INSERT 시 항상 Storage 업로드 실행

-- 1. 기존 트리거 및 함수 제거
DROP TRIGGER IF EXISTS auto_upload_purchase_order_trigger ON purchase_requests;
DROP FUNCTION IF EXISTS auto_upload_purchase_order();

-- 2. 새로운 트리거 함수 (조건 없음, INSERT 시 항상 호출)
CREATE FUNCTION auto_upload_purchase_order()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := format('https://work.hansl.com/api/upload-po/%s', NEW.purchase_order_number),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'User-Agent', 'Auto-Upload-Trigger/1.1'
      ),
      body := '{}'::jsonb
    );
    RAISE NOTICE '발주서 자동 업로드 요청 전송: %', NEW.purchase_order_number;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '발주서 자동 업로드 실패: % - %', NEW.purchase_order_number, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 새로운 트리거: INSERT 후 실행
CREATE TRIGGER auto_upload_purchase_order_trigger
AFTER INSERT ON purchase_requests
FOR EACH ROW EXECUTE FUNCTION auto_upload_purchase_order(); 