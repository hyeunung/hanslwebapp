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

// Private 파일 업로드 후 메시지로 공유하는 방식
async function sendMessageWithAttachment(
  user_id: string, 
  purchase_order_number: string, 
  message?: string
): Promise<any> {
  console.log(`🚀 sendMessageWithAttachment 시작: ${purchase_order_number}, user: ${user_id}`);
  
  const slackUserToken = Deno.env.get('SLACK_USER_TOKEN');
  if (!slackUserToken) {
    console.error('❌ SLACK_USER_TOKEN이 설정되지 않음');
    throw new Error('SLACK_USER_TOKEN not configured');
  }
  console.log('✅ SLACK_USER_TOKEN 확인됨');

  // 1. Storage에서 파일 다운로드 시도
  const filename = `${purchase_order_number}.xlsx`;
  console.log(`📂 Storage에서 파일 다운로드 시도: ${filename}`);
  
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('po-files')
    .download(filename);

  if (downloadError || !fileData) {
    console.error(`❌ Storage 파일 다운로드 실패: ${filename}`, downloadError);
    
    // 파일이 없을 때 간단한 실패 메시지만 전송
    const fallbackMessage = `❗ *파일 첨부 실패*

📋 발주번호: ${purchase_order_number}
📎 요청한 발주서 파일을 찾을 수 없습니다.

관리자에게 문의하세요.`;
    
    const fallbackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: user_id,
        text: fallbackMessage,
        as_user: true,
      }),
    });

    const fallbackData = await fallbackResponse.json();
    console.log('Fallback message sent due to missing file:', fallbackData);
    
    return {
      ok: fallbackData.ok,
      message: 'File not found, fallback message sent',
      file_error: downloadError?.message || 'File not found',
      slack_response: fallbackData
    };
  }

  console.log(`✅ 파일 로드 성공: ${filename}, 크기: ${fileData.size} bytes`);

  // 2. 파일을 ArrayBuffer로 변환
  const arrayBuffer = await fileData.arrayBuffer();
  const fileSize = arrayBuffer.byteLength;
  console.log(`📦 ArrayBuffer 크기: ${fileSize} bytes`);

  // 3. Private 파일로 업로드 (3단계 방식)
  console.log('🚀 Step 1: getUploadURLExternal 호출...');
  
  const uploadUrlResponse = await fetch('https://slack.com/api/files.getUploadURLExternal', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${slackUserToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      filename: `${purchase_order_number}.xlsx`,
      length: fileSize.toString()
    }),
  });
  
  const uploadUrlData = await uploadUrlResponse.json();
  console.log('🔗 업로드 URL 응답:', JSON.stringify(uploadUrlData, null, 2));
  
  if (!uploadUrlData.ok) {
    console.error('❌ 업로드 URL 요청 실패:', uploadUrlData.error);
    throw new Error(`Failed to get upload URL: ${uploadUrlData.error}`);
  }

  // 4. Step 2: 파일 업로드
  console.log('📤 Step 2: 파일 업로드...');
  
  const uploadResponse = await fetch(uploadUrlData.upload_url, {
    method: 'POST',
    body: arrayBuffer,
  });
  
  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('❌ 파일 업로드 실패:', uploadResponse.status, errorText);
    throw new Error(`Failed to upload file: ${uploadResponse.status}`);
  }

  console.log('✅ 파일 업로드 성공!');

  // 5. Step 3: Private 파일로 업로드 완료 (채널 지정 없음)
  console.log('🎆 Step 3: Private 파일 업로드 완료...');
  
  const completeUploadPayload = {
    files: [{
      id: uploadUrlData.file_id,
      title: `${purchase_order_number}.xlsx`
    }]
    // channels 없음 - Private 파일로 업로드
  };
  
  const completeUploadResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${slackUserToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(completeUploadPayload),
  });
  
  const completeUploadData = await completeUploadResponse.json();
  console.log('🎆 업로드 완료 응답:', JSON.stringify(completeUploadData, null, 2));
  
  if (!completeUploadData.ok) {
    console.error('❌ 업로드 완료 실패:', completeUploadData.error);
    throw new Error(`Failed to complete file upload: ${completeUploadData.error}`);
  }

  console.log('✨ Private 파일 업로드 완료!');
  
  // 6. 업로드된 파일 정보 가져오기
  const fileInfo = completeUploadData.files[0];
  const fileId = fileInfo.id;
  const permalink = fileInfo.permalink;
  
  console.log(`📄 파일 ID: ${fileId}`);
  console.log(`🔗 파일 링크: ${permalink}`);

  // 7. DM으로 파일 정보가 포함된 메시지 전송
  console.log('💬 파일 정보가 포함된 DM 메시지 전송...');
  
  const dmMessage = message || `${purchase_order_number}`;
  const fullMessage = `${dmMessage}

📎 첨부파일: ${purchase_order_number}.xlsx
🔗 다운로드: ${permalink}`;
  
  const dmResponse = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${slackUserToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: user_id,
      text: fullMessage,
      as_user: true,
    }),
  });

  const dmData = await dmResponse.json();
  console.log('💬 DM 전송 응답:', JSON.stringify(dmData, null, 2));
  
  if (!dmData.ok) {
    console.error('❌ DM 전송 실패:', dmData.error);
    throw new Error(`Failed to send DM: ${dmData.error}`);
  }
  
  console.log('✅ 파일 포함 DM 전송 성공!');
  
  return {
    file_upload: completeUploadData,
    dm_message: dmData,
    file_id: fileId,
    permalink: permalink,
    ok: true
  };
}

// 간단한 텍스트 메시지만 전송하는 함수
async function sendSimpleMessage(user_id: string, message?: string, blocks?: any[]): Promise<any> {
  console.log(`📨 간단한 메시지 전송: ${user_id}`);
  
  const slackUserToken = Deno.env.get('SLACK_USER_TOKEN');
  if (!slackUserToken) {
    console.error('❌ SLACK_USER_TOKEN이 설정되지 않음');
    throw new Error('SLACK_USER_TOKEN not configured');
  }

  const payload: any = {
    channel: user_id,
    text: message || '',  // message가 없으면 빈 문자열
    as_user: true,
  };

  if (blocks && blocks.length > 0) {
    payload.blocks = blocks;
  }

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${slackUserToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  console.log('📨 메시지 전송 응답:', JSON.stringify(data, null, 2));
  
  return data;
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
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const requestData: SlackDMRequest = await req.json();
    console.log('📨 요청 받음:', JSON.stringify(requestData, null, 2));

    const { 
      user_id, 
      message, 
      blocks,
      purchase_order_number,
      with_attachment 
    } = requestData;

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let result;

    // 첨부파일이 필요한 경우
    if (with_attachment && purchase_order_number) {
      console.log('📎 첨부파일 포함 메시지 전송 시도...');
      try {
        result = await sendMessageWithAttachment(user_id, purchase_order_number, message);
      } catch (error) {
        console.error('❌ 첨부파일 전송 실패:', error);
        return new Response(JSON.stringify({ 
          error: 'File attachment failed',
          error_message: error.message,
          error_stack: error.stack,
          purchase_order_number,
          user_id
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      // 간단한 텍스트 메시지만 전송
      console.log('📨 간단한 텍스트 메시지 전송...');
      if (!message && (!blocks || blocks.length === 0)) {
        return new Response(JSON.stringify({ error: 'message or blocks is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      try {
        result = await sendSimpleMessage(user_id, message, blocks);
      } catch (error) {
        console.error('❌ 메시지 전송 실패:', error);
        return new Response(JSON.stringify({ 
          error: 'Message sending failed',
          error_message: error.message,
          error_stack: error.stack,
          user_id
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('💥 Edge Function 오류:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      error_message: error.message,
      error_stack: error.stack 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});