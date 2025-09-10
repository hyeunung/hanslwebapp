-- 연차 불일치 수정 마이그레이션
-- 실행일: 2025-01-25
-- 목적: leave 테이블의 실제 연차 사용량과 employees 테이블의 used_annual_leave 값 동기화

-- ======================================
-- 1. 현재 불일치 상태 확인
-- ======================================
DO $$
BEGIN
    RAISE NOTICE '=== 수정 전 불일치 상태 확인 ===';
END $$;

WITH leave_summary AS (
    SELECT 
        e.id,
        e.name,
        COUNT(CASE WHEN l.status = 'approved' AND EXTRACT(YEAR FROM l.date) = 2025 AND l.leave_type = 'annual' THEN 1 END) as full_day_count,
        COUNT(CASE WHEN l.status = 'approved' AND EXTRACT(YEAR FROM l.date) = 2025 AND l.leave_type = 'half_am' THEN 1 END) as half_am_count,
        COUNT(CASE WHEN l.status = 'approved' AND EXTRACT(YEAR FROM l.date) = 2025 AND l.leave_type = 'half_pm' THEN 1 END) as half_pm_count
    FROM employees e
    LEFT JOIN leave l ON e.id = l.employee_id
    GROUP BY e.id, e.name
)
SELECT 
    ls.name,
    e.used_annual_leave as current_record,
    (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5) as actual_usage,
    e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5) as difference
FROM leave_summary ls
JOIN employees e ON ls.id = e.id
WHERE e.annual_leave_granted_current_year IS NOT NULL
  AND ABS(e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5)) > 0.01
ORDER BY ABS(e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5)) DESC;

-- ======================================
-- 2. 백업 테이블 생성
-- ======================================
DO $$
BEGIN
    RAISE NOTICE '=== 백업 테이블 생성 ===';
END $$;

DROP TABLE IF EXISTS employees_backup_20250125_discrepancy;
CREATE TABLE employees_backup_20250125_discrepancy AS 
SELECT 
    id, name, used_annual_leave, remaining_annual_leave, annual_leave_granted_current_year,
    created_at, updated_at
FROM employees 
WHERE annual_leave_granted_current_year IS NOT NULL;

-- ======================================
-- 3. 개별 직원 연차 수정
-- ======================================

-- 임소연: 14.5 → 14
DO $$
DECLARE
    target_name VARCHAR := '임소연';
    new_used_leave DECIMAL := 14.0;
    granted_leave DECIMAL;
    rows_updated INTEGER;
BEGIN
    SELECT annual_leave_granted_current_year INTO granted_leave
    FROM employees 
    WHERE name = target_name AND annual_leave_granted_current_year IS NOT NULL;
    
    IF FOUND THEN
        UPDATE employees
        SET 
            used_annual_leave = new_used_leave,
            remaining_annual_leave = granted_leave - new_used_leave,
            updated_at = NOW()
        WHERE name = target_name AND annual_leave_granted_current_year IS NOT NULL;
        
        GET DIAGNOSTICS rows_updated = ROW_COUNT;
        RAISE NOTICE '% 업데이트 완료: 사용연차 = %, 남은연차 = %, 업데이트된 행 = %', 
            target_name, new_used_leave, (granted_leave - new_used_leave), rows_updated;
    ELSE
        RAISE NOTICE '% 직원을 찾을 수 없거나 생성연차가 설정되지 않음', target_name;
    END IF;
END $$;

-- 김경태: 3 → 11
DO $$
DECLARE
    target_name VARCHAR := '김경태';
    new_used_leave DECIMAL := 11.0;
    granted_leave DECIMAL;
    rows_updated INTEGER;
BEGIN
    SELECT annual_leave_granted_current_year INTO granted_leave
    FROM employees 
    WHERE name = target_name AND annual_leave_granted_current_year IS NOT NULL;
    
    IF FOUND THEN
        UPDATE employees
        SET 
            used_annual_leave = new_used_leave,
            remaining_annual_leave = granted_leave - new_used_leave,
            updated_at = NOW()
        WHERE name = target_name AND annual_leave_granted_current_year IS NOT NULL;
        
        GET DIAGNOSTICS rows_updated = ROW_COUNT;
        RAISE NOTICE '% 업데이트 완료: 사용연차 = %, 남은연차 = %, 업데이트된 행 = %', 
            target_name, new_used_leave, (granted_leave - new_used_leave), rows_updated;
    ELSE
        RAISE NOTICE '% 직원을 찾을 수 없거나 생성연차가 설정되지 않음', target_name;
    END IF;
END $$;

-- 김지혜: 7.5 → 8.5
DO $$
DECLARE
    target_name VARCHAR := '김지혜';
    new_used_leave DECIMAL := 8.5;
    granted_leave DECIMAL;
    rows_updated INTEGER;
BEGIN
    SELECT annual_leave_granted_current_year INTO granted_leave
    FROM employees 
    WHERE name = target_name AND annual_leave_granted_current_year IS NOT NULL;
    
    IF FOUND THEN
        UPDATE employees
        SET 
            used_annual_leave = new_used_leave,
            remaining_annual_leave = granted_leave - new_used_leave,
            updated_at = NOW()
        WHERE name = target_name AND annual_leave_granted_current_year IS NOT NULL;
        
        GET DIAGNOSTICS rows_updated = ROW_COUNT;
        RAISE NOTICE '% 업데이트 완료: 사용연차 = %, 남은연차 = %, 업데이트된 행 = %', 
            target_name, new_used_leave, (granted_leave - new_used_leave), rows_updated;
    ELSE
        RAISE NOTICE '% 직원을 찾을 수 없거나 생성연차가 설정되지 않음', target_name;
    END IF;
END $$;

-- 곽병현: 10.5 → 11.5
DO $$
DECLARE
    target_name VARCHAR := '곽병현';
    new_used_leave DECIMAL := 11.5;
    granted_leave DECIMAL;
    rows_updated INTEGER;
BEGIN
    SELECT annual_leave_granted_current_year INTO granted_leave
    FROM employees 
    WHERE name = target_name AND annual_leave_granted_current_year IS NOT NULL;
    
    IF FOUND THEN
        UPDATE employees
        SET 
            used_annual_leave = new_used_leave,
            remaining_annual_leave = granted_leave - new_used_leave,
            updated_at = NOW()
        WHERE name = target_name AND annual_leave_granted_current_year IS NOT NULL;
        
        GET DIAGNOSTICS rows_updated = ROW_COUNT;
        RAISE NOTICE '% 업데이트 완료: 사용연차 = %, 남은연차 = %, 업데이트된 행 = %', 
            target_name, new_used_leave, (granted_leave - new_used_leave), rows_updated;
    ELSE
        RAISE NOTICE '% 직원을 찾을 수 없거나 생성연차가 설정되지 않음', target_name;
    END IF;
END $$;

-- 윤은호: 11 → 11.5
DO $$
DECLARE
    target_name VARCHAR := '윤은호';
    new_used_leave DECIMAL := 11.5;
    granted_leave DECIMAL;
    rows_updated INTEGER;
BEGIN
    SELECT annual_leave_granted_current_year INTO granted_leave
    FROM employees 
    WHERE name = target_name AND annual_leave_granted_current_year IS NOT NULL;
    
    IF FOUND THEN
        UPDATE employees
        SET 
            used_annual_leave = new_used_leave,
            remaining_annual_leave = granted_leave - new_used_leave,
            updated_at = NOW()
        WHERE name = target_name AND annual_leave_granted_current_year IS NOT NULL;
        
        GET DIAGNOSTICS rows_updated = ROW_COUNT;
        RAISE NOTICE '% 업데이트 완료: 사용연차 = %, 남은연차 = %, 업데이트된 행 = %', 
            target_name, new_used_leave, (granted_leave - new_used_leave), rows_updated;
    ELSE
        RAISE NOTICE '% 직원을 찾을 수 없거나 생성연차가 설정되지 않음', target_name;
    END IF;
END $$;

-- 김윤회: 14 → 14.5
DO $$
DECLARE
    target_name VARCHAR := '김윤회';
    new_used_leave DECIMAL := 14.5;
    granted_leave DECIMAL;
    rows_updated INTEGER;
BEGIN
    SELECT annual_leave_granted_current_year INTO granted_leave
    FROM employees 
    WHERE name = target_name AND annual_leave_granted_current_year IS NOT NULL;
    
    IF FOUND THEN
        UPDATE employees
        SET 
            used_annual_leave = new_used_leave,
            remaining_annual_leave = granted_leave - new_used_leave,
            updated_at = NOW()
        WHERE name = target_name AND annual_leave_granted_current_year IS NOT NULL;
        
        GET DIAGNOSTICS rows_updated = ROW_COUNT;
        RAISE NOTICE '% 업데이트 완료: 사용연차 = %, 남은연차 = %, 업데이트된 행 = %', 
            target_name, new_used_leave, (granted_leave - new_used_leave), rows_updated;
    ELSE
        RAISE NOTICE '% 직원을 찾을 수 없거나 생성연차가 설정되지 않음', target_name;
    END IF;
END $$;

-- ======================================
-- 4. 수정 후 결과 확인
-- ======================================
DO $$
BEGIN
    RAISE NOTICE '=== 수정된 직원들 최종 상태 ===';
END $$;

SELECT 
    name as "이름",
    annual_leave_granted_current_year as "생성연차",
    used_annual_leave as "사용연차",
    remaining_annual_leave as "남은연차",
    (annual_leave_granted_current_year - used_annual_leave) as "계산확인"
FROM employees
WHERE name IN ('임소연', '김경태', '김지혜', '곽병현', '윤은호', '김윤회')
  AND annual_leave_granted_current_year IS NOT NULL
ORDER BY name;

-- ======================================
-- 5. 전체 불일치 상태 재확인
-- ======================================
DO $$
BEGIN
    RAISE NOTICE '=== 수정 후 전체 불일치 상태 재확인 ===';
END $$;

WITH leave_summary AS (
    SELECT 
        e.id,
        e.name,
        COUNT(CASE WHEN l.status = 'approved' AND EXTRACT(YEAR FROM l.date) = 2025 AND l.leave_type = 'annual' THEN 1 END) as full_day_count,
        COUNT(CASE WHEN l.status = 'approved' AND EXTRACT(YEAR FROM l.date) = 2025 AND l.leave_type = 'half_am' THEN 1 END) as half_am_count,
        COUNT(CASE WHEN l.status = 'approved' AND EXTRACT(YEAR FROM l.date) = 2025 AND l.leave_type = 'half_pm' THEN 1 END) as half_pm_count
    FROM employees e
    LEFT JOIN leave l ON e.id = l.employee_id
    GROUP BY e.id, e.name
)
SELECT 
    ls.name as "직원명",
    e.used_annual_leave as "현재기록",
    (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5) as "실제사용",
    e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5) as "차이"
FROM leave_summary ls
JOIN employees e ON ls.id = e.id
WHERE e.annual_leave_granted_current_year IS NOT NULL
  AND ABS(e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5)) > 0.01
ORDER BY ABS(e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5)) DESC;

-- ======================================
-- 6. 변경사항 요약
-- ======================================
DO $$
BEGIN
    RAISE NOTICE '=== 변경사항 요약 ===';
END $$;

SELECT 
    eb.name as "직원명",
    eb.used_annual_leave as "수정전",
    e.used_annual_leave as "수정후",
    (e.used_annual_leave - eb.used_annual_leave) as "변경량",
    eb.remaining_annual_leave as "남은연차_수정전",
    e.remaining_annual_leave as "남은연차_수정후"
FROM employees_backup_20250125_discrepancy eb
JOIN employees e ON eb.id = e.id
WHERE eb.name IN ('임소연', '김경태', '김지혜', '곽병현', '윤은호', '김윤회')
  AND (eb.used_annual_leave != e.used_annual_leave OR eb.remaining_annual_leave != e.remaining_annual_leave)
ORDER BY eb.name;

-- ======================================
-- 완료 메시지
-- ======================================
DO $$
BEGIN
    RAISE NOTICE '🎉 연차 불일치 수정 마이그레이션 완료!';
    RAISE NOTICE '백업 테이블: employees_backup_20250125_discrepancy';
END $$;