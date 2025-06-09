// [중간 관리자 알림 프록시 API]
// 클라이언트에서 이 엔드포인트로 POST 요청을 보내면, 서버가 Edge Function(서버리스 함수)으로 요청을 프록시(중계)합니다.
// - 보안, CORS, 환경 변수 보호, 추가 로직 삽입 등을 위해 사용합니다.
// - Edge Function의 응답을 그대로 클라이언트에 전달합니다.

import { NextRequest, NextResponse } from 'next/server';

// POST 메서드: 중간 관리자 알림을 Edge Function으로 전달
export async function POST(req: NextRequest) {
  try {
    // 클라이언트에서 받은 요청 body 파싱
    const body = await req.json();
    // 환경 변수에서 Edge Function URL을 가져옴
    const edgeUrl = process.env.NEXT_PUBLIC_EDGE_URL;
    if (!edgeUrl) {
      // 환경 변수 누락 시 에러 반환
      return NextResponse.json({ error: 'Missing NEXT_PUBLIC_EDGE_URL environment variable.' }, { status: 500 });
    }
    // 실제 호출할 Edge Function URL 생성
    const EDGE_URL = edgeUrl + '/notify-middle-manager';

    // Edge Function으로 POST 요청 전달
    const response = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // Edge Function의 응답을 그대로 반환
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err: any) {
    // 예외 발생 시 에러 메시지 반환
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
} 