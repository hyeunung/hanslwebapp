import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WebClient } from '@slack/web-api';

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Slack 클라이언트 초기화 (USER TOKEN 사용)
const slack = new WebClient(process.env.SLACK_USER_TOKEN);

export async function POST(request: NextRequest) {
  try {
    const { purchaseRequestId } = await request.json();
    
    if (!purchaseRequestId) {
      return NextResponse.json({ error: 'purchaseRequestId가 필요합니다.' }, { status: 400 });
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
      return NextResponse.json(
        { error: '발주 요청을 찾을 수 없습니다.', details: requestError }, 
        { status: 404 }
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
      return NextResponse.json(
        { error: 'Lead Buyer를 찾을 수 없습니다.', details: buyerError }, 
        { status: 404 }
      );
    }

    console.log(`Lead Buyer: ${leadBuyer.name} (${leadBuyer.slack_id})`);

    // 3. 기존 발주서 파일 확인 및 다운로드
    const purchaseOrderNumber = purchaseRequest.purchase_order_number || `PO_${purchaseRequestId}`;
    let fileBuffer: Buffer;
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
      fileBuffer = Buffer.from(await existingFile.arrayBuffer());
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
      
      fileBuffer = Buffer.from(textData, 'utf-8');
      fileName = `발주서_${purchaseOrderNumber}.txt`;
    }

    // 4. DM 채널 열기
    console.log('DM 채널 생성 중...');
    const dmChannel = await slack.conversations.open({
      users: leadBuyer.slack_id
    });

    if (!dmChannel.ok || !dmChannel.channel?.id) {
      console.error('DM 채널 생성 실패:', dmChannel);
      return NextResponse.json(
        { error: 'DM 채널 생성에 실패했습니다.', details: dmChannel.error }, 
        { status: 500 }
      );
    }

    console.log(`DM 채널 생성 성공: ${dmChannel.channel.id}`);

    // 5. 메시지 내용 구성 (중간관리자와 동일한 형식)
    const message = `📋 발주서 파일

🔶 발주번호: ${purchaseOrderNumber}
🔶 구매요청자: ${purchaseRequest.requester_name}
🔶 요청유형: ${purchaseRequest.request_type}
🔶 진행상태: ${purchaseRequest.progress_type}

첨부된 파일을 확인해 주세요.`;

    // 6. 중간관리자 방식과 동일하게 파일 업로드
    console.log('파일 업로드 중...');
    const result = await slack.filesUploadV2({
      channel_id: dmChannel.channel.id,
      file: fileBuffer,
      filename: fileName,
      initial_comment: message
    });

    if (!result.ok) {
      console.error('파일 업로드 실패:', result);
      return NextResponse.json(
        { error: 'Slack 파일 업로드에 실패했습니다.', details: result.error }, 
        { status: 500 }
      );
    }

    console.log('파일 업로드 성공!');

    return NextResponse.json({
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
        fileId: result.files?.[0]?.files?.[0]?.id
      }
    });

  } catch (error) {
    console.error('Lead Buyer 알림 전송 중 오류:', error);
    return NextResponse.json(
      { error: 'Lead Buyer 알림 전송 중 오류가 발생했습니다.', details: error }, 
      { status: 500 }
    );
  }
}

// 조건 확인용 함수
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const purchaseRequestId = searchParams.get('id');

  if (!purchaseRequestId) {
    return NextResponse.json({ error: 'purchase request id가 필요합니다.' }, { status: 400 });
  }

  try {
    // 발주 요청 정보 조회
    const { data: purchaseRequest, error } = await supabase
      .from('purchase_requests')
      .select(`
        id,
        progress_type,
        final_manager_status,
        purchase_order_number,
        requester_name,
        request_type
      `)
      .eq('id', purchaseRequestId)
      .single();

    if (error || !purchaseRequest) {
      return NextResponse.json(
        { error: '발주 요청을 찾을 수 없습니다.', details: error }, 
        { status: 404 }
      );
    }

    // 조건 확인
    const shouldNotify = 
      purchaseRequest.progress_type === '선진행' || 
      (purchaseRequest.progress_type === '일반' && purchaseRequest.final_manager_status === 'approved');

    return NextResponse.json({
      purchaseRequest,
      shouldNotify,
      conditions: {
        isAdvanceProgress: purchaseRequest.progress_type === '선진행',
        isNormalWithApproved: purchaseRequest.progress_type === '일반' && purchaseRequest.final_manager_status === 'approved'
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: '조건 확인 중 오류가 발생했습니다.', details: error }, 
      { status: 500 }
    );
  }
}