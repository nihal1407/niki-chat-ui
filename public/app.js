/* ═══ J.A.R.V.I.S. client ═══ */

const $ = (id) => document.getElementById(id);
let ws = null;

// ---------- boot sequence ----------
const BOOT_LINES = [
  ['INITIALIZING J.A.R.V.I.S.', 'loading neural core…'],
  ['CALIBRATING SENSORS', 'establishing secure uplink…'],
  ['SYSTEMS NOMINAL', 'all diagnostics passed'],
];
(async () => {
  for (const [main, sub] of BOOT_LINES) {
    $('boot-text').textContent = main;
    $('boot-sub').textContent = sub;
    await new Promise(r => setTimeout(r, 550));
  }
  $('boot').style.opacity = '0';
  setTimeout(() => {
    $('boot').classList.add('hidden');
    // check existing session
    const r = fetch('/api/check').then(res => {
      if (res.ok) {
        $('login-view').classList.add('hidden');
        $('chat-view').classList.remove('hidden');
        connectWS();
        jarvisGreeting();
      } else {
        $('login-view').classList.remove('hidden');
        setTimeout(() => $('pwd') && $('pwd').focus(), 100);
      }
    });
  }, 600);
})();

// ---------- auth ----------
$('login-btn').onclick = doLogin;
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.activeElement === $('pwd')) doLogin();
});

async function doLogin() {
  const pwd = $('pwd').value;
  if (!pwd) return;
  $('login-btn').textContent = 'SCANNING…';
  const ok = await tryLogin(pwd);
  $('login-btn').textContent = 'AUTHENTICATE';
  if (ok) {
    $('login-view').classList.add('hidden');
    $('chat-view').classList.remove('hidden');
    connectWS();
    jarvisGreeting();
  } else {
    $('login-err').textContent = '⚠ ACCESS DENIED — INVALID CODE';
  }
}
async function tryLogin(pwd) {
  const r = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pwd })
  });
  return r.ok;
}

// ---------- HUD clock ----------
setInterval(() => {
  if ($('clock')) $('clock').textContent = new Date().toLocaleTimeString('en-GB');
}, 1000);

// ---------- websocket ----------
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/proxy-ws`);

  ws.onopen = () => {
    $('conn-status').textContent = '● ONLINE';
    $('conn-status').style.color = '#3ddc84';
  };
  ws.onmessage = (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch { return; }
    if (data.type === 'backend_connected') return;
    if (data.type === 'error') { addMsg('niki', `⚠ SYSTEM FAULT — ${data.message || 'backend error'}`); endTyping(); return; }
    if (data.method === 'event' && data.params) {
      const p = data.params;
      if (p.type === 'assistant_message_delta' && p.text) streamMsg(p.text);
      else if (p.type === 'assistant_message' && p.text) finalizeMsg(p.text);
      else if (['turn_completed', 'response_done'].includes(p.type)) endTyping();
    }
    if (data.result && data.result.content) finalizeMsg(data.result.content);
  };
  ws.onclose = () => {
    $('conn-status').textContent = '● RECONNECTING…';
    $('conn-status').style.color = 'var(--gold)';
    setTimeout(connectWS, 2000);
  };
}

// ---------- send ----------
$('send').onclick = send;
$('input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
$('input').addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 130) + 'px';
});

function send() {
  const txt = $('input').value.trim();
  if (!txt || !ws || ws.readyState !== WebSocket.OPEN) return;
  addMsg('user', txt.toUpperCase());
  $('input').value = '';
  $('input').style.height = 'auto';
  showTyping();
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'chat',
    params: { message: txt }
  }));
}

// ---------- render ----------
let typingEl = null, streamingEl = null, streamBuf = '';

function jarvisGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning, sir' : h < 17 ? 'Good afternoon, sir' : 'Good evening, sir';
  addMsg('niki', `${greet}. All systems are operational. How may I assist you?`);
}

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
  typingEl.textContent = '// processing request …';
  $('messages').appendChild(typingEl);
  scrollBottom();
}
function endTyping() { if (typingEl) { typingEl.remove(); typingEl = null; } }

function streamMsg(chunk) {
  endTyping();
  if (!streamingEl) { streamBuf = ''; streamingEl = addMsg('niki', ''); }
  streamBuf += chunk;
  streamingEl.textContent = streamBuf;
  scrollBottom();
}
function finalizeMsg(text) {
  endTyping();
  if (streamingEl && !text) { streamingEl = null; return; }
  streamingEl = null;
  if (text) addMsg('niki', text);
}
function scrollBottom() {
  const m = $('messages');
  m.scrollTop = m.scrollHeight;
}
