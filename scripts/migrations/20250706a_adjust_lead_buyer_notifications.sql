-- 20250706a_adjust_lead_buyer_notifications.sql
-- Purpose: Refine Lead Buyer DM conditions.
--   1) Send DM only when a new purchase request is INSERTED with progress_type = '선진행'.
--   2) Send DM when an existing purchase request (non-선진행) gets final approval (final_manager_status changes to 'approved').

-- Replace the existing unified notification function with the adjusted logic.

CREATE OR REPLACE FUNCTION public.notify_lead_buyer_unified()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    lead_buyer_slack_ids TEXT[];
    slack_id TEXT;
    supabase_url TEXT := 'https://qvhbigvdfyvhoegkhvef.supabase.co';
    anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg';
    should_notify BOOLEAN := FALSE;
    notification_reason TEXT;
BEGIN
    /*
      1. 선진행 요청 알림 (INSERT 직후)
     */
    IF TG_OP = 'INSERT' THEN
        IF NEW.progress_type = '선진행' THEN
            should_notify := TRUE;
            notification_reason := '선진행 요청 등록';
        END IF;

    /*
      2. 최종승인 알림 (일반 건만)
     */
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.final_manager_status = 'approved'
           AND OLD.final_manager_status IS DISTINCT FROM NEW.final_manager_status
           AND (NEW.progress_type IS NULL OR NEW.progress_type <> '선진행') THEN
            should_notify := TRUE;
            notification_reason := '최종승인 완료';
        END IF;
    END IF;

    -- 알림이 필요하지 않으면 종료
    IF NOT should_notify THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    /* Lead Buyer Slack ID 조회 */
    SELECT array_agg(e.slack_id)
      INTO lead_buyer_slack_ids
      FROM employees e
      WHERE e.purchase_role @> ARRAY['lead buyer']
        AND e.slack_id IS NOT NULL
        AND e.slack_id != '';

    IF lead_buyer_slack_ids IS NULL OR array_length(lead_buyer_slack_ids, 1) = 0 THEN
        RAISE WARNING 'No Lead Buyer found with valid Slack ID for notification: %', notification_reason;
        RETURN COALESCE(NEW, OLD);
    END IF;

    /* 각 Lead Buyer에게 DM 발송 */
    FOREACH slack_id IN ARRAY lead_buyer_slack_ids
    LOOP
        BEGIN
            PERFORM net.http_post(
                url := supabase_url || '/functions/v1/slack-dm-sender',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || anon_key
                ),
                body := jsonb_build_object(
                    'user_id', slack_id,
                    'blocks', jsonb_build_array(
                        jsonb_build_object(
                            'type', 'section',
                            'text', jsonb_build_object(
                                'type', 'mrkdwn',
                                'text', '📋 *발주서 파일*'
                            )
                        ),
                        jsonb_build_object(
                            'type', 'section',
                            'text', jsonb_build_object(
                                'type', 'mrkdwn',
                                'text',
                                '🔸 *발주번호:* ' || NEW.purchase_order_number || E'\n' ||
                                '🔸 *구매요청자:* ' || NEW.requester_name || E'\n' ||
                                '🔸 *업체명:* ' || COALESCE(NEW.vendor_name, '미정') || E'\n' ||
                                '🔸 *총액:* ' || COALESCE(NEW.total_amount::TEXT, '0') || ' ' || NEW.currency
                            )
                        ),
                        jsonb_build_object(
                            'type', 'actions',
                            'elements', jsonb_build_array(
                                jsonb_build_object(
                                    'type', 'button',
                                    'text', jsonb_build_object(
                                        'type', 'plain_text',
                                        'text', 'Excel 다운로드'
                                    ),
                                    'style', 'primary',
                                    'url', 'https://hanslwebapp.vercel.app/api/excel/download/' || NEW.purchase_order_number,
                                    'action_id', 'excel_download'
                                )
                            )
                        )
                    )
                )
            );
            RAISE NOTICE 'Lead Buyer notification sent to % for %: %', slack_id, notification_reason, NEW.purchase_order_number;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to send notification to %: %', slack_id, SQLERRM;
        END;
    END LOOP;

    RETURN COALESCE(NEW, OLD);

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in Lead Buyer notification system: %', SQLERRM;
        RETURN COALESCE(NEW, OLD);
END;
$$;
