-- 연차 불일치 상태 확인 및 수정 스크립트
-- 실행일: 2025-01-25

-- 1. 현재 불일치 상태 확인
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
    '=== 불일치 상태 확인 ===' as section,
    ls.name,
    e.used_annual_leave as "현재_기록",
    (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5) as "실제_사용",
    e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5) as "차이"
FROM leave_summary ls
JOIN employees e ON ls.id = e.id
WHERE e.annual_leave_granted_current_year IS NOT NULL
  AND ABS(e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5)) > 0.01
ORDER BY ABS(e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5)) DESC;

-- 2. 수정 전 백업 테이블 생성
CREATE TABLE IF NOT EXISTS employees_backup_20250125 AS 
SELECT * FROM employees WHERE annual_leave_granted_current_year IS NOT NULL;

-- 3. 각 직원별 연차 수정

-- 임소연 수정 (14.5 → 14)
UPDATE employees
SET 
    used_annual_leave = 14,
    remaining_annual_leave = annual_leave_granted_current_year - 14,
    updated_at = NOW()
WHERE name = '임소연'
  AND annual_leave_granted_current_year IS NOT NULL;

-- 김경태 수정 (3 → 11) 
UPDATE employees
SET 
    used_annual_leave = 11,
    remaining_annual_leave = annual_leave_granted_current_year - 11,
    updated_at = NOW()
WHERE name = '김경태'
  AND annual_leave_granted_current_year IS NOT NULL;

-- 김지혜 수정 (7.5 → 8.5)
UPDATE employees
SET 
    used_annual_leave = 8.5,
    remaining_annual_leave = annual_leave_granted_current_year - 8.5,
    updated_at = NOW()
WHERE name = '김지혜'
  AND annual_leave_granted_current_year IS NOT NULL;

-- 곽병현 수정 (10.5 → 11.5)
UPDATE employees
SET 
    used_annual_leave = 11.5,
    remaining_annual_leave = annual_leave_granted_current_year - 11.5,
    updated_at = NOW()
WHERE name = '곽병현'
  AND annual_leave_granted_current_year IS NOT NULL;

-- 윤은호 수정 (11 → 11.5)
UPDATE employees
SET 
    used_annual_leave = 11.5,
    remaining_annual_leave = annual_leave_granted_current_year - 11.5,
    updated_at = NOW()
WHERE name = '윤은호'
  AND annual_leave_granted_current_year IS NOT NULL;

-- 김윤회 수정 (14 → 14.5)
UPDATE employees
SET 
    used_annual_leave = 14.5,
    remaining_annual_leave = annual_leave_granted_current_year - 14.5,
    updated_at = NOW()
WHERE name = '김윤회'
  AND annual_leave_granted_current_year IS NOT NULL;

-- 4. 수정 후 결과 확인
SELECT 
    '=== 수정 완료된 직원 확인 ===' as section,
    name,
    annual_leave_granted_current_year as "생성연차",
    used_annual_leave as "사용연차",
    remaining_annual_leave as "남은연차",
    (annual_leave_granted_current_year - used_annual_leave) as "계산확인"
FROM employees
WHERE name IN ('임소연', '김경태', '김지혜', '곽병현', '윤은호', '김윤회')
  AND annual_leave_granted_current_year IS NOT NULL
ORDER BY name;

-- 5. 전체 불일치 상태 재확인
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
    '=== 수정 후 불일치 상태 재확인 ===' as section,
    ls.name,
    e.used_annual_leave as "현재_기록",
    (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5) as "실제_사용",
    e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5) as "차이"
FROM leave_summary ls
JOIN employees e ON ls.id = e.id
WHERE e.annual_leave_granted_current_year IS NOT NULL
  AND ABS(e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5)) > 0.01
ORDER BY ABS(e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5)) DESC;

-- 6. 수정 내역 요약
SELECT 
    '=== 수정 내역 요약 ===' as section,
    eb.name,
    eb.used_annual_leave as "수정_전",
    e.used_annual_leave as "수정_후",
    (e.used_annual_leave - eb.used_annual_leave) as "변경량"
FROM employees_backup_20250125 eb
JOIN employees e ON eb.id = e.id
WHERE eb.name IN ('임소연', '김경태', '김지혜', '곽병현', '윤은호', '김윤회')
  AND eb.used_annual_leave != e.used_annual_leave
ORDER BY eb.name;