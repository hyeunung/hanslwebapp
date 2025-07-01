import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WebClient } from '@slack/web-api';

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Slack 클라이언트 초기화
const slack = new WebClient(process.env.SLACK_USER_TOKEN);

export async function POST(request: NextRequest) {
  try {
    const { fileName, message = "파일을 전송드립니다." } = await request.json();
    
    if (!fileName) {
      return NextResponse.json({ error: 'fileName이 필요합니다.' }, { status: 400 });
    }

    // 1. 중간관리자 정보 조회
    const { data: middleManager, error: employeeError } = await supabase
      .from('employees')
      .select('id, name, slack_id')
      .contains('purchase_role', ['middle_manager'])
      .single();

    if (employeeError || !middleManager) {
      return NextResponse.json(
        { error: '중간관리자를 찾을 수 없습니다.', details: employeeError }, 
        { status: 404 }
      );
    }

    // 2. Supabase Storage에서 파일 다운로드
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('po-files')
      .download(fileName);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: '파일 다운로드에 실패했습니다.', details: downloadError }, 
        { status: 404 }
      );
    }

    // 3. 파일을 Buffer로 변환
    const fileBuffer = Buffer.from(await fileData.arrayBuffer());

    // 4. DM 채널 열기
    const dmChannel = await slack.conversations.open({
      users: middleManager.slack_id
    });

    if (!dmChannel.ok || !dmChannel.channel?.id) {
      return NextResponse.json(
        { error: 'DM 채널 생성에 실패했습니다.', details: dmChannel.error }, 
        { status: 500 }
      );
    }

    // 5. Slack으로 파일 업로드 및 메시지 전송
    const result = await slack.filesUploadV2({
      channel_id: dmChannel.channel.id,
      file: fileBuffer,
      filename: fileName,
      initial_comment: `${message}\n\n📁 파일명: ${fileName}\n👤 수신자: ${middleManager.name} 님`
    });



    if (!result.ok) {
      return NextResponse.json(
        { error: 'Slack 파일 업로드에 실패했습니다.', details: result.error }, 
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${middleManager.name}님에게 파일이 성공적으로 전송되었습니다.`,
      details: {
        recipientName: middleManager.name,
        slackId: middleManager.slack_id,
        fileName: fileName,
        fileId: result.files?.[0]?.files?.[0]?.id
      }
    });

  } catch (error) {
    console.error('파일 전송 중 오류:', error);
    return NextResponse.json(
      { error: '파일 전송 중 오류가 발생했습니다.', details: error }, 
      { status: 500 }
    );
  }
}

// GET 메소드로 테스트용 파일 목록 조회
export async function GET() {
  try {
    // Storage에 있는 파일 목록 조회
    const { data: files, error } = await supabase.storage
      .from('po-files')
      .list('', {
        limit: 10,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      return NextResponse.json(
        { error: '파일 목록 조회에 실패했습니다.', details: error }, 
        { status: 500 }
      );
    }

    // .emptyFolderPlaceholder 파일 제외
    const filteredFiles = files?.filter(file => file.name !== '.emptyFolderPlaceholder') || [];

    return NextResponse.json({
      files: filteredFiles.map(file => ({
        name: file.name,
        size: file.metadata?.size,
        createdAt: file.created_at,
        updatedAt: file.updated_at
      }))
    });

  } catch (error) {
    console.error('파일 목록 조회 중 오류:', error);
    return NextResponse.json(
      { error: '파일 목록 조회 중 오류가 발생했습니다.', details: error }, 
      { status: 500 }
    );
  }
}