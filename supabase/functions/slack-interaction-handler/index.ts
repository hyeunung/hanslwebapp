import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

// HMAC-SHA256 서명 검증 함수
async function verifySlackSignature(
  timestamp: string,
  body: string,
  signature: string,
  signingSecret: string
): Promise<boolean> {
  // 타임스탬프 검증 (5분 이내)
  const now = Math.floor(Date.now() / 1000);
  const timestampNum = parseInt(timestamp);
  if (Math.abs(now - timestampNum) > 60 * 5) {
    console.log('Request timestamp is too old');
    return false;
  }

  // 서명 생성을 위한 베이스 스트링 구성
  const baseString = `v0:${timestamp}:${body}`;
  
  // HMAC-SHA256 계산
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(baseString)
  );
  
  // 16진수 다이제스트로 변환
  const computedSignature = 'v0=' + Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // 상수 시간 비교
  return computedSignature === signature;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Slack Signing Secret 검증
    const slackSigningSecret = Deno.env.get('SLACK_SIGNING_SECRET');
    if (!slackSigningSecret) {
      console.error('SLACK_SIGNING_SECRET not configured');
      return new Response('Server configuration error', { status: 500 });
    }

    // 서명 검증을 위한 헤더 추출
    const timestamp = req.headers.get('X-Slack-Request-Timestamp');
    const signature = req.headers.get('X-Slack-Signature');
    
    if (!timestamp || !signature) {
      console.log('Missing Slack signature headers');
      return new Response('Missing signature headers', { status: 401 });
    }

    // Raw request body 추출 (서명 검증용)
    const rawBody = await req.text();
    
    // 서명 검증
    const isValidSignature = await verifySlackSignature(
      timestamp,
      rawBody,
      signature,
      slackSigningSecret
    );

    if (!isValidSignature) {
      console.log('Invalid Slack signature');
      return new Response('Invalid signature', { status: 401 });
    }

    console.log('✅ Slack signature verified successfully');

    // 이제 안전하게 payload 파싱
    const formData = new URLSearchParams(rawBody);
    const payloadStr = formData.get('payload');
    
    if (!payloadStr) {
      return new Response('No payload found', { status: 400 });
    }

    const payload = JSON.parse(payloadStr);
    console.log('Slack interaction payload:', JSON.stringify(payload, null, 2));

    // 액션 정보 추출
    const action = payload.actions?.[0];
    const user = payload.user;
    const channel = payload.channel;
    const messageTs = payload.message?.ts;

    if (!action) {
      return new Response('No action found', { status: 400 });
    }

    const actionId = action.action_id;
    const purchaseRequestId = parseInt(action.value);

    // Supabase 클라이언트 초기화
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Slack API 토큰 (User Token 사용)
    const slackUserToken = Deno.env.get('SLACK_USER_TOKEN');
    if (!slackUserToken) {
      throw new Error('SLACK_USER_TOKEN not configured');
    }

    // 구매 요청 정보 조회
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchase_requests')
      .select(`
        *,
        vendors:vendor_id (vendor_name, vendor_payment_schedule)
      `)
      .eq('id', purchaseRequestId)
      .single();

    if (purchaseError || !purchaseData) {
      console.error('구매 요청 조회 오류:', purchaseError);
      return new Response('Purchase request not found', { status: 404 });
    }

    if (actionId === 'approve_purchase' || actionId === 'reject_purchase') {
      // 승인/반려 처리
      const newStatus = actionId === 'approve_purchase' ? 'approved' : 'rejected';
      const statusText = actionId === 'approve_purchase' ? '승인됨' : '반려됨';
      const statusEmoji = actionId === 'approve_purchase' ? '✅' : '❌';

      // 데이터베이스 업데이트
      const { error: updateError } = await supabase
        .from('purchase_requests')
        .update({ 
          middle_manager_status: newStatus,
          // 승인 시간도 기록
          ...(newStatus === 'approved' && { middle_manager_approved_at: new Date().toISOString() })
        })
        .eq('id', purchaseRequestId);

      if (updateError) {
        console.error('상태 업데이트 오류:', updateError);
        return new Response('Database update failed', { status: 500 });
      }

      // 완료 메시지 생성 (두 번째 이미지 형태)
      const completionBlocks = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${statusEmoji} 발주 승인 완료 - ${purchaseData.requester_name || '정현웅'}`
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*요청유형:*\n${purchaseData.request_type || '원자재'}`
            },
            {
              type: "mrkdwn",
              text: `*업체명:*\n${purchaseData.vendors?.vendor_name || 'TEST'}`
            },
            {
              type: "mrkdwn",
              text: `*담당자:*\n${purchaseData.requester_name || '정현웅'}`
            },
            {
              type: "mrkdwn",
              text: `*처리결과:*\n${statusText}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*처리시간:* ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}\n*처리자:* <@${user.id}>`
          }
        }
      ];

      // 기존 메시지를 완료 메시지로 교체
      const replaceResponse = await fetch('https://slack.com/api/chat.update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${slackUserToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: channel.id,
          ts: messageTs,
          text: `발주 승인 완료 - ${purchaseData.purchase_order_number}`,
          blocks: completionBlocks
        })
      });

      const replaceData = await replaceResponse.json();
      console.log('완료 메시지 교체 결과:', replaceData);

      return new Response(JSON.stringify({ 
        success: true, 
        status: newStatus,
        message: `Purchase request ${statusText}` 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } else {
      return new Response('Unknown action', { status: 400 });
    }

  } catch (error) {
    console.error('Slack 상호작용 처리 오류:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});