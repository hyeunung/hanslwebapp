import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { purchase_order_number, file_url } = await request.json();

    if (!purchase_order_number) {
      return NextResponse.json(
        { error: 'purchase_order_number가 필요합니다.' },
        { status: 400 }
      );
    }

    // Lead Buyer들의 slack_id 조회
    const { data: leadBuyers, error: queryError } = await supabase
      .from('employees')
      .select('slack_id')
      .contains('purchase_role', ['Lead Buyer']);

    if (queryError) {
      throw new Error(`Lead Buyer 조회 실패: ${queryError.message}`);
    }

    if (!leadBuyers || leadBuyers.length === 0) {
      return NextResponse.json(
        { error: 'Lead Buyer를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 웹앱 엑셀 다운로드 API URL 생성
    const downloadUrl = `https://hanslwebapp.vercel.app/api/excel/download/${purchase_order_number}`;
    console.log('생성된 다운로드 URL:', downloadUrl);
    
    const message = `발주번호 : ${purchase_order_number}에 대한 <${downloadUrl}|발주서> 다운로드가 활성화 되었습니다. 업무에 참고 바랍니다.`;

    // 모든 Lead Buyer에게 알림 전송
    const slackPromises = leadBuyers.map(buyer => 
      fetch('https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/slack-dm-sender', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg'
        },
        body: JSON.stringify({
          user_id: buyer.slack_id,
          message: message
        })
      })
    );

    const slackResults = await Promise.allSettled(slackPromises);
    
    // 실패한 알림 확인
    const failedResults = slackResults.filter(result => result.status === 'rejected');
    if (failedResults.length > 0) {
      console.warn('일부 슬랙 알림 전송 실패:', failedResults);
    }

    return NextResponse.json({ 
      success: true, 
      message: `${leadBuyers.length}명의 Lead Buyer에게 엑셀 다운로드 알림이 전송되었습니다.`,
      download_url: downloadUrl,
      sent_count: slackResults.filter(result => result.status === 'fulfilled').length,
      failed_count: failedResults.length
    });

  } catch (error) {
    console.error('알림 전송 오류:', error);
    return NextResponse.json(
      { error: '알림 전송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 