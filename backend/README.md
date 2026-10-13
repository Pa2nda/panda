# Together backend

The backend uses only Python 3.11+ standard-library modules and SQLite. It serves the website and its API from the same origin.

## Run locally

From the workspace root in PowerShell:

```powershell
$env:TOGETHER_SPECIALIST_INVITE_CODE = [guid]::NewGuid().ToString("N")
& "C:/path/to/python3.11.exe" backend/server.py
```

Open `http://127.0.0.1:8000/`. The SQLite database is created at `backend/data/together.sqlite3` on first run. The invite code is required to create specialist accounts; share it only with trusted specialists.

The current VS Code Python interpreter path can be found from **Python: Select Interpreter**. The server binds to `127.0.0.1` by default. Set `TOGETHER_HOST` only when intentionally exposing it on a network.

The local preview origins `http://127.0.0.1:3000`, `http://localhost:3000`, and port `5500` are allowed by default. For a different development origin, set `TOGETHER_ALLOWED_ORIGINS` to an exact comma-separated origin list. Production should use the exact HTTPS site origin and must not allow wildcard origins.

## Notifications by email

Login, parent/specialist registration, and child game start/completion events are always saved to SQLite and appear in the specialist dashboard. To also email the site operator, configure these environment variables before starting the server:

```powershell
$env:TOGETHER_NOTIFY_EMAIL = "operator@example.com"
$env:TOGETHER_SMTP_HOST = "smtp.example.com"
$env:TOGETHER_SMTP_PORT = "587"
$env:TOGETHER_SMTP_USER = "smtp-user"
$env:TOGETHER_SMTP_PASSWORD = "smtp-app-password"
$env:TOGETHER_FROM_EMAIL = "Together <notifications@example.com>"
```

Port `465` uses implicit TLS; other ports use STARTTLS. Support replies are emailed to the address on the request when SMTP is configured. Never commit real SMTP credentials or invitation codes.

## Accounts and privacy

- A parent account registers a child profile; additional child profiles can be added after login.
- Passwords are stored as PBKDF2-HMAC-SHA256 hashes. Sessions use random, HttpOnly, SameSite cookies and can be revoked by logging out.
- Specialist accounts require the server-side invite code. Only specialists can read all activity and reply to support tickets.
- Game events are saved only when a parent is signed in and has selected a child. Guest play remains available but is not attributed to a child.
- The child profile collects a name and optional age only. Avoid entering sensitive health information.
- On an HTTPS deployment, set `TOGETHER_SECURE_COOKIES=1`, use a production-grade HTTPS reverse proxy, and restrict the server to trusted origins and operators.

This is a local starter backend. Before public deployment, add persistent rate limiting, backups, a formal privacy/retention policy, and operational monitoring.