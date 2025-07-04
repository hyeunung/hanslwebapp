import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://qvhbigvdfyvhoegkhvef.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg';
const SLACK_USER_TOKEN = Deno.env.get('SLACK_USER_TOKEN');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

Deno.serve(async (req: Request) => {
  console.log('최종승인 슬랙 메시지 동기화 시작');
  
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { purchase_order_number } = await req.json();
    
    if (!purchase_order_number) {
      return new Response('발주번호가 필요합니다', { status: 400 });
    }

    console.log('발주번호:', purchase_order_number);

    // 1. 발주번호로 purchase_request 조회 (요청유형 포함)
    const { data: purchaseRequest, error: purchaseError } = await supabase
      .from('purchase_requests')
      .select('id, requester_name, request_type, final_manager_status')
      .eq('purchase_order_number', purchase_order_number)
      .single();

    if (purchaseError || !purchaseRequest) {
      console.error('발주 요청 조회 실패:', purchaseError);
      return new Response('발주 요청을 찾을 수 없습니다', { status: 404 });
    }

    console.log('발주 요청 조회 성공:', purchaseRequest);

    // 2. 요청유형에 따라 최종관리자 분류
    let targetRole: string;
    if (purchaseRequest.request_type === '원자재') {
      targetRole = 'raw_material_manager';
    } else if (purchaseRequest.request_type === '소모품') {
      targetRole = 'consumable_manager';
    } else {
      console.error('알 수 없는 요청유형:', purchaseRequest.request_type);
      return new Response('알 수 없는 요청유형입니다', { status: 400 });
    }

    // 3. 해당 역할의 최종관리자 slack_id 조회
    const { data: finalManagers, error: managersError } = await supabase
      .from('employees')
      .select('slack_id')
      .contains('purchase_role', [targetRole])
      .not('slack_id', 'is', null);

    if (managersError || !finalManagers?.length) {
      console.error('최종관리자 조회 실패:', managersError);
      return new Response('최종관리자를 찾을 수 없습니다', { status: 404 });
    }

    console.log('최종관리자 조회 성공:', finalManagers);

    // 4. 각 최종관리자에게 메시지 동기화 실행
    for (const manager of finalManagers) {
      await syncSlackMessage(manager.slack_id, purchase_order_number);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: '최종승인 슬랙 메시지 동기화 완료',
      purchase_order_number,
      target_role: targetRole
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('처리 에러:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});

async function syncSlackMessage(slackUserId: string, purchaseOrderNumber: string) {
  try {
    if (!SLACK_USER_TOKEN) {
      console.log('SLACK_USER_TOKEN이 설정되지 않음');
      return;
    }

    console.log(`${slackUserId}와의 최종승인 메시지 동기화 시작`);

    // 1. DM 채널 ID 조회/생성
    const dmChannelResponse = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_USER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        users: slackUserId
      })
    });

    const dmChannelResult = await dmChannelResponse.json();
    if (!dmChannelResult.ok) {
      console.error('DM 채널 조회 실패:', dmChannelResult.error);
      return;
    }

    const channelId = dmChannelResult.channel.id;
    console.log('DM 채널 ID:', channelId);

    // 2. 채널에서 메시지 검색 (최근 50개 메시지)
    const historyResponse = await fetch(`https://slack.com/api/conversations.history?channel=${channelId}&limit=50`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SLACK_USER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const historyResult = await historyResponse.json();
    if (!historyResult.ok) {
      console.error('메시지 히스토리 조회 실패:', historyResult.error);
      return;
    }

    console.log(`메시지 ${historyResult.messages?.length || 0}개 조회됨`);

    // 3. "발주서 승인 요청" + 발주번호가 포함된 메시지 찾기
    const targetMessage = historyResult.messages?.find((message: any) => {
      const messageText = JSON.stringify(message);
      return messageText.includes('발주서 승인 요청') && 
             messageText.includes(purchaseOrderNumber);
    });

    if (targetMessage) {
      console.log('삭제 대상 메시지 발견:', targetMessage.ts);

      // 4. 기존 메시지 삭제
      const deleteResponse = await fetch('https://slack.com/api/chat.delete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_USER_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: channelId,
          ts: targetMessage.ts
        })
      });

      const deleteResult = await deleteResponse.json();
      if (deleteResult.ok) {
        console.log('기존 메시지 삭제 성공');
      } else {
        console.error('메시지 삭제 실패:', deleteResult.error);
      }
    } else {
      console.log('삭제할 메시지를 찾을 수 없음');
    }

    // 5. 완료 메시지 전송
    const completionMessage = `✅ 발주번호 : ${purchaseOrderNumber} 에 대한 최종결제 처리가 완료 되었습니다`;
    
    const postResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_USER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: channelId,
        text: completionMessage
      })
    });

    const postResult = await postResponse.json();
    if (postResult.ok) {
      console.log('완료 메시지 전송 성공');
    } else {
      console.error('완료 메시지 전송 실패:', postResult.error);
    }

  } catch (error) {
    console.error(`${slackUserId} 최종승인 메시지 동기화 실패:`, error);
  }
} 