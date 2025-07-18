-- employees 테이블에서 hire_date 컬럼 제거
-- join_date와 중복되는 컬럼이므로 삭제
-- 실제 UI에서는 join_date만 "입사일"로 사용됨

ALTER TABLE employees DROP COLUMN IF EXISTS hire_date; 