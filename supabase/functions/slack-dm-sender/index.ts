import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

    // Supabase 클라이언트 초기화 (파일 다운로드용)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 요청 본문 파싱 - blocks 파라미터 추가
    const { user_id, message, blocks, file_upload } = await req.json();
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

    console.log(`Sending DM to user: ${user_id}, message: ${message}${blocks ? ' with Block Kit' : ''}`);
    
    // 파일 업로드가 요청된 경우
    if (file_upload && file_upload.order_number) {
      console.log(`파일 업로드 요청: ${file_upload.order_number}`);
      
      try {
        // 1. Storage에서 파일 다운로드
        const filename = `${file_upload.order_number}.xlsx`;
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('po-files')
          .download(filename);

        if (downloadError || !fileData) {
          console.error('Storage 다운로드 오류:', downloadError);
          // 파일 업로드 실패해도 메시지는 전송
        } else {
          // 2. ArrayBuffer를 Uint8Array로 변환
          const arrayBuffer = await fileData.arrayBuffer();
          const fileBuffer = new Uint8Array(arrayBuffer);
          const downloadFilename = `발주서_한샘디지텍_${file_upload.order_number}.xlsx`;
          
          // 3. Slack에 파일 업로드 (FormData 사용)
          const formData = new FormData();
          formData.append('token', slackUserToken);
          formData.append('channels', user_id);
          formData.append('filename', downloadFilename);
          formData.append('filetype', 'xlsx');
          formData.append('initial_comment', message);
          formData.append('file', new Blob([fileBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          }), downloadFilename);

          const fileUploadResponse = await fetch('https://slack.com/api/files.upload', {
            method: 'POST',
            body: formData
          });

          const fileUploadData = await fileUploadResponse.json();
          
          if (fileUploadData.ok) {
            console.log('파일 업로드 성공:', fileUploadData.file?.name);
            return new Response(JSON.stringify({
              success: true,
              message: 'File uploaded successfully',
              file_id: fileUploadData.file?.id,
              file_url: fileUploadData.file?.url_private
            }), {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
              }
            });
          } else {
            console.error('파일 업로드 실패:', fileUploadData.error);
            // 파일 업로드 실패시 일반 메시지로 fallback
          }
        }
      } catch (fileError) {
        console.error('파일 처리 오류:', fileError);
        // 파일 처리 실패시 일반 메시지로 fallback
      }
    }

    // Slack 메시지 전송을 위한 페이로드 구성
    const messagePayload: any = {
      channel: user_id,
      text: message // fallback text
    };

    // Block Kit이 제공된 경우 추가
    if (blocks && Array.isArray(blocks)) {
      messagePayload.blocks = blocks;
      console.log('Block Kit 메시지 전송:', JSON.stringify(blocks, null, 2));
    }

    // Slack 메시지 전송
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackUserToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload)
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
      message: blocks ? 'Block Kit message sent successfully' : 'DM sent successfully',
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
