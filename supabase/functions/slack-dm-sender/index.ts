import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface SlackDMRequest {
  user_id: string;
  message?: string;
  blocks?: any[]; // Block Kit 블록 배열 직접 지원
  purchase_order_number?: string;
  requester_name?: string;
  vendor_name?: string;
  request_date?: string;
  total_amount?: string;
  currency?: string;
  with_attachment?: boolean; // 첨부파일 포함 여부
}

// 실제 파일 첨부로 메시지 전송하는 함수 (새로운 Slack API 사용)
async function sendMessageWithAttachment(
  user_id: string, 
  purchase_order_number: string, 
  message?: string
): Promise<any> {
  const slackUserToken = Deno.env.get('SLACK_USER_TOKEN');
  if (!slackUserToken) {
    throw new Error('SLACK_USER_TOKEN not configured');
  }

  // 1. Storage에서 파일 다운로드
  const filename = `${purchase_order_number}.xlsx`;
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('po-files')
    .download(filename);

  if (downloadError || !fileData) {
    console.error(`File not found in storage: ${filename}`, downloadError);
    throw new Error(`File not found in storage: ${filename}`);
  }

  // 2. 파일을 ArrayBuffer로 변환
  const fileArrayBuffer = await fileData.arrayBuffer();
  const fileSize = fileArrayBuffer.byteLength;

  console.log(`File ${filename} loaded, size: ${fileSize} bytes`);

  // 3. 새로운 Slack API - Step 1: 업로드 URL 받기
  const getUploadUrlResponse = await fetch('https://slack.com/api/files.getUploadURLExternal', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${slackUserToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      filename: filename,
      length: fileSize.toString()
    }),
  });

  const uploadUrlData = await getUploadUrlResponse.json();
  
  if (!uploadUrlData.ok) {
    console.error('getUploadURLExternal failed:', uploadUrlData);
    throw new Error(`Failed to get upload URL: ${uploadUrlData.error}`);
  }

  console.log('Upload URL received:', uploadUrlData.upload_url);
  console.log('File ID:', uploadUrlData.file_id);

  // 4. 새로운 Slack API - Step 2: 실제 파일 업로드
  const uploadResponse = await fetch(uploadUrlData.upload_url, {
    method: 'POST',
    body: fileArrayBuffer,
  });

  if (!uploadResponse.ok) {
    const uploadError = await uploadResponse.text();
    console.error('File upload failed:', uploadError);
    throw new Error(`Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }

  console.log('File uploaded successfully to Slack');

  // 5-1. DM 채널 열기 (필요한 경우)
  const openDMResponse = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${slackUserToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      users: user_id
    }),
  });

  const dmData = await openDMResponse.json();
  console.log('DM channel data:', dmData);
  
  const channelId = dmData.ok ? dmData.channel.id : user_id;
  console.log('Using channel ID:', channelId);

  // 5-2. 새로운 Slack API - Step 3: 업로드 완료 및 파일 공유
  const completeUploadResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${slackUserToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: [{
        id: uploadUrlData.file_id,
        title: `발주서_${purchase_order_number}.xlsx`
      }],
      channels: [channelId],
      initial_comment: message || `📋 구매요청 승인 대기 - ${purchase_order_number}\n\n📎 첨부파일: 발주서 Excel 파일입니다.`
    }),
  });

  const completeUploadData = await completeUploadResponse.json();
  console.log('Complete upload response:', JSON.stringify(completeUploadData, null, 2));
  
  if (!completeUploadData.ok) {
    console.error('completeUploadExternal failed:', completeUploadData);
    console.error('Request payload was:', {
      files: [{
        id: uploadUrlData.file_id,
        title: `발주서_${purchase_order_number}.xlsx`
      }],
      channels: [channelId],
      initial_comment: message || `📋 구매요청 승인 대기 - ${purchase_order_number}\n\n📎 첨부파일: 발주서 Excel 파일입니다.`
    });
    throw new Error(`Failed to complete file upload: ${completeUploadData.error}`);
  }

  console.log('File attachment completed successfully');
  return completeUploadData;
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
    const { user_id, message, blocks, purchase_order_number, requester_name, vendor_name, request_date, total_amount, currency, with_attachment } = body;

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

    // 첨부파일 모드인 경우 files.upload 사용
    if (with_attachment && purchase_order_number) {
      console.log(`Sending message with attachment for order: ${purchase_order_number}`);
      
      const attachmentResult = await sendMessageWithAttachment(
        user_id, 
        purchase_order_number, 
        message
      );
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Message with attachment sent successfully',
          slack_response: attachmentResult 
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Block Kit 메시지 준비
    let messagePayload;

    if (blocks) {
      // 직접 전달된 Block Kit 블록 사용
      messagePayload = {
        channel: user_id,
        blocks: blocks
      };
    } else if (purchase_order_number) {
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
        JSON.stringify({ error: 'Either message, blocks, or purchase_order_number is required' }),
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