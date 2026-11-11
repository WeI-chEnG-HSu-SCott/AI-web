import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const config = {
  logPath: path.resolve(process.env.ACCESS_LOG_PATH || path.join(here, "..", "data", "access.jsonl")),
  host: process.env.SSE_HOST || "0.0.0.0",
  port: Number(process.env.SSE_PORT || 8790),
  bufferSize: Math.max(1, Number(process.env.EVENT_BUFFER_SIZE || 50)),
  maxEventsPerSecond: Math.max(1, Number(process.env.MAX_EVENTS_PER_SECOND || 120))
};
const clients = new Set(); let history = []; let offset = 0; let pending = ""; let serial = 0; let windowStart = Date.now(); let windowCount = 0;

const geoCache = new Map();

function isPrivateIP(ip = "") {
  const clean = ip.trim();
  if (!clean || clean === "-" || clean === "127.0.0.1" || clean === "::1") return true;
  if (clean.startsWith("10.") || clean.startsWith("192.168.") || clean.startsWith("127.")) return true;
  if (clean.startsWith("172.")) {
    const parts = clean.split(".");
    if (parts.length >= 2) {
      const second = parseInt(parts[1], 10);
      if (second >= 16 && second <= 31) return true;
    }
  }
  if (clean.startsWith("fc00:") || clean.startsWith("fe80:")) return true;
  return false;
}

export function fetchGeoIP(ip = "") {
  const cleanIp = ip.trim();
  if (!cleanIp || isPrivateIP(cleanIp)) {
    return Promise.resolve({ city: "Local Network", region: "LAN", country_name: "Private Network", org: "Local", location: "Local Network" });
  }
  if (geoCache.has(cleanIp)) return Promise.resolve(geoCache.get(cleanIp));
  return new Promise((resolve) => {
    const req = https.get("https://ipapi.co/" + cleanIp + "/json/", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FlyOS-Collector/1.0)" },
      timeout: 3000
    }, (res) => {
      let body = "";
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => {
        try {
          if (res.statusCode === 200) {
            const data = JSON.parse(body);
            if (!data.error) {
              const city = typeof data.city === "string" ? data.city : "";
              const region = typeof data.region === "string" ? data.region : "";
              const country = typeof (data.country_name || data.country) === "string" ? (data.country_name || data.country) : "";
              const org = typeof (data.org || data.asn) === "string" ? (data.org || data.asn) : "";
              const locParts = [city, country].filter(Boolean);
              const location = locParts.length > 0 ? locParts.join(", ") : "Unknown";
              const result = { city, region, country_name: country, org, location };
              geoCache.set(cleanIp, result);
              return resolve(result);
            }
          }
        } catch {}
        const fallback = { city: "", region: "", country_name: "", org: "", location: "Unknown" };
        geoCache.set(cleanIp, fallback);
        resolve(fallback);
      });
    });
    req.on("error", () => { const fb = { city: "", region: "", country_name: "", org: "", location: "Unknown" }; geoCache.set(cleanIp, fb); resolve(fb); });
    req.on("timeout", () => { req.destroy(); const fb = { city: "", region: "", country_name: "", org: "", location: "Unknown" }; geoCache.set(cleanIp, fb); resolve(fb); });
  });
}

const sensitiveParameter = /^(access_?token|api_?key|auth(orization)?|code|cookie|id_?token|key|pass(word)?|secret|session|sid|token)$/i;
function text(value) { return typeof value === "string" && value !== "-" ? value : ""; }
function redactUrl(value) { const raw = text(value); if (!raw) return ""; const cut = raw.indexOf("?"); if (cut < 0) return raw; const pathPart = raw.slice(0, cut); const params = new URLSearchParams(raw.slice(cut + 1)); for (const [key] of params) if (sensitiveParameter.test(key)) params.set(key, "[redacted]"); const query = params.toString(); return query ? pathPart + "?" + query : pathPart; }

export function normalize(record, geo = null) {
  if (!record || typeof record !== "object") throw new Error("record must be an object");
  const status = Number(record.status);
  if (!Number.isInteger(status)) throw new Error("status must be an integer");
  const target = redactUrl(text(record.request_uri) || text(record.uri) || "/");
  const cleanPath = target.split("?")[0] || "/";
  const ua = text(record.user_agent);
  const clientIp = text(record.client_ip);
  const geoObj = geo || (isPrivateIP(clientIp) ? { city: "Local Network", region: "LAN", country_name: "Private Network", org: "Local", location: "Local Network" } : { city: "", region: "", country_name: "", org: "", location: "Unresolved" });

  return {
    event_id: String(++serial),
    timestamp: typeof record.time === "string" ? record.time : new Date().toISOString(),
    client_ip: clientIp,
    client_port: Number(record.client_port) || null,
    proxy_peer_ip: text(record.proxy_peer_ip),
    proxy_peer_port: Number(record.proxy_peer_port) || null,
    ip_resolution: text(record.ip_resolution) || "unverified",
    proxy_headers: {
      cf_connecting_ip: text(record.cf_connecting_ip_header),
      x_forwarded_for: text(record.x_forwarded_for_header),
      cf_ray: text(record.cf_ray)
    },
    geo: geoObj,
    method: text(record.method) || "GET",
    request: text(record.request),
    path: cleanPath,
    request_target: target,
    host: text(record.host),
    scheme: text(record.scheme),
    protocol: text(record.protocol),
    status,
    user_agent: ua,
    referer: redactUrl(record.referer),
    accept_language: text(record.accept_language),
    accept: text(record.accept),
    accept_encoding: text(record.accept_encoding),
    content_type: text(record.content_type),
    origin: text(record.origin),
    client_hints: {
      ua: text(record.sec_ch_ua),
      platform: text(record.sec_ch_ua_platform),
      mobile: text(record.sec_ch_ua_mobile)
    },
    fetch_metadata: {
      site: text(record.sec_fetch_site),
      mode: text(record.sec_fetch_mode),
      destination: text(record.sec_fetch_dest)
    },
    authentication_metadata: {
      has_authorization: Number(record.has_authorization) === 1,
      value_saved: false
    },
    tls: {
      protocol: text(record.ssl_protocol),
      cipher: text(record.ssl_cipher)
    },
    request_length: Number(record.request_length) || 0,
    content_length: Number(record.content_length) || null,
    verification_status: "unverified",
    request_time_seconds: Number(record.request_time) || 0,
    bytes_sent: Number(record.bytes_sent) || 0,
    body_bytes_sent: Number(record.body_bytes_sent) || 0
  };
}

function send(res, event) { res.write("id: " + event.event_id + "\nevent: visit\ndata: " + JSON.stringify(event) + "\n\n"); }

function publish(event) {
  const now = Date.now();
  if (now - windowStart >= 1000) { windowStart = now; windowCount = 0; }
  if (++windowCount > config.maxEventsPerSecond) return console.error("event dropped: per-second limit reached");
  history.push(event);
  if (history.length > config.bufferSize) history = history.slice(-config.bufferSize);
  for (const client of clients) send(client, event);
}

async function consume(textData) {
  pending += textData;
  const lines = pending.split(/\r?\n/);
  pending = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      const ip = text(record.client_ip);
      const geo = await fetchGeoIP(ip);
      publish(normalize(record, geo));
    } catch (error) {
      console.error("invalid log line skipped: " + error.message);
    }
  }
}

function readNew() {
  fs.stat(config.logPath, (err, stat) => {
    if (err) {
      if (err.code !== "ENOENT") console.error("log stat failed: " + err.message);
      return;
    }
    if (stat.size < offset) {
      offset = 0;
      pending = "";
    }
    if (stat.size === offset) return;
    const stream = fs.createReadStream(config.logPath, { start: offset, end: stat.size - 1, encoding: "utf8" });
    stream.on("data", consume);
    stream.on("error", error => console.error("log read failed: " + error.message));
    stream.on("end", () => {
      offset = stat.size;
    });
  });
}

function watchLog() {
  readNew();
  let timer;
  fs.watch(path.dirname(config.logPath), (_type, file) => {
    if (file && file !== path.basename(config.logPath)) return;
    clearTimeout(timer);
    timer = setTimeout(readNew, 35);
  }).on("error", error => console.error("log watch failed: " + error.message));
  setInterval(readNew, 1000).unref();
}

const viewer = fs.readFileSync(path.join(here, "viewer.html"));

export function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, {"content-type":"application/json","cache-control":"no-store"});
      return res.end(JSON.stringify({status:"ok", clients:clients.size}));
    }
    if (req.method === "GET" && url.pathname === "/events") {
      res.writeHead(200, {"content-type":"text/event-stream","cache-control":"no-cache","connection":"keep-alive","x-accel-buffering":"no"});
      res.write(": connected\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (req.method === "GET" && url.pathname === "/viewer") {
      res.writeHead(200, {"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
      return res.end(viewer);
    }
    res.writeHead(404, {"content-type":"application/json"});
    res.end("{\"error\":\"not found\"}");
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(path.dirname(config.logPath), {recursive:true});
  if (!fs.existsSync(config.logPath)) fs.closeSync(fs.openSync(config.logPath, "a"));
  watchLog();
  const server = createServer();
  server.listen(config.port, config.host, () => console.log("collector listening at http://" + config.host + ":" + config.port + "; log=" + config.logPath));
}