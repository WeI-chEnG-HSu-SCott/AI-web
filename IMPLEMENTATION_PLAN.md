# Implementation plan

## Scope and decisions

- Build an HTML-first static site with no framework or CMS.
- Keep the event collector local by default (`127.0.0.1`). Record expanded request and connection metadata, including IP addresses and redacted request targets, but exclude cookies, authorization headers, and request bodies.
- Treat bot names derived from User-Agent as heuristics only; events remain `unverified`.
- Keep `OAI-SearchBot` allowed and block `GPTBot` until the site owner explicitly chooses otherwise.
- A production origin is required before generating deployable canonical URLs, `robots.txt`, and `sitemap.xml`; no placeholder origin will be published.

## Deliverables

| Area | Files |
| --- | --- |
| Site | `public/`, content template, CSS, local static server |
| Collector | `collector/src/server.js`, tests, SSE viewer, package scripts |
| Nginx | `nginx/site.conf.example`, JSON escaping and log rotation guidance |
| Operations | `README.md`, `SECURITY.md`, `.gitignore`, site-generation script |

## Dependencies

- Node.js 20+ (the current environment has Node.js 24.22.1).
- Production only: Nginx and, optionally, `cloudflared`. Nginx is not installed in this Windows environment, so `nginx -t` is a manual deployment check.
- The collector uses only Node.js built-in modules; no npm packages are needed.

## Risks and mitigations

- Access logs are written after request completion, so events are not request-arrival notifications.
- User-Agent values are untrusted and must be escaped in the viewer.
- Log rotation can change the log inode; the collector reopens and rereads the configured file safely.
- A tunnel makes only Nginx public; the collector remains loopback-bound.

## Acceptance approach

1. Run the local static server and assert 200/404 responses.
2. Run the collector against a temporary JSONL access log.
3. Connect an SSE client, append a valid Nginx-format log line, and assert the normalized event arrives.
4. Append malformed JSON and assert the collector remains usable.
5. Validate source metadata and generated public files after the site owner supplies the production origin.

## Official sources checked

- OpenAI crawler controls: https://developers.openai.com/api/docs/bots
- Nginx logging module (`log_format` is `http` context; `escape=json` is supported): https://nginx.org/en/docs/http/ngx_http_log_module.html
- SSE/EventSource behavior: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
- Cloudflare Tunnel prerequisites and published routes: https://developers.cloudflare.com/tunnel/get-started/
