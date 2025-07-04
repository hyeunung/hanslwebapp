import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://qvhbigvdfyvhoegkhvef.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg';
const SLACK_USER_TOKEN = Deno.env.get('SLACK_USER_TOKEN');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

Deno.serve(async (req: Request) => {
  console.log('슬랙 버튼 처리 시작');
  
  if (req.method === 'POST') {
    try {
      const body = await req.text();
      const contentType = req.headers.get('content-type');
      
      if (contentType?.includes('application/x-www-form-urlencoded')) {
        const formData = new URLSearchParams(body);
        const payload = formData.get('payload');
        
        if (payload) {
          const parsed = JSON.parse(payload);
          console.log('버튼 액션:', parsed.actions?.[0]?.action_id);
          console.log('발주 ID:', parsed.actions?.[0]?.value);
          
          if (parsed.type === 'block_actions' && parsed.actions?.length > 0) {
            const action = parsed.actions[0];
            const purchaseRequestId = parseInt(action.value);
            const actionId = action.action_id;
            
            // 액션에 따라 업데이트할 필드와 값 결정
            let updateField: string;
            let newStatus: string;
            
            if (actionId === 'approve_middle_manager') {
              updateField = 'middle_manager_status';
              newStatus = 'approved';
            } else if (actionId === 'reject_middle_manager') {
              updateField = 'middle_manager_status';
              newStatus = 'rejected';
            } else if (actionId === 'approve_final_manager') {
              updateField = 'final_manager_status';
              newStatus = 'approved';
            } else if (actionId === 'reject_final_manager') {
              updateField = 'final_manager_status';
              newStatus = 'rejected';
            } else {
              console.log('알 수 없는 액션:', actionId);
              return new Response(null, { status: 200 });
            }
            
            console.log(`DB 업데이트: ID=${purchaseRequestId}, Field=${updateField}, Status=${newStatus}`);
            
            // DB 업데이트 + 발주번호 조회
            const updateData: any = {};
            updateData[updateField] = newStatus;
            
            const { data, error } = await supabase
              .from('purchase_requests')
              .update(updateData)
              .eq('id', purchaseRequestId)
              .select('purchase_order_number')
              .single();
            
            if (error) {
              console.error('DB 업데이트 실패:', error);
              await sendResponse(parsed.response_url, {
                text: `❌ 업데이트 실패: ${error.message}`,
                response_type: "ephemeral"
              });
            } else {
              console.log('DB 업데이트 성공');
              const orderNumber = data?.purchase_order_number || purchaseRequestId;
              
              let successMessage: string;
              if (newStatus === 'approved') {
                successMessage = `✅ 발주번호 : ${orderNumber} 에 대한 최종결제 처리가 완료 되었습니다`;
              } else {
                successMessage = `발주번호 : ${orderNumber} 에 대한 반료가 완료 되었습니다`;
              }
              
              // 1. 원본 메시지 삭제
              console.log('원본 메시지 삭제 시작');
              await deleteOriginalMessage(parsed.channel.id, parsed.message.ts);
              
              // 2. slack-dm-sender를 통해 새로운 DM으로 성공 메시지 전송
              console.log('새 DM으로 성공 메시지 전송 시작');
              await sendNewDM(parsed.channel.id, successMessage);
            }
          }
          
          return new Response(null, { status: 200 });
        }
      }
      
      return new Response('OK', { status: 200 });
      
    } catch (error) {
      console.error('처리 에러:', error);
      return new Response('Error', { status: 200 });
    }
  }
  
  return new Response('OK', { status: 200 });
});

async function sendResponse(responseUrl: string, message: any) {
  try {
    const response = await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    console.log('응답 전송 성공:', response.status);
  } catch (e) {
    console.error('응답 전송 실패:', e);
  }
}

async function sendNewDM(userId: string, message: string) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/slack-dm-sender`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        user_id: userId,
        message: message
      })
    });
    
    const result = await response.json();
    if (response.ok) {
      console.log('새 DM 전송 성공:', result);
    } else {
      console.error('새 DM 전송 실패:', result);
    }
  } catch (e) {
    console.error('새 DM 전송 중 에러:', e);
  }
}

async function deleteOriginalMessage(channel: string, messageTs: string) {
  try {
    if (!SLACK_USER_TOKEN) {
      console.log('SLACK_USER_TOKEN이 설정되지 않음 - 메시지 삭제 건너뛰기');
      return;
    }
    
    const response = await fetch('https://slack.com/api/chat.delete', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_USER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: channel,
        ts: messageTs
      })
    });
    
    const result = await response.json();
    if (result.ok) {
      console.log('원본 메시지 삭제 성공');
    } else {
      console.error('메시지 삭제 실패:', result.error);
    }
  } catch (e) {
    console.error('메시지 삭제 중 에러:', e);
  }
}