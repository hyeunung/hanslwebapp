const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ndvkgshojjqxdgwvkjek.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.');
    console.log('다음 명령어로 실행하세요:');
    console.log('SUPABASE_SERVICE_ROLE_KEY=your_service_key node execute-annual-leave-fix.js');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeQuery(query, description) {
    console.log(`\n🔄 ${description}...`);
    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });
        
        if (error) {
            console.error(`❌ ${description} 실패:`, error);
            return false;
        }
        
        console.log(`✅ ${description} 완료`);
        if (data && data.length > 0) {
            console.table(data);
        }
        return true;
    } catch (err) {
        console.error(`❌ ${description} 중 오류:`, err);
        return false;
    }
}

async function executeDirectQuery(query, description) {
    console.log(`\n🔄 ${description}...`);
    try {
        const { data, error } = await supabase.from('employees').select('*').limit(0);
        
        if (error) {
            console.error(`❌ 연결 테스트 실패:`, error);
            return false;
        }
        
        // 직접 쿼리 실행을 위한 대안 방법
        const queries = query.split(';').filter(q => q.trim());
        
        for (const singleQuery of queries) {
            const trimmedQuery = singleQuery.trim();
            if (trimmedQuery) {
                console.log(`실행할 쿼리: ${trimmedQuery.substring(0, 100)}...`);
                // 여기서는 각 쿼리의 로직을 개별적으로 처리해야 합니다.
            }
        }
        
        return true;
    } catch (err) {
        console.error(`❌ ${description} 중 오류:`, err);
        return false;
    }
}

async function main() {
    console.log('🚀 연차 불일치 수정 스크립트 실행 시작');
    
    // 1. 현재 불일치 상태 확인
    const checkQuery = `
        WITH leave_summary AS (
            SELECT 
                e.id,
                e.name,
                COUNT(CASE WHEN l.status = 'approved' AND EXTRACT(YEAR FROM l.date) = 2025 AND l.leave_type = 'annual' THEN 1 END) as full_day_count,
                COUNT(CASE WHEN l.status = 'approved' AND EXTRACT(YEAR FROM l.date) = 2025 AND l.leave_type = 'half_am' THEN 1 END) as half_am_count,
                COUNT(CASE WHEN l.status = 'approved' AND EXTRACT(YEAR FROM l.date) = 2025 AND l.leave_type = 'half_pm' THEN 1 END) as half_pm_count
            FROM employees e
            LEFT JOIN leave l ON e.id = l.employee_id
            GROUP BY e.id, e.name
        )
        SELECT 
            ls.name,
            e.used_annual_leave as current_record,
            (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5) as actual_usage,
            e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5) as difference
        FROM leave_summary ls
        JOIN employees e ON ls.id = e.id
        WHERE e.annual_leave_granted_current_year IS NOT NULL
          AND ABS(e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5)) > 0.01
        ORDER BY ABS(e.used_annual_leave - (ls.full_day_count + (ls.half_am_count + ls.half_pm_count) * 0.5)) DESC
    `;
    
    // 개별 업데이트 쿼리들
    const updates = [
        {
            name: '임소연',
            from: 14.5,
            to: 14,
            query: `UPDATE employees SET used_annual_leave = 14, remaining_annual_leave = annual_leave_granted_current_year - 14, updated_at = NOW() WHERE name = '임소연' AND annual_leave_granted_current_year IS NOT NULL`
        },
        {
            name: '김경태',
            from: 3,
            to: 11,
            query: `UPDATE employees SET used_annual_leave = 11, remaining_annual_leave = annual_leave_granted_current_year - 11, updated_at = NOW() WHERE name = '김경태' AND annual_leave_granted_current_year IS NOT NULL`
        },
        {
            name: '김지혜',
            from: 7.5,
            to: 8.5,
            query: `UPDATE employees SET used_annual_leave = 8.5, remaining_annual_leave = annual_leave_granted_current_year - 8.5, updated_at = NOW() WHERE name = '김지혜' AND annual_leave_granted_current_year IS NOT NULL`
        },
        {
            name: '곽병현',
            from: 10.5,
            to: 11.5,
            query: `UPDATE employees SET used_annual_leave = 11.5, remaining_annual_leave = annual_leave_granted_current_year - 11.5, updated_at = NOW() WHERE name = '곽병현' AND annual_leave_granted_current_year IS NOT NULL`
        },
        {
            name: '윤은호',
            from: 11,
            to: 11.5,
            query: `UPDATE employees SET used_annual_leave = 11.5, remaining_annual_leave = annual_leave_granted_current_year - 11.5, updated_at = NOW() WHERE name = '윤은호' AND annual_leave_granted_current_year IS NOT NULL`
        },
        {
            name: '김윤회',
            from: 14,
            to: 14.5,
            query: `UPDATE employees SET used_annual_leave = 14.5, remaining_annual_leave = annual_leave_granted_current_year - 14.5, updated_at = NOW() WHERE name = '김윤회' AND annual_leave_granted_current_year IS NOT NULL`
        }
    ];
    
    // 수정 후 확인 쿼리
    const verificationQuery = `
        SELECT 
            name,
            annual_leave_granted_current_year as granted,
            used_annual_leave as used,
            remaining_annual_leave as remaining,
            (annual_leave_granted_current_year - used_annual_leave) as calculated_remaining
        FROM employees
        WHERE name IN ('임소연', '김경태', '김지혜', '곽병현', '윤은호', '김윤회')
          AND annual_leave_granted_current_year IS NOT NULL
        ORDER BY name
    `;
    
    try {
        // Supabase JavaScript 클라이언트를 사용한 개별 업데이트
        console.log('\n📊 현재 상태 확인 중...');
        
        // 현재 상태 조회
        const { data: currentData, error: currentError } = await supabase
            .from('employees')
            .select('name, used_annual_leave, remaining_annual_leave, annual_leave_granted_current_year')
            .in('name', ['임소연', '김경태', '김지혜', '곽병현', '윤은호', '김윤회'])
            .not('annual_leave_granted_current_year', 'is', null);
        
        if (currentError) {
            console.error('❌ 현재 상태 조회 실패:', currentError);
            return;
        }
        
        console.log('현재 상태:');
        console.table(currentData);
        
        // 개별 업데이트 실행
        for (const update of updates) {
            console.log(`\n🔄 ${update.name} 업데이트 중 (${update.from} → ${update.to})...`);
            
            const { error: updateError } = await supabase
                .from('employees')
                .update({
                    used_annual_leave: update.to,
                    updated_at: new Date().toISOString()
                })
                .eq('name', update.name)
                .not('annual_leave_granted_current_year', 'is', null);
            
            if (updateError) {
                console.error(`❌ ${update.name} 업데이트 실패:`, updateError);
            } else {
                console.log(`✅ ${update.name} 업데이트 완료`);
                
                // remaining_annual_leave도 업데이트
                const { data: employeeData, error: fetchError } = await supabase
                    .from('employees')
                    .select('annual_leave_granted_current_year')
                    .eq('name', update.name)
                    .single();
                
                if (!fetchError && employeeData) {
                    const newRemaining = employeeData.annual_leave_granted_current_year - update.to;
                    await supabase
                        .from('employees')
                        .update({ remaining_annual_leave: newRemaining })
                        .eq('name', update.name);
                }
            }
        }
        
        // 최종 결과 확인
        console.log('\n📊 수정 후 최종 상태 확인 중...');
        const { data: finalData, error: finalError } = await supabase
            .from('employees')
            .select('name, used_annual_leave, remaining_annual_leave, annual_leave_granted_current_year')
            .in('name', ['임소연', '김경태', '김지혜', '곽병현', '윤은호', '김윤회'])
            .not('annual_leave_granted_current_year', 'is', null);
        
        if (finalError) {
            console.error('❌ 최종 상태 조회 실패:', finalError);
            return;
        }
        
        console.log('수정 후 최종 상태:');
        console.table(finalData);
        
        console.log('\n🎉 연차 불일치 수정 완료!');
        
    } catch (error) {
        console.error('❌ 실행 중 오류 발생:', error);
    }
}

if (require.main === module) {
    main().catch(console.error);
}