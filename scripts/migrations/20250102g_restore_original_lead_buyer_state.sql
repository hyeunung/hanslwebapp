-- 이채령님(Lead Buyer) 알림을 원래 상태로 완전히 되돌리기
-- 원래는 Lead Buyer 알림 시스템이 완전히 제거된 상태였음

-- 1단계: Lead Buyer 알림 트리거들 제거
DROP TRIGGER IF EXISTS trigger_lead_buyer_notification_unified ON purchase_requests;

-- 2단계: Lead Buyer 알림 함수 제거  
DROP FUNCTION IF EXISTS notify_lead_buyer_unified() CASCADE;

-- 확인용 로그
DO $$
BEGIN
    RAISE NOTICE '✅ 이채령님(Lead Buyer) 알림 시스템 완전 제거 완료';
    RAISE NOTICE '🔄 원래 상태로 되돌림: Lead Buyer 알림 없음';
    RAISE NOTICE '🎯 중간관리자 알림만 유지';
END $$;