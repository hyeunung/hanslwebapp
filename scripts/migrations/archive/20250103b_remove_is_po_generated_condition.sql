-- 구매완료 오류 해결: is_po_generated 조건 제거
-- on_purchase_request_status_change 함수에서 존재하지 않는 필드 참조 제거

CREATE OR REPLACE FUNCTION on_purchase_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- 결제완료 시 자동 발주서 생성 (is_po_generated 조건 제거)
  IF NEW.is_payment_completed = TRUE
     AND NEW.progress_type = '일반' THEN
    PERFORM call_edge_generate_po(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;