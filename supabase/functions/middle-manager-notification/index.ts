import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

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
    const { purchase_request_id } = await req.json();
    
    if (!purchase_request_id) {
      return new Response(JSON.stringify({
        error: 'purchase_request_id is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Supabase 클라이언트 초기화
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 구매 요청 정보 조회
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchase_requests')
      .select(`
        *,
        vendors:vendor_id (vendor_name)
      `)
      .eq('id', purchase_request_id)
      .single();

    if (purchaseError || !purchaseData) {
      console.error('구매 요청 조회 오류:', purchaseError);
      return new Response(JSON.stringify({
        error: 'Purchase request not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 구매 요청 품목들 조회
    const { data: itemsData, error: itemsError } = await supabase
      .from('purchase_request_items')
      .select('*')
      .eq('purchase_request_id', purchase_request_id)
      .order('line_number', { ascending: true });

    if (itemsError || !itemsData || itemsData.length === 0) {
      console.error('품목 조회 오류:', itemsError);
      return new Response(JSON.stringify({
        error: 'No items found for this purchase request'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 첫 번째 품목과 총 금액 계산
    const firstItem = itemsData[0];
    const totalAmount = itemsData.reduce((sum, item) => sum + Number(item.amount_value || 0), 0);
    const itemCount = itemsData.length;

    // Block Kit 메시지 생성 (첫 번째 이미지 형태)
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `📋 발주서 승인 요청 - ${purchaseData.requester_name || '정현웅'}`
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
            text: `*결제유형:*\n${purchaseData.payment_category || '발주'}`
          },
          {
            type: "mrkdwn",
            text: `*업체명:*\n${purchaseData.vendors?.vendor_name || 'TEST'}`
          },
          {
            type: "mrkdwn",
            text: `*담당자:*\n${purchaseData.requester_name || '정현웅'}`
          }
        ]
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📦 *주문품목 (${itemCount > 1 ? `외 ${itemCount - 1}개` : '1개'})*\n${firstItem.line_number}번 - ${firstItem.item_name}\n규격: ${firstItem.specification || 'gkuh'} | 수량: ${firstItem.quantity}개 | 단가: ₩${firstItem.unit_price_value} | 합계: ₩${firstItem.amount_value} | 비고: ${firstItem.remark || 'f'}`
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*총 금액:*\n₩${totalAmount}`
          },
          {
            type: "mrkdwn",
            text: `*결제조건:*\n${purchaseData.vendors?.vendor_payment_schedule || '월말 정산'}`
          }
        ]
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "✅ 승인"
            },
            style: "primary",
            action_id: "approve_purchase",
            value: purchase_request_id.toString()
          },
          {
            type: "button", 
            text: {
              type: "plain_text",
              text: "❌ 반려"
            },
            style: "danger",
            action_id: "reject_purchase",
            value: purchase_request_id.toString()
          }
        ]
      }
    ];

    // 중간관리자들 조회
    const { data: managersData, error: managersError } = await supabase
      .from('employees')
      .select('slack_id')
      .contains('purchase_role', ['middle_manager'])
      .not('slack_id', 'is', null);

    if (managersError || !managersData || managersData.length === 0) {
      console.error('중간관리자 조회 오류:', managersError);
      return new Response(JSON.stringify({
        error: 'No middle managers found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 각 중간관리자에게 Slack 메시지 전송
    const slackUserToken = Deno.env.get('SLACK_USER_TOKEN');
    if (!slackUserToken) {
      throw new Error('SLACK_USER_TOKEN not configured');
    }

    const results = [];
    for (const manager of managersData) {
      try {
        const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${slackUserToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            channel: manager.slack_id,
            text: `발주서 승인 요청 - ${purchaseData.purchase_order_number}`,
            blocks: blocks
          })
        });

        const slackData = await slackResponse.json();
        results.push({
          manager_slack_id: manager.slack_id,
          success: slackData.ok,
          message_ts: slackData.ts,
          error: slackData.error
        });

        // 메시지 타임스탬프를 purchase_requests에 저장 (나중에 삭제/업데이트용)
        if (slackData.ok && slackData.ts) {
          await supabase
            .from('purchase_requests')
            .update({ slack_ts: slackData.ts })
            .eq('id', purchase_request_id);
        }

      } catch (error) {
        results.push({
          manager_slack_id: manager.slack_id,
          success: false,
          error: error.message
        });
      }
    }

    console.log('중간관리자 알림 전송 완료:', results);

    return new Response(JSON.stringify({
      success: true,
      message: 'Middle manager notifications sent',
      results: results,
      purchase_order_number: purchaseData.purchase_order_number
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('중간관리자 알림 전송 오류:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});