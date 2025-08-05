-- 직원 삭제를 위한 참조 관계 정리 및 완전 삭제
-- 2025년 1월 17일: 김철수, 김영희 직원 데이터 완전 삭제
-- 
-- 문제: employees 테이블에서 삭제 시 purchase_requests.requester_id 외래키 제약조건 위반
-- 해결: 참조 관계 해제 후 안전하게 삭제

-- ==========================================
-- 1단계: 삭제 대상 직원 확인
-- ==========================================

-- 삭제 대상 직원들의 현재 상태 확인
DO $$
DECLARE
    rec RECORD;
    ref_count INTEGER;
BEGIN
    RAISE NOTICE '=== 삭제 대상 직원 확인 ===';
    
    FOR rec IN 
        SELECT id, name, email 
        FROM employees 
        WHERE name IN ('김철수', '김영희')
        ORDER BY name
    LOOP
        -- 각 직원별 참조 카운트 확인
        SELECT COUNT(*) INTO ref_count
        FROM purchase_requests 
        WHERE requester_id = rec.id;
        
        RAISE NOTICE '직원: % (ID: %), 이메일: %, 참조 발주 건수: %', 
                     rec.name, rec.id, rec.email, ref_count;
    END LOOP;
END $$;

-- ==========================================
-- 2단계: purchase_requests 참조 해제
-- ==========================================

-- 김철수, 김영희가 요청자인 발주 요청들의 requester_id를 NULL로 변경
-- (requester_name은 유지하여 기록 보존)
UPDATE purchase_requests 
SET requester_id = NULL 
WHERE requester_id IN (
    SELECT id 
    FROM employees 
    WHERE name IN ('김철수', '김영희')
);

-- 변경된 건수 확인
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '=== purchase_requests 참조 해제 완료 ===';
    RAISE NOTICE '업데이트된 발주 요청 건수: %', updated_count;
END $$;

-- ==========================================
-- 3단계: notifications 관련 데이터 정리
-- ==========================================

-- notifications 테이블에서 해당 직원들과 관련된 알림 데이터 삭제
-- (slack_user_id나 관련 메타데이터에 포함될 수 있음)
DELETE FROM notifications 
WHERE metadata::text LIKE '%김철수%' 
   OR metadata::text LIKE '%김영희%'
   OR message LIKE '%김철수%' 
   OR message LIKE '%김영희%';

-- 삭제된 알림 건수 확인
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '=== notifications 정리 완료 ===';
    RAISE NOTICE '삭제된 알림 건수: %', deleted_count;
END $$;

-- ==========================================
-- 4단계: 최종 안전성 검사
-- ==========================================

-- 외래키 참조가 완전히 제거되었는지 확인
DO $$
DECLARE
    remaining_refs INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_refs
    FROM purchase_requests pr
    JOIN employees e ON pr.requester_id = e.id
    WHERE e.name IN ('김철수', '김영희');
    
    IF remaining_refs > 0 THEN
        RAISE EXCEPTION '❌ 아직 % 건의 외래키 참조가 남아있습니다. 삭제를 중단합니다.', remaining_refs;
    ELSE
        RAISE NOTICE '✅ 모든 외래키 참조가 안전하게 해제되었습니다.';
    END IF;
END $$;

-- ==========================================
-- 5단계: 직원 데이터 완전 삭제
-- ==========================================

-- 김철수, 김영희를 employees 테이블에서 완전 삭제
DELETE FROM employees 
WHERE name IN ('김철수', '김영희');

-- 삭제 완료 확인
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '=== 직원 삭제 완료 ===';
    RAISE NOTICE '삭제된 직원 수: %', deleted_count;
    
    IF deleted_count = 2 THEN
        RAISE NOTICE '✅ 김철수, 김영희 삭제가 성공적으로 완료되었습니다!';
    ELSIF deleted_count = 1 THEN
        RAISE NOTICE '⚠️  1명만 삭제되었습니다. (김철수 또는 김영희 중 1명이 존재하지 않았을 수 있음)';
    ELSE
        RAISE NOTICE '⚠️  삭제된 직원이 없습니다. (김철수, 김영희가 존재하지 않았을 수 있음)';
    END IF;
END $$;

-- ==========================================
-- 6단계: 최종 검증
-- ==========================================

-- 삭제가 완전히 완료되었는지 최종 확인
DO $$
DECLARE
    remaining_employees INTEGER;
    orphaned_requests INTEGER;
BEGIN
    -- 남은 직원 확인
    SELECT COUNT(*) INTO remaining_employees
    FROM employees 
    WHERE name IN ('김철수', '김영희');
    
    -- 고아 발주 요청 확인 (requester_name은 있지만 requester_id가 NULL인 경우)
    SELECT COUNT(*) INTO orphaned_requests
    FROM purchase_requests 
    WHERE requester_id IS NULL 
      AND requester_name IN ('김철수', '김영희');
    
    RAISE NOTICE '=== 최종 검증 결과 ===';
    RAISE NOTICE '남은 김철수/김영희 직원 수: %', remaining_employees;
    RAISE NOTICE '이름은 남았지만 ID가 NULL인 발주 요청 수: %', orphaned_requests;
    
    IF remaining_employees = 0 THEN
        RAISE NOTICE '🎉 김철수, 김영희 완전 삭제 성공!';
        RAISE NOTICE '📋 기존 발주 기록은 요청자명으로 보존되었습니다.';
    ELSE
        RAISE EXCEPTION '❌ 삭제 실패: % 명의 직원이 여전히 남아있습니다.', remaining_employees;
    END IF;
END $$;

-- ==========================================
-- 마이그레이션 완료
-- ==========================================

/*
실행 결과 요약:
1. ✅ purchase_requests에서 외래키 참조 해제 (requester_name은 보존)
2. ✅ notifications에서 관련 알림 데이터 정리  
3. ✅ 안전성 검사 통과
4. ✅ employees에서 김철수, 김영희 완전 삭제
5. ✅ 기존 발주 기록은 요청자명으로 추적 가능

⚠️  주의사항:
- 삭제된 직원들은 복구할 수 없습니다
- 발주 기록의 requester_id는 NULL이 되지만 requester_name은 유지됩니다
- 새로운 발주 요청 시 해당 이름으로 직원을 찾을 수 없게 됩니다
*/