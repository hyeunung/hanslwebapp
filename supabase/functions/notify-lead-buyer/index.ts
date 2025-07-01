import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// JWT 검증 완전 비활성화
export const config = { verify_jwt: false, cors: true };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestPayload {
  purchaseRequestId: number;
  triggerType?: string;
  progressType?: string;
  finalManagerStatus?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Supabase 클라이언트 초기화 (인증 없이)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Slack 설정 - USER TOKEN 사용 (파일 업로드용)
    const slackUserToken = Deno.env.get('SLACK_USER_TOKEN')!;

    const { purchaseRequestId }: RequestPayload = await req.json();

    if (!purchaseRequestId) {
      return new Response(
        JSON.stringify({ error: 'purchaseRequestId가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Lead Buyer 알림 처리 시작: ID ${purchaseRequestId}`);

    // 1. 발주 요청 정보 조회
    const { data: purchaseRequest, error: requestError } = await supabase
      .from('purchase_requests')
      .select('*')
      .eq('id', purchaseRequestId)
      .single();

    if (requestError || !purchaseRequest) {
      console.error('발주 요청 조회 오류:', requestError);
      return new Response(
        JSON.stringify({ error: '발주 요청을 찾을 수 없습니다.', details: requestError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Lead Buyer 정보 조회 (이채령님)
    const { data: leadBuyer, error: buyerError } = await supabase
      .from('employees')
      .select('id, name, slack_id')
      .contains('purchase_role', ['Lead Buyer'])
      .single();

    if (buyerError || !leadBuyer) {
      console.error('Lead Buyer 조회 오류:', buyerError);
      return new Response(
        JSON.stringify({ error: 'Lead Buyer를 찾을 수 없습니다.', details: buyerError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Lead Buyer: ${leadBuyer.name} (${leadBuyer.slack_id})`);

    // 3. 기존 발주서 파일 확인 및 다운로드
    const purchaseOrderNumber = purchaseRequest.purchase_order_number || `PO_${purchaseRequestId}`;
    let fileBuffer: Uint8Array;
    let fileName: string;
    
    // 3-1. Storage에서 기존 파일 찾기 - 재시도 로직 포함
    const possibleFileNames = [
      `${purchaseOrderNumber}.xlsx`,
      `발주서_${purchaseOrderNumber}.xlsx`,
    ];
    
    let existingFile = null;
    
    // 파일 검색 함수 (재시도 지원)
    const searchForFile = async () => {
      for (const possibleFileName of possibleFileNames) {
        try {
          console.log(`파일 검색 중: ${possibleFileName}`);
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('po-files')
            .download(possibleFileName);
            
          if (!downloadError && fileData) {
            console.log(`파일 발견: ${possibleFileName}`);
            return { file: fileData, name: possibleFileName };
          }
        } catch (error) {
          console.log(`파일 없음: ${possibleFileName}`);
          continue;
        }
      }
      return null;
    };
    
    // 첫 번째 검색 시도
    let fileResult = await searchForFile();
    
    // 파일을 못 찾았고 선진행인 경우 재시도 (파일 업로드 대기)
    if (!fileResult && purchaseRequest.progress_type === '선진행') {
      console.log('선진행 요청: 파일 업로드 완료 대기 중... (3초)');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 두 번째 검색 시도
      fileResult = await searchForFile();
      
      if (!fileResult) {
        console.log('재시도 후에도 파일을 찾을 수 없음 - 5초 더 대기');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 세 번째 검색 시도
        fileResult = await searchForFile();
      }
    }
    
    if (fileResult) {
      existingFile = fileResult.file;
      fileName = fileResult.name;
      fileBuffer = new Uint8Array(await existingFile.arrayBuffer());
      console.log(`기존 파일 사용: ${fileName} (${fileBuffer.length} bytes)`);
    } else {
      // 기존 파일이 없으면 간단한 텍스트 파일 생성
      console.log('기존 파일 없음 - 텍스트 파일 생성');
      const textData = `발주서

발주번호: ${purchaseOrderNumber}
구매요청자: ${purchaseRequest.requester_name}
업체명: ${purchaseRequest.vendor_name || ''}
요청일자: ${purchaseRequest.request_date}
진행상태: ${purchaseRequest.progress_type}
요청유형: ${purchaseRequest.request_type}

총액: ${purchaseRequest.total_amount}`;
      
      fileBuffer = new TextEncoder().encode(textData);
      fileName = `발주서_${purchaseOrderNumber}.txt`;
    }

    // 4. DM 채널 열기
    console.log('DM 채널 생성 중...');
    const dmChannelResponse = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        users: leadBuyer.slack_id
      })
    });

    const dmChannel = await dmChannelResponse.json();

    if (!dmChannel.ok || !dmChannel.channel?.id) {
      console.error('DM 채널 생성 실패:', dmChannel);
      return new Response(
        JSON.stringify({ error: 'DM 채널 생성에 실패했습니다.', details: dmChannel.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`DM 채널 생성 성공: ${dmChannel.channel.id}`);

    // 5. 메시지 내용 구성
    const message = `📋 발주서 파일

🔶 발주번호: ${purchaseOrderNumber}
🔶 구매요청자: ${purchaseRequest.requester_name}
🔶 요청유형: ${purchaseRequest.request_type}
🔶 진행상태: ${purchaseRequest.progress_type}

첨부된 파일을 확인해 주세요.`;

    // 6. 파일 업로드 (새로운 Slack API 방식 사용)
    console.log('파일 업로드 중...');
    
    // files.getUploadURLExternal API 사용
    const uploadUrlResponse = await fetch('https://slack.com/api/files.getUploadURLExternal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: fileName,
        length: fileBuffer.length
      })
    });

    const uploadUrlData = await uploadUrlResponse.json();
    
    if (!uploadUrlData.ok) {
      console.error('Upload URL 요청 실패:', uploadUrlData);
      return new Response(
        JSON.stringify({ error: 'Upload URL 요청에 실패했습니다.', details: uploadUrlData.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 파일을 업로드 URL에 업로드
    const fileUploadResponse = await fetch(uploadUrlData.upload_url, {
      method: 'POST',
      body: fileBuffer
    });

    if (!fileUploadResponse.ok) {
      console.error('파일 업로드 실패:', fileUploadResponse.status);
      return new Response(
        JSON.stringify({ error: '파일 업로드에 실패했습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // files.completeUploadExternal로 업로드 완료
    const completeResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slackUserToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: [{
          id: uploadUrlData.file_id,
          title: fileName
        }],
        channel_id: dmChannel.channel.id,
        initial_comment: message
      })
    });

    const completeData = await completeResponse.json();

    if (!completeData.ok) {
      console.error('파일 업로드 완료 실패:', completeData);
      return new Response(
        JSON.stringify({ error: 'Slack 파일 업로드 완료에 실패했습니다.', details: completeData.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('파일 업로드 성공!');

    // 7. 알림 로그 저장
    await supabase.from('lead_buyer_notifications').insert({
      purchase_request_id: purchaseRequestId,
      trigger_type: 'FUNCTION_CALL',
      progress_type: purchaseRequest.progress_type,
      final_manager_status: purchaseRequest.final_manager_status,
      success: true,
      api_response: JSON.stringify({ 
        fileId: completeData.files?.[0]?.id,
        fileName: fileName,
        message: 'V2 API 사용 - 파일 업로드 성공'
      })
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `${leadBuyer.name}님에게 발주서가 성공적으로 전송되었습니다.`,
        details: {
          recipientName: leadBuyer.name,
          slackId: leadBuyer.slack_id,
          fileName: fileName,
          purchaseOrderNumber: purchaseOrderNumber,
          requesterName: purchaseRequest.requester_name,
          requestType: purchaseRequest.request_type,
          progressType: purchaseRequest.progress_type,
          fileId: completeData.files?.[0]?.id
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Lead Buyer 알림 전송 중 오류:', error);
    
    // 오류 로그도 저장
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!
      );
      
      await supabase.from('lead_buyer_notifications').insert({
        purchase_request_id: (await req.json())?.purchaseRequestId || 0,
        trigger_type: 'FUNCTION_CALL',
        success: false,
        api_response: `ERROR: ${error.message}`
      });
    } catch (logError) {
      console.error('로그 저장 실패:', logError);
    }
    
    return new Response(
      JSON.stringify({ error: 'Lead Buyer 알림 전송 중 오류가 발생했습니다.', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});