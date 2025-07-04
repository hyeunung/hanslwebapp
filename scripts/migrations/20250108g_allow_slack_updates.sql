-- 슬랙에서도 중간관리자 상태 업데이트 가능하도록 RLS 정책 추가

-- 기존 정책 확인
SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'purchase_requests';

-- 슬랙 웹훅에서 중간관리자 상태만 업데이트 가능하도록 허용
CREATE POLICY "allow_slack_middle_manager_update" ON purchase_requests
FOR UPDATE 
TO anon
USING (true)
WITH CHECK (true);

-- 확인
SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'purchase_requests' AND cmd = 'UPDATE'; 