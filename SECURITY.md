# Security and privacy

## Public surface

- Nginx serves only `public/` static files.
- The collector listens on `0.0.0.0:8790` by default. Its only endpoints are `/health`, `/events`, and local `/viewer`; do not expose its port through a tunnel or reverse proxy.

## Event data

The normalized event contains timestamp; raw client IP and port; method; request target with sensitive query values redacted; host, scheme, and protocol; status; raw User-Agent; Referer with sensitive query values redacted; Accept and Accept-Language headers; selected browser client hints; available TLS protocol and cipher; request length and duration; bytes sent; and heuristic bot classification. User-Agent and all other request headers are untrusted. The viewer inserts only `textContent`.

Cookie, Authorization, and request-body content are deliberately excluded. Query keys matching `access_token`, `api_key`, `auth`, `authorization`, `code`, `cookie`, `id_token`, `key`, `password`, `secret`, `session`, `sid`, or `token` are stored as `[redacted]`; other query keys and values are retained.

## Retention and access

Raw Nginx JSONL logs must live outside `public/`, be readable only by the Nginx process and collector account, and have a site-owner-defined retention period. They now contain personal data, including raw IP addresses, and must not be publicly exposed. Configure log rotation and back up only encrypted, access-controlled copies when necessary.

## Known limits

User-Agent matching is not bot verification. Nginx logs requests after processing finishes, so the event stream is not a request-arrival signal. The collector intentionally has no write, command, or arbitrary-file endpoints.
