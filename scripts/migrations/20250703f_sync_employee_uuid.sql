-- 20250703f_sync_employee_uuid.sql
-- Align employees.id (uuid) with auth.users.id based on email
-- Steps:
-- 1. Identify mismatched rows (same email, different uuid)
-- 2. Insert missing employees row with new uuid if not exists
-- 3. Re-point purchase_requests.requester_id to new uuid
-- 4. Delete obsolete employees row

-- 1 & 2. Insert rows for mismatched users
INSERT INTO employees (id, name, email, purchase_role, slack_id)
SELECT u.id,
       COALESCE(e.name, split_part(u.email, '@', 1)),
       u.email,
       COALESCE(e.purchase_role, '{middle_manager}'::text[]),
       e.slack_id
FROM auth.users u
JOIN employees e ON e.email = u.email
WHERE e.id <> u.id
  AND NOT EXISTS (
      SELECT 1 FROM employees ex WHERE ex.id = u.id
  );

-- 3. Update purchase_requests requester_id to new uuid
UPDATE purchase_requests pr
SET requester_id = u.id
FROM auth.users u
JOIN employees e ON e.email = u.email
WHERE e.id <> u.id
  AND pr.requester_id = e.id;

-- 4. Delete obsolete employees rows (those whose email matches a different uuid now)
DELETE FROM employees e
USING auth.users u
WHERE e.email = u.email
  AND e.id <> u.id; 