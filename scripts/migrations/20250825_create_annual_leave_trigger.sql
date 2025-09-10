-- 자동 연차 계산 트리거 함수 생성
CREATE OR REPLACE FUNCTION calculate_remaining_annual_leave()
RETURNS TRIGGER AS $$
BEGIN
    NEW.remaining_annual_leave := COALESCE(NEW.annual_leave_granted_current_year, 0) - COALESCE(NEW.used_annual_leave, 0);
    IF NEW.remaining_annual_leave < 0 THEN
        NEW.remaining_annual_leave := 0;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 후 새로 생성
DROP TRIGGER IF EXISTS auto_calculate_remaining_leave ON employees;

CREATE TRIGGER auto_calculate_remaining_leave
BEFORE INSERT OR UPDATE OF annual_leave_granted_current_year, used_annual_leave, used_bereavement_leave
ON employees
FOR EACH ROW
EXECUTE FUNCTION calculate_remaining_annual_leave();

-- 현재 불일치 데이터 수정
UPDATE employees
SET 
    remaining_annual_leave = annual_leave_granted_current_year - COALESCE(used_annual_leave, 0),
    updated_at = NOW()
WHERE annual_leave_granted_current_year IS NOT NULL
  AND (remaining_annual_leave != (annual_leave_granted_current_year - COALESCE(used_annual_leave, 0)));