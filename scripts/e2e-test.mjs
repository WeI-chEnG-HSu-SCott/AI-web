import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const log = path.join(os.tmpdir(), `visit-observatory-${process.pid}.jsonl`); const port = 18000 + Math.floor(Math.random() * 1000);
fs.writeFileSync(log, '');
const child = spawn(process.execPath, ['src/server.js'], {cwd:path.join(root,'collector'), env:{...process.env, ACCESS_LOG_PATH:log, SSE_PORT:String(port)}, stdio:['ignore','pipe','pipe']});
let childOutput = ''; child.stdout.on('data', data => { childOutput += data; }); child.stderr.on('data', data => { childOutput += data; });
const wait = ms => new Promise(resolve => setTimeout(resolve,ms));
const get = route => new Promise((resolve,reject) => http.get(`http://127.0.0.1:${port}${route}`, res => resolve(res)).on('error',reject));
try {
  for (let i=0;i<30;i++) { try { const res=await get('/health'); res.resume(); break; } catch { if(i===29) throw new Error(`collector did not become ready: ${childOutput.trim()}`); await wait(50); } }
  const received = new Promise((resolve,reject) => { const request=http.get(`http://127.0.0.1:${port}/events`, res => { let text=''; res.on('data',chunk=>{ text += chunk; const match=text.match(/data: (.+)\n/); if(match){ request.destroy(); resolve(JSON.parse(match[1])); } }); }); request.on('error',error=>{if(error.code!=='ECONNRESET')reject(error);}); setTimeout(()=>reject(new Error('SSE timeout')),3000).unref(); });
  await wait(100); fs.appendFileSync(log, '{"time":"2026-10-25T12:00:00Z","method":"GET","uri":"/articles/example.html?private=1","status":200,"user_agent":"test-client","request_time":0.02,"bytes_sent":99}\n');
  const event = await received; assert.equal(event.path, '/articles/example.html'); assert.equal(event.status, 200); assert.equal(event.verification_status, 'unverified'); console.log('PASS: HTTP log → collector → SSE event');
} finally { child.kill(); fs.rmSync(log,{force:true}); }
