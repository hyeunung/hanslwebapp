import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service Role 클라이언트 (Storage 접근용)
const supabaseServiceRole = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    
    if (!orderNumber) {
      return NextResponse.json(
        { error: '발주번호가 필요합니다.' },
        { status: 400 }
      );
    }

    const filename = `${orderNumber}.xlsx`;
    
    // Supabase Storage에서 파일 다운로드
    const { data, error } = await supabaseServiceRole.storage
      .from('po-files')
      .download(filename);

    if (error || !data) {
      return NextResponse.json(
        { error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 다운로드용 파일명 생성
    const downloadFilename = `발주서_한샘디지텍_${orderNumber}.xlsx`;
    
    // ArrayBuffer를 Uint8Array로 변환
    const arrayBuffer = await data.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Excel 파일로 응답 (직접 다운로드)
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: '다운로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}