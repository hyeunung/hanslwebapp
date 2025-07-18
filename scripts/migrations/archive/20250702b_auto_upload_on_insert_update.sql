-- 2025-07-02b: 발주 UPDATE 시에도 Storage 업로드 재실행

-- 1. 기존 트리거 제거
DROP TRIGGER IF EXISTS auto_upload_purchase_order_trigger ON purchase_requests;

-- 2. 트리거 재생성 (INSERT 또는 UPDATE 시 실행)
CREATE TRIGGER auto_upload_purchase_order_trigger
AFTER INSERT OR UPDATE ON purchase_requests
FOR EACH ROW EXECUTE FUNCTION auto_upload_purchase_order(); 