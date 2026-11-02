import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const origin = process.env.SITE_ORIGIN;
if (!origin || !/^https:\/\/[^/?#]+$/i.test(origin)) throw new Error('Set SITE_ORIGIN to a production HTTPS origin, e.g. https://www.yourdomain.tld');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const pages = ['index.html','about.html','archive.html','experiments/index.html','articles/example.html','articles/what-is-robots-txt.html','articles/ai-crawlers-and-robots-txt.html','articles/what-is-a-web-crawler.html','articles/http-status-codes-for-website-owners.html','articles/can-you-trust-a-user-agent.html'];
for (const page of pages) { const file = path.join(root,page); const html = fs.readFileSync(file,'utf8').replace(/\s*<link rel="canonical"[^>]*>\n?/g,'').replace('</head>', `  <link rel="canonical" href="${origin}/${page === 'index.html' ? '' : page}">\n</head>`); fs.writeFileSync(file,html); }
fs.writeFileSync(path.join(root,'robots.txt'), `User-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\n# Site owner has not opted into training crawl. Remove this block only after review.\nUser-agent: GPTBot\nDisallow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
const urls = pages.map(page => `${origin}/${page === 'index.html' ? '' : page}`); fs.writeFileSync(path.join(root,'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`Generated canonical URLs, robots.txt and sitemap.xml for ${origin}`);
