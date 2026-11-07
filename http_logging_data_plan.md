# HTTP 訪問資料紀錄規劃（Nginx）

版本：2026-11-07

## 目的

重新整理網站的 HTTP 訪問紀錄，保留足以研究訪問者請求特徵、代理轉送路徑與網路連線的資料。紀錄範圍以以下三類為主：

- **A｜HTTP Request Headers**：請求方隨 HTTP Request 傳送的標頭。
- **B｜HTTP Request 資訊**：請求方法、路徑、參數、Body 類型與大小等。
- **D｜Proxy Headers 與來源 IP**：代理伺服器附加的資訊，尤其是 Cloudflare 轉送時的原始訪客 IP。

本文件另包含 Cookie 的觀察方案。Cookie 會嘗試記錄「是否存在、大小、名稱」，**預設不保存 Cookie 值**，也不保存 `Authorization` 憑證內容。

---

## 1. 先釐清資料來源

一次 HTTP 訪問會產生多種可觀察資料，但它們不是同一種東西：

| 資料 | 來源 | 例子 |
|---|---|---|
| HTTP Request Headers | 請求方傳送的 HTTP 標頭 | `User-Agent`、`Accept-Language` |
| HTTP Request 資訊 | HTTP 請求行及請求內容 | `GET /?q=art`、Request Body |
| Connection metadata | Nginx 觀察到的連線資訊 | 連線來源 IP、Port、TLS 版本 |
| Proxy metadata | Cloudflare／其他可信任代理附加 | `CF-Connecting-IP`、`X-Forwarded-For` |
| Raw Packet | 網路介面實際收到的封包 | IP/TCP 標頭、封包時間與大小 |

Nginx Access Log 是伺服器從請求與連線中挑選欄位後產生的紀錄，不是完整 Raw Packet，也不會自動包含所有 HTTP Headers 或 Response Body。

HTTPS 的封包內容通常經 TLS 加密。若在 Origin 網路介面擷取封包，通常看到的是 Cloudflare 到 Origin 這一段連線，而不是訪客到 Cloudflare 的原始連線。

---

## 2. A 類：HTTP Request Headers

這些欄位由客戶端隨 Request 傳送；是否出現取決於瀏覽器、爬蟲、HTTP client 及其設定。Header 值是客戶端自我宣告，不能單憑它證明真實設備或身分。

| 建議欄位名稱 | Nginx 變數 | 用途 |
|---|---|---|
| `user_agent` | `$http_user_agent` | 客戶端宣告的軟體資訊 |
| `accept` | `$http_accept` | 可接受的媒體類型 |
| `accept_language` | `$http_accept_language` | 語言偏好宣告 |
| `accept_encoding` | `$http_accept_encoding` | 可接受的壓縮格式 |
| `content_type` | `$http_content_type` | Request Body 類型（若有） |
| `origin` | `$http_origin` | 跨來源請求的 Origin（若有） |
| `referer` | `$http_referer` | Referer（可能缺漏或偽造） |
| `sec_ch_ua` | `$http_sec_ch_ua` | User-Agent Client Hints |
| `sec_ch_ua_platform` | `$http_sec_ch_ua_platform` | 客戶端宣告的平台 |
| `sec_ch_ua_mobile` | `$http_sec_ch_ua_mobile` | 客戶端宣告的行動裝置提示 |
| `sec_fetch_site` | `$http_sec_fetch_site` | Fetch Metadata：請求來源關係 |
| `sec_fetch_mode` | `$http_sec_fetch_mode` | Fetch Metadata：請求模式 |
| `sec_fetch_dest` | `$http_sec_fetch_dest` | Fetch Metadata：請求目的類型 |

### 不建議直接保存的 Headers

| Header | Nginx 變數 | 建議 |
|---|---|---|
| Cookie | `$http_cookie` | 不記錄原始值；只記錄存在、長度，必要時在應用程式端解析名稱 |
| Authorization | `$http_authorization` | 只記錄是否存在；絕不記錄原始值 |
| Proxy-Authorization | `$http_proxy_authorization` | 不記錄原始值 |
| 任意自訂 Token Header | 例如 `$http_x_api_key` | 不記錄原始值 |

Cookie 或 Authorization 可能包含 Session ID、登入憑證、Bearer Token、追蹤識別碼等。即使它們是請求自動附帶的，也仍然是敏感資料。

---

## 3. B 類：HTTP Request 資訊

| 建議欄位名稱 | Nginx 變數 | 用途／注意事項 |
|---|---|---|
| `request` | `$request` | Request Line，例如 `GET / HTTP/2.0` |
| `method` | `$request_method` | GET、HEAD、POST 等 |
| `request_uri` | `$request_uri` | 原始 URI，包含 Query String |
| `uri` | `$uri` | Nginx 目前處理的 URI；可能受 rewrite 影響 |
| `args` | `$args` | Query String；可能含 Token 或個資，建議不要無差別保存 |
| `content_type` | `$http_content_type` | Request Body 的媒體類型 |
| `content_length` | `$http_content_length` | 客戶端宣告的 Body 長度 |
| `request_length` | `$request_length` | Nginx 所讀取的 Request 長度，包含請求行、Headers、Body |
| `status` | `$status` | Nginx 回應狀態碼 |
| `request_time` | `$request_time` | Nginx 從讀取請求開始到完成處理的時間 |
| `server_protocol` | `$server_protocol` | Nginx 處理的 HTTP 協定版本 |

### Request Body

`$request_body` 不等於保證可取得的完整 Body。它是否可用與 Nginx 是否讀取 Body、緩衝設定及請求處理流程有關。若研究不需要分析表單或 API 內容，建議只保存 `content_type`、`content_length`，不要保存 Body 本身。

### Query String 的安全處理

`request_uri` 和 `args` 可能含有密碼重設 Token、追蹤參數、電子郵件或其他個資。建議：

1. 預設只保存路徑，不保存 Query String；或
2. 在應用程式端對已知敏感參數（例如 `token`、`key`、`password`、`session`）遮罩後再保存。

---

## 4. D 類：代理資訊與真實訪客 IP（優先項目）

### 4.1 必須區分的三種 IP

| 欄位 | 意義 |
|---|---|
| `client_ip` | 經可信任代理設定還原後，Nginx 認定的客戶端 IP |
| `proxy_peer_ip` | 與 Nginx 直接建立連線的對方 IP；使用 Real IP 模組時以 `$realip_remote_addr` 保留 |
| `cf_connecting_ip_header` | Request 中 `CF-Connecting-IP` Header 的原始值；只有在來源確實可信任時才可採信 |

重要：`$remote_addr` 預設是直接連線對方的 IP。若 Cloudflare 連到 Origin，預設看到的是 Cloudflare IP，而不是訪客 IP。設定 Nginx Real IP 模組後，`$remote_addr` 才會依可信任代理提供的 Header 改為原始訪客 IP；`$realip_remote_addr` 則保留替換前的連線來源。

### 4.2 Cloudflare 情境

典型路徑：

```text
訪客 → Cloudflare Edge → Origin Nginx
```

Cloudflare 會在轉送請求時提供 `CF-Connecting-IP`。Nginx 必須先確認 TCP 連線來源屬於 Cloudflare 官方 IP 範圍，才可以信任這個 Header。

官方 IP 清單：

- IPv4：https://www.cloudflare.com/ips-v4
- IPv6：https://www.cloudflare.com/ips-v6

不要只複製本文的零星示例 CIDR 當成完整清單。應將官方當前公布的**完整 IPv4 與 IPv6 CIDR**放進設定，並建立定期更新流程。

### 4.3 Nginx Real IP 設定範例

先建立 Cloudflare CIDR 設定檔：

```bash
sudo nano /etc/nginx/cloudflare-ips.conf
```

將官方完整 IP 清單逐行寫入，格式如下（以下只是格式示例，不是完整清單）：

```nginx
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
# 請加入 Cloudflare 官方完整 IPv4 與 IPv6 清單
```

在 Nginx 主設定檔的 `http {}` 區塊中加入：

```nginx
http {
    include /etc/nginx/cloudflare-ips.conf;

    real_ip_header CF-Connecting-IP;
    real_ip_recursive on;

    # 其他設定……
}
```

`ngx_http_realip_module` 的功能是依照可信任代理提供的位址資訊，更新 Nginx 所認定的客戶端位址。確認模組存在：

```bash
nginx -V 2>&1
```

檢查是否包含：

```text
--with-http_realip_module
```

若沒有，需確認發行版是否以動態模組提供及是否已載入。

### 4.4 必須保護 Origin

只設定 `set_real_ip_from` 還不夠。若 Origin 可以被任何來源直接連線，攻擊者可能直接送出偽造的 `CF-Connecting-IP` Header。

建議：

- 防火牆只允許 Cloudflare 官方 IP 範圍連入 Origin 的 HTTP/HTTPS Port。
- 若有管理用途或其他可信任代理，另外設計明確的允許來源。
- 不要信任任意來源送來的 `X-Forwarded-For`、`X-Real-IP` 或 `CF-Connecting-IP`。
- 若使用 Cloudflare Tunnel，先確認 `cloudflared` 到 Nginx 的實際連線方式；不要直接套用一般 Cloudflare Proxy 的來源 IP 信任設定。

### 4.5 其他 Reverse Proxy

若使用其他代理，必須知道：

1. 代理伺服器實際連到 Nginx 的來源 IP／CIDR。
2. 代理實際使用哪個 Header 傳遞來源 IP。
3. Header 中多個 IP 的排列規則。
4. 是否有多層代理，以及每一層是否可信任。

例如：

```nginx
set_real_ip_from 192.0.2.10;  # 示意：替換成實際可信任代理 IP
real_ip_header X-Forwarded-For;
real_ip_recursive on;
```

不要把 `192.0.2.10` 當成真實設定值；它是文件示例位址。

---

## 5. Cookie：嘗試觀察，但不保存秘密值

### 5.1 建議記錄的 Cookie 中繼資料

| 欄位 | 意義 | 建議 |
|---|---|---|
| `has_cookie` | Request 是否帶 Cookie Header | 記錄 |
| `cookie_header_bytes` | Cookie Header 長度 | 記錄 |
| `cookie_count` | Cookie 項目數量 | 可在應用程式端計算 |
| `cookie_names` | Cookie 名稱清單 | 先檢查名稱是否含個資，再決定是否保存 |
| `cookie_values` | Cookie 值 | **不要保存** |

Nginx 可以安全地記錄是否存在及長度，而不記錄值：

```nginx
map $http_cookie $has_cookie {
    ""      0;
    default 1;
}

map $http_cookie $cookie_header_bytes {
    ""      0;
    default $request_length; # 不要使用此替代值作為 Cookie 長度
}
```

上面的第二個 `map` 只是提醒：Nginx 沒有可直接視為 Cookie Header 精確位元組長度的通用內建變數。**不要將 `$request_length` 誤標成 Cookie 長度。** 若需要精確長度，應在應用程式端對 Header 字串計算長度，且只保存數字。

### 5.2 Cookie 名稱的解析

若需要 Cookie 名稱清單，建議在 Node.js 應用程式端解析 `Cookie` Header，只留下名稱，不保存值。例如：

```javascript
function getCookieMetadata(cookieHeader = "") {
  if (!cookieHeader) {
    return {
      has_cookie: false,
      cookie_count: 0,
      cookie_names: []
    };
  }

  const names = cookieHeader
    .split(";")
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => item.split("=")[0].trim())
    .filter(Boolean);

  return {
    has_cookie: true,
    cookie_count: names.length,
    cookie_names: names
  };
}
```

使用方式：

```javascript
const cookieMetadata = getCookieMetadata(req.headers.cookie);

const event = {
  ...cookieMetadata,
  // 其他經過篩選的事件欄位
};
```

注意：

- 不要把 `req.headers.cookie` 本身寫入 Log。
- Cookie 名稱也可能暴露服務或追蹤機制資訊；若不需要名稱，記錄 `has_cookie` 和 `cookie_count` 即可。
- 若要研究 Cookie 名稱，先在自己的測試環境使用自建的非敏感測試 Cookie。
- 不要為了取得 Cookie 而要求訪客登入、建立帳號或提供額外憑證。

### 5.3 Authorization

只記錄是否存在：

```nginx
map $http_authorization $has_authorization {
    ""      0;
    default 1;
}
```

不要記錄 `$http_authorization` 原始值。它可能包含 Basic 憑證或 Bearer Token。

---

## 6. 建議的 JSON Log 格式

以下是一份可作為新紀錄架構起點的 Nginx `log_format`。它不保存 Cookie 或 Authorization 原始值，也不保存 Query String：

```nginx
map $http_cookie $has_cookie {
    ""      0;
    default 1;
}

map $http_authorization $has_authorization {
    ""      0;
    default 1;
}

log_format research_json escape=json
'{'
  '"timestamp":"$time_iso8601",'
  '"client_ip":"$remote_addr",'
  '"proxy_peer_ip":"$realip_remote_addr",'
  '"cf_connecting_ip_header":"$http_cf_connecting_ip",'
  '"x_forwarded_for_header":"$http_x_forwarded_for",'
  '"remote_port":"$remote_port",'
  '"method":"$request_method",'
  '"request":"$request",'
  '"uri":"$uri",'
  '"server_protocol":"$server_protocol",'
  '"host":"$host",'
  '"status":$status,'
  '"request_time":"$request_time",'
  '"request_length":$request_length,'
  '"user_agent":"$http_user_agent",'
  '"accept":"$http_accept",'
  '"accept_language":"$http_accept_language",'
  '"accept_encoding":"$http_accept_encoding",'
  '"content_type":"$http_content_type",'
  '"origin":"$http_origin",'
  '"referer":"$http_referer",'
  '"sec_ch_ua":"$http_sec_ch_ua",'
  '"sec_ch_ua_platform":"$http_sec_ch_ua_platform",'
  '"sec_ch_ua_mobile":"$http_sec_ch_ua_mobile",'
  '"sec_fetch_site":"$http_sec_fetch_site",'
  '"sec_fetch_mode":"$http_sec_fetch_mode",'
  '"sec_fetch_dest":"$http_sec_fetch_dest",'
  '"has_cookie":$has_cookie,'
  '"has_authorization":$has_authorization,'
  '"ssl_protocol":"$ssl_protocol",'
  '"ssl_cipher":"$ssl_cipher",'
  '"bytes_sent":"$bytes_sent",'
  '"body_bytes_sent":"$body_bytes_sent"'
'}';
```

在網站對應的 `server {}` 區塊使用：

```nginx
access_log /var/log/nginx/research-access.json research_json;
```

### 設定注意事項

1. `map` 必須放在 `http {}` 區塊，不能放在 `server {}`。
2. `log_format` 也必須放在 `http {}`。
3. `access_log` 可放在對應的 `server {}` 或 `location {}`。
4. 若沒有啟用 HTTPS，`ssl_protocol`、`ssl_cipher` 會是空值。
5. `$realip_remote_addr` 在未使用 Real IP 模組或未發生位址替換時，可能與 `$remote_addr` 相同或呈現不同情況；解讀前要依設定驗證。
6. 若有 Cloudflare，`$http_cf_connecting_ip` 只是收到的 Header 值；只有連線來源經可信任範圍驗證後，才可當作可信任的訪客 IP。
7. `$request` 不含完整 Request Headers，也不含 Request Body。
8. `request` 和 `uri` 仍可能包含敏感 Query String 的風險；若需要完全避免，應改用不含參數的路徑欄位，並確認 rewrite 行為。
9. Nginx 的 `$bytes_sent` 與 `$body_bytes_sent` 是回應傳送資料的統計，不是訪客上傳資料量。

---

## 7. 建議的最終事件資料結構

以下是經過整理後的資料模型示例。IP 與 Header 值均為示意資料：

```json
{
  "event_id": "event-000001",
  "timestamp": "2026-11-07T01:00:00-05:00",
  "source_type": "observed",

  "network": {
    "client_ip": "203.0.113.25",
    "proxy_peer_ip": "172.64.0.1",
    "cf_connecting_ip_header": "203.0.113.25",
    "ip_resolution": "trusted_cloudflare_header",
    "remote_port": 51234,
    "server_protocol": "HTTP/2.0",
    "ssl_protocol": "TLSv1.3"
  },

  "request": {
    "method": "GET",
    "uri": "/",
    "host": "come-is.site",
    "status": 200,
    "request_length": 420,
    "request_time": 0.025
  },

  "headers": {
    "user_agent": "Example User Agent",
    "accept": "text/html",
    "accept_language": "en-US,en;q=0.9",
    "accept_encoding": "gzip, br",
    "sec_ch_ua": "",
    "sec_ch_ua_platform": ""
  },

  "proxy": {
    "provider": "cloudflare",
    "cf_ray": "example-ray-id"
  },

  "cookie_metadata": {
    "has_cookie": true,
    "cookie_count": 2,
    "cookie_names": ["theme", "language"],
    "values_saved": false
  },

  "authentication_metadata": {
    "has_authorization": false,
    "authorization_value_saved": false
  },

  "classification": {
    "bot_status": "unclassified",
    "verification_status": "unverified",
    "classification_method": null
  }
}
```

注意：`client_ip`、`proxy_peer_ip` 和 `ip_resolution` 必須由實際 Nginx 設定與驗證結果填入，不能直接照抄示例。若無法確認原始 IP，應記錄 `client_ip: null` 或將 IP 來源標記為 `unverified`，不要把代理 IP 冒充成訪客 IP。

---

## 8. 驗證與部署流程

建議依照以下順序進行，不要一次改完就假設資料正確：

1. **備份設定**：先備份 Nginx 設定與現有 Log 格式。
2. **確認拓樸**：確認是 Cloudflare Proxy、Cloudflare Tunnel、其他反向代理，還是直接連線。
3. **確認 IP 信任範圍**：只信任實際會連到 Origin 的代理 IP／CIDR。
4. **設定 Real IP 模組**：設定 `set_real_ip_from`、`real_ip_header`、`real_ip_recursive`。
5. **增加診斷 Log**：同時記錄還原後 IP、原始連線 IP 與代理 Header。
6. **測試設定**：
   ```bash
   sudo nginx -t
   ```
7. **重新載入 Nginx**：
   ```bash
   sudo systemctl reload nginx
   ```
8. **用自己的測試裝置訪問**：比較伺服器端觀察到的來源 IP、Cloudflare Header 與實際測試出口 IP。
9. **測試直接連 Origin 的情況**：確認防火牆阻止非可信任來源直接連線，或至少不會相信它提供的偽造代理 Header。
10. **驗證 Cookie**：在自己的測試瀏覽器設定非敏感測試 Cookie，確認 Log 只記錄存在狀態／名稱／數量，不會出現測試值。
11. **檢查 Log 是否洩漏**：搜尋 `Cookie`、`Authorization`、`Bearer`、`session`、`token` 等字串，確認沒有保存憑證值。

---

## 9. 研究與隱私上的界線

- IP 位址可以與其他資料結合，用於關聯訪問紀錄或推測網路位置；不要將 IP 等同於一個確定的人。
- User-Agent、Client Hints、Accept-Language 等都是客戶端宣告，可能缺漏或偽造。
- Cookie 值與 Authorization 值可能是可重用的存取憑證，應視為秘密資料。
- 不要為了研究而要求訪客提供帳密、Session Token 或其他認證資料。
- 設定資料保留期限、存取權限與必要的 IP 遮罩／刪除政策。
- 若要公開展示訪問資料，避免直接展示完整 IP、Cookie 名稱或可能識別個人的組合特徵。

## 10. 官方技術文件

- NGINX Embedded Variables：https://nginx.org/en/docs/http/ngx_http_core_module.html#variables
- NGINX `log_module`：https://nginx.org/en/docs/http/ngx_http_log_module.html
- NGINX Real IP Module：https://nginx.org/en/docs/http/ngx_http_realip_module.html
- Cloudflare：Restoring original visitor IPs：https://developers.cloudflare.com/support/troubleshooting/restoring-visitor-ips/restoring-original-visitor-ips/
- Cloudflare IP Ranges：https://www.cloudflare.com/ips/
- RFC 9110 — HTTP Semantics：https://www.rfc-editor.org/rfc/rfc9110

---

## 最重要的實作原則

**完整觀察請求，不等於完整保存所有內容。**

本研究優先保存：

1. 可信任來源下的原始訪客 IP，以及直接連線的 Proxy IP。
2. A 類 HTTP Request Headers。
3. B 類 Request 方法、路徑、協定、狀態與大小。
4. D 類代理資訊與 IP 還原依據。
5. Cookie 是否存在、數量與經篩選的名稱；不保存 Cookie 值。
6. Authorization 是否存在；不保存 Authorization 值。

這樣可以研究網路訪問的技術特徵，同時避免把可直接重用的認證憑證寫進長期日誌。

---

## 11. FlyOS 部署版：Cookie metadata 與 HMAC 指紋（2026-11-07）

### 11.1 已採用的界線

本專案**不保存原始 Cookie header 或 Cookie 值**。它們可能是可重放的 session／登入憑證。取而代之，每個 request 記錄下列資料：

| JSON 欄位 | 意義 |
|---|---|
| `has_cookie` | 是否存在 Cookie header |
| `cookie_header_bytes` | Cookie header 的 UTF-8 精確位元組數 |
| `cookie_count` | 以分號分隔後的 Cookie 項目數 |
| `cookie_names` | 最多 32 個、每個最多 64 字元、符合 Cookie token 格式的名稱，以逗號連接 |
| `cookie_fingerprint` | 以本機秘密 key 計算的 HMAC-SHA-256（base64url），可關聯相同完整 Cookie header，但不可由 fingerprint 還原值 |
| `values_saved` | 固定為 `false` |

同一完整 Cookie header 在 key 不變時會得到同一 fingerprint；header 任何值、順序或名稱改變時 fingerprint 會改變。fingerprint 仍是可關聯識別符，應視為個人資料，不應公開展示。

### 11.2 FlyOS Jammy ARM64：使用 Node metadata proxy

FlyOS 使用 Ubuntu Jammy ARM64 的 ports repository。實測該 repository 即使啟用 Universe，仍不提供與其 Nginx 1.18 ABI 相容的 `libnginx-mod-http-js`／`njs` 套件。因此本部署**不混裝**其他 Ubuntu 版本或官方 Nginx 的 dynamic module。

改用現有 Node 24 建立 loopback-only metadata proxy：

```text
Cloudflare Tunnel → Node metadata proxy :8080 → Nginx :8081
```

proxy 在記憶體中讀取 Cookie／Authorization，計算 metadata 與 HMAC，移除 `Cookie`、`Authorization`、`Proxy-Authorization` 及任何訪客偽造的 `X-Insectary-*` header，再把純 metadata header 轉給 Nginx。原始 Cookie 不會寫入 Nginx log、Node console、SSE 或回應。

### 11.3 建立並保管 HMAC key

在 FlyOS 建立只供 root 讀取的 key：

```bash
sudo sh -c 'openssl rand -base64 48 > /etc/nginx/insectary-cookie-hmac.key'
sudo chown root:root /etc/nginx/insectary-cookie-hmac.key
sudo chmod 600 /etc/nginx/insectary-cookie-hmac.key
```

Key 不可貼入聊天、Git、Nginx JSONL 或 SSE。遺失 key 不會洩漏 Cookie，但之後產生的 fingerprint 將無法與舊資料比對。更換 key 則會讓同一 Cookie 得到新的 fingerprint。

將專案內 `nginx/insectary-metadata-proxy-start` 安裝成 root-only metadata proxy 啟動 wrapper：

```bash
sudo install -o root -g root -m 0700 ~/AI-web/nginx/insectary-metadata-proxy-start /usr/local/sbin/insectary-metadata-proxy-start
```

### 11.4 Node metadata proxy 程式

專案的 `collector/src/metadata-proxy.js` 是此 proxy。它必須在 `cloudflared` 前面監聽原本的 `127.0.0.1:8080`，Nginx 則改為只監聽 `127.0.0.1:8081`。安裝腳本前，將程式放到可由低權限程序讀取的位置：

```bash
sudo install -d -o root -g root -m 0755 /usr/local/lib/insectary
sudo install -o root -g root -m 0644 ~/AI-web/collector/src/metadata-proxy.js /usr/local/lib/insectary/metadata-proxy.js
```

### 11.5 Nginx log format

將 `/etc/nginx/conf.d/insectary-log-format.conf` 更新為專案的 `nginx/flyos-insectary-log-format.conf`。此檔專為 FlyOS 的 `/home/flyos/AI-web` 與 `127.0.0.1:8080` 部署準備；`/etc/nginx/conf.d/*.conf` 正常會被 Nginx 的 `http {}` context include。網站 server block 則使用 `nginx/flyos-insectary-site.conf`。

安裝前先備份並再由專案檔覆蓋：

```bash
sudo cp /etc/nginx/conf.d/insectary-log-format.conf /etc/nginx/conf.d/insectary-log-format.conf.bak
sudo cp /etc/nginx/sites-available/insectary /etc/nginx/sites-available/insectary.bak
sudo install -o root -g root -m 0644 ~/AI-web/nginx/flyos-insectary-log-format.conf /etc/nginx/conf.d/insectary-log-format.conf
sudo install -o root -g root -m 0644 ~/AI-web/nginx/flyos-insectary-site.conf /etc/nginx/sites-available/insectary
```

`insectary_json` log format 從 Node 加入的 `X-Insectary-*` metadata header 取值。嚴禁加入 `$http_cookie`、`$http_authorization`、`$http_proxy_authorization`、`$request_body`、`$args` 或 `$request_uri`。

### 11.6 真實訪客 IP：Cloudflare Tunnel 專用信任模型

FlyOS 的實際路徑為：

```text
visitor → Cloudflare edge → cloudflared → Node :8080 → Nginx :8081
```

因此 server block 必須同時有：

```nginx
listen 127.0.0.1:8081;
set_real_ip_from 127.0.0.1;
real_ip_header CF-Connecting-IP;
real_ip_recursive on;
access_log /var/log/insectary/access.jsonl insectary_json;
```

在此 topology，`client_ip` 是 Nginx 依可信任本機 `cloudflared` 提供的 `CF-Connecting-IP` 還原後 IP；`proxy_peer_ip` 是替換前的 loopback peer，應為 `127.0.0.1`。不要把 Cloudflare 公網 CIDR 清單用於此 Tunnel-to-loopback 設定，也不要把 Nginx 改回對 LAN／Internet 監聽。

### 11.7 驗證順序

1. 備份現有 Nginx 設定。
2. 建立 key、同步 Node metadata proxy 和更新後的 log format。
3. 執行：

   ```bash
   sudo nginx -t
   ```

4. 若成功，重啟 Nginx（它會改為監聽 8081）：

   ```bash
   sudo nginx -s quit
   sudo nginx
   ```

5. 啟動 metadata proxy，再同步更新後的 `collector/src/server.js` 和 `collector/src/viewer.html` 到 `~/AI-web/collector/src/`，並重啟 tmux 內的 collector。
6. 開啟 log：

   ```bash
   sudo tail -f /var/log/insectary/access.jsonl
   ```

7. 用自己的手機行動網路訪問 `https://come-is.site`。驗證：
   - `client_ip` 和 `cf_connecting_ip_header` 相同，且不是 `127.0.0.1`。
   - `proxy_peer_ip` 為 `127.0.0.1`。
   - `ip_resolution` 是 `trusted_cloudflare_tunnel_header`。
   - 若瀏覽器帶 Cookie，`has_cookie` 為 `1`，metadata 欄位有數值／fingerprint，且 log 中找不到 Cookie 值。
8. 用 `curl -I http://127.0.0.1:8080/` 測試本機 request 時，預期 `client_ip` 是 `127.0.0.1`、`ip_resolution` 是 `direct_or_header_absent`，這是正常的對照結果。
9. 檢查 SSE viewer；它只應顯示真實 client IP 和 IP resolution，不應展示 Cookie metadata 或 fingerprint。
