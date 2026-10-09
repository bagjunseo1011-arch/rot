#!/usr/bin/env node
/* 로컬 미리보기 서버.  실행: node serve.js  →  http://localhost:4322
   빌드 결과가 절대 경로(/assets/...)를 쓰기 때문에 file:// 로 열면 CSS가 안 붙습니다.
   배포용이 아니라 확인용입니다. */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4322; // what-ai.kr(4321)과 동시에 띄울 수 있게
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, urlPath);

  // 디렉터리 요청은 index.html 로
  if (urlPath.endsWith('/')) file = path.join(file, 'index.html');

  // ROOT 밖으로 나가는 경로 차단
  if (!path.resolve(file).startsWith(path.resolve(ROOT))) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      // 없는 주소는 실제 배포와 같이 404 페이지를 보여 줍니다
      fs.readFile(path.join(ROOT, '404.html'), (e2, notFound) => {
        res.writeHead(404, { 'Content-Type': TYPES['.html'] }).end(e2 ? 'Not Found' : notFound);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(data);
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
