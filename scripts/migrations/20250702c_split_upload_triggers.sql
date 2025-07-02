-- 2025-07-02c: 자동 업로드 트리거/함수 분리 (INSERT, UPDATE 별도)

-- 1. 기존 통합 트리거/함수 제거
DROP TRIGGER IF EXISTS auto_upload_purchase_order_trigger ON purchase_requests;
DROP FUNCTION IF EXISTS auto_upload_purchase_order();

-- 2. INSERT 전용 함수
CREATE FUNCTION auto_upload_po_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := format('https://work.hansl.com/api/upload-po/%s', NEW.purchase_order_number),
    headers := '{"Content-Type":"application/json","User-Agent":"Auto-Upload-Insert/1.0"}'::jsonb,
    body := '{}'::jsonb
  );
  RAISE NOTICE '발주서 INSERT 자동 업로드 전송: %', NEW.purchase_order_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. UPDATE 전용 함수
CREATE FUNCTION auto_upload_po_on_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := format('https://work.hansl.com/api/upload-po/%s', NEW.purchase_order_number),
    headers := '{"Content-Type":"application/json","User-Agent":"Auto-Upload-Update/1.0"}'::jsonb,
    body := '{}'::jsonb
  );
  RAISE NOTICE '발주서 UPDATE 자동 업로드 전송: %', NEW.purchase_order_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 트리거 생성
-- INSERT 전용
CREATE TRIGGER trg_auto_upload_po_insert
AFTER INSERT ON purchase_requests
FOR EACH ROW EXECUTE FUNCTION auto_upload_po_on_insert();

-- UPDATE 전용
CREATE TRIGGER trg_auto_upload_po_update
AFTER UPDATE ON purchase_requests
FOR EACH ROW EXECUTE FUNCTION auto_upload_po_on_update(); 