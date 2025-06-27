import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WebClient } from '@slack/web-api';

// Service Role 클라이언트 (Storage 접근용)
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Slack Web API 클라이언트
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const { channel_id, initial_comment } = await request.json();
    
    if (!orderNumber || !channel_id) {
      return NextResponse.json(
        { error: '발주번호와 채널 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const filename = `${orderNumber}.xlsx`;
    
    console.log(`슬랙 파일 업로드 시작: ${filename} → ${channel_id}`);
    
    // 1. Supabase Storage에서 파일 다운로드
    const { data, error } = await supabaseServiceRole.storage
      .from('po-files')
      .download(filename);

    if (error || !data) {
      console.error('Storage 다운로드 오류:', error);
      return NextResponse.json(
        { error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 2. ArrayBuffer를 Buffer로 변환 (Slack API에서 요구)
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 3. 슬랙에 파일 업로드
    const downloadFilename = `발주서_한샘디지텍_${orderNumber}.xlsx`;
    
    const result = await slack.filesUploadV2({
      channel_id: channel_id,
      file: buffer,
      filename: downloadFilename,
      initial_comment: initial_comment || `발주번호 : ${orderNumber}에 대한 발주서 파일입니다.`,
    });

    console.log('슬랙 파일 업로드 성공:', result.files);

    return NextResponse.json({
      success: true,
      file_id: (result as any).file?.id || null,
      message: '파일이 슬랙에 성공적으로 업로드되었습니다.'
    });

  } catch (error) {
    console.error('슬랙 파일 업로드 오류:', error);
    return NextResponse.json(
      { error: '파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}