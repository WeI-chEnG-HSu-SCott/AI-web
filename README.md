# 訪問痕跡觀測站

原生 HTML 網站 + 本機 Nginx JSON access log 收集器 + SSE 藝術事件流。沒有 CMS、資料庫或 npm 依賴。網站呈現內容為英文；本操作文件使用中文。

## 本機啟動

開兩個 PowerShell 視窗：

```powershell
node scripts/local-static-server.mjs
node collector/src/server.js
```

網站為 `http://127.0.0.1:8080`；本機事件檢視器為 `http://127.0.0.1:8787/viewer`。開發時 collector 讀取 `collector/data/access.jsonl`。Nginx 上線時，使用 `ACCESS_LOG_PATH` 指向 Nginx 的 JSONL log，例如：

```powershell
$env:ACCESS_LOG_PATH = 'C:\logs\visit-observatory\access.jsonl'
node collector/src/server.js
```

停止服務：在相對應視窗按 `Ctrl+C`。

## 端到端驗收（本機、不需 Nginx）

先啟動 collector 並開啟 viewer，然後在另一個 PowerShell 執行：

```powershell
Add-Content collector/data/access.jsonl '{"time":"2026-10-25T12:00:00Z","method":"GET","uri":"/articles/example.html","status":200,"user_agent":"test-client","referer":"-","request_time":0.023,"bytes_sent":1234,"request_id":"demo-1"}'
```

檢視器應顯示一筆事件。執行單元測試：

```powershell
node --test collector/test/*.test.mjs
node scripts/e2e-test.mjs
```

## 資料觀測模式

目前為「最大化、但不攔截訪問」模式：網站不要求登入、同意彈窗或額外驗證。Nginx 記錄 IP、client port、完整請求目標、Host、HTTP 協議、Referer、Accept／Accept-Language、部分 browser client hints、可用的 TLS metadata、request length、回應資料與既有欄位。collector 會遮罩 query 與 Referer 裡常見的憑證型參數（例如 `token`、`password`、`api_key`），並且不收集 Cookie、Authorization 或 request body。完整欄位和保護措施見 [SECURITY.md](SECURITY.md)。

## Nginx 上線

1. 先將 `public/` 放到伺服器，例如 `/srv/visit-observatory/public`，把原始 log 放在該目錄外。
2. 按實際 Nginx 結構整合 [nginx/site.conf.example](nginx/site.conf.example)：`log_format` 必須位於 `http {}`，再以 `nginx -t` 驗證，通過才 reload。
3. 讓 collector 使用只有讀取該 log 的帳號執行；不要以 root 執行。
4. 用 `curl -i http://localhost/` 發出請求，確認 JSONL 出現一行、collector viewer 收到對應事件。log 在回應完成後才寫入。
5. 設定 logrotate：輪替後通知 Nginx reopen logs；collector 會偵測檔案縮小並從新檔重新讀取。

此 Windows 開發環境沒有偵測到 Nginx，因此 `nginx -t` 與真實 Nginx access log 驗收是部署後 **MANUAL**。

## 正式網域與搜尋 metadata（必做）

在你有正式 HTTPS 網域後，執行一次（不要用示例文字當網域）：

```powershell
$env:SITE_ORIGIN = 'https://www.your-real-domain.tld'
node scripts/generate-public-metadata.mjs
```

這會為每個 HTML 頁產生 canonical，並建立 `public/robots.txt` 與 `public/sitemap.xml`。預設允許 `OAI-SearchBot`、禁止 `GPTBot`；是否允許 GPTBot 是網站所有者的內容政策決定。新增文章時：複製 `public/articles/example.html`、修改唯一 title/description/h1 與內容、加入普通 `<a href>` 導覽，並把新檔加入 `pages` 陣列後重跑產生器。

## Cloudflare Tunnel（部署後手動）

1. 在 Cloudflare Dashboard 的 **Networking → Tunnels** 建立 tunnel，依 Windows/Linux 主機安裝指示執行 `cloudflared`。
2. 新增 Published application：hostname 選你的公開網域，Service URL 指向 `http://localhost:80`（Nginx）。
3. **不要**建立任何指向 port 8787（collector）的公開 route。
4. 從另一個網路以 `curl -I` 檢查首頁、robots、sitemap、文章皆為 200，並檢查 canonical 與 TLS。
5. 在 Google Search Console 與 Bing Webmaster Tools 驗證網域、提交 sitemap；這些行為不保證收錄或 AI 引用。

## 驗收狀態

| 項目 | 狀態 |
| --- | --- |
| HTML-first 頁面、普通連結、唯一 title/description/h1 | PASS（原始碼檢查） |
| 本機靜態 200 / 不存在 URL 404 | PASS（以 local-static-server 執行） |
| collector JSON 解析、schema、路徑去 query | PASS（`node --test collector/test/*.test.mjs`） |
| HTTP log → collector → SSE event | MANUAL（可重現命令已提供；此受控開發環境拒絕 loopback 測試連線） |
| SSE viewer、有限 50 筆瀏覽器清單、loopback 預設 | PASS（實作與本機命令） |
| Nginx 寫 JSON、`nginx -t` | MANUAL（Nginx 未安裝） |
| canonical、robots、絕對 sitemap | MANUAL（需要正式網域後產生） |
| Cloudflare、外網連通、Search Console/Bing、索引與 AI 引用 | MANUAL |

## 官方文件

- [OpenAI crawler controls](https://developers.openai.com/api/docs/bots)
- [Nginx logging module](https://nginx.org/en/docs/http/ngx_http_log_module.html)
- [MDN: Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [Cloudflare Tunnel setup](https://developers.cloudflare.com/tunnel/get-started/)

網站結構已為 crawler-friendly 做準備，但不代表搜尋引擎必定索引，也不代表 AI 必定引用。
