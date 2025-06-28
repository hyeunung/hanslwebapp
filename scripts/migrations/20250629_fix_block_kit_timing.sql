-- 2025-06-29: Block Kit 알림 타이밍 수정
-- 품목 INSERT 완료 후 알림 생성하도록 수정

-- 1. notifications 테이블 생성 (없으면)
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    notification_type VARCHAR(50) NOT NULL,
    target_user_id TEXT,
    target_type VARCHAR(20) DEFAULT 'user',
    message_text TEXT,
    block_kit_payload JSONB,
    related_table VARCHAR(50),
    related_id BIGINT,
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    failed_reason TEXT,
    is_interactive BOOLEAN DEFAULT false,
    interaction_payload JSONB,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Block Kit 메시지 생성 함수 수정 (품목 없는 경우 대응)
CREATE OR REPLACE FUNCTION create_purchase_approval_block_kit(p_purchase_request_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    purchase_data RECORD;
    item_count INTEGER;
    first_item RECORD;
    block_kit_message JSONB;
    item_details_text TEXT;
    approval_url TEXT;
BEGIN
    -- 발주 요청 데이터 조회
    SELECT 
        pr.*,
        v.vendor_name as vendor_name
    INTO purchase_data
    FROM purchase_requests pr
    LEFT JOIN vendors v ON pr.vendor_id = v.id
    WHERE pr.id = p_purchase_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION '발주 요청을 찾을 수 없습니다: %', p_purchase_request_id;
    END IF;
    
    -- 품목 수량 및 첫 번째 품목 조회
    SELECT COUNT(*) INTO item_count
    FROM purchase_request_items 
    WHERE purchase_request_id = p_purchase_request_id;
    
    -- 품목이 없으면 NULL 반환 (나중에 다시 시도)
    IF item_count = 0 THEN
        RETURN NULL;
    END IF;
    
    SELECT * INTO first_item
    FROM purchase_request_items 
    WHERE purchase_request_id = p_purchase_request_id
    ORDER BY line_number
    LIMIT 1;
    
    -- 승인 URL 생성
    approval_url := format('https://work.hansl.com/purchase/approve?id=%s', p_purchase_request_id);
    
    -- 품목 상세 텍스트 생성
    IF item_count > 1 THEN
        item_details_text := format('%s (외 %s개)', 
            COALESCE(first_item.item_name, '미지정'), 
            item_count - 1);
    ELSE
        item_details_text := COALESCE(first_item.item_name, '미지정');
    END IF;
    
    -- Block Kit 메시지 구성
    block_kit_message := jsonb_build_object(
        'blocks', jsonb_build_array(
            -- 헤더
            jsonb_build_object(
                'type', 'header',
                'text', jsonb_build_object(
                    'type', 'plain_text',
                    'text', '📋 발주서 승인 요청 - ' || COALESCE(purchase_data.requester_name, '미지정'),
                    'emoji', true
                )
            ),
            
            -- 구분선
            jsonb_build_object('type', 'divider'),
            
            -- 기본 정보 섹션
            jsonb_build_object(
                'type', 'section',
                'fields', jsonb_build_array(
                    jsonb_build_object(
                        'type', 'mrkdwn',
                        'text', '*요청유형:*' || chr(10) || COALESCE(purchase_data.request_type, '미지정')
                    ),
                    jsonb_build_object(
                        'type', 'mrkdwn',
                        'text', '*결제유형:*' || chr(10) || COALESCE(purchase_data.payment_category, '미지정')
                    ),
                    jsonb_build_object(
                        'type', 'mrkdwn',
                        'text', '*업체명:*' || chr(10) || COALESCE(purchase_data.vendor_name, '미지정')
                    ),
                    jsonb_build_object(
                        'type', 'mrkdwn',
                        'text', '*담당자:*' || chr(10) || COALESCE(purchase_data.requester_name, '미지정')
                    )
                )
            ),
            
            -- 주문 품목 섹션
            jsonb_build_object(
                'type', 'section',
                'text', jsonb_build_object(
                    'type', 'mrkdwn',
                    'text', format('🗂️ *주문 품목 (외 %s개)*%s%s%s규격: %s | 수량: %s개 | 단가: ₩%s | 합계: ₩%s | 비고: %s',
                        GREATEST(item_count - 1, 0),
                        chr(10),
                        '*1번 - ' || COALESCE(first_item.item_name, '미지정') || '*',
                        chr(10),
                        COALESCE(first_item.specification, '미지정'),
                        COALESCE(first_item.quantity::text, '0'),
                        COALESCE(to_char(first_item.unit_price_value, 'FM999,999,999'), '0'),
                        COALESCE(to_char(first_item.amount_value, 'FM999,999,999'), '0'),
                        COALESCE(first_item.remark, '없음')
                    )
                )
            ),
            
            -- 품목 전체보기 버튼 (별도 섹션)
            jsonb_build_object(
                'type', 'actions',
                'elements', jsonb_build_array(
                    jsonb_build_object(
                        'type', 'button',
                        'text', jsonb_build_object(
                            'type', 'plain_text',
                            'text', '품목 전체보기',
                            'emoji', true
                        ),
                        'value', 'view_all_items',
                        'action_id', 'view_items_' || p_purchase_request_id
                    )
                )
            ),
            
            -- 금액 정보 섹션
            jsonb_build_object(
                'type', 'section',
                'fields', jsonb_build_array(
                    jsonb_build_object(
                        'type', 'mrkdwn',
                        'text', '*총 금액:*' || chr(10) || '₩' || COALESCE(to_char(purchase_data.total_amount, 'FM999,999,999'), '0')
                    ),
                    jsonb_build_object(
                        'type', 'mrkdwn',
                        'text', '*결제조건:*' || chr(10) || '월말 정산'
                    )
                )
            ),
            
            -- 구분선
            jsonb_build_object('type', 'divider'),
            
            -- 승인/반려 버튼
            jsonb_build_object(
                'type', 'actions',
                'elements', jsonb_build_array(
                    jsonb_build_object(
                        'type', 'button',
                        'text', jsonb_build_object(
                            'type', 'plain_text',
                            'text', '✅ 승인',
                            'emoji', true
                        ),
                        'style', 'primary',
                        'value', 'approve',
                        'action_id', 'approve_purchase_' || p_purchase_request_id
                    ),
                    jsonb_build_object(
                        'type', 'button',
                        'text', jsonb_build_object(
                            'type', 'plain_text',
                            'text', '❌ 반려',
                            'emoji', true
                        ),
                        'style', 'danger',
                        'value', 'reject',
                        'action_id', 'reject_purchase_' || p_purchase_request_id
                    )
                )
            ),
            
            -- 발주 요청자 정보 및 발주번호
            jsonb_build_object(
                'type', 'context',
                'elements', jsonb_build_array(
                    jsonb_build_object(
                        'type', 'mrkdwn',
                        'text', format('발주 요청자: %s | 승인 필요: 부서장 | 발주번호: %s',
                            COALESCE(purchase_data.requester_name, '미지정'),
                            COALESCE(purchase_data.purchase_order_number, '미지정')
                        )
                    )
                )
            )
        )
    );
    
    RETURN block_kit_message;
END;
$$;

-- 3. 지연된 Block Kit 알림 전송 함수
CREATE OR REPLACE FUNCTION send_delayed_block_kit_notification(p_purchase_request_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    block_kit_data JSONB;
    target_slack_ids TEXT[];
    current_slack_id TEXT;
    notification_id BIGINT;
BEGIN
    -- Block Kit 메시지 생성 시도
    SELECT create_purchase_approval_block_kit(p_purchase_request_id) INTO block_kit_data;
    
    -- 품목이 없으면 아직 처리하지 않음
    IF block_kit_data IS NULL THEN
        RAISE NOTICE 'Block Kit 알림 지연: 품목 데이터가 아직 없음 (ID: %)', p_purchase_request_id;
        RETURN;
    END IF;
    
    -- middle_manager들의 slack_id 조회
    SELECT array_agg(e.slack_id) INTO target_slack_ids
    FROM employees e
    WHERE e.purchase_role @> ARRAY['middle_manager'];
    
    -- 각 middle_manager에게 Block Kit 알림 생성
    FOREACH current_slack_id IN ARRAY target_slack_ids
    LOOP
        INSERT INTO notifications (
            notification_type,
            target_user_id,
            target_type,
            block_kit_payload,
            related_table,
            related_id,
            metadata,
            status,
            is_interactive
        ) VALUES (
            'purchase_approval_request',
            current_slack_id,
            'user',
            block_kit_data,
            'purchase_requests',
            p_purchase_request_id,
            jsonb_build_object(
                'purchase_request_id', p_purchase_request_id,
                'approval_type', 'middle_manager'
            ),
            'pending',
            true
        ) RETURNING id INTO notification_id;
        
        -- Slack DM 전송
        PERFORM net.http_post(
            url := 'https://qvhbigvdfyvhoegkhvef.supabase.co/functions/v1/slack-dm-sender',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2aGJpZ3ZkZnl2aG9lZ2todmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4MTQzNjAsImV4cCI6MjA2MzM5MDM2MH0.7VZlSwnNuE0MaQpDjuzeZFgjJrDBQOWA_COyqaM8Rbg'
            ),
            body := jsonb_build_object(
                'user_id', current_slack_id,
                'blocks', block_kit_data->'blocks'
            )
        );
        
        -- 알림 상태 업데이트
        UPDATE notifications 
        SET status = 'sent', sent_at = NOW() 
        WHERE id = notification_id;
    END LOOP;
    
    RAISE NOTICE 'Block Kit 알림 전송 완료 (ID: %)', p_purchase_request_id;
END;
$$;

-- 4. purchase_request_items INSERT 트리거 추가
CREATE OR REPLACE FUNCTION on_purchase_request_item_insert()
RETURNS TRIGGER AS $$
DECLARE
    item_count INTEGER;
    has_pending_notification BOOLEAN;
BEGIN
    -- 해당 purchase_request의 총 품목 수 확인
    SELECT COUNT(*) INTO item_count
    FROM purchase_request_items
    WHERE purchase_request_id = NEW.purchase_request_id;
    
    -- 이미 Block Kit 알림이 전송되었는지 확인
    SELECT EXISTS(
        SELECT 1 FROM notifications 
        WHERE related_table = 'purchase_requests' 
        AND related_id = NEW.purchase_request_id 
        AND notification_type = 'purchase_approval_request'
        AND status = 'sent'
    ) INTO has_pending_notification;
    
    -- 첫 번째 품목이고 아직 알림이 전송되지 않았으면 Block Kit 알림 전송
    IF item_count = 1 AND NOT has_pending_notification THEN
        PERFORM send_delayed_block_kit_notification(NEW.purchase_request_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. purchase_request_items INSERT 트리거 생성
DROP TRIGGER IF EXISTS trg_purchase_request_item_insert ON purchase_request_items;
CREATE TRIGGER trg_purchase_request_item_insert
    AFTER INSERT ON purchase_request_items
    FOR EACH ROW
    EXECUTE FUNCTION on_purchase_request_item_insert();

-- 6. 기존 send_purchase_notifications 함수 수정 (Block Kit 대신 간단한 텍스트만)
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
    -- 1. 발주 요청 알림 (INSERT 시) -> middle_manager에게 (Block Kit은 제거하고 간단한 텍스트만)
    IF TG_OP = 'INSERT' THEN
        -- 간단한 텍스트 알림은 유지 (Block Kit은 별도 트리거에서 처리)
        SELECT array_agg(e.slack_id) INTO target_slack_ids
        FROM employees e
        WHERE e.purchase_role @> ARRAY['middle_manager'];
        
        message_text := format(
            '%s님으로 부터 발주번호 : %s 의 새로운 결제 요청이 있습니다. 상세 승인 요청은 별도 메시지로 전송됩니다.',
            COALESCE(NEW.requester_name, '미지정'),
            COALESCE(NEW.purchase_order_number, '미지정')
        );
        
        -- 각 middle_manager에게 간단한 텍스트 DM 전송
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
        
        -- 기존 로직들은 모두 유지...
        
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
    
    -- 나머지 UPDATE 관련 로직들은 모두 기존과 동일하게 유지...
    
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
    
    -- 나머지 모든 기존 로직들 유지...
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 변경사항 요약:
-- 1. Block Kit 알림을 purchase_request_items INSERT 후로 지연
-- 2. 품목이 없는 경우 NULL 반환하여 나중에 재시도
-- 3. purchase_request_items INSERT 트리거 추가
-- 4. 중복 알림 방지 로직 추가
-- 5. 기존 send_purchase_notifications는 간단한 텍스트 알림만 담당