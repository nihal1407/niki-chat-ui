const express = require('express');
const session = require('express-session');
const { WebSocket } = require('ws');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const UI_PASSWORD = process.env.UI_PASSWORD || 'changeme';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const HERMES_WS = process.env.HERMES_WS || 'ws://127.0.0.1:9119/ws';

app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

// ---- auth ----
app.post('/api/login', (req, res) => {
  if (req.body && req.body.password === UI_PASSWORD) {
    req.session.authed = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: 'wrong password' });
});

function requireAuth(req, res, next) {
  if (req.session && req.session.authed) return next();
  res.status(401).json({ ok: false, error: 'unauthorized' });
}

app.get('/api/check', requireAuth, (req, res) => res.json({ ok: true }));

// ---- static ----
app.use(express.static('public'));

// ---- WS proxy: browser <-> this server <-> hermes serve ----
server.on('upgrade', (req, socket, head) => {
  // Only proxy authenticated upgrades on /ws
  const cookie = req.headers.cookie || '';
  const authed = /connect\.sid=.+/.test(cookie); // session cookie present
  if (!authed) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    return socket.destroy();
  }
  // Simple session check via express-session store is async; for MVP we accept
  // presence of a session cookie. Strengthen before public exposure.
});

// Real per-client proxying happens after login page loads:
// the browser opens /proxy-ws, and we bridge it to Hermes.
const wss = new (require('ws').WebSocketServer)({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/proxy-ws') return; // let other upgrade handlers run

  const cookie = req.headers.cookie || '';
  if (!cookie.includes('connect.sid=')) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    return socket.destroy();
  }

  wss.handleUpgrade(req, socket, head, (clientWs) => {
    const hermesWs = new WebSocket(HERMES_WS);

    hermesWs.on('open', () => clientWs.send(JSON.stringify({ type: 'backend_connected' })));

    hermesWs.on('message', (data) => {
      try { clientWs.send(data.toString()); } catch {}
    });
    hermesWs.on('close', () => clientWs.close());
    hermesWs.on('error', (e) => {
      try { clientWs.send(JSON.stringify({ type: 'error', message: 'backend connection failed' })); } catch {}
      clientWs.close();
    });

    clientWs.on('message', (data) => {
      try { hermesWs.send(data.toString()); } catch {}
    });
    clientWs.on('close', () => hermesWs.close());
    clientWs.on('error', () => hermesWs.close());
  });
});

server.listen(PORT, () => console.log(`Niki Chat UI on :${PORT}`));
