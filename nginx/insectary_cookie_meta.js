import crypto from 'crypto';

function cookieHeader(r) {
  return r.headersIn.Cookie || r.headersIn.cookie || '';
}

function cookieParts(r) {
  return cookieHeader(r)
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function cookieHeaderBytes(r) {
  return String(Buffer.byteLength(cookieHeader(r), 'utf8'));
}

function cookieCount(r) {
  return String(cookieParts(r).length);
}

function cookieNames(r) {
  const allowedName = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]{1,64}$/;
  return cookieParts(r)
    .map((item) => item.split('=', 1)[0].trim())
    .filter((name) => allowedName.test(name))
    .slice(0, 32)
    .join(',');
}

function cookieFingerprint(r) {
  const header = cookieHeader(r);
  const key = process.env.COOKIE_HMAC_KEY;

  if (!header) return '';
  if (!key) return 'key_unavailable';

  return crypto.createHmac('sha256', key).update(header).digest('base64url');
}

export default {
  cookieHeaderBytes,
  cookieCount,
  cookieNames,
  cookieFingerprint
};
