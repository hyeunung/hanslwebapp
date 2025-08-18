import { createClient } from '@supabase/supabase-js';

// Using the working service key from the Supabase functions
const supabaseUrl = 'https://qvhbigvdfyvhoegkhvef.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzgxNDM2MCwiZXhwIjoyMDYzMzkwMzYwfQ.dVuv-NnGPYhKuG4Y7ixNOIgp2WvIKyaQ8YBP8_cXCqs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function recalculateAnnualLeave() {
  try {
    console.log('🔄 연차 재계산 시작...');
    
    // Test connection first
    console.log('🔌 데이터베이스 연결 테스트...');
    const { data: testData, error: testError } = await supabase
      .from('employees')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ 데이터베이스 연결 실패:', testError);
      return;
    }
    
    console.log('✅ 데이터베이스 연결 성공');
    
    // Step 1: Get all employees
    console.log('📊 직원 데이터 조회...');
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, name, annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave')
      .order('name');
    
    if (empError) {
      console.error('❌ 직원 데이터 조회 실패:', empError);
      return;
    }
    
    console.log(`📈 총 ${employees.length}명의 직원 발견`);
    
    // Show current state
    console.log('\n📊 현재 연차 상태:');
    console.table(employees.map(emp => ({
      이름: emp.name,
      생성연차: emp.annual_leave_granted_current_year || 0,
      사용연차: emp.used_annual_leave || 0,
      남은연차: emp.remaining_annual_leave || 0
    })));
    
    // Step 2: Recalculate for each employee
    const currentYear = new Date().getFullYear();
    console.log(`\n📅 ${currentYear}년도 연차 재계산 중...`);
    
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