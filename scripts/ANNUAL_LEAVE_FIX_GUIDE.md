# 연차 불일치 수정 가이드

## 개요

`leave` 테이블의 실제 연차 사용량과 `employees` 테이블의 `used_annual_leave` 값이 불일치하는 문제를 해결하는 마이그레이션입니다.

## 문제 현황

다음 직원들의 연차 데이터가 불일치 상태입니다:

| 직원명 | 현재 기록 | 실제 사용량 | 차이 | 수정 후 |
|--------|-----------|-------------|------|---------|
| 임소연 | 14.5 | 14.0 | +0.5 | 14.0 |
| 김경태 | 3.0 | 11.0 | -8.0 | 11.0 |
| 김지혜 | 7.5 | 8.5 | -1.0 | 8.5 |
| 곽병현 | 10.5 | 11.5 | -1.0 | 11.5 |
| 윤은호 | 11.0 | 11.5 | -0.5 | 11.5 |
| 김윤회 | 14.0 | 14.5 | -0.5 | 14.5 |

## 실행 방법

### 방법 1: Supabase SQL Editor에서 직접 실행

1. Supabase 프로젝트 대시보드에 접속
2. SQL Editor 메뉴 선택
3. `scripts/migrations/20250125_fix_annual_leave_discrepancy.sql` 파일 내용을 복사
4. SQL Editor에 붙여넣기 후 실행

### 방법 2: 마이그레이션 스크립트 사용 (현재 네트워크 문제로 불가)

```bash
# 환경변수 설정 후 실행
SUPABASE_SERVICE_ROLE_KEY=your_service_key node scripts/execute-migration.js scripts/migrations/20250125_fix_annual_leave_discrepancy.sql
```

## 실행 결과 확인

스크립트 실행 후 다음과 같은 결과를 확인할 수 있습니다:

### 1. 수정 전 불일치 상태 확인
```sql
-- 불일치가 있는 직원들의 현재 상태와 실제 사용량 비교
```

### 2. 백업 테이블 생성
- `employees_backup_20250125_discrepancy` 테이블에 수정 전 데이터 백업

### 3. 개별 직원 업데이트 로그
```
임소연 업데이트 완료: 사용연차 = 14, 남은연차 = 9, 업데이트된 행 = 1
김경태 업데이트 완료: 사용연차 = 11, 남은연차 = 9, 업데이트된 행 = 1
...
```

### 4. 수정 후 최종 상태
수정된 직원들의 최종 연차 상태 확인

### 5. 전체 불일치 재확인
수정 후에도 불일치가 남아있는 직원이 있는지 확인

### 6. 변경사항 요약
수정 전/후 비교표

## 안전장치

1. **백업 테이블**: `employees_backup_20250125_discrepancy`에 수정 전 데이터 보관
2. **조건부 업데이트**: `annual_leave_granted_current_year`가 설정된 직원만 업데이트
3. **로그 출력**: 각 단계마다 상세한 로그 출력
4. **검증 쿼리**: 수정 후 결과 확인을 위한 다양한 검증 쿼리

## 롤백 방법

문제가 발생한 경우 백업 테이블에서 복원:

```sql
-- 특정 직원 롤백
UPDATE employees 
SET 
    used_annual_leave = backup.used_annual_leave,
    remaining_annual_leave = backup.remaining_annual_leave,
    updated_at = NOW()
FROM employees_backup_20250125_discrepancy backup
WHERE employees.id = backup.id 
  AND employees.name = '직원명';

-- 전체 롤백
UPDATE employees 
SET 
    used_annual_leave = backup.used_annual_leave,
    remaining_annual_leave = backup.remaining_annual_leave,
    updated_at = NOW()
FROM employees_backup_20250125_discrepancy backup
WHERE employees.id = backup.id;
```

## 주의사항

1. **프로덕션 환경**에서 실행하기 전에 백업을 권장합니다
2. **피크 시간대** 이외에 실행을 권장합니다
3. 실행 후 **연차 관련 기능**들이 정상 작동하는지 확인하세요
4. **트리거**가 있다면 업데이트 시 동작을 확인하세요

## 파일 목록

- `scripts/migrations/20250125_fix_annual_leave_discrepancy.sql` - 메인 마이그레이션 파일
- `scripts/simple-annual-leave-update.cjs` - JavaScript 실행 스크립트 (네트워크 문제로 현재 사용 불가)
- `scripts/ANNUAL_LEAVE_FIX_GUIDE.md` - 이 가이드 파일