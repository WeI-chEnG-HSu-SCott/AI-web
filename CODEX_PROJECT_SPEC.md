# Codex 專案規格：HTML-first 的公開觀測網站與即時訪問藝術資料管線

> **用途**：將本文件交給 Codex，請它在目前的工作目錄中檢查環境、提出必要問題（只問會阻塞實作的問題），再按階段實作、測試並記錄結果。
>
> **核心目標優先順序**
> 1. 在本地端主機運行網站，但讓公網上的 AI 搜尋爬蟲、搜尋引擎、一般爬蟲及自動化程式有機會訪問。
> 2. 記錄即時 HTTP 訪問資料，並以可程式化方式送到藝術創作程式。
> 3. 以原生 HTML/CSS/少量 JavaScript 管理內容，不建立大型 CMS 或複雜後台。

---

## 0. 執行前規則

1. **先檢查現有專案與作業系統**，不要覆寫或刪除現有檔案。若目錄不是空的，先列出內容並判斷是否已有實作。
2. 先建立 `IMPLEMENTATION_PLAN.md`，列出將新增/修改的檔案、依賴、服務、風險及驗收測試，再分階段實作。
3. 每個階段完成後執行可行的測試；若失敗，先修正再繼續。
4. 不得捏造測試結果、外部爬蟲已造訪、搜尋引擎已收錄或 AI 已引用等結論。無法從目前環境驗證的項目，要標示為「需要部署後人工驗證」。
5. 優先使用簡單、可讀、容易維護的技術。不要自行加入 React、Next.js、資料庫、CMS、Redis、Kafka 或大型分析平台，除非實際需求證明必要。
6. 不要把秘密、私人日誌、API token、環境變數或設定檔放在公開網站目錄。
7. 不要用 `robots.txt` 當作存取控制。私人端點必須有實際的驗證/授權或根本不對外發布。
8. 所有外部依賴與技術決策需記錄官方文件來源；如官方文件與本規格不同，以目前官方文件為準，並記錄修正原因。
9. 先做能在本機完全測試的版本；Cloudflare Tunnel、網域、搜尋引擎驗證等依賴使用者帳號或公開網域的工作，提供明確步驟，不假裝已完成。
10. 任何依賴外部服務帳號、DNS 權限或使用者秘密的步驟，都應停在安全的設定說明，不要要求使用者把密碼/token 貼進對話或提交到 Git。

## 1. 需求與非目標

### 1.1 必須達成

- 原生 HTML 頁面可直接被 HTTP 讀取；核心文字不應只在 JavaScript 執行後才出現。
- 有清楚的內部 `<a href>` 連結、每頁唯一標題與描述、canonical URL、`robots.txt` 和 `sitemap.xml`。
- 網站內容容易以複製/編輯 HTML 的方式新增，不需要 CMS。
- Nginx 記錄每個 HTTP 請求，日誌採 JSON 格式並能由程式安全解析。
- Node.js 收集器讀取日誌新行，轉成標準事件格式，並透過 SSE 推送到本機藝術程式/儀表板。
- 提供一個簡單的本機事件檢視頁面或測試客戶端，能顯示新事件。
- 原始日誌不公開；SSE 端點預設只綁定 loopback（127.0.0.1）或受防火牆/驗證保護。
- 提供安裝、啟動、停止、測試、備份及公開部署說明。
- 提供能重現的驗收測試，至少驗證「送出 HTTP 請求 → Nginx 寫日誌 → 收集器解析 → SSE 客戶端收到事件」這條端到端管線。

### 1.2 不承諾／非目標

- 不承諾任何搜尋引擎一定抓取或索引頁面。
- 不承諾任何生成式 AI 一定在回答中引用網站。
- 不承諾可以觀察到 AI 內部所有搜尋、索引、推理或使用者互動。
- User-Agent 不能單獨證明請求者身分；只憑 UA 的爬蟲分類應標記為 `claimed_bot` 或 `unverified`。
- 不做大型 CMS、會員系統、複雜管理後台或全面式網站分析平台。
- 第一版不需要資料庫；以 JSONL 日誌作為原始紀錄。未來如需複雜查詢再評估 SQLite/PostgreSQL。
- 不公開完整日誌、原始 IP、Cookie、Authorization header 或其他可能涉及個人資料的欄位。

## 2. 建議架構

### 2.1 元件

1. **網站內容**：原生 HTML、CSS、少量 JavaScript。
2. **HTTP 伺服器**：Nginx，服務靜態檔案並寫 JSON access log。
3. **原始資料**：Nginx access log，存放在網站根目錄之外；日誌輪替與檔案權限需設定。
4. **事件收集器**：Node.js LTS。讀取 Nginx 日誌新增內容、解析 JSON、正規化欄位，並提供 SSE。
5. **藝術創作端**：初版提供 HTML/JavaScript `EventSource` 測試頁；另附可供 p5.js、Python 或其他程式使用的 SSE 介面說明。
6. **公開入口（選配部署階段）**：Cloudflare Tunnel 將公開 hostname 映射到本地 Nginx。不要直接公開資料收集器、原始日誌或管理端點。
7. **搜尋可發現性**：`robots.txt`、`sitemap.xml`、語意化 HTML、canonical、JSON-LD（只有資料真實時才加入）、Google Search Console 與 Bing Webmaster Tools 的人工設定指南。

### 2.2 資料流

```text
外部 HTTP 請求
    |
    v
公開網域 / Cloudflare Tunnel（部署後）
    |
    v
Nginx 靜態網站 ---------------------> 回傳 HTML / CSS / JS / assets
    |
    +----> JSON access log（原始記錄）
                    |
                    v
             Node.js log collector
                    |
                    +----> JSONL 正規化事件（可選；原始日誌仍保留）
                    |
                    +----> SSE stream（預設只允許本機或受保護的客戶端）
                                      |
                                      v
                             p5.js / Python / art system
```

### 2.3 SSE vs WebSocket

第一版用 SSE，因為主要需求是伺服器單向推送新事件到創作程式。SSE 不提供同一連線的客戶端到伺服器雙向訊息；若日後真的需要雙向控制，再評估 WebSocket 或獨立 API。

## 3. 建議專案結構

依現有 repo 調整，但保持簡單：

```text
project-root/
├── public/
│   ├── index.html
│   ├── about.html
│   ├── experiments/
│   │   └── index.html
│   ├── articles/
│   │   └── example.html
│   ├── assets/
│   │   ├── style.css
│   │   └── images/
│   ├── robots.txt
│   └── sitemap.xml
├── collector/
│   ├── package.json
│   ├── src/
│   │   └── server.js
│   └── README.md
├── nginx/
│   └── site.conf.example
├── scripts/
│   ├── test-request.sh
│   └── generate-sitemap.mjs   # 若有需要；初版可先手動 sitemap
├── logs/                       # 僅在開發時作為說明/本地路徑；實際日誌建議放在 public 外
├── .gitignore
├── README.md
├── IMPLEMENTATION_PLAN.md
└── SECURITY.md
```

實際 access log 應設定在如 `/var/log/nginx/` 或其他 `public/` 以外的路徑；不要把日誌資料夾放進會被 Nginx 當作網站根目錄的地方。

## 4. HTML-first GEO / 搜尋可發現性要求

### 4.1 HTML 頁面

每個可公開索引頁面應：

- 使用 `<!doctype html>`、正確的 `<html lang="zh-Hant">`、UTF-8、viewport。
- 有唯一且描述清楚的 `<title>`、meta description、`<h1>`。
- 使用語意化 HTML（`main`, `nav`, `article`, `section`, `header`, `footer` 等）。
- 用普通 `<a href="...">` 連到所有重要頁面；避免只有 JavaScript click handler 的導航。
- 重要內容直接存在 HTML 文字中；不要只用 Canvas/WebGL/圖片呈現文字。
- 圖片提供有意義的 `alt`（裝飾性圖片可用空 alt）。
- 使用正確的 HTTP 狀態碼：有效頁面 200，不存在頁面 404。
- canonical 必須使用真正的正式網域與 URL，不能留 `example.com`。
- 不複製相同內容到多個 URL，必要時做一致的 canonical/redirect。
- 文章內容應提供實際研究問題、方法、觀察、限制及引用來源；不要堆砌關鍵字或虛構研究成果。

### 4.2 `robots.txt`

建立 `public/robots.txt` 範本，但在正式部署前，必須以使用者的內容政策決定是否允許 GPTBot。若希望 ChatGPT Search 有機會抓取內容，需允許 `OAI-SearchBot`。`OAI-SearchBot` 與 `GPTBot` 是不同的控制項。

建議初始範例（正式域名需替換）：

```text
User-agent: *
Allow: /

User-agent: OAI-SearchBot
Allow: /

# 以下規則代表不允許 GPTBot 抓取；若網站所有者希望允許，請刪除這個區塊。
User-agent: GPTBot
Disallow: /

Sitemap: https://YOUR-DOMAIN.example/sitemap.xml
```

注意：
- `robots.txt` 不是安全控制，也不保證所有爬蟲都遵守。
- 不要把私人資料放在公開 URL，再寄望 robots.txt 隱藏它。
- 不要不加思考地擋掉所有 `bot`；這會直接違反「讓爬蟲容易找到」的主要目標。
- 只有在使用者確認政策後，才決定 GPTBot 是否允許。

### 4.3 `sitemap.xml`

- 使用 UTF-8 XML。
- 使用完整絕對 URL。
- 只列出正式、可公開、希望被索引的 URL。
- 不列草稿、私人 API、日誌、內部控制介面。
- 初期頁面少時可手動維護；頁面增加後以腳本從明確的公開頁面清單產生。
- 新增文章時，README 必須說明如何更新 sitemap。
- 不聲稱 sitemap 提交就保證收錄。

### 4.4 JSON-LD

可以對研究文章使用 Schema.org `Article`，但只填真實存在的資訊，例如 `headline`, `description`, `author`, `datePublished`, `dateModified`, `mainEntityOfPage`。不要加入虛構評分、作者、日期或不符合可見內容的欄位。JSON-LD 是補充訊號，不是 AI 引用保證。

### 4.5 外部搜尋引擎設定

README 應提供部署後人工操作步驟：
- 在 Google Search Console 驗證網域、提交 sitemap、使用 URL Inspection。
- 在 Bing Webmaster Tools 驗證網站並提交 sitemap。
- 用 `curl` 從外部網路測試首頁、robots、sitemap 與文章頁。
- 檢查 HTTP 200、canonical、可讀 HTML、無錯誤 `noindex`、無錯誤 robots block。
- 在伺服器日誌中確認實際爬蟲請求；請求紀錄不等於已索引或已引用。

## 5. Nginx JSON access log

建立可依作業系統調整的 Nginx 設定範本。`log_format` 必須放在 `http` context；`access_log` 放在合適的 server/location context。請先執行 `nginx -t`，不要直接覆蓋系統設定。

示例：

```nginx
log_format access_json escape=json
  '{'
    '"time":"$time_iso8601",'
    '"method":"$request_method",'
    '"uri":"$uri",'
    '"status":$status,'
    '"user_agent":"$http_user_agent",'
    '"referer":"$http_referer",'
    '"request_time":$request_time,'
    '"bytes_sent":$body_bytes_sent,'
    '"request_id":"$request_id"'
  '}';

access_log /var/log/nginx/access.json access_json;
```

實作注意事項：
- 這是設定範例，必須按實際 Nginx 結構整合，不要盲目貼到錯誤 context。
- 不要預設記錄 `$remote_addr`。若研究確實需要 IP，需明確設定目的、存取權限、保存期限與告知方式。
- 不記錄 Cookie、Authorization、完整 query string 或 POST body，除非有明確且經審查的需求。
- 使用 `escape=json` 讓字串中的特殊字元適當跳脫。
- **即時性限制**：Nginx access log 通常在請求處理結束時寫入，因此 SSE 事件代表「已完成/已記錄的請求」，不一定是請求剛抵達時的訊號；對長時間下載或長連線，事件可能延遲。驗收時要量測此延遲。若作品必須在請求抵達瞬間觸發，需另行設計 request-start instrumentation，不能假設 access log 本身提供到達時事件。
- 設定 logrotate 或等效輪替方式，避免磁碟被日誌填滿。
- 讓 Node.js 收集器只有讀取日誌的必要權限，不要以 root 執行整個收集器。
- 處理 log rotation、檔案被 rename/reopen、最後一行未完成、無效 JSON、收集器重啟等情況。

## 6. Node.js SSE 收集器

### 6.1 最小功能

- 使用目前受支援的 Node.js LTS。
- 以設定檔或環境變數指定日誌路徑與 SSE listen host/port。
- 預設 listen host 為 `127.0.0.1`，而不是 `0.0.0.0`。
- 從 Nginx 日誌讀取新行，逐行 parse JSON。
- 轉成標準事件 schema。
- SSE endpoint 回傳正確的 `Content-Type: text/event-stream`，並按 SSE 格式發送事件。
- 傳送初始 comment/keep-alive（按需要），處理客戶端斷線。
- 使用有上限的記憶體緩衝區，不要無限保存所有事件。
- 若 SSE 客戶端晚加入，明確定義是否只收到新事件或可讀最近 N 筆事件。
- 以 `id:` 產生事件 ID；若支援重連，需正確處理 `Last-Event-ID` 或在 README 說明不提供歷史重播。
- 限制每秒事件量或在高流量時提供聚合模式，避免事件洪水拖垮網站。
- 事件解析錯誤要寫到獨立錯誤日誌或 stderr，不可讓一行壞 JSON 使整個服務崩潰。
- 收集器不得提供任意讀檔 API、任意命令執行或可寫日誌端點。

### 6.2 標準事件 schema

第一版建議：

```json
{
  "event_id": "monotonic-or-unique-id",
  "timestamp": "2026-10-25T12:00:00Z",
  "method": "GET",
  "path": "/articles/example.html",
  "status": 200,
  "user_agent": "raw user-agent string",
  "bot_family": "unknown",
  "verification_status": "unverified",
  "request_time_seconds": 0.023,
  "bytes_sent": 1234
}
```

- `path` 優先使用正規化後的 path，不傳送 query string。
- `user_agent` 是請求者自述文字，應視為不可信輸入；輸出到 HTML 時必須 escape。
- `bot_family` 是啟發式分類，不等同驗證。
- `verification_status` 初版可用 `unverified`；只有依照官方 IP range 或官方驗證流程成功後，才可標為 `verified`。
- 不在事件中暴露 IP、Cookie、認證資料或私人標頭。
- 若日後要保留 IP，需獨立設計隱私與保留政策。

### 6.3 SSE 端點安全

- 預設只供本機藝術程式使用，listen `127.0.0.1`。
- 不要把 SSE collector 直接公開在 Cloudflare Tunnel 上。
- 若確實需要遠端藝術程式連線，需先增加明確的驗證、TLS、速率限制與資料最小化；秘密放在環境變數，不提交 Git。
- 公開展示用事件流應是另一個端點，只輸出去識別化且經過篩選的資料。
- SSE stream 不可輸出完整日誌原文或內部檔案路徑。

### 6.4 開發測試頁

建立一個只在本機使用的測試頁或命令列 client：
- 使用 `EventSource` 訂閱 SSE。
- 顯示最近 50 筆事件。
- 對 User-Agent 等外部字串做 HTML escaping。
- 斷線時顯示狀態，並測試自動重連。
- 不將測試頁或 collector 暴露成可讀私人日誌的公開管理介面。

## 7. 公開部署與 Cloudflare Tunnel

公開部署是可發現性的必要前提，但不是索引保證。

- 需要使用者擁有可用網域與 Cloudflare 帳號。
- 安裝 `cloudflared` 並建立 Tunnel。
- 將公開 hostname 路由至本地 Nginx，例如 `http://localhost:80`。
- 只發布網站 Nginx 的必要服務，不發布資料收集器、檔案系統、SSH、資料庫或管理端點。
- 若主機離線、休眠、網路中斷或 Tunnel 斷線，網站會無法正常回應；README 要說明這個限制。
- 驗證公開 hostname、TLS、HTTP redirect、canonical、robots、sitemap 和日誌。
- 先本地測試，再讓使用者執行需要帳號、DNS 權限或 token 的步驟。不要要求把 Cloudflare token 寫進 repo。

## 8. 隱私、安全與可靠性

- 原始日誌保存在 web root 外。
- 預設不記錄 IP；若必要，說明用途、存取權限、保存期限和適用法規需由網站管理者確認。
- 不記錄 Cookie、Authorization、POST body、URL query 中的敏感資料。
- 不把 User-Agent 當成可信身份。
- 對輸出至 HTML 的所有外部字串進行 escaping。
- 設定 log rotation、磁碟空間監測與備份策略。
- SSE client 斷線、重連、慢速客戶端及大量事件時不應造成無限記憶體增長。
- 不使用日誌或統計端點暴露其他訪客的個人資料。
- 加入 `.gitignore`，忽略日誌、`.env`、本機設定、依賴資料夾與 build artifacts。
- 提供 `SECURITY.md`，列出公開端點、資料欄位、保留期限及已知限制。

## 9. 驗收測試

Codex 必須在 README/測試報告中標記每項為 PASS、FAIL 或 MANUAL。不可把 MANUAL 說成 PASS。

### A. 靜態網站
- [ ] 首頁在本機回傳 HTTP 200。
- [ ] 重要文章可透過直接 URL 訪問。
- [ ] HTML 包含實際文字、唯一 title、description、h1。
- [ ] 重要頁面可從一般 `<a href>` 連結到達。
- [ ] 不存在頁面回傳真正 404。
- [ ] canonical 不包含 placeholder 網域。

### B. GEO / crawler readiness
- [ ] `/robots.txt` 可讀取，語法與政策一致。
- [ ] `/sitemap.xml` 可讀取且只列正式公開 URL。
- [ ] Sitemap URL 使用完整絕對 URL。
- [ ] 無意外的 `noindex`、錯誤 canonical 或 robots block。
- [ ] `OAI-SearchBot` 政策已在 README 清楚記錄。
- [ ] 是否允許 `GPTBot` 由網站管理者決定，而不是 Codex 自行假設。
- [ ] 外部部署後用 `curl` 檢查公開 URL。
- [ ] 搜尋引擎是否索引／AI 是否引用，必須標為部署後觀測，不可由本地測試推斷。

### C. 日誌
- [ ] 測試請求在 Nginx access log 中產生一筆 JSON。
- [ ] 每行可由 `JSON.parse` 解析。
- [ ] UA 中的引號、反斜線等特殊字元不會破壞 JSON。
- [ ] 日誌路徑在公開 web root 外。
- [ ] 日誌未包含不必要的 IP、Cookie、Authorization 或 query string。
- [ ] logrotate/輪替方式有說明。

### D. 即時事件流
- [ ] 收集器能讀取新日誌行。
- [ ] 測試請求可被轉成標準 event schema。
- [ ] SSE client 能收到事件。
- [ ] 斷線、重連、無效日誌行不會讓服務崩潰。
- [ ] 事件緩衝有上限。
- [ ] collector 預設只綁定 loopback。
- [ ] 沒有公開任意檔案讀取或管理端點。
- [ ] 提供一個端到端測試命令或腳本。

### E. 部署
- [ ] Nginx 設定先經 `nginx -t` 檢查。
- [ ] Cloudflare Tunnel 步驟有官方來源。
- [ ] 公開路由只指向 Nginx 網站服務。
- [ ] 公開網址可從不同網路訪問（需要人工驗證）。
- [ ] 主機離線時的行為與限制已記錄。

## 10. 實作階段與交付物

### Phase 1 — HTML-first website
交付：`public/` 內容、CSS、首頁、關於頁、實驗頁、文章範本、robots、sitemap。

### Phase 2 — Nginx logging
交付：`nginx/site.conf.example`、JSON log format、設定驗證說明、測試腳本。

### Phase 3 — Node.js event collector + SSE
交付：`collector/`、標準 event schema、SSE endpoint、本機測試 client、端到端測試。

### Phase 4 — 安全與操作文件
交付：`README.md`、`SECURITY.md`、`.gitignore`、log rotation 說明、啟動/停止指令、常見問題。

### Phase 5 — 公開部署手冊
交付：Cloudflare Tunnel、網域、HTTPS、外部驗證、Search Console/Bing Webmaster Tools 的逐步人工操作說明。不得假裝 Codex 已有使用者帳號或 DNS 權限。

### Phase 6 — GEO 驗證與觀測
交付：部署後測試清單、爬蟲日誌檢視方法、收錄與引用的觀測表格。明確區分：
1. crawler request observed
2. search engine indexed
3. search impression/click
4. AI answer citation

這四者不可互相推論。

## 11. Codex 應先問使用者的阻塞性問題

先檢查 repo 與作業系統；只有以下問題會影響實作時才詢問：

1. 作業系統是 Linux、macOS，還是 Windows/WSL2？
2. 是否已擁有網域與 Cloudflare 帳號？若沒有，先完成本機版，公開部署留待之後。
3. 希望 GPTBot 被允許還是禁止？預設建議允許 `OAI-SearchBot`，而 GPTBot 依使用者內容政策選擇。
4. 即時事件是否只供本機藝術程式使用？預設是「只供本機」，不公開原始事件流。

若使用者未回答，採用安全預設：本機先完成、collector 只綁定 loopback、不記錄 IP、不公開 SSE、不允許未確認的外部管理存取。

## 12. 官方資料來源

以下來源應在實作前重新開啟確認是否更新。若文件已變更，依最新官方文件修正並在 `IMPLEMENTATION_PLAN.md` 記錄。

1. OpenAI — Overview of OpenAI Crawlers  
   https://developers.openai.com/api/docs/bots  
   用途：OAI-SearchBot、GPTBot、ChatGPT-User 的用途與分別設定。
2. OpenAI Help Center — Publishers and Developers FAQ  
   https://help.openai.com/en/articles/12627856  
   用途：公開網站可被 ChatGPT Search 發現的條件、允許 OAI-SearchBot 的建議。
3. Google Search Central — Get started with Search: a developer’s guide  
   https://developers.google.com/search/docs/fundamentals/get-started-developers  
   用途：可抓取連結、sitemap、文字內容、標題與 JavaScript 搜尋可見性。
4. Google Search Central — What Is a Sitemap  
   https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview  
   用途：sitemap 的目的與不保證收錄的限制。
5. Google Search Central — Build and Submit a Sitemap  
   https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap  
   用途：絕對 URL、提交方式、sitemap 規範。
6. Google Search Central — Robots.txt Introduction and Guide  
   https://developers.google.com/search/docs/crawling-indexing/robots/intro  
   用途：robots.txt 不是安全機制，禁止抓取不等於禁止索引。
7. Nginx — ngx_http_log_module  
   https://nginx.org/en/docs/http/ngx_http_log_module.html  
   用途：`log_format`、`escape=json`、`access_log`。
8. MDN — Using server-sent events  
   https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events  
   用途：SSE 的單向推送、EventSource、錯誤處理。
9. Cloudflare — Set up Cloudflare Tunnel  
   https://developers.cloudflare.com/tunnel/get-started/  
   用途：建立 Tunnel、公開 hostname 到本地服務的路由、所需條件。

## 13. 最終交付標準

完成後，請 Codex 在回覆中提供：

- 實際新增/修改的檔案清單。
- 如何在本機啟動網站、Nginx 與 collector。
- 如何執行端到端測試。
- 測試結果表（PASS/FAIL/MANUAL）。
- 如何新增一篇 HTML 文章並更新 sitemap。
- 如何設定 Cloudflare Tunnel（若未能在本機自動完成，提供人工步驟）。
- 尚未完成或需要使用者操作的事項。
- 已知安全限制與隱私決策。
- 所有引用官方文件的連結。
- 明確聲明：已準備好 crawler-friendly 的網站結構不代表搜尋引擎必定索引，也不代表 AI 必定引用。

**第一個里程碑是端到端資料管線：發出一個 HTTP 請求 → Nginx 寫入 JSON 日誌 → Node.js 解析 → SSE client 收到事件。** 先讓這條管線可靠運作，再增加公開部署與 GEO 驗證。
