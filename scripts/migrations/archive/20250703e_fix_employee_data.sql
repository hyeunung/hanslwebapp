-- 20250703e_fix_employee_data.sql
-- Ensure each auth user has a corresponding employees row and open select policy for authenticated role.

-- 1. Insert missing employees records based on auth.users
INSERT INTO employees (id, name, email, purchase_role)
SELECT u.id,
       split_part(u.email, '@', 1) AS name,
       u.email,
       '{middle_manager}'::text[]
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.id = u.id
);

-- 2. Ensure SELECT access for authenticated users (if not already)
DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename  = 'employees'
        AND policyname = 'allow_all_select_employees'
  ) THEN
    CREATE POLICY allow_all_select_employees ON employees
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$; 