import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const origin = process.env.SITE_ORIGIN;
if (!origin || !/^https:\/\/[^/?#]+$/i.test(origin)) {
  throw new Error('Set SITE_ORIGIN to a production HTTPS origin, e.g. https://www.yourdomain.tld');
}

const root = path.resolve(process.env.PUBLIC_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public'));
const normalizedOrigin = origin.replace(/\/$/, '');
const verificationTags = [
  ['google-site-verification', process.env.GOOGLE_SITE_VERIFICATION],
  ['msvalidate.01', process.env.BING_SITE_VERIFICATION],
].filter(([, value]) => value);

function findPages(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findPages(fullPath);
    return entry.isFile() && entry.name.endsWith('.html') ? [path.relative(root, fullPath).replaceAll(path.sep, '/')] : [];
  });
}

function publicPath(page) {
  if (page === 'index.html') return '/';
  if (page.endsWith('/index.html')) return `/${page.slice(0, -'index.html'.length)}`;
  return `/${page}`;
}

const pages = findPages(root).sort();
if (pages.length === 0) throw new Error(`No HTML pages found in ${root}`);

for (const page of pages) {
  const file = path.join(root, page);
  const original = fs.readFileSync(file, 'utf8');
  if (!/<\/head>/i.test(original)) throw new Error(`Missing </head> in ${page}`);
  const url = `${normalizedOrigin}${publicPath(page)}`;
  const html = original
    .replace(/\s*<link rel="canonical"[^>]*>\n?/gi, '')
    .replace(/\s*<meta name="(?:google-site-verification|msvalidate\.01)"[^>]*>\n?/gi, '')
    .replace('</head>', `${verificationTags.map(([name, value]) => `  <meta name="${name}" content="${value}">\n`).join('')}  <link rel="canonical" href="${url}">\n</head>`);
  fs.writeFileSync(file, html);
}

fs.writeFileSync(path.join(root, 'robots.txt'), `# Public pages may be crawled for search discovery and AI training.\nUser-agent: *\nAllow: /\n\n# Allow ChatGPT Search discovery.\nUser-agent: OAI-SearchBot\nAllow: /\n\n# Allow OpenAI model-training crawls.\nUser-agent: GPTBot\nAllow: /\n\nSitemap: ${normalizedOrigin}/sitemap.xml\n`);

const urls = pages.map(page => `${normalizedOrigin}${publicPath(page)}`);
fs.writeFileSync(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`);

console.log(`Generated canonical URLs, robots.txt and sitemap.xml for ${normalizedOrigin} (${pages.length} public HTML pages).`);
