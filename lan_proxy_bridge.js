const http = require('http');
const os = require('os');

const TARGET_HOST = '::1';
const TARGET_PORT = 8080;
const LISTEN_PORT = 8080;

// Lấy danh sách các IPv4 nội bộ
function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

function createProxyFor(ip) {
  const server = http.createServer((req, res) => {
    // Thêm CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const options = {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `localhost:${TARGET_PORT}`,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error(`[Proxy ${ip}] Error:`, err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Backend unreachable', details: err.message }));
      }
    });

    req.pipe(proxyReq, { end: true });
  });

  server.listen(LISTEN_PORT, ip, () => {
    console.log(`[LAN Bridge] Đang lắng nghe trên http://${ip}:${LISTEN_PORT} -> http://[${TARGET_HOST}]:${TARGET_PORT}`);
  });

  server.on('error', (err) => {
    console.warn(`[LAN Bridge] Không thể bind ${ip}:${LISTEN_PORT} (${err.code}).`);
  });

  return server;
}

const ips = getLocalIps();
console.log('Các địa chỉ IP mạng nội bộ phát hiện:', ips);

const servers = ips.map((ip) => createProxyFor(ip));

// Giữ tiến trình chạy liên tục
process.on('SIGINT', () => {
  servers.forEach((s) => s.close());
  process.exit(0);
});
