import { createClient } from '@supabase/supabase-js';

// Direct configuration
const supabaseUrl = 'https://wdqvzjfuatjqfabxvkqz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkcXZ6amZ1YXRqcWZhYnh2a3F6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzE1MDIxNywiZXhwIjoyMDMyNzI2MjE3fQ.wUwNBBDdpT5s5E1MHdGqVrMhIGtPtXxbwAFcBJW7qzI';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixAnnualLeave() {
  try {
    console.log('🔍 1단계: 수정 전 불일치 데이터 확인...');
    
    // 1. 불일치 데이터 확인
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

    console.log('\n🔧 2단계: 불일치 데이터 수정...');
    
    // 2. 불일치 데이터 수정
    let fixedCount = 0;
    
    for (const employee of employees) {
      const calculated = (employee.annual_leave_granted_current_year || 0) - (employee.used_annual_leave || 0);
      
      if (employee.remaining_annual_leave !== calculated) {
        const { error: updateError } = await supabase
          .from('employees')
          .update({ 
            remaining_annual_leave: calculated,
            updated_at: new Date().toISOString()
          })
          .eq('name', employee.name);
        
        if (updateError) {
          console.error(`❌ ${employee.name} 수정 실패:`, updateError);
        } else {
          fixedCount++;
          console.log(`✅ ${employee.name}: ${employee.remaining_annual_leave} → ${calculated}`);
        }
      }
    }

    console.log(`\n✅ ${fixedCount}명의 데이터 수정 완료`);

    console.log('\n📊 3단계: 수정 후 결과 확인...');
    
    // 3. 수정 후 결과 확인
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
      console.log('\n⚠️  참고: 자동 계산 트리거 설정을 위해 다음 SQL을 Supabase Dashboard에서 실행해주세요:');
      console.log('\n-- 자동 연차 계산 트리거 함수 생성');
      console.log('CREATE OR REPLACE FUNCTION calculate_remaining_annual_leave()');
      console.log('RETURNS TRIGGER AS $$');
      console.log('BEGIN');
      console.log('    NEW.remaining_annual_leave := COALESCE(NEW.annual_leave_granted_current_year, 0) - COALESCE(NEW.used_annual_leave, 0);');
      console.log('    IF NEW.remaining_annual_leave < 0 THEN');
      console.log('        NEW.remaining_annual_leave := 0;');
      console.log('    END IF;');
      console.log('    NEW.updated_at := NOW();');
      console.log('    RETURN NEW;');
      console.log('END;');
      console.log('$$ LANGUAGE plpgsql;');
      console.log('');
      console.log('-- 트리거 생성');
      console.log('DROP TRIGGER IF EXISTS auto_calculate_remaining_leave ON employees;');
      console.log('');
      console.log('CREATE TRIGGER auto_calculate_remaining_leave');
      console.log('BEFORE INSERT OR UPDATE OF annual_leave_granted_current_year, used_annual_leave, used_bereavement_leave');
      console.log('ON employees');
      console.log('FOR EACH ROW');
      console.log('EXECUTE FUNCTION calculate_remaining_annual_leave();');
    } else {
      console.log(`\n⚠️ ${stillInconsistent.length}개의 데이터가 여전히 불일치합니다:`);
      console.table(stillInconsistent);
    }

  } catch (error) {
    console.error('❌ 예상치 못한 오류:', error);
  }
}

// 함수 실행
fixAnnualLeave();