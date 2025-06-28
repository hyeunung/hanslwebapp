-- 2025-06-29: 중복 알림 제거
-- INSERT 시 기존 텍스트 알림을 제거하고 Block Kit 알림만 유지

CREATE OR REPLACE FUNCTION send_purchase_notifications()
RETURNS TRIGGER AS $$
DECLARE
    message_text TEXT;
    target_slack_ids TEXT[];
    current_slack_id TEXT;
    download_link TEXT;
    item_details TEXT;
    target_role TEXT;
BEGIN
    -- 1. 발주 요청 알림 (INSERT 시) -> 제거됨
    -- Block Kit 알림은 purchase_request_items INSERT 트리거에서 처리
    IF TG_OP = 'INSERT' THEN
        -- 기존 텍스트 알림 제거됨
        
        -- 3. 선진행 발주서 알림 (INSERT 시 + progress_type = '선진행') [기존 로직 유지]
        IF NEW.progress_type = '선진행' THEN
            -- Lead Buyer들의 slack_id 조회
            SELECT array_agg(e.slack_id) INTO target_slack_ids
            FROM employees e
            WHERE e.purchase_role @> ARRAY['Lead Buyer'];
            
            message_text := format(
                '발주번호 : %s에 대한 발주서 다운로드가 활성화 되었습니다. 업무에 참고 바랍니다.',
                COALESCE(NEW.purchase_order_number, '미지정')
            );
            
            -- 각 Lead Buyer에게 DM 전송
            FOREACH current_slack_id IN ARRAY target_slack_ids
            LOOP
                PERFORM net.http_post(
                    url := 'https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/slack-dm-sender',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg'
                    ),
                    body := jsonb_build_object(
                        'user_id', current_slack_id,
                        'message', message_text
                    )
                );
            END LOOP;
        END IF;
        
        -- 7. 구매 요청 선진행 알림 [기존 로직 유지]
        IF NEW.payment_category = '구매 요청' AND NEW.progress_type = '선진행' THEN
            SELECT array_agg(e.slack_id) INTO target_slack_ids
            FROM employees e
            WHERE e.purchase_role @> ARRAY['Lead Buyer'];
            
            message_text := format(
                '발주번호 : %s 에 대한 ''%s''님의 구매요청이 있습니다. 구매 진행 부탁드립니다.',
                COALESCE(NEW.purchase_order_number, '미지정'),
                COALESCE(NEW.requester_name, '미지정')
            );
            
            FOREACH current_slack_id IN ARRAY target_slack_ids
            LOOP
                PERFORM net.http_post(
                    url := 'https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/slack-dm-sender',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg'
                    ),
                    body := jsonb_build_object(
                        'user_id', current_slack_id,
                        'message', message_text
                    )
                );
            END LOOP;
        END IF;
    END IF;
    
    -- 2. 최종 결제 요청 알림 (중간관리자 승인 시) [기존 로직 유지]
    IF TG_OP = 'UPDATE' AND NEW.middle_manager_status = 'approved' AND (OLD.middle_manager_status IS DISTINCT FROM NEW.middle_manager_status) THEN
        IF NEW.request_type = '원자재' THEN
            target_role := 'raw_material_manager';
        ELSIF NEW.request_type = '소모품' THEN
            target_role := 'consumable_manager';
        ELSE
            target_role := 'final_approver';
        END IF;
        
        SELECT array_agg(e.slack_id) INTO target_slack_ids
        FROM employees e
        WHERE e.purchase_role @> ARRAY[target_role];
        
        message_text := format(
            '%s님의 발주번호 : %s (%s) 에 대한 최종 승인 요청이 있습니다.',
            COALESCE(NEW.requester_name, '미지정'),
            COALESCE(NEW.purchase_order_number, '미지정'),
            COALESCE(NEW.request_type, '미지정')
        );
        
        FOREACH current_slack_id IN ARRAY target_slack_ids
        LOOP
            PERFORM net.http_post(
                url := 'https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/slack-dm-sender',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg'
                ),
                body := jsonb_build_object(
                    'user_id', current_slack_id,
                    'message', message_text
                )
            );
        END LOOP;
    END IF;
    
    -- 4. 일반 발주서 알림 (최종승인 시 + progress_type = '일반') [기존 로직 유지]
    IF TG_OP = 'UPDATE' AND NEW.final_manager_status = 'approved' AND (OLD.final_manager_status IS DISTINCT FROM NEW.final_manager_status) AND NEW.progress_type = '일반' THEN
        SELECT array_agg(e.slack_id) INTO target_slack_ids
        FROM employees e
        WHERE e.purchase_role @> ARRAY['Lead Buyer'];
        
        message_text := format(
            '발주번호 : %s에 대한 발주서 다운로드가 활성화 되었습니다. 업무에 참고 바랍니다.',
            COALESCE(NEW.purchase_order_number, '미지정')
        );
        
        FOREACH current_slack_id IN ARRAY target_slack_ids
        LOOP
            PERFORM net.http_post(
                url := 'https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/slack-dm-sender',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg'
                ),
                body := jsonb_build_object(
                    'user_id', current_slack_id,
                    'message', message_text
                )
            );
        END LOOP;
    END IF;
    
    -- 5. 구매 요청 최종승인 알림 [기존 로직 유지]
    IF TG_OP = 'UPDATE' AND NEW.final_manager_status = 'approved' AND (OLD.final_manager_status IS DISTINCT FROM NEW.final_manager_status) AND NEW.payment_category = '구매 요청' THEN
        SELECT array_agg(e.slack_id) INTO target_slack_ids
        FROM employees e
        WHERE e.purchase_role @> ARRAY['Lead Buyer'];
        
        message_text := format(
            '발주번호 : %s 에 대한 ''%s''님의 구매요청이 있습니다. 구매 진행 부탁드립니다.',
            COALESCE(NEW.purchase_order_number, '미지정'),
            COALESCE(NEW.requester_name, '미지정')
        );
        
        FOREACH current_slack_id IN ARRAY target_slack_ids
        LOOP
            PERFORM net.http_post(
                url := 'https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/slack-dm-sender',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg'
                ),
                body := jsonb_build_object(
                    'user_id', current_slack_id,
                    'message', message_text
                )
            );
        END LOOP;
    END IF;
    
    -- 6. 입고 완료 알림 (채널 알림) [기존 로직 유지]
    IF TG_OP = 'UPDATE' AND NEW.is_received = TRUE AND (OLD.is_received IS DISTINCT FROM NEW.is_received) THEN
        SELECT string_agg(
            format('• 품명: %s%s• 규격: %s%s• 수량: %s%s• 비고: %s', 
                   COALESCE(item_name, '미지정'), chr(10),
                   COALESCE(specification, '미지정'), chr(10),
                   COALESCE(quantity::text, '0'), chr(10),
                   COALESCE(remark, '없음')), 
            chr(10) || chr(10)
        ) INTO item_details
        FROM purchase_request_items 
        WHERE purchase_request_id = NEW.id;
        
        message_text := format(
            '📦 *입고 처리 완료*%s%s🔸 *발주번호*: %s%s🔸 *구매업체*: %s%s🔸 *입고요청일*: %s%s🔸 *구매요청자*: %s%s%s*품목 정보:*%s%s',
            chr(10), chr(10),
            COALESCE(NEW.purchase_order_number, '미지정'), chr(10),
            COALESCE(NEW.vendor_name, '미지정'), chr(10),
            COALESCE(NEW.delivery_request_date::text, '미지정'), chr(10),
            COALESCE(NEW.requester_name, '미지정'), chr(10), chr(10),
            chr(10),
            COALESCE(item_details, '품목 정보 없음')
        );
        
        -- 입고-현황 채널에 메시지 전송
        PERFORM net.http_post(
            url := 'https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/slack-dm-sender',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg'
            ),
            body := jsonb_build_object(
                'user_id', 'C08SQT4509E',
                'message', message_text
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 변경사항 요약:
-- 1. INSERT 시 중간관리자에게 보내는 기존 텍스트 알림 제거
-- 2. Block Kit 알림만 purchase_request_items INSERT 트리거에서 처리
-- 3. 다른 모든 알림 로직은 기존과 동일하게 유지