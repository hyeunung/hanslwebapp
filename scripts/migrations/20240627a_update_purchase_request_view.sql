DROP VIEW IF EXISTS purchase_request_view;

-- 재구성된 View
-- 필요한 컬럼만 예시로 작성. 실제로는 기존 View 의 전체 컬럼 목록을 포함해야 함.
-- 핵심은 purchase_request_file_url 을 제거하고, 하위 items 의 link 값을 link 로 노출시키는 것.

CREATE OR REPLACE VIEW purchase_request_view AS
SELECT
  pr.id                              AS purchase_request_id,
  pr.purchase_order_number,
  pr.request_date,
  pr.delivery_request_date,
  pr.progress_type,
  pr.is_payment_completed,
  pr.payment_completed_at,
  pr.payment_category,
  pr.currency,
  pr.request_type,
  pr.vendor_name,
  pr.vendor_payment_schedule,
  pr.requester_name,
  pri.item_name,
  pri.specification,
  pri.quantity,
  pri.unit_price_value,
  pri.amount_value,
  pri.remark,
  pr.project_vendor,
  pr.sales_order_number,
  pr.project_item,
  pri.line_number,
  vc.contact_name,
  pr.middle_manager_status,
  pr.final_manager_status,
  pr.is_received,
  pr.received_at,
  pr.is_payment_completed,
  -- 새 컬럼: 첫 번째로 발견되는 link 값
  (SELECT l.link
     FROM purchase_request_items l
    WHERE l.purchase_request_id = pr.id
      AND l.link IS NOT NULL
    LIMIT 1)                     AS link
FROM purchase_requests pr
LEFT JOIN purchase_request_items pri ON pri.purchase_request_id = pr.id
LEFT JOIN vendor_contacts vc       ON vc.id = pr.contact_id; 