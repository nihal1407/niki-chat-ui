/* Niki Chat UI client */

const $ = (id) => document.getElementById(id);
let ws = null;

// ---------- auth ----------
async function tryLogin(pwd) {
  const r = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pwd })
  });
  return r.ok;
}

$('login-btn').onclick = doLogin;
$('pwd').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const pwd = $('pwd').value;
  if (!pwd) return;
  $('login-btn').textContent = '…';
  const ok = await tryLogin(pwd);
  $('login-btn').textContent = 'Enter';
  if (ok) {
    $('login-view').classList.add('hidden');
    $('chat-view').classList.remove('hidden');
    connectWS();
    addMsg('niki', "Hi nehal! 👋 Niki here — browser edition. What can I do for you?");
  } else {
    $('login-err').textContent = 'Wrong password, try again.';
  }
}

// ---------- websocket to backend (proxied) ----------
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/proxy-ws`);

  ws.onopen = () => console.log('connected');
  ws.onmessage = (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch { return; }

    // Hermes backend messages vary by version; handle common shapes.
    // Assistant text chunks / final events:
    if (data.type === 'backend_connected') return;
    if (data.type === 'error') { addMsg('niki', `⚠️ ${data.message || 'backend error'}`); return; }
    if (data.method === 'event' && data.params) {
      const p = data.params;
      // assistant message deltas
      if (p.type === 'assistant_message_delta' && p.text) streamMsg(p.text);
      else if (p.type === 'assistant_message' && p.text) finalizeMsg(p.text);
      else if (p.type === 'turn_completed' || p.type === 'response_done') endTyping();
    }
    // direct RPC responses
    if (data.result && data.result.content) {
      finalizeMsg(data.result.content);
    }
  };
  ws.onclose = () => setTimeout(connectWS, 2000);
}

// ---------- sending ----------
$('send').onclick = send;
$('input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});

function send() {
  const txt = $('input').value.trim();
  if (!txt || !ws || ws.readyState !== WebSocket.OPEN) return;
  addMsg('user', txt);
  $('input').value = '';
  showTyping();

  // Hermes JSON-RPC chat request shape (adjust method/params per your backend version)
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'chat',
    params: { message: txt }
  }));
}

// ---------- rendering ----------
let typingEl = null;
let streamingEl = null;

function addMsg(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  $('messages').appendChild(div);
  scrollBottom();
  return div;
}

function showTyping() {
  typingEl = document.createElement('div');
  typingEl.className = 'msg niki typing';
  typingEl.textContent = 'Niki is thinking…';
  $('messages').appendChild(typingEl);
  scrollBottom();
}
function endTyping() { if (typingEl) { typingEl.remove(); typingEl = null; } }

let streamBuf = '';
function streamMsg(chunk) {
  endTyping();
  if (!streamingEl) {
    streamBuf = '';
    streamingEl = addMsg('niki', '');
  }
  streamBuf += chunk;
  streamingEl.textContent = streamBuf;
  scrollBottom();
}
function finalizeMsg(text) {
  endTyping();
  if (streamingEl && !text) { streamingEl = null; return; }
  if (streamingEl) { streamingEl = null; }
  if (text) addMsg('niki', text);
}

function scrollBottom() {
  const m = $('messages');
  m.scrollTop = m.scrollHeight;
}
