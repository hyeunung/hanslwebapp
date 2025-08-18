import { createClient } from '@supabase/supabase-js';

// Supabase 설정
const supabaseUrl = 'https://qvhbigvdfyvhoegkhvef.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzgxNDM2MCwiZXhwIjoyMDYzMzkwMzYwfQ.BrNMjHpH8HQoZ9rSgCWDczL5HHJR5o7h3cGzKG02qnI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function recalculateAnnualLeave() {
  try {
    console.log('🔄 연차 재계산 시작...');
    
    // 1. 먼저 현재 상태 확인
    const { data: beforeEmployees, error: beforeError } = await supabase
      .from('employees')
      .select('id, name, annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave')
      .order('name');
    
    if (beforeError) {
      console.error('❌ 초기 데이터 조회 실패:', beforeError);
      return;
    }
    
    console.log('\n📊 현재 연차 현황:');
    console.table(beforeEmployees.map(emp => ({
      이름: emp.name,
      생성연차: emp.annual_leave_granted_current_year || 0,
      사용연차: emp.used_annual_leave || 0,
      남은연차: emp.remaining_annual_leave || 0
    })));
    
    // 2. 각 직원별로 사용연차 재계산
    for (const employee of beforeEmployees) {
      // leave 테이블에서 올해 승인된 연차 집계
      const currentYear = new Date().getFullYear();
      const { data: leaves, error: leaveError } = await supabase
        .from('leave')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('status', 'approved')
        .gte('date', `${currentYear}-01-01`)
        .lte('date', `${currentYear}-12-31`);
      
      if (leaveError) {
        console.error(`❌ ${employee.name}의 연차 조회 실패:`, leaveError);
        continue;
      }
      
      const usedAnnualLeave = leaves ? leaves.length : 0;
      const remainingAnnualLeave = (employee.annual_leave_granted_current_year || 0) - usedAnnualLeave;
      
      // 업데이트
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          used_annual_leave: usedAnnualLeave,
          remaining_annual_leave: Math.max(0, remainingAnnualLeave) // 음수 방지
        })
        .eq('id', employee.id);
      
      if (updateError) {
        console.error(`❌ ${employee.name} 업데이트 실패:`, updateError);
      } else {
        console.log(`✅ ${employee.name}: 사용연차=${usedAnnualLeave}, 남은연차=${Math.max(0, remainingAnnualLeave)}`);
      }
    }
    
    // 3. 최종 결과 확인
    const { data: afterEmployees, error: afterError } = await supabase
      .from('employees')
      .select('name, annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave')
      .order('name');
    
    if (afterError) {
      console.error('❌ 최종 데이터 조회 실패:', afterError);
    } else {
      console.log('\n📊 업데이트된 연차 현황:');
      console.table(afterEmployees.map(emp => ({
        이름: emp.name,
        생성연차: emp.annual_leave_granted_current_year || 0,
        사용연차: emp.used_annual_leave || 0,
        남은연차: emp.remaining_annual_leave || 0
      })));
    }
    
    console.log('\n✅ 연차 재계산 완료!');
    
  } catch (error) {
    console.error('❌ 예상치 못한 오류:', error);
  }
}

recalculateAnnualLeave();