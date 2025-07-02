-- 2025-07-02d: 중복 자동 업로드 트리거/함수 정리
-- 실제 사용 트리거
--   trg_auto_upload_po_insert (AFTER INSERT)
--   trg_auto_upload_po_update (AFTER UPDATE)
-- 실제 사용 함수
--   auto_upload_po_on_insert()
--   auto_upload_po_on_update()
-- 그 외 이름이 같은 과거 버전은 모두 제거

-- 1. 불필요한 옛 트리거 제거
DROP TRIGGER IF EXISTS auto_upload_purchase_order_trigger ON purchase_requests;
DROP TRIGGER IF EXISTS auto_upload_purchase_order_trigger_insert ON purchase_requests;
DROP TRIGGER IF EXISTS auto_upload_purchase_order_trigger_update ON purchase_requests;

-- 2. 불필요한 옛 함수 제거
DROP FUNCTION IF EXISTS auto_upload_purchase_order();
-- ↓ 과거에 버전 관리 혼동으로 생성되었을 가능성 있는 이름들
DROP FUNCTION IF EXISTS auto_upload_purchase_order_on_insert();
DROP FUNCTION IF EXISTS auto_upload_purchase_order_on_update(); 