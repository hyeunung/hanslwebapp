-- F20250917_018 발주 상태 확인
SELECT 
    purchase_order_number,
    requester_name,
    middle_manager_status,
    final_manager_status,
    progress_type,
    payment_category,
    request_date,
    final_manager_approved_at
FROM purchase_requests 
WHERE purchase_order_number = 'F20250917_018';