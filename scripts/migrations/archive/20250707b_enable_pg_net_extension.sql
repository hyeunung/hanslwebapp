-- Enable pg_net extension to allow HTTP requests via net.http_post
-- This extension is required by various triggers/functions that call net.http_post()

create extension if not exists pg_net with schema extensions; 