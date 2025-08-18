const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase 설정
const supabaseUrl = 'https://qvhbigvdfyvhoegkhvef.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzgxNDM2MCwiZXhwIjoyMDYzMzkwMzYwfQ.BrNMjHpH8HQoZ9rSgCWDczL5HHJR5o7h3cGzKG02qnI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeMigration() {
  try {
    // SQL 파일 읽기
    const sqlPath = path.join(__dirname, 'migrations', '20250819_recalculate_remaining_annual_leave.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('🔄 연차 재계산 SQL 실행 중...');
    
    // SQL 문을 세미콜론으로 분리하여 각각 실행
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim() && !statement.trim().startsWith('--')) {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: statement.trim()
        });
        
        if (error) {
          console.error('❌ SQL 실행 오류:', error);
          throw error;
        }
      }
    }
    
    console.log('✅ 연차 재계산 완료!');
    
    // 결과 확인
    const { data: employees, error: fetchError } = await supabase
      .from('employees')
      .select('name, annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave')
      .order('name');
    
    if (fetchError) {
      console.error('❌ 결과 조회 오류:', fetchError);
    } else {
      console.log('\n📊 연차 현황:');
      console.table(employees.map(emp => ({
        이름: emp.name,
        생성연차: emp.annual_leave_granted_current_year || 0,
        사용연차: emp.used_annual_leave || 0,
        남은연차: emp.remaining_annual_leave || 0
      })));
    }
    
  } catch (error) {
    console.error('❌ 마이그레이션 실행 실패:', error);
    process.exit(1);
  }
}

executeMigration();