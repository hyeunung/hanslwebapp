-- 2025-06-26: 테스트 데이터 정리
-- 승인관리 페이지에서 보이던 테스트용 데이터들을 삭제

-- 테스트 아이템 데이터 삭제
DELETE FROM purchase_request_items WHERE purchase_request_id IN (
    1000, -- PO-2025-TEST-003 (이영희)
    1001, -- PO-2025-DIRECT-001 (박민수)
    1002, -- PO-2025-FINAL-001 (이지은)
    1004, -- TEST-001-BASIC (테스트사용자1)
    1005, -- TEST-002-ADVANCED (테스트사용자2)
    1006, -- TEST-MSG-FORMAT-001 (김테스트)
    945   -- 불완전한 데이터 (발주번호: "1", 요청자명: 공백)
);

-- 테스트 구매 요청 데이터 삭제
DELETE FROM purchase_requests WHERE id IN (
    1000, -- PO-2025-TEST-003 (이영희)
    1001, -- PO-2025-DIRECT-001 (박민수)
    1002, -- PO-2025-FINAL-001 (이지은)
    1004, -- TEST-001-BASIC (테스트사용자1)
    1005, -- TEST-002-ADVANCED (테스트사용자2)
    1006, -- TEST-MSG-FORMAT-001 (김테스트)
    945   -- 불완전한 데이터 (발주번호: "1", 요청자명: 공백)
);

-- 삭제된 데이터 요약:
-- - 테스트용 purchase_requests: 7건
-- - 관련 purchase_request_items: 4건
-- - 삭제 대상: TEST 키워드 포함, 테스트 사용자명, 불완전한 데이터 