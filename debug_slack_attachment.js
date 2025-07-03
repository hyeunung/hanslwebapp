// 3단계: Slack 첨부파일 디버깅을 위한 간단한 테스트 스크립트

const SUPABASE_URL = 'https://qvhbigvdfyvhoegkhvef.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg';

async function testSlackAttachment() {
    console.log('🧪 Slack 첨부파일 디버깅 테스트 시작...');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/slack-dm-sender`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: 'U08KADVPK2T', // 이채령님 Slack ID로 테스트
                message: '🧪 첨부파일 디버깅 테스트',
                purchase_order_number: 'F20250702_013',
                with_attachment: true
            })
        });
        
        const data = await response.json();
        
        console.log('📊 응답 상태:', response.status);
        console.log('📄 응답 데이터:', JSON.stringify(data, null, 2));
        
        if (!response.ok) {
            console.error('❌ 에러 발생:', data);
        } else {
            console.log('✅ 성공:', data);
        }
        
    } catch (error) {
        console.error('💥 예외 발생:', error);
    }
}

testSlackAttachment();