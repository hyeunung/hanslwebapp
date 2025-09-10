const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ndvkgshojjqxdgwvkjek.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.');
    console.log('다음 명령어로 실행하세요:');
    console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_key node execute-annual-leave-fix.cjs');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('🚀 연차 불일치 수정 스크립트 실행 시작');
    
    // 개별 업데이트 쿼리들
    const updates = [
        {
            name: '임소연',
            from: 14.5,
            to: 14,
        },
        {
            name: '김경태',
            from: 3,
            to: 11,
        },
        {
            name: '김지혜',
            from: 7.5,
            to: 8.5,
        },
        {
            name: '곽병현',
            from: 10.5,
            to: 11.5,
        },
        {
            name: '윤은호',
            from: 11,
            to: 11.5,
        },
        {
            name: '김윤회',
            from: 14,
            to: 14.5,
        }
    ];
    
    try {
        // Supabase JavaScript 클라이언트를 사용한 개별 업데이트
        console.log('\n📊 현재 상태 확인 중...');
        
        // 현재 상태 조회
        const { data: currentData, error: currentError } = await supabase
            .from('employees')
            .select('name, used_annual_leave, remaining_annual_leave, annual_leave_granted_current_year')
            .in('name', ['임소연', '김경태', '김지혜', '곽병현', '윤은호', '김윤회'])
            .not('annual_leave_granted_current_year', 'is', null)
            .order('name');
        
        if (currentError) {
            console.error('❌ 현재 상태 조회 실패:', currentError);
            return;
        }
        
        console.log('현재 상태:');
        console.table(currentData);
        
        // 불일치 상태 확인 (leave 테이블과 비교)
        console.log('\n🔍 leave 테이블과의 불일치 상태 확인 중...');
        
        for (const employee of currentData) {
            // 해당 직원의 2025년 승인된 연차 조회
            const { data: leaveData, error: leaveError } = await supabase
                .from('leave')
                .select('leave_type, date')
                .eq('employee_id', (await supabase
                    .from('employees')
                    .select('id')
                    .eq('name', employee.name)
                    .single()).data.id)
                .eq('status', 'approved')
                .gte('date', '2025-01-01')
                .lt('date', '2026-01-01');
            
            if (!leaveError && leaveData) {
                const fullDays = leaveData.filter(l => l.leave_type === 'annual').length;
                const halfDays = leaveData.filter(l => l.leave_type === 'half_am' || l.leave_type === 'half_pm').length;
                const actualUsage = fullDays + (halfDays * 0.5);
                
                console.log(`${employee.name}: 기록=${employee.used_annual_leave}, 실제=${actualUsage}, 차이=${employee.used_annual_leave - actualUsage}`);
            }
        }
        
        // 개별 업데이트 실행
        console.log('\n🔧 업데이트 실행 중...');
        for (const update of updates) {
            console.log(`\n🔄 ${update.name} 업데이트 중 (${update.from} → ${update.to})...`);
            
            // 먼저 해당 직원의 정보 가져오기
            const { data: employeeData, error: fetchError } = await supabase
                .from('employees')
                .select('annual_leave_granted_current_year, used_annual_leave')
                .eq('name', update.name)
                .not('annual_leave_granted_current_year', 'is', null)
                .single();
            
            if (fetchError) {
                console.error(`❌ ${update.name} 정보 조회 실패:`, fetchError);
                continue;
            }
            
            if (!employeeData) {
                console.log(`⚠️  ${update.name} 직원 정보를 찾을 수 없습니다.`);
                continue;
            }
            
            const newRemaining = employeeData.annual_leave_granted_current_year - update.to;
            
            const { error: updateError } = await supabase
                .from('employees')
                .update({
                    used_annual_leave: update.to,
                    remaining_annual_leave: newRemaining,
                    updated_at: new Date().toISOString()
                })
                .eq('name', update.name)
                .not('annual_leave_granted_current_year', 'is', null);
            
            if (updateError) {
                console.error(`❌ ${update.name} 업데이트 실패:`, updateError);
            } else {
                console.log(`✅ ${update.name} 업데이트 완료: ${update.from} → ${update.to} (남은연차: ${newRemaining})`);
            }
        }
        
        // 최종 결과 확인
        console.log('\n📊 수정 후 최종 상태 확인 중...');
        const { data: finalData, error: finalError } = await supabase
            .from('employees')
            .select('name, used_annual_leave, remaining_annual_leave, annual_leave_granted_current_year')
            .in('name', ['임소연', '김경태', '김지혜', '곽병현', '윤은호', '김윤회'])
            .not('annual_leave_granted_current_year', 'is', null)
            .order('name');
        
        if (finalError) {
            console.error('❌ 최종 상태 조회 실패:', finalError);
            return;
        }
        
        console.log('수정 후 최종 상태:');
        console.table(finalData);
        
        // 변경 사항 요약
        console.log('\n📋 변경 사항 요약:');
        const changes = [];
        for (const curr of currentData) {
            const final = finalData.find(f => f.name === curr.name);
            if (final && curr.used_annual_leave !== final.used_annual_leave) {
                changes.push({
                    이름: curr.name,
                    변경전: curr.used_annual_leave,
                    변경후: final.used_annual_leave,
                    차이: final.used_annual_leave - curr.used_annual_leave
                });
            }
        }
        console.table(changes);
        
        console.log('\n🎉 연차 불일치 수정 완료!');
        
    } catch (error) {
        console.error('❌ 실행 중 오류 발생:', error);
    }
}

if (require.main === module) {
    main().catch(console.error);
}