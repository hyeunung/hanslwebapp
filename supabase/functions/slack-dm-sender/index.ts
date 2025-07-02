import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface SlackDMRequest {
  user_id: string;
  message?: string;
  purchase_order_number?: string;
  requester_name?: string;
  vendor_name?: string;
  request_date?: string;
  total_amount?: string;
  currency?: string;
}

Deno.serve(async (req: Request) => {
  try {
    // CORS 처리
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body: SlackDMRequest = await req.json();
    const { user_id, message, purchase_order_number, requester_name, vendor_name, request_date, total_amount, currency } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Slack User Token 가져오기
    const slackUserToken = Deno.env.get('SLACK_USER_TOKEN');
    if (!slackUserToken) {
      console.error('SLACK_USER_TOKEN not found');
      return new Response(
        JSON.stringify({ error: 'Slack User Token not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending DM to user: ${user_id}`);

    // Block Kit 메시지 준비
    let messagePayload;

    if (purchase_order_number) {
      // 구매 요청 알림용 Block Kit 메시지
      const excelDownloadUrl = `https://hanslwebapp.vercel.app/api/excel/download/${purchase_order_number}`;
      
      messagePayload = {
        channel: user_id,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `📋 *발주서 파일*\n\n🔸 *발주번호:* ${purchase_order_number}\n🔸 *구매요청자:* ${requester_name || '미정'}\n🔸 *업체명:* ${vendor_name || '미정'}\n🔸 *총액:* ${total_amount || '0'} ${currency || 'KRW'}`
            }
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                style: "primary",
                text: {
                  type: "plain_text",
                  text: "Excel 다운로드",
                  emoji: true
                },
                url: excelDownloadUrl,
                action_id: "excel_download"
              }
            ]
          }
        ]
      };
    } else if (message) {
      // 일반 텍스트 메시지
      messagePayload = {
        channel: user_id,
        text: message,
        as_user: true,
      };
    } else {
      return new Response(
        JSON.stringify({ error: 'Either message or purchase_order_number is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Message payload:', JSON.stringify(messagePayload, null, 2));

    // Slack API로 DM 전송
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    const slackData = await slackResponse.json();

    if (!slackData.ok) {
      console.error('Slack API error:', slackData);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send Slack message', 
          details: slackData.error 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Slack DM sent successfully:', slackData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'DM sent successfully',
        slack_response: slackData 
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );

  } catch (error) {
    console.error('Error in slack-dm-sender:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});