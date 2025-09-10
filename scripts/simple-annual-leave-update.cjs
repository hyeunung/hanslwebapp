const { createClient } = require('@supabase/supabase-js');

// 환경변수 설정
const supabaseUrl = 'https://ndvkgshojjqxdgwvkjek.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function updateEmployee(name, newUsedLeave) {
    try {
        console.log(`🔄 ${name} 업데이트 중... (사용연차: ${newUsedLeave})`);
        
        // 1. 현재 정보 조회
        const { data: current, error: fetchError } = await supabase
            .from('employees')
            .select('annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave')
            .eq('name', name)
            .single();
        
        if (fetchError) {
            console.error(`❌ ${name} 조회 실패:`, fetchError.message);
            return false;
        }
        
        if (!current || !current.annual_leave_granted_current_year) {
            console.error(`❌ ${name} 정보가 없거나 생성연차가 설정되지 않음`);
            return false;
        }
        
        console.log(`   현재: 생성=${current.annual_leave_granted_current_year}, 사용=${current.used_annual_leave}, 남은=${current.remaining_annual_leave}`);
        
        // 2. 새로운 남은 연차 계산
        const newRemainingLeave = current.annual_leave_granted_current_year - newUsedLeave;
        
        // 3. 업데이트 실행
        const { error: updateError } = await supabase
            .from('employees')
            .update({
                used_annual_leave: newUsedLeave,
                remaining_annual_leave: newRemainingLeave,
                updated_at: new Date().toISOString()
            })
            .eq('name', name);
        
        if (updateError) {
            console.error(`❌ ${name} 업데이트 실패:`, updateError.message);
            return false;
        }
        
        console.log(`✅ ${name} 업데이트 완료: 사용=${newUsedLeave}, 남은=${newRemainingLeave}`);
        return true;
        
    } catch (error) {
        console.error(`❌ ${name} 처리 중 오류:`, error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 연차 불일치 수정 시작\n');
    
    const updates = [
        { name: '임소연', newUsed: 14 },      // 14.5 → 14
        { name: '김경태', newUsed: 11 },      // 3 → 11
        { name: '김지혜', newUsed: 8.5 },     // 7.5 → 8.5
        { name: '곽병현', newUsed: 11.5 },    // 10.5 → 11.5
        { name: '윤은호', newUsed: 11.5 },    // 11 → 11.5
        { name: '김윤회', newUsed: 14.5 },    // 14 → 14.5
    ];
    
    let successCount = 0;
    let failCount = 0;
    
    for (const update of updates) {
        const success = await updateEmployee(update.name, update.newUsed);
        if (success) {
            successCount++;
        } else {
            failCount++;
        }
        console.log(''); // 구분선
    }
    
    console.log(`📊 결과: 성공 ${successCount}건, 실패 ${failCount}건`);
    
    // 최종 확인
    console.log('\n📋 최종 결과 확인:');
    try {
        const { data: finalData, error } = await supabase
            .from('employees')
            .select('name, annual_leave_granted_current_year, used_annual_leave, remaining_annual_leave')
            .in('name', updates.map(u => u.name))
            .order('name');
        
        if (error) {
            console.error('❌ 최종 확인 실패:', error.message);
        } else if (finalData) {
            console.table(finalData.map(item => ({
                이름: item.name,
                생성연차: item.annual_leave_granted_current_year,
                사용연차: item.used_annual_leave,
                남은연차: item.remaining_annual_leave,
                계산확인: item.annual_leave_granted_current_year - item.used_annual_leave
            })));
        }
    } catch (error) {
        console.error('❌ 최종 확인 중 오류:', error.message);
    }
    
    console.log('\n🎉 작업 완료!');
}

main().catch(console.error);