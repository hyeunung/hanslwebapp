-- 2025-06-27: 알림 메시지를 Storage 직접 다운로드 링크로 변경

-- 알림 함수 수정: 웹앱 링크 대신 Storage 직접 다운로드 링크 사용
CREATE OR REPLACE FUNCTION send_purchase_notifications()
RETURNS TRIGGER AS $$
DECLARE
    message_text TEXT;
    target_slack_ids TEXT[];
    current_slack_id TEXT;
    storage_download_url TEXT;
    item_details TEXT;
    target_role TEXT;
BEGIN
    -- 1. 발주 요청 알림 (INSERT 시) -> middle_manager에게
    IF TG_OP = 'INSERT' THEN
        -- middle_manager들의 slack_id 조회
        SELECT array_agg(e.slack_id) INTO target_slack_ids
        FROM employees e
        WHERE e.purchase_role @> ARRAY['middle_manager'];
        
        message_text := format(
            '%s님으로 부터 발주번호 : %s 의 새로운 <https://work.hansl.com/dashboard?tab=dashboard&subtab=done|결제 요청>이 있습니다.',
            COALESCE(NEW.requester_name, '미지정'),
            COALESCE(NEW.purchase_order_number, '미지정')
        );
        
        -- 각 middle_manager에게 DM 전송
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
        
        -- 3. 선진행 발주서 알림 (INSERT 시 + progress_type = '선진행') -> Storage 직접 다운로드
        IF NEW.progress_type = '선진행' THEN
            -- Lead Buyer들의 slack_id 조회
            SELECT array_agg(e.slack_id) INTO target_slack_ids
            FROM employees e
            WHERE e.purchase_role @> ARRAY['Lead Buyer'];
            
            -- Storage 직접 다운로드 URL 생성
            storage_download_url := format(
                'https://qvhbigvdfyvhoegkhvef.supabase.co/storage/v1/object/public/po-files/%s.xlsx?download=발주서_한샘디지텍_%s.xlsx',
                NEW.purchase_order_number,
                NEW.purchase_order_number
            );
            
            message_text := format(
                '발주번호 : %s에 대한 <%s|발주서>다운로드가 활성화 되었습니다. 업무에 참고 바랍니다.',
                COALESCE(NEW.purchase_order_number, '미지정'),
                storage_download_url
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
        
        -- 7. 구매 요청 선진행 알림 (INSERT 시 + payment_category = '구매 요청' + progress_type = '선진행')
        IF NEW.payment_category = '구매 요청' AND NEW.progress_type = '선진행' THEN
            -- Lead Buyer들의 slack_id 조회
            SELECT array_agg(e.slack_id) INTO target_slack_ids
            FROM employees e
            WHERE e.purchase_role @> ARRAY['Lead Buyer'];
            
            message_text := format(
                '발주번호 : %s 에 대한 ''%s''님의 구매요청이 있습니다. 구매 진행 부탁드립니다.',
                COALESCE(NEW.purchase_order_number, '미지정'),
                COALESCE(NEW.requester_name, '미지정')
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
    END IF;
    
    -- 2. 최종 결제 요청 알림 (중간관리자 승인 시) -> 요청 유형별 담당자에게
    IF TG_OP = 'UPDATE' AND NEW.middle_manager_status = 'approved' AND (OLD.middle_manager_status IS DISTINCT FROM NEW.middle_manager_status) THEN
        -- 요청 유형별 담당자 결정
        CASE 
            WHEN NEW.request_type = '원자재' THEN
                target_role := 'U08MGQG5J8B'; -- 양승진
            WHEN NEW.request_type = '소모품' THEN  
                target_role := 'U04Q8J5FJ5G'; -- 황연순
            ELSE
                target_role := 'U08MGQG5J8B'; -- 기본값: 양승진
        END CASE;
        
        message_text := format(
            '%s님으로 부터 발주번호 : %s 의 <https://work.hansl.com/dashboard?tab=dashboard&subtab=done|최종 결제 요청>이 있습니다.',
            COALESCE(NEW.requester_name, '미지정'),
            COALESCE(NEW.purchase_order_number, '미지정')
        );
        
        -- 담당자에게 DM 전송
        PERFORM net.http_post(
            url := 'https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/slack-dm-sender',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg'
            ),
            body := jsonb_build_object(
                'user_id', target_role,
                'message', message_text
            )
        );
    END IF;
    
    -- 4. 일반 발주서 알림 (최종승인 시 + progress_type = '일반') -> Storage 직접 다운로드
    IF TG_OP = 'UPDATE' AND NEW.final_manager_status = 'approved' AND (OLD.final_manager_status IS DISTINCT FROM NEW.final_manager_status) AND NEW.progress_type = '일반' THEN
        -- Lead Buyer들의 slack_id 조회
        SELECT array_agg(e.slack_id) INTO target_slack_ids
        FROM employees e
        WHERE e.purchase_role @> ARRAY['Lead Buyer'];
        
        -- Storage 직접 다운로드 URL 생성
        storage_download_url := format(
            'https://qvhbigvdfyvhoegkhvef.supabase.co/storage/v1/object/public/po-files/%s.xlsx?download=발주서_한샘디지텍_%s.xlsx',
            NEW.purchase_order_number,
            NEW.purchase_order_number
        );
        
        message_text := format(
            '발주번호 : %s에 대한 <%s|발주서>다운로드가 활성화 되었습니다. 업무에 참고 바랍니다.',
            COALESCE(NEW.purchase_order_number, '미지정'),
            storage_download_url
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
    
    -- 5. 구매 요청 최종승인 알림 (최종승인 시 + payment_category = '구매 요청')
    IF TG_OP = 'UPDATE' AND NEW.final_manager_status = 'approved' AND (OLD.final_manager_status IS DISTINCT FROM NEW.final_manager_status) AND NEW.payment_category = '구매 요청' THEN
        -- Lead Buyer들의 slack_id 조회
        SELECT array_agg(e.slack_id) INTO target_slack_ids
        FROM employees e
        WHERE e.purchase_role @> ARRAY['Lead Buyer'];
        
        message_text := format(
            '발주번호 : %s 에 대한 ''%s''님의 구매요청이 있습니다. 구매 진행 부탁드립니다.',
            COALESCE(NEW.purchase_order_number, '미지정'),
            COALESCE(NEW.requester_name, '미지정')
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
    
    -- 6. 입고 완료 알림 (채널 알림) - 한 줄씩 보기 좋게 수정
    IF TG_OP = 'UPDATE' AND NEW.is_received = TRUE AND (OLD.is_received IS DISTINCT FROM NEW.is_received) THEN
        -- 품명, 규격, 수량, 비고 정보 조회 (한 줄씩 나누기)
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

-- 변경사항:
-- 1. 선진행 발주서 알림: Storage 직접 다운로드 URL 사용
-- 2. 일반 발주서 알림: Storage 직접 다운로드 URL 사용  
-- 3. ?download 파라미터로 파일명 지정하여 바로 다운로드
-- 4. 웹앱으로 이동하지 않고 파일 직접 다운로드