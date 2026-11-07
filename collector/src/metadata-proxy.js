import crypto from 'node:crypto';
import http from 'node:http';

const config = {
  host: process.env.METADATA_PROXY_HOST || '127.0.0.1',
  port: Number(process.env.METADATA_PROXY_PORT || 18080),
  originHost: process.env.NGINX_ORIGIN_HOST || '127.0.0.1',
  originPort: Number(process.env.NGINX_ORIGIN_PORT || 8081),
  hmacKey: process.env.COOKIE_HMAC_KEY || ''
};

if (!config.hmacKey) throw new Error('COOKIE_HMAC_KEY is required');

function cookieMetadata(cookieHeader = '') {
  const parts = cookieHeader.split(';').map(item => item.trim()).filter(Boolean);
  const allowedName = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]{1,64}$/;
  const names = parts
    .map(item => item.split('=', 1)[0].trim())
    .filter(name => allowedName.test(name))
    .slice(0, 32);

  return {
    hasCookie: cookieHeader ? '1' : '0',
    headerBytes: String(Buffer.byteLength(cookieHeader, 'utf8')),
    count: String(parts.length),
    names: names.join(','),
    fingerprint: cookieHeader
      ? crypto.createHmac('sha256', config.hmacKey).update(cookieHeader).digest('base64url')
      : ''
  };
}

function sanitizeHeaders(headers) {
  const output = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (lower === 'cookie' || lower === 'authorization' || lower === 'proxy-authorization') continue;
    if (lower.startsWith('x-insectary-')) continue;
    if (lower === 'connection') continue;
    output[name] = value;
  }
  return output;
}

const server = http.createServer((request, response) => {
  const cookieHeader = typeof request.headers.cookie === 'string' ? request.headers.cookie : '';
  const metadata = cookieMetadata(cookieHeader);
  const headers = sanitizeHeaders(request.headers);
  headers['x-insectary-has-cookie'] = metadata.hasCookie;
  headers['x-insectary-cookie-header-bytes'] = metadata.headerBytes;
  headers['x-insectary-cookie-count'] = metadata.count;
  headers['x-insectary-cookie-names'] = metadata.names;
  headers['x-insectary-cookie-fingerprint'] = metadata.fingerprint;
  headers['x-insectary-has-authorization'] = request.headers.authorization ? '1' : '0';

  const upstream = http.request({
    host: config.originHost,
    port: config.originPort,
    method: request.method,
    path: request.url,
    headers
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });

  upstream.on('error', (error) => {
    console.error(`Nginx origin unavailable: ${error.message}`);
    if (!response.headersSent) response.writeHead(502, {'content-type': 'text/plain; charset=utf-8'});
    response.end('Origin unavailable');
  });

  request.pipe(upstream);
});

server.listen(config.port, config.host, () => {
  console.log(`metadata proxy listening at http://${config.host}:${config.port}; origin=http://${config.originHost}:${config.originPort}`);
});
