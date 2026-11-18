// Статичний сервер CyberQuest для браузера на ПК або в локальній мережі.
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { parseArgs } = require('node:util');
const { lanLinks, joinPage } = require('./lan-join');

const { values } = parseArgs({ options: {
  lan: { type: 'boolean' }, port: { type: 'string', default: '5173' },
  cert: { type: 'string' }, key: { type: 'string' },
  'open-qr': { type: 'boolean' },
} });
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Вкажіть порт від 1 до 65535.');
if (!!values.cert !== !!values.key) throw new Error('Для HTTPS вкажіть --cert і --key разом.');

const root = fs.realpathSync(path.join(__dirname, '..', 'src'));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg',
};

function send(req, res, file, size, type) {
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  let start = 0;
  let end = size - 1;

  if (type === 'audio/mpeg') {
    res.setHeader('Accept-Ranges', 'bytes');
    if (req.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (range?.[1]) {
        start = Number(range[1]);
        if (range[2]) end = Math.min(end, Number(range[2]));
      } else if (range?.[2]) {
        start = Math.max(0, size - Number(range[2]));
      }
      if (!range || (!range[1] && !range[2]) || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` });
        return res.end();
      }
      res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    }
  }

  if (!res.headersSent) res.writeHead(200, { 'Content-Length': size });
  if (req.method === 'HEAD' || size === 0) return res.end();
  fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
}

async function serve(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  let url, pathname;
  try {
    url = new URL(req.url, 'http://localhost');
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (['/src', '/src/', '/src/index.html'].includes(pathname)) {
    res.writeHead(302, { Location: '/' + url.search });
    return res.end();
  }
  if (pathname === '/join' && values.lan && req.socket.remoteAddress === '127.0.0.1') {
    const page = joinPage(lanLinks(protocol, port));
    res.writeHead(200, { 'Content-Type': types['.html'], 'Cache-Control': 'no-store' });
    return res.end(req.method === 'HEAD' ? undefined : page);
  }
  const requested = pathname === '/' ? '/index.html' : pathname;
  const type = types[path.extname(requested)];
  try {
    const file = type && await fs.promises.realpath(path.resolve(root, '.' + requested));
    if (file && file.startsWith(root + path.sep)) {
      const stat = await fs.promises.stat(file);
      if (stat.isFile()) return send(req, res, file, stat.size, type);
    }
  } catch {
    // Відсутній або недоступний ресурс.
  }
  res.writeHead(404);
  res.end('404');
}

const tls = values.cert && { cert: fs.readFileSync(values.cert), key: fs.readFileSync(values.key) };
const protocol = tls ? 'https' : 'http';
const server = tls ? https.createServer(tls, serve) : http.createServer(serve);
server.listen(port, values.lan ? '0.0.0.0' : '127.0.0.1', () => {
  const local = `${protocol}://localhost:${port}/`;
  console.log(local);
  if (!values.lan) return;

  for (const { name, url } of lanLinks(protocol, port)) console.log(`${name}: ${url}`);
  const join = local + 'join';
  console.log(`QR: ${join}`);
  if (!values['open-qr'] || process.platform !== 'win32') return;

  const browser = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', `start "" ${join}`], {
    windowsVerbatimArguments: true, windowsHide: true, stdio: 'ignore',
  });
  browser.on('error', () => console.warn(`Open the QR page in your browser: ${join}`));
  browser.unref();
});
