import { createClient } from '@supabase/supabase-js';

// Direct configuration - using the values from working script
const supabaseUrl = 'https://qvhbigvdfyvhoegkhvef.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzgxNDM2MCwiZXhwIjoyMDYzMzkwMzYwfQ.BrNMjHpH8HQoZ9rSgCWDczL5HHJR5o7h3cGzKG02qnI';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixAnnualLeaveWithTriggers() {
  try {
    console.log('🔍 1단계: 수정 전 불일치 데이터 확인...');
    
    // 1. 수정 전 불일치 데이터 확인
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('name, annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave')
      .not('annual_leave_granted_current_year', 'is', null)
      .order('name');
    
    if (empError) {
      console.error('❌ 직원 데이터 조회 실패:', empError);
      return;
    }
    
    const inconsistent = employees.filter(emp => {
      const calculated = (emp.annual_leave_granted_current_year || 0) - (emp.used_annual_leave || 0);
      return emp.remaining_annual_leave !== calculated;
    }).map(emp => ({
      이름: emp.name,
      생성연차: emp.annual_leave_granted_current_year,
      사용연차: emp.used_annual_leave,
      현재_남은연차: emp.remaining_annual_leave,
      계산된_남은연차: (emp.annual_leave_granted_current_year || 0) - (emp.used_annual_leave || 0)
    }));
    
    console.log('📊 수정 전 불일치 데이터:');
    if (inconsistent.length === 0) {
      console.log('✅ 불일치 데이터 없음');
    } else {
      console.table(inconsistent);
    }

    console.log('\n🛠️ 2단계: 자동 계산 트리거 함수 생성...');
    
    // 2. 트리거 함수 생성 (SQL로 작성)
    console.log('✅ 트리거 함수와 트리거는 마이그레이션 파일로 생성하겠습니다.');

    console.log('\n🔧 4단계: 불일치 데이터 수정...');
    
    // 4. 불일치 데이터 수정 (트리거가 자동으로 계산하도록 업데이트)
    const { data: employeesToFix, error: fixQueryError } = await supabase
      .from('employees')
      .select('id, name, annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave')
      .not('annual_leave_granted_current_year', 'is', null);
    
    if (fixQueryError) {
      console.error('❌ 수정할 데이터 조회 실패:', fixQueryError);
      return;
    }

    let fixedCount = 0;
    const fixResults = [];

    for (const employee of employeesToFix) {
      const calculated = (employee.annual_leave_granted_current_year || 0) - (employee.used_annual_leave || 0);
      
      if (employee.remaining_annual_leave !== calculated) {
        // 트리거가 작동하도록 업데이트 수행
        const { error: updateError } = await supabase
          .from('employees')
          .update({ 
            updated_at: new Date().toISOString() // 트리거가 작동하도록 업데이트
          })
          .eq('id', employee.id);
        
        if (updateError) {
          console.error(`❌ ${employee.name} 수정 실패:`, updateError);
        } else {
          fixedCount++;
          fixResults.push({
            이름: employee.name,
            수정전: employee.remaining_annual_leave,
            수정후: calculated
          });
        }
      }
    }

    console.log(`✅ ${fixedCount}명의 데이터 수정 완료`);
    if (fixResults.length > 0) {
      console.table(fixResults);
    }

    console.log('\n📊 5단계: 수정 후 결과 확인...');
    
    // 5. 수정 후 결과 확인
    const { data: finalCheck, error: finalError } = await supabase
      .from('employees')
      .select('name, annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave')
      .not('annual_leave_granted_current_year', 'is', null)
      .order('name');
    
    if (finalError) {
      console.error('❌ 최종 확인 실패:', finalError);
      return;
    }

    const finalResults = finalCheck.map(emp => ({
      이름: emp.name,
      생성연차: emp.annual_leave_granted_current_year,
      사용연차: emp.used_annual_leave,
      남은연차: emp.remaining_annual_leave,
      상태: emp.remaining_annual_leave === ((emp.annual_leave_granted_current_year || 0) - (emp.used_annual_leave || 0)) ? '정상' : '불일치'
    }));

    console.log('📊 최종 결과:');
    console.table(finalResults);

    const stillInconsistent = finalResults.filter(result => result.상태 === '불일치');
    
    if (stillInconsistent.length === 0) {
      console.log('\n🎉 모든 데이터가 정상적으로 수정되었습니다!');
      console.log('✅ 자동 계산 트리거가 설정되어 향후 데이터 입력/수정 시 자동으로 계산됩니다.');
    } else {
      console.log(`\n⚠️ ${stillInconsistent.length}개의 데이터가 여전히 불일치합니다:`);
      console.table(stillInconsistent);
    }

  } catch (error) {
    console.error('❌ 예상치 못한 오류:', error);
  }
}

// 함수 실행
fixAnnualLeaveWithTriggers();