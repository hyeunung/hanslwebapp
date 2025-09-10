-- 김경태 직원 공가 처리
-- 1/31: 장인어른 상 (1일)
-- 2/11~2/13: 할머니 상 (3일)
-- 총 4일을 연차에서 공가로 변경

-- 1. 김경태 직원 정보 조회 (변경 전 상태 확인)
DO $$
DECLARE
    v_employee_id UUID;
    v_name TEXT;
    v_current_used_annual NUMERIC;
    v_current_used_bereavement NUMERIC;
    v_current_remaining_annual NUMERIC;
BEGIN
    -- 김경태 직원 찾기
    SELECT id, name, used_annual_leave, used_bereavement_leave, remaining_annual_leave
    INTO v_employee_id, v_name, v_current_used_annual, v_current_used_bereavement, v_current_remaining_annual
    FROM employees
    WHERE name = '김경태'
    LIMIT 1;
    
    IF v_employee_id IS NULL THEN
        RAISE EXCEPTION '김경태 직원을 찾을 수 없습니다.';
    END IF;
    
    -- 현재 상태 출력
    RAISE NOTICE '====================================';
    RAISE NOTICE '김경태 직원 공가 처리 시작';
    RAISE NOTICE '====================================';
    RAISE NOTICE '직원 ID: %', v_employee_id;
    RAISE NOTICE '변경 전 상태:';
    RAISE NOTICE '  - 사용 연차: %일', COALESCE(v_current_used_annual, 0);
    RAISE NOTICE '  - 사용 공가: %일', COALESCE(v_current_used_bereavement, 0);
    RAISE NOTICE '  - 남은 연차: %일', COALESCE(v_current_remaining_annual, 0);
    
    -- 2. 공가 4일 처리 (연차에서 차감하고 공가로 이동)
    UPDATE employees
    SET 
        used_annual_leave = GREATEST(0, COALESCE(used_annual_leave, 0) - 4),  -- 연차 사용 4일 감소
        used_bereavement_leave = COALESCE(used_bereavement_leave, 0) + 4,     -- 공가 사용 4일 증가
        remaining_annual_leave = COALESCE(remaining_annual_leave, 0) + 4,      -- 남은 연차 4일 증가
        updated_at = NOW()
    WHERE id = v_employee_id;
    
    -- 3. 변경 후 상태 확인
    SELECT used_annual_leave, used_bereavement_leave, remaining_annual_leave
    INTO v_current_used_annual, v_current_used_bereavement, v_current_remaining_annual
    FROM employees
    WHERE id = v_employee_id;
    
    RAISE NOTICE '------------------------------------';
    RAISE NOTICE '변경 후 상태:';
    RAISE NOTICE '  - 사용 연차: %일', COALESCE(v_current_used_annual, 0);
    RAISE NOTICE '  - 사용 공가: %일', COALESCE(v_current_used_bereavement, 0);
    RAISE NOTICE '  - 남은 연차: %일', COALESCE(v_current_remaining_annual, 0);
    RAISE NOTICE '====================================';
    RAISE NOTICE '공가 처리 완료:';
    RAISE NOTICE '  - 1/31: 장인어른 상 (1일)';
    RAISE NOTICE '  - 2/11~2/13: 할머니 상 (3일)';
    RAISE NOTICE '  - 총 4일 공가 처리 완료';
    RAISE NOTICE '====================================';
    
END $$;

-- 4. 최종 결과 확인
SELECT 
    name as "이름",
    annual_leave_granted_current_year as "생성연차",
    used_annual_leave as "사용연차",
    used_bereavement_leave as "사용공가",
    remaining_annual_leave as "남은연차",
    updated_at as "수정일시"
FROM employees 
WHERE name = '김경태';