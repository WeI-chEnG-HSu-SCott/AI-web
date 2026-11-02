import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'art-data');
const count = Math.max(1, Number(process.argv[2] || 48));
const start = new Date('2026-10-26T14:00:00.000Z').getTime();
const visitors = [
  ['oai-searchbot', 'OAI-SearchBot/1.0'],
  ['googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ['bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  ['gptbot', 'GPTBot/1.2'],
  ['unknown', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36']
];
const paths = ['/','/about.html','/experiments/','/articles/example.html','/assets/style.css','/robots.txt','/sitemap.xml'];
const statuses = [200, 200, 200, 200, 304, 404, 429];
const events = Array.from({ length: count }, (_, index) => {
  const [bot_family, user_agent] = visitors[index % visitors.length];
  const status = statuses[index % statuses.length];
  const pathName = paths[(index * 3) % paths.length];
  return {
    event_id: `fake-${String(index + 1).padStart(4, '0')}`,
    timestamp: new Date(start + index * (700 + (index % 5) * 530)).toISOString(),
    client_ip: `198.51.100.${20 + (index % 20)}`,
    client_port: 40000 + index * 31,
    method: index % 13 === 0 ? 'HEAD' : 'GET',
    path: pathName,
    request_target: index % 9 === 0 ? `${pathName}?topic=art&token=%5Bredacted%5D` : pathName,
    host: 'visit-observatory.test',
    scheme: index % 4 === 0 ? 'http' : 'https',
    protocol: index % 3 === 0 ? 'HTTP/1.1' : 'HTTP/2.0',
    status,
    user_agent,
    referer: index % 6 === 0 ? 'https://search.example/?q=network+art' : '',
    accept_language: index % 3 === 0 ? 'zh-TW,zh;q=0.9' : 'en-US,en;q=0.8',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    client_hints: { ua: bot_family === 'unknown' ? '"Chromium";v="130"' : '', platform: bot_family === 'unknown' ? '"macOS"' : '' },
    tls: { protocol: index % 4 === 0 ? '' : 'TLSv1.3', cipher: index % 4 === 0 ? '' : 'TLS_AES_256_GCM_SHA384' },
    request_length: 180 + (index % 8) * 42,
    bot_family,
    verification_status: 'unverified',
    request_time_seconds: Number((0.008 + (index % 11) * 0.031).toFixed(3)),
    bytes_sent: status === 304 ? 0 : 700 + (index % 9) * 640
  };
});
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'fake-visit-events.jsonl'), `${events.map(JSON.stringify).join('\n')}\n`);
fs.writeFileSync(path.join(outDir, 'fake-visit-events.json'), `${JSON.stringify(events, null, 2)}\n`);
console.log(`Wrote ${events.length} fake normalized events to art-data/.`);
