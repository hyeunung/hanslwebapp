-- 20250109a_remove_existing_material_manager_system.sql
-- Purpose: 기존 Material Manager 알림 시스템 완전 삭제
-- 새로운 중간관리자 스타일 워크플로우 구현을 위한 클린업

-- 1. 기존 트리거 완전 삭제
DROP TRIGGER IF EXISTS material_manager_notify_trigger ON purchase_requests;

-- 2. 기존 함수 완전 삭제
DROP FUNCTION IF EXISTS public.notify_material_managers();

-- 3. 관련 보조 함수들도 삭제 (있을 경우)
DROP FUNCTION IF EXISTS public.send_block_kit_approval_notification(BIGINT);
DROP FUNCTION IF EXISTS public.create_purchase_approval_block_kit(BIGINT);
DROP FUNCTION IF EXISTS public.handle_purchase_request_insert();

-- 확인용 로그
DO $$
BEGIN
    RAISE NOTICE '✅ 기존 Material Manager 알림 시스템 완전 삭제 완료';
    RAISE NOTICE '🗑️ 삭제된 항목: material_manager_notify_trigger, notify_material_managers()';
    RAISE NOTICE '🆕 다음 단계: 새로운 중간관리자 스타일 시스템 구현 준비';
END $$;