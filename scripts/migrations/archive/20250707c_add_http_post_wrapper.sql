-- 20250707c_add_http_post_wrapper.sql
-- Purpose: Provide a backwards-compatibility wrapper so legacy triggers that call
--          net.http_post(url := text, headers := jsonb, body := text)
--          continue to work with pg_net >= v0.11 (signature changed).

-- Ensure required schema / extension exists
CREATE SCHEMA IF NOT EXISTS net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA net;

-- Wrapper function definition
CREATE OR REPLACE FUNCTION net.http_post(
    url     text,
    headers jsonb,
    body    text
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
    request_id bigint;
BEGIN
    -- Delegate to the official function introduced in pg_net >= v0.11
    -- which signature is: http_post(url text, body jsonb, params jsonb default '{}', headers jsonb default '{...}', timeout_milliseconds integer default 5000)
    request_id := net.http_post(
        url     := url,
        body    := body::jsonb,
        headers := headers
    );
    RETURN request_id;
END;
$$;

COMMENT ON FUNCTION net.http_post(text, jsonb, text) IS
'Compatibility shim that accepts (url, headers, body) like earlier versions. It internally converts body text to jsonb and calls the official pg_net http_post().'; 