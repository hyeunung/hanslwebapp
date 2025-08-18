import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Supabase 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Using Supabase URL:', supabaseUrl);
console.log('Service key present:', !!supabaseServiceKey);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL(sql, description) {
  try {
    console.log(`🔄 ${description}...`);
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error(`❌ ${description} 실패:`, error);
      return null;
    }
    
    console.log(`✅ ${description} 성공`);
    return data;
  } catch (err) {
    console.error(`❌ ${description} 예외:`, err);
    return null;
  }
}

async function recalculateAnnualLeave() {
  try {
    console.log('🔄 연차 재계산 시작...');
    
    // Step 1: Update used_annual_leave
    const step1SQL = `
      UPDATE employees e
      SET used_annual_leave = COALESCE((
          SELECT COUNT(*)
          FROM leave l
          WHERE l.employee_id = e.id
          AND EXTRACT(YEAR FROM l.date) = EXTRACT(YEAR FROM CURRENT_DATE)
          AND l.status = 'approved'
      ), 0);
    `;
    
    await executeSQL(step1SQL, '사용 연차 업데이트');
    
    // Step 2: Update remaining_annual_leave
    const step2SQL = `
      UPDATE employees
      SET remaining_annual_leave = COALESCE(annual_leave_granted_current_year, 0) - COALESCE(used_annual_leave, 0)
      WHERE annual_leave_granted_current_year IS NOT NULL;
    `;
    
    await executeSQL(step2SQL, '남은 연차 업데이트');
    
    // Step 3: Fix negative values
    const step3SQL = `
      UPDATE employees 
      SET remaining_annual_leave = 0 
      WHERE remaining_annual_leave < 0;
    `;
    
    await executeSQL(step3SQL, '음수 값 수정');
    
    // Step 4: Get final results
    console.log('📊 최종 결과 조회...');
    const { data: results, error } = await supabase
      .from('employees')
      .select('name, annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave')
      .not('annual_leave_granted_current_year', 'is', null)
      .order('name');
    
    if (error) {
      console.error('❌ 최종 결과 조회 실패:', error);
    } else {
      console.log('\n📊 업데이트된 연차 현황:');
      console.table(results.map(emp => ({
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