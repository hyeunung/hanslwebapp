-- 20250702i_add_timeout_auto_upload_po.sql
-- Purpose: Add 5-second timeout to net.http_post inside auto_upload_purchase_order to prevent statement timeout.

CREATE OR REPLACE FUNCTION auto_upload_purchase_order()
RETURNS TRIGGER AS $$
DECLARE
    should_auto_upload BOOLEAN := FALSE;
BEGIN
    -- Determine whether we should auto-upload
    IF TG_OP = 'INSERT' AND NEW.progress_type = '선진행' THEN
        should_auto_upload := TRUE;
    ELSIF TG_OP = 'UPDATE'
          AND NEW.final_manager_status = 'approved'
          AND (OLD.final_manager_status IS DISTINCT FROM NEW.final_manager_status) THEN
        should_auto_upload := TRUE;
    END IF;

    IF should_auto_upload THEN
        BEGIN
            PERFORM net.http_post(
                url := format('https://work.hansl.com/api/upload-po/%s', NEW.purchase_order_number),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'User-Agent', 'Auto-Upload-Trigger/1.0'
                ),
                body := '{}'::jsonb,
                timeout_msec := 5000 -- 5-second timeout
            );
            RAISE NOTICE '발주서 자동 업로드 요청 완료 (timeout 5s): %', NEW.purchase_order_number;
        EXCEPTION WHEN OTHERS THEN
            -- Do not block transaction on upload failures
            RAISE WARNING '발주서 자동 업로드 실패 (무시됨): % - %', NEW.purchase_order_number, SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
