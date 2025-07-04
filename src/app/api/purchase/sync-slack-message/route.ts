import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('슬랙 메시지 동기화 API 호출됨');
    
    const body = await request.json();
    const { purchase_order_number } = body;

    if (!purchase_order_number) {
      return NextResponse.json(
        { error: '발주번호가 필요합니다' },
        { status: 400 }
      );
    }

    console.log('발주번호:', purchase_order_number);

    // Supabase Edge Function 호출
    const supabaseUrl = 'https://qvhbigvdfyvhoegkhvef.supabase.co';
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg';

    const response = await fetch(`${supabaseUrl}/functions/v1/slack-message-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ purchase_order_number })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Edge Function 호출 실패:', result);
      return NextResponse.json(
        { error: 'Edge Function 호출 실패', details: result },
        { status: response.status }
      );
    }

    console.log('Edge Function 호출 성공:', result);
    
    return NextResponse.json({
      success: true,
      message: '슬랙 메시지 동기화가 완료되었습니다',
      purchase_order_number,
      details: result
    });

  } catch (error) {
    console.error('API 에러:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 