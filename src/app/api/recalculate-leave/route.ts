import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🔄 연차 재계산 시작...');
    
    // 1. 현재 상태 확인
    const { data: beforeEmployees, error: beforeError } = await supabase
      .from('employees')
      .select('id, name, annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave')
      .order('name');
    
    if (beforeError) {
      return NextResponse.json({ error: '초기 데이터 조회 실패', details: beforeError }, { status: 500 });
    }
    
    const results: Array<{
      name: string;
      status: 'success' | 'failed';
      used?: number;
      remaining?: number;
      error?: any;
    }> = [];
    
    // 2. 각 직원별로 사용연차 재계산
    for (const employee of beforeEmployees || []) {
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
        results.push({ name: employee.name, status: 'failed', error: updateError });
      } else {
        console.log(`✅ ${employee.name}: 사용연차=${usedAnnualLeave}, 남은연차=${Math.max(0, remainingAnnualLeave)}`);
        results.push({ 
          name: employee.name, 
          status: 'success', 
          used: usedAnnualLeave, 
          remaining: Math.max(0, remainingAnnualLeave) 
        });
      }
    }
    
    // 3. 최종 결과 확인
    const { data: afterEmployees, error: afterError } = await supabase
      .from('employees')
      .select('name, annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave')
      .order('name');
    
    return NextResponse.json({
      success: true,
      message: '연차 재계산 완료',
      results,
      finalData: afterEmployees
    });
    
  } catch (error) {
    console.error('❌ 예상치 못한 오류:', error);
    return NextResponse.json({ error: '예상치 못한 오류', details: error }, { status: 500 });
  }
}