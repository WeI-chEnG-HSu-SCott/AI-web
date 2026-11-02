import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(projectRoot, 'public');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'insectary-public-'));
const copy = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copy(path.join(from, entry.name), target);
    else fs.copyFileSync(path.join(from, entry.name), target);
  }
};

try {
  copy(source, temporaryRoot);
  const result = spawnSync(process.execPath, [path.join(projectRoot, 'scripts', 'generate-public-metadata.mjs')], {
    env: { ...process.env, SITE_ORIGIN: 'https://example.test', PUBLIC_DIR: temporaryRoot, GOOGLE_SITE_VERIFICATION: 'google-token', BING_SITE_VERIFICATION: 'bing-token' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const robots = fs.readFileSync(path.join(temporaryRoot, 'robots.txt'), 'utf8');
  const sitemap = fs.readFileSync(path.join(temporaryRoot, 'sitemap.xml'), 'utf8');
  assert.match(robots, /User-agent: OAI-SearchBot\nAllow: \//);
  assert.match(robots, /User-agent: GPTBot\nAllow: \//);
  assert.match(robots, /Sitemap: https:\/\/example\.test\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/example\.test\//);
  assert.match(sitemap, /https:\/\/example\.test\/experiments\//);
  const home = fs.readFileSync(path.join(temporaryRoot, 'index.html'), 'utf8');
  assert.match(home, /<link rel="canonical" href="https:\/\/example\.test\/">/);
  assert.match(home, /<meta name="google-site-verification" content="google-token">/);
  assert.match(home, /<meta name="msvalidate\.01" content="bing-token">/);
  console.log('PASS: public metadata generation and verification tags');
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
