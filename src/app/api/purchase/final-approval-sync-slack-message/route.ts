import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { purchase_order_number } = await request.json();
    
    if (!purchase_order_number) {
      return NextResponse.json({ error: '발주번호가 필요합니다' }, { status: 400 });
    }

    console.log('최종승인 Slack 메시지 동기화 요청:', purchase_order_number);

    // Supabase Edge Function 호출
    const response = await fetch('https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/final-approval-slack-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        purchase_order_number
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('최종승인 Slack 동기화 성공:', result);
      return NextResponse.json({
        success: true,
        message: '최종승인 슬랙 메시지 동기화 완료',
        ...result
      });
    } else {
      console.error('최종승인 Slack 동기화 실패:', result);
      return NextResponse.json({
        success: false,
        message: '최종승인 슬랙 메시지 동기화 실패',
        error: result
      }, { status: response.status });
    }

  } catch (error) {
    console.error('최종승인 Slack 동기화 API 에러:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal Server Error',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 