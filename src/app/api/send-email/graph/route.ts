// [Microsoft Graph API를 통한 이메일 발송 API]
// 이 엔드포인트는 구매요청의 발주서 파일을 첨부하여 이메일을 발송하고, DB 상태를 업데이트하며, Slack 알림까지 전송합니다.
// - Microsoft Graph API로 메일 전송
// - Supabase로 DB 업데이트
// - Slack Web API로 알림 전송
// - 환경 변수, 에러 처리, 파일 첨부 등 협업과 유지보수에 용이하도록 작성

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import { WebClient } from '@slack/web-api';

// 환경 변수에서 필요한 정보 불러오기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const slackToken = process.env.SLACK_BOT_TOKEN;
const slackChannel = process.env.SLACK_PO_CHANNEL_ID;
const msGraphToken = process.env.MS_GRAPH_ACCESS_TOKEN;

if (!supabaseUrl || !serviceRoleKey || !slackToken || !slackChannel || !msGraphToken) {
  // 환경 변수 누락 시 서버 에러 발생
  throw new Error('Missing required environment variables');
}

// Supabase, Slack 클라이언트 생성
const supabase = createClient(supabaseUrl, serviceRoleKey);
const slack = new WebClient(slackToken);

// POST 메서드: 이메일 발송 및 상태 업데이트, Slack 알림
export async function POST(req: NextRequest) {
  try {
    // 요청 body에서 필요한 값 추출
    const { purchase_request_id, to, cc, subject, body } = await req.json();
    // DB에서 해당 구매요청의 발주서 파일 URL 조회
    const { data: pr, error } = await supabase
      .from('purchase_requests')
      .select('po_file_url')
      .eq('id', purchase_request_id)
      .single();
    if (error || !pr) {
      // 구매요청이 없으면 404 반환
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 발주서 파일을 Base64로 변환 (첨부파일용)
    const resp = await fetch(pr.po_file_url);
    const arrayBuffer = await resp.arrayBuffer();
    const contentBytes = Buffer.from(arrayBuffer).toString('base64');

    // Microsoft Graph API 클라이언트 초기화
    const graphClient = Client.init({
      authProvider: (done: (err: any, accessToken: string | null) => void) => {
        done(null, msGraphToken ?? null);
      }
    });

    // 메일 객체 생성 (첨부파일 포함)
    const mail = {
      message: {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: `${body}<br><br><a href="${pr.po_file_url}" target="_blank">발주서 보기/다운로드</a>`
        },
        toRecipients: to.map((email: string) => ({ emailAddress: { address: email } })),
        ccRecipients: cc.map((email: string) => ({ emailAddress: { address: email } })),
        attachments: [
          {
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: pr.po_file_url.split('/').pop(),
            contentBytes: contentBytes,
            contentType: 'application/pdf'
          }
        ]
      }
    };

    // Microsoft Graph API로 메일 전송
    await graphClient.api('/me/sendMail').post(mail);

    // DB에 이메일 발송 시각 업데이트
    await supabase
      .from('purchase_requests')
      .update({ email_status: new Date().toISOString() })
      .eq('id', purchase_request_id);

    // Slack 채널로 알림 전송 (slackChannel은 null이 아님을 보장)
    await slack.chat.postMessage({
      channel: slackChannel!,
      text: `📧 *발주서 이메일 전송 완료*  \n• 발주번호: #${purchase_request_id}`
    });

    // 성공 응답 반환
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    // 에러 발생 시 에러 메시지 반환
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
} 