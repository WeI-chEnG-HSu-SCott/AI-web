import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.env.PUBLIC_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public'));
const host = process.env.STATIC_HOST || '127.0.0.1'; const port = Number(process.env.STATIC_PORT || 8080);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.js':'text/javascript; charset=utf-8'};
http.createServer((req,res)=>{ if (req.method !== 'GET' && req.method !== 'HEAD') {res.writeHead(405);return res.end();} const requested = decodeURIComponent(new URL(req.url, 'http://local').pathname); const candidate = path.resolve(root, '.' + (requested.endsWith('/') ? requested + 'index.html' : requested)); if (!candidate.startsWith(root + path.sep) && candidate !== root) {res.writeHead(403);return res.end();} fs.readFile(candidate,(err,data)=>{if(err){res.writeHead(err.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});return res.end(err.code==='ENOENT'?'Not found':'Server error');}res.writeHead(200,{'content-type':types[path.extname(candidate)]||'application/octet-stream','x-content-type-options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);}); }).listen(port,host,()=>console.log(`static site: http://${host}:${port}`));
