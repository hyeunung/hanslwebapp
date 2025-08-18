import { createClient } from '@supabase/supabase-js';

// Direct configuration - using the values from the env file
const supabaseUrl = 'https://qvhbigvdfyvhoegkhvef.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzgxNDM2MCwiZXhwIjoyMDYzMzkwMzYwfQ.BrNMjHpH8HQoZ9rSgCWDczL5HHJR5o7h3cGzKG02qnI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function recalculateAnnualLeave() {
  try {
    console.log('🔄 연차 재계산 시작...');
    
    // Step 1: Get all employees first to understand the data
    console.log('📊 현재 직원 데이터 조회...');
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, name, annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave')
      .order('name');
    
    if (empError) {
      console.error('❌ 직원 데이터 조회 실패:', empError);
      return;
    }
    
    console.log(`📈 총 ${employees.length}명의 직원 발견`);
    
    // Step 2: For each employee, calculate their used annual leave
    const currentYear = new Date().getFullYear();
    console.log(`📅 ${currentYear}년도 연차 재계산 중...`);
    
    const updates = [];
    
    for (const employee of employees) {
      console.log(`🔍 ${employee.name} 처리 중...`);
      
      // Count approved leaves for current year
      const { data: leaves, error: leaveError } = await supabase
        .from('leave')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('status', 'approved')
        .gte('date', `${currentYear}-01-01`)
        .lte('date', `${currentYear}-12-31`);
      
      if (leaveError) {
        console.error(`❌ ${employee.name}의 연차 데이터 조회 실패:`, leaveError);
        continue;
      }
      
      const usedAnnualLeave = leaves ? leaves.length : 0;
      const grantedLeave = employee.annual_leave_granted_current_year || 0;
      const remainingLeave = Math.max(0, grantedLeave - usedAnnualLeave);
      
      console.log(`   생성연차: ${grantedLeave}, 사용연차: ${usedAnnualLeave}, 남은연차: ${remainingLeave}`);
      
      // Update the employee
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          used_annual_leave: usedAnnualLeave,
          remaining_annual_leave: remainingLeave
        })
        .eq('id', employee.id);
      
      if (updateError) {
        console.error(`❌ ${employee.name} 업데이트 실패:`, updateError);
      } else {
        console.log(`✅ ${employee.name} 업데이트 완료`);
        updates.push({
          이름: employee.name,
          생성연차: grantedLeave,
          사용연차: usedAnnualLeave,
          남은연차: remainingLeave
        });
      }
    }
    
    // Step 3: Show final results
    console.log('\n📊 업데이트 결과:');
    console.table(updates);
    
    console.log(`\n✅ 연차 재계산 완료! (총 ${updates.length}명 업데이트)`);
    
  } catch (error) {
    console.error('❌ 예상치 못한 오류:', error);
  }
}

recalculateAnnualLeave();