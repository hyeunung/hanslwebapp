# 연차 데이터 수정 및 자동 계산 트리거 설정 가이드

Supabase API 연결에 문제가 있어 수동으로 SQL을 실행해야 합니다.

## 1단계: 수정 전 불일치 데이터 확인

다음 SQL을 Supabase Dashboard → SQL Editor에서 실행하세요:

```sql
-- 1. 수정 전 불일치 데이터 확인
SELECT 
    name as "이름",
    annual_leave_granted_current_year as "생성연차",
    used_annual_leave as "사용연차",
    remaining_annual_leave as "현재_남은연차",
    (annual_leave_granted_current_year - COALESCE(used_annual_leave, 0)) as "계산된_남은연차"
FROM employees
WHERE annual_leave_granted_current_year IS NOT NULL
  AND (remaining_annual_leave != (annual_leave_granted_current_year - COALESCE(used_annual_leave, 0)))
ORDER BY name;
```

## 2단계: 불일치 데이터 수정

```sql
-- 2. 불일치 데이터 수정
UPDATE employees
SET 
    remaining_annual_leave = annual_leave_granted_current_year - COALESCE(used_annual_leave, 0),
    updated_at = NOW()
WHERE annual_leave_granted_current_year IS NOT NULL
  AND (remaining_annual_leave != (annual_leave_granted_current_year - COALESCE(used_annual_leave, 0)));
```

## 3단계: 자동 계산 트리거 함수 생성

```sql
-- 3. 자동 계산 트리거 함수 생성
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
```

## 4단계: 트리거 생성

```sql
-- 4. 트리거 생성
DROP TRIGGER IF EXISTS auto_calculate_remaining_leave ON employees;

CREATE TRIGGER auto_calculate_remaining_leave
BEFORE INSERT OR UPDATE OF annual_leave_granted_current_year, used_annual_leave, used_bereavement_leave
ON employees
FOR EACH ROW
EXECUTE FUNCTION calculate_remaining_annual_leave();
```

## 5단계: 수정 후 결과 확인

```sql
-- 5. 수정 후 결과 확인
SELECT 
    name as "이름",
    annual_leave_granted_current_year as "생성연차",
    used_annual_leave as "사용연차",
    remaining_annual_leave as "남은연차",
    CASE 
        WHEN remaining_annual_leave = (annual_leave_granted_current_year - COALESCE(used_annual_leave, 0))
        THEN '정상'
        ELSE '불일치'
    END as "상태"
FROM employees
WHERE annual_leave_granted_current_year IS NOT NULL
ORDER BY name;
```

## 실행 순서

1. **1단계** SQL 실행 → 불일치 데이터 확인 및 기록
2. **3단계** SQL 실행 → 트리거 함수 생성
3. **4단계** SQL 실행 → 트리거 생성
4. **2단계** SQL 실행 → 데이터 수정 (트리거가 자동 작동)
5. **5단계** SQL 실행 → 최종 결과 확인

## 예상 결과

- 불일치 데이터가 자동으로 수정됩니다
- 향후 `annual_leave_granted_current_year`, `used_annual_leave`, `used_bereavement_leave` 필드가 수정될 때마다 `remaining_annual_leave`가 자동으로 계산됩니다
- `remaining_annual_leave`는 음수가 될 수 없도록 보장됩니다