-- 20250824b_fix_annual_leave_calculation.sql
-- 연차 계산 불일치 수정 및 자동 계산 트리거 추가

-- =====================================================
-- 1. 현재 불일치 데이터 확인 (수정 전)
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE '연차 계산 불일치 수정 시작';
    RAISE NOTICE '====================================';
    
    -- 불일치 직원 목록 출력
    FOR r IN 
        SELECT 
            name,
            annual_leave_granted_current_year as granted,
            used_annual_leave as used,
            remaining_annual_leave as current_remaining,
            (annual_leave_granted_current_year - COALESCE(used_annual_leave, 0)) as calculated_remaining,
            (remaining_annual_leave - (annual_leave_granted_current_year - COALESCE(used_annual_leave, 0))) as diff
        FROM employees
        WHERE annual_leave_granted_current_year IS NOT NULL
          AND (remaining_annual_leave != (annual_leave_granted_current_year - COALESCE(used_annual_leave, 0)))
        ORDER BY name
    LOOP
        RAISE NOTICE '불일치 발견: % - 현재 남은연차: %일, 계산된 남은연차: %일 (차이: %일)', 
            r.name, r.current_remaining, r.calculated_remaining, r.diff;
    END LOOP;
END $$;

-- =====================================================
-- 2. 불일치 데이터 수정
-- =====================================================
UPDATE employees
SET 
    remaining_annual_leave = annual_leave_granted_current_year - COALESCE(used_annual_leave, 0),
    updated_at = NOW()
WHERE annual_leave_granted_current_year IS NOT NULL
  AND (remaining_annual_leave != (annual_leave_granted_current_year - COALESCE(used_annual_leave, 0)));

-- 수정된 건수 확인
DO $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RAISE NOTICE '총 %건의 연차 데이터가 수정되었습니다.', v_updated_count;
END $$;

-- =====================================================
-- 3. 자동 계산 트리거 함수 생성
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_remaining_annual_leave()
RETURNS TRIGGER AS $$
BEGIN
    -- 남은 연차 자동 계산
    NEW.remaining_annual_leave := COALESCE(NEW.annual_leave_granted_current_year, 0) - COALESCE(NEW.used_annual_leave, 0);
    
    -- 음수 방지
    IF NEW.remaining_annual_leave < 0 THEN
        NEW.remaining_annual_leave := 0;
    END IF;
    
    -- 업데이트 시간 기록
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. 트리거 생성 (INSERT, UPDATE 시 자동 계산)
-- =====================================================
-- 기존 트리거가 있다면 제거
DROP TRIGGER IF EXISTS auto_calculate_remaining_leave ON employees;

-- 새 트리거 생성
CREATE TRIGGER auto_calculate_remaining_leave
BEFORE INSERT OR UPDATE OF annual_leave_granted_current_year, used_annual_leave, used_bereavement_leave
ON employees
FOR EACH ROW
EXECUTE FUNCTION calculate_remaining_annual_leave();

-- =====================================================
-- 5. 전체 데이터 재계산 (안전을 위해)
-- =====================================================
UPDATE employees
SET 
    remaining_annual_leave = annual_leave_granted_current_year - COALESCE(used_annual_leave, 0)
WHERE annual_leave_granted_current_year IS NOT NULL;

-- =====================================================
-- 6. 최종 결과 확인
-- =====================================================
SELECT 
    name as "이름",
    annual_leave_granted_current_year as "생성연차",
    used_annual_leave as "사용연차",
    used_bereavement_leave as "사용공가",
    remaining_annual_leave as "남은연차",
    CASE 
        WHEN remaining_annual_leave = (annual_leave_granted_current_year - COALESCE(used_annual_leave, 0))
        THEN '✅ 정상'
        ELSE '❌ 불일치'
    END as "상태"
FROM employees
WHERE annual_leave_granted_current_year IS NOT NULL
ORDER BY 
    CASE 
        WHEN remaining_annual_leave != (annual_leave_granted_current_year - COALESCE(used_annual_leave, 0))
        THEN 0
        ELSE 1
    END,
    name;

-- =====================================================
-- 완료 메시지
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE '연차 계산 수정 완료';
    RAISE NOTICE '자동 계산 트리거 설치 완료';
    RAISE NOTICE '====================================';
END $$;