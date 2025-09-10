-- 20250824c_sync_leave_table_with_employees.sql
-- leave 테이블 기준으로 employees 테이블의 연차 데이터 동기화

-- =====================================================
-- 1. 수정 전 불일치 데이터 확인
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Leave 테이블 기준 연차 동기화 시작';
    RAISE NOTICE '====================================';
END $$;

-- 불일치 직원 목록 확인
WITH leave_summary AS (
    SELECT 
        e.id,
        e.name,
        -- 종일 연차 개수
        COUNT(CASE 
            WHEN l.status = 'approved' 
            AND EXTRACT(YEAR FROM l.date) = EXTRACT(YEAR FROM CURRENT_DATE)
            AND l.leave_type = 'annual' 
            THEN 1 
        END) as full_day_count,
        -- 오전 반차 개수
        COUNT(CASE 
            WHEN l.status = 'approved' 
            AND EXTRACT(YEAR FROM l.date) = EXTRACT(YEAR FROM CURRENT_DATE)
            AND l.leave_type = 'half_am' 
            THEN 1 
        END) as half_am_count,
        -- 오후 반차 개수
        COUNT(CASE 
            WHEN l.status = 'approved' 
            AND EXTRACT(YEAR FROM l.date) = EXTRACT(YEAR FROM CURRENT_DATE)
            AND l.leave_type = 'half_pm' 
            THEN 1 
        END) as half_pm_count
    FROM employees e
    LEFT JOIN leave l ON e.id = l.employee_id
    GROUP BY e.id, e.name
)
SELECT 
    ls.name as "이름",
    e.used_annual_leave as "현재_기록된_사용연차",
    ls.full_day_count as "종일연차",
    ls.half_am_count as "오전반차",
    ls.half_pm_count as "오후반차",
    (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5) as "실제_사용연차",
    e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5) as "차이"
FROM leave_summary ls
JOIN employees e ON ls.id = e.id
WHERE e.annual_leave_granted_current_year IS NOT NULL
  AND e.used_annual_leave != (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5)
ORDER BY ABS(e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5)) DESC;

-- =====================================================
-- 2. Leave 테이블 기준으로 사용연차 재계산
-- =====================================================
DO $$
DECLARE
    v_updated_count INTEGER := 0;
    v_employee RECORD;
    v_actual_used NUMERIC;
BEGIN
    RAISE NOTICE '------------------------------------';
    RAISE NOTICE '연차 재계산 시작...';
    
    -- 각 직원별로 leave 테이블에서 실제 사용 연차 계산
    FOR v_employee IN 
        SELECT 
            e.id,
            e.name,
            e.used_annual_leave as current_used,
            e.annual_leave_granted_current_year
        FROM employees e
        WHERE e.annual_leave_granted_current_year IS NOT NULL
    LOOP
        -- leave 테이블에서 실제 사용 연차 계산
        SELECT 
            COUNT(CASE WHEN leave_type = 'annual' THEN 1 END) + 
            COUNT(CASE WHEN leave_type IN ('half_am', 'half_pm') THEN 1 END) * 0.5
        INTO v_actual_used
        FROM leave
        WHERE employee_id = v_employee.id
          AND status = 'approved'
          AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE);
        
        -- 값이 다른 경우만 업데이트
        IF v_employee.current_used != COALESCE(v_actual_used, 0) THEN
            UPDATE employees
            SET 
                used_annual_leave = COALESCE(v_actual_used, 0),
                remaining_annual_leave = annual_leave_granted_current_year - COALESCE(v_actual_used, 0),
                updated_at = NOW()
            WHERE id = v_employee.id;
            
            v_updated_count := v_updated_count + 1;
            
            RAISE NOTICE '✅ %: %.1f일 → %.1f일로 수정', 
                v_employee.name, 
                v_employee.current_used, 
                COALESCE(v_actual_used, 0);
        END IF;
    END LOOP;
    
    RAISE NOTICE '------------------------------------';
    RAISE NOTICE '총 %명의 연차 데이터가 수정되었습니다.', v_updated_count;
END $$;

-- =====================================================
-- 3. Leave 테이블 변경 시 자동 동기화 트리거 생성
-- =====================================================

-- 트리거 함수: leave 테이블 변경 시 employees 테이블 업데이트
CREATE OR REPLACE FUNCTION sync_employee_leave_count()
RETURNS TRIGGER AS $$
DECLARE
    v_used_annual NUMERIC;
    v_employee_id UUID;
BEGIN
    -- 영향받는 직원 ID 결정
    IF TG_OP = 'DELETE' THEN
        v_employee_id := OLD.employee_id;
    ELSE
        v_employee_id := NEW.employee_id;
    END IF;
    
    -- 해당 직원의 승인된 연차 재계산
    SELECT 
        COUNT(CASE WHEN leave_type = 'annual' THEN 1 END) + 
        COUNT(CASE WHEN leave_type IN ('half_am', 'half_pm') THEN 1 END) * 0.5
    INTO v_used_annual
    FROM leave
    WHERE employee_id = v_employee_id
      AND status = 'approved'
      AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- employees 테이블 업데이트
    UPDATE employees
    SET 
        used_annual_leave = COALESCE(v_used_annual, 0),
        remaining_annual_leave = annual_leave_granted_current_year - COALESCE(v_used_annual, 0),
        updated_at = NOW()
    WHERE id = v_employee_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 제거
DROP TRIGGER IF EXISTS sync_leave_to_employees ON leave;

-- 새 트리거 생성
CREATE TRIGGER sync_leave_to_employees
AFTER INSERT OR UPDATE OR DELETE ON leave
FOR EACH ROW
EXECUTE FUNCTION sync_employee_leave_count();

-- =====================================================
-- 4. 최종 결과 확인
-- =====================================================
WITH leave_check AS (
    SELECT 
        e.id,
        e.name,
        COUNT(CASE 
            WHEN l.status = 'approved' 
            AND EXTRACT(YEAR FROM l.date) = EXTRACT(YEAR FROM CURRENT_DATE)
            AND l.leave_type = 'annual' 
            THEN 1 
        END) as full_days,
        COUNT(CASE 
            WHEN l.status = 'approved' 
            AND EXTRACT(YEAR FROM l.date) = EXTRACT(YEAR FROM CURRENT_DATE)
            AND l.leave_type IN ('half_am', 'half_pm') 
            THEN 1 
        END) as half_days
    FROM employees e
    LEFT JOIN leave l ON e.id = l.employee_id
    GROUP BY e.id, e.name
)
SELECT 
    lc.name as "이름",
    e.annual_leave_granted_current_year as "생성연차",
    e.used_annual_leave as "사용연차",
    e.used_bereavement_leave as "사용공가",
    e.remaining_annual_leave as "남은연차",
    lc.full_days as "종일",
    lc.half_days as "반차",
    CASE 
        WHEN e.used_annual_leave = (lc.full_days + lc.half_days * 0.5)
        THEN '✅ 동기화됨'
        ELSE '❌ 불일치'
    END as "상태"
FROM leave_check lc
JOIN employees e ON lc.id = e.id
WHERE e.annual_leave_granted_current_year IS NOT NULL
ORDER BY 
    CASE 
        WHEN e.used_annual_leave != (lc.full_days + lc.half_days * 0.5)
        THEN 0
        ELSE 1
    END,
    lc.name;

-- =====================================================
-- 완료 메시지
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Leave 테이블 동기화 완료';
    RAISE NOTICE '자동 동기화 트리거 설치 완료';
    RAISE NOTICE '====================================';
END $$;