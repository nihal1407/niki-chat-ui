# Niki Chat UI

A lightweight browser chat UI for [Hermes Agent](https://github.com/NousResearch/hermes-agent).
Deploy on any VM; it connects to a running `hermes serve` backend (JSON-RPC over WebSocket)
and gives you Niki in the browser — independent of Telegram.

## Architecture

```
Browser ──HTTP──> Node/Express (static + auth) ──WS──> hermes serve (VM with Hermes)
   you               this repo (any VM)                your Hermes box
```

- The UI is pure static HTML/JS/CSS — no build step.
- A tiny Express server serves it, handles login, and proxies WebSocket
  traffic to the Hermes backend so your backend URL/token never touch the browser.

## Files

| File | Purpose |
|------|---------|
| `public/index.html` | Chat interface |
| `public/app.js` | WebSocket client + rendering |
| `public/style.css` | Styling (dark, Telegram-ish) |
| `server.js` | Express: static files, session auth, WS proxy |
| `.env.example` | Config template |

## Quick start

```bash
git clone <this-repo> && cd niki-chat-ui
npm install            # express, ws, dotenv, express-session (tiny deps)
cp .env.example .env   # then edit values
node server.js         # listens on PORT (default 3000)
```

Open `http://<vm-ip>:3000`, log in with `UI_PASSWORD`, chat.

## Configuration (.env)

```ini
PORT=3000                      # port for this UI server
UI_PASSWORD=changeme           # login password for the browser
HERMES_WS=ws://144.24.146.172:9119/ws   # hermes serve WebSocket URL
HERMES_HTTP=http://144.24.146.172:9119  # hermes serve HTTP URL
SESSION_SECRET=some-random-string
```

## On the Hermes side (one-time)

On the VM running Hermes:

1. Set a dashboard password in `~/.hermes/config.yaml`:
   ```yaml
   dashboard:
     basic_auth:
       username: niki
       password_hash: <hash>
   ```
   Generate the hash:
   ```bash
   python -c "from plugins.dashboard_auth.basic import hash_password; print(hash_password('your-password'))"
   ```
2. Start the backend publicly:
   ```bash
   hermes serve --host 0.0.0.0 --port 9119
   ```
3. Open the port in Oracle Cloud ingress **restricted to your UI VM's IP**:
   Source CIDR `<ui-vm-ip>/32`, TCP, port 9119.

## Security notes

- Change `UI_PASSWORD` and `SESSION_SECRET` before exposing anything.
- The Hermes backend should stay behind the UI proxy — don't expose 9119 to
  `0.0.0.0/0`; whitelist only the UI VM.
- HTTPS: put nginx/caddy in front for TLS if this faces the internet.

## Status

MVP: login → chat → streaming responses. Sessions/memory are shared with the
Telegram bot since both talk to the same agent core.
