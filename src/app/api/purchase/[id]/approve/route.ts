// [구매요청 최종 결제 처리 API]
// 이 엔드포인트는 구매요청(purchase_requests) 테이블의 특정 id에 대해 is_payment_completed를 '완료'로 변경합니다.
// - 결제 승인(최종 결제) 시 사용됩니다.
// - Supabase 서비스 역할 키를 사용하여 안전하게 DB를 업데이트합니다.
// - 에러 및 환경 변수 체크 포함.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 환경 변수에서 Supabase 정보 불러오기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  // 환경 변수 누락 시 서버 에러 발생
  throw new Error('Missing Supabase environment variables');
}

// Supabase 클라이언트 생성 (서비스 역할 키 사용)
const supabase = createClient(supabaseUrl, serviceRoleKey);

// POST 메서드: 결제 승인 처리
export async function POST(req: any, { params }: { params: any }) {
  const { id } = params; // URL 파라미터에서 id 추출
  try {
    // 해당 id의 is_payment_completed와 final_manager_approved_at를 업데이트
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('purchase_requests')
      .update({ is_payment_completed: true, final_manager_approved_at: now })
      .eq('id', Number(id));
    if (error) throw error;
    // 성공 시 JSON 응답
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    // 에러 발생 시 에러 메시지 반환
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
} 