-- 중복 중간관리자 알림 방지: 트리거 제거
-- 이유: 웹앱에서 별도 API 호출(/api/purchase/${prId}/notify-middle-manager)을 하고 있어서
-- 데이터베이스 트리거와 중복으로 알림이 전송되고 있음

-- 1. 중간관리자 INSERT 알림 트리거 제거
DROP TRIGGER IF EXISTS middle_manager_insert_notify_trigger ON purchase_requests;

-- 2. 관련 함수도 제거 (더 이상 사용되지 않음)
DROP FUNCTION IF EXISTS notify_middle_manager_on_insert();

-- 확인
SELECT 'middle_manager_insert_notify_trigger 트리거가 제거되었습니다.' as status; 