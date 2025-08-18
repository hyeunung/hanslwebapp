-- 20250819_recalculate_remaining_annual_leave.sql
-- Migration to recalculate annual leave for all employees

-- Step 1: Update used_annual_leave for all employees based on approved leaves from the 'leave' table for the current year
UPDATE employees e
SET used_annual_leave = COALESCE((
    SELECT COUNT(*)
    FROM leave l
    WHERE l.employee_id = e.id
    AND EXTRACT(YEAR FROM l.date) = EXTRACT(YEAR FROM CURRENT_DATE)
    AND l.status = 'approved'
), 0);

-- Step 2: Update remaining_annual_leave by subtracting used from granted
UPDATE employees
SET remaining_annual_leave = COALESCE(annual_leave_granted_current_year, 0) - COALESCE(used_annual_leave, 0)
WHERE annual_leave_granted_current_year IS NOT NULL;

-- Step 3: Fix any negative values
UPDATE employees 
SET remaining_annual_leave = 0 
WHERE remaining_annual_leave < 0;

-- Step 4: Query to verify the results
SELECT name, annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave
FROM employees
WHERE annual_leave_granted_current_year IS NOT NULL
ORDER BY name;