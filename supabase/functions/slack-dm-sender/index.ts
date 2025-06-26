import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  // CORS 헤더 설정
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // 환경변수에서 Slack User Token 가져오기
    const slackUserToken = Deno.env.get('SLACK_USER_TOKEN');
    if (!slackUserToken) {
      console.error('SLACK_USER_TOKEN environment variable is not set');
      return new Response(JSON.stringify({
        error: 'Slack User Token not configured'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // 요청 본문 파싱
    const { user_id, message } = await req.json();
    if (!user_id || !message) {
      return new Response(JSON.stringify({
        error: 'user_id and message are required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`Sending DM to user: ${user_id}, message: ${message}`);
    // Slack API를 사용하여 DM 전송
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackUserToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel: user_id,
        text: message
      })
    });
    const slackData = await slackResponse.json();
    if (!slackData.ok) {
      console.error('Slack API error:', slackData);
      return new Response(JSON.stringify({
        error: 'Failed to send Slack message',
        details: slackData.error
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('Slack message sent successfully:', slackData);
    return new Response(JSON.stringify({
      success: true,
      message: 'DM sent successfully',
      slack_response: slackData
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in slack-dm-sender function:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
