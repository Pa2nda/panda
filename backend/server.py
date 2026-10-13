import hashlib
import hmac
import json
import os
import secrets
import smtplib
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT.parent / "website"
DATABASE_PATH = Path(os.environ.get("TOGETHER_DATABASE", ROOT / "data" / "together.sqlite3"))
SESSION_DAYS = 14
MAX_REQUEST_BYTES = 64 * 1024
PASSWORD_ITERATIONS = 310_000
COOKIE_NAME = "together_session"


@contextmanager
def database():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database():
    with database() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                role TEXT NOT NULL CHECK (role IN ('parent', 'specialist')),
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );

            CREATE TABLE IF NOT EXISTS children (
                id INTEGER PRIMARY KEY,
                parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                age INTEGER CHECK (age IS NULL OR age BETWEEN 2 AND 18),
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );

            CREATE TABLE IF NOT EXISTS activity_events (
                id INTEGER PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                child_id INTEGER REFERENCES children(id) ON DELETE SET NULL,
                event_type TEXT NOT NULL,
                game TEXT,
                details TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );

            CREATE TABLE IF NOT EXISTS support_tickets (
                id INTEGER PRIMARY KEY,
                parent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                contact_name TEXT NOT NULL,
                contact_email TEXT NOT NULL,
                subject TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered')),
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );

            CREATE TABLE IF NOT EXISTS support_messages (
                id INTEGER PRIMARY KEY,
                ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                sender_role TEXT NOT NULL CHECK (sender_role IN ('visitor', 'parent', 'specialist')),
                message TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY,
                event_type TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );

            CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_id);
            CREATE INDEX IF NOT EXISTS idx_events_created ON activity_events(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_tickets_created ON support_tickets(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_messages_ticket ON support_messages(ticket_id, id);
            """
        )


def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS
    )
    return salt.hex(), digest.hex()


def create_session(connection, user_id):
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    connection.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        (token_hash, user_id, expires.isoformat()),
    )
    return token


def send_email_async(recipient, subject, body):
    if not recipient or not os.environ.get("TOGETHER_SMTP_HOST"):
        return

    def send():
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = os.environ.get("TOGETHER_FROM_EMAIL", "Together <noreply@localhost>")
        message["To"] = recipient
        message.set_content(body)

        host = os.environ["TOGETHER_SMTP_HOST"]
        port = int(os.environ.get("TOGETHER_SMTP_PORT", "587"))
        username = os.environ.get("TOGETHER_SMTP_USER", "")
        password = os.environ.get("TOGETHER_SMTP_PASSWORD", "")
        try:
            if port == 465:
                with smtplib.SMTP_SSL(host, port, timeout=12) as server:
                    if username:
                        server.login(username, password)
                    server.send_message(message)
            else:
                with smtplib.SMTP(host, port, timeout=12) as server:
                    server.starttls()
                    if username:
                        server.login(username, password)
                    server.send_message(message)
        except (OSError, smtplib.SMTPException, ValueError) as error:
            print(f"Email notification failed: {error}")

    threading.Thread(target=send, daemon=True).start()


def notify(event_type, message):
    with database() as connection:
        connection.execute(
            "INSERT INTO notifications (event_type, message) VALUES (?, ?)",
            (event_type, message),
        )
    send_email_async(os.environ.get("TOGETHER_NOTIFY_EMAIL"), f"Together: {event_type}", message)


class TogetherHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def log_message(self, format_string, *args):
        print(f"{self.log_date_time_string()} {self.address_string()} {format_string % args}")

    @staticmethod
    def allowed_origins():
        configured = os.environ.get("TOGETHER_ALLOWED_ORIGINS", "")
        if configured:
            return {origin.strip() for origin in configured.split(",") if origin.strip()}
        return {
            "http://127.0.0.1:3000",
            "http://localhost:3000",
            "http://127.0.0.1:5500",
            "http://localhost:5500",
        }

    def send_json(self, status, payload, cookie=None, clear_cookie=False):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.add_local_cors_headers()
        if cookie:
            secure = "; Secure" if os.environ.get("TOGETHER_SECURE_COOKIES") == "1" else ""
            self.send_header(
                "Set-Cookie",
                f"{COOKIE_NAME}={cookie}; HttpOnly; SameSite=Lax; Path=/; Max-Age={SESSION_DAYS * 86400}{secure}",
            )
        elif clear_cookie:
            secure = "; Secure" if os.environ.get("TOGETHER_SECURE_COOKIES") == "1" else ""
            self.send_header(
                "Set-Cookie",
                f"{COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0{secure}",
            )
        self.end_headers()
        self.wfile.write(body)

    def add_local_cors_headers(self):
        origin = self.headers.get("Origin", "")
        if origin in self.allowed_origins():
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Vary", "Origin")

    def do_OPTIONS(self):
        origin = self.headers.get("Origin", "")
        if origin not in self.allowed_origins():
            self.send_error(403)
            return
        self.send_response(204)
        self.add_local_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("حجم الطلب غير صالح.")
        if length <= 0 or length > MAX_REQUEST_BYTES:
            raise ValueError("حجم الطلب غير صالح.")
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ValueError("تعذر قراءة البيانات المرسلة.")

    def current_user(self, connection):
        cookie = SimpleCookie()
        cookie.load(self.headers.get("Cookie", ""))
        morsel = cookie.get(COOKIE_NAME)
        if not morsel:
            return None
        token_hash = hashlib.sha256(morsel.value.encode("utf-8")).hexdigest()
        return connection.execute(
            """SELECT users.id, users.name, users.email, users.role
               FROM sessions JOIN users ON users.id = sessions.user_id
               WHERE sessions.token_hash = ? AND sessions.expires_at > ?""",
            (token_hash, datetime.now(timezone.utc).isoformat()),
        ).fetchone()

    def require_user(self, connection, role=None):
        user = self.current_user(connection)
        if not user:
            self.send_json(401, {"error": "سجّل الدخول أولًا."})
            return None
        if role and user["role"] != role:
            self.send_json(403, {"error": "ليس لديك صلاحية لهذه الصفحة."})
            return None
        return user

    def user_payload(self, connection, user):
        result = {"id": user["id"], "name": user["name"], "email": user["email"], "role": user["role"]}
        if user["role"] == "parent":
            result["children"] = [
                dict(child)
                for child in connection.execute(
                    "SELECT id, name, age FROM children WHERE parent_id = ? ORDER BY id",
                    (user["id"],),
                )
            ]
        return result

    def do_GET(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            return super().do_GET()

        with database() as connection:
            if path == "/api/session":
                user = self.current_user(connection)
                self.send_json(200, {"user": self.user_payload(connection, user) if user else None})
                return

            if path == "/api/support/requests":
                user = self.require_user(connection, "parent")
                if not user:
                    return
                tickets = connection.execute(
                    "SELECT * FROM support_tickets WHERE parent_id = ? ORDER BY created_at DESC",
                    (user["id"],),
                ).fetchall()
                self.send_json(200, {"tickets": self.ticket_payloads(connection, tickets)})
                return

            if path == "/api/parent/dashboard":
                user = self.require_user(connection, "parent")
                if not user:
                    return
                events = connection.execute(
                    """SELECT activity_events.*, children.name AS child_name
                       FROM activity_events
                       LEFT JOIN children ON children.id = activity_events.child_id
                       WHERE activity_events.user_id = ?
                       ORDER BY activity_events.id DESC LIMIT 50""",
                    (user["id"],),
                ).fetchall()
                tickets = connection.execute(
                    "SELECT * FROM support_tickets WHERE parent_id = ? ORDER BY created_at DESC",
                    (user["id"],),
                ).fetchall()
                self.send_json(
                    200,
                    {
                        "user": self.user_payload(connection, user),
                        "events": [dict(row) for row in events],
                        "tickets": self.ticket_payloads(connection, tickets),
                    },
                )
                return

            if path == "/api/specialist/dashboard":
                user = self.require_user(connection, "specialist")
                if not user:
                    return
                events = connection.execute(
                    """SELECT activity_events.*, users.name AS parent_name,
                              children.name AS child_name
                       FROM activity_events
                       LEFT JOIN users ON users.id = activity_events.user_id
                       LEFT JOIN children ON children.id = activity_events.child_id
                       ORDER BY activity_events.id DESC LIMIT 100"""
                ).fetchall()
                tickets = connection.execute(
                    "SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 100"
                ).fetchall()
                notifications = connection.execute(
                    "SELECT * FROM notifications ORDER BY id DESC LIMIT 100"
                ).fetchall()
                self.send_json(
                    200,
                    {
                        "events": [dict(row) for row in events],
                        "tickets": self.ticket_payloads(connection, tickets),
                        "notifications": [dict(row) for row in notifications],
                    },
                )
                return

        self.send_json(404, {"error": "المسار غير موجود."})

    def ticket_payloads(self, connection, tickets):
        result = []
        for ticket in tickets:
            item = dict(ticket)
            item["messages"] = [
                dict(message)
                for message in connection.execute(
                    """SELECT support_messages.*, users.name AS sender_name
                       FROM support_messages
                       LEFT JOIN users ON users.id = support_messages.sender_id
                       WHERE ticket_id = ? ORDER BY support_messages.id""",
                    (ticket["id"],),
                )
            ]
            result.append(item)
        return result

    def do_POST(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/"):
            self.send_json(404, {"error": "المسار غير موجود."})
            return

        try:
            payload = self.read_json()
            self.handle_api_post(path, payload)
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
        except sqlite3.IntegrityError:
            self.send_json(409, {"error": "البريد الإلكتروني مسجل بالفعل."})
        except Exception as error:
            print(f"API request failed: {error}")
            self.send_json(500, {"error": "حدث خطأ داخلي. حاول مرة أخرى."})

    def handle_api_post(self, path, payload):
        if not isinstance(payload, dict):
            raise ValueError("صيغة البيانات غير صحيحة.")

        if path == "/api/register/parent":
            self.register_parent(payload)
            return
        if path == "/api/register/specialist":
            self.register_specialist(payload)
            return
        if path == "/api/children":
            self.add_child(payload)
            return
        if path == "/api/login":
            self.login(payload)
            return
        if path == "/api/logout":
            self.logout()
            return
        if path == "/api/activity":
            self.record_activity(payload)
            return
        if path == "/api/support":
            self.create_ticket(payload)
            return
        if path.startswith("/api/support/") and path.endswith("/reply"):
            self.reply_to_ticket(path, payload)
            return

        self.send_json(404, {"error": "المسار غير موجود."})

    @staticmethod
    def clean_text(value, field, limit, required=True):
        text = value.strip() if isinstance(value, str) else ""
        if required and not text:
            raise ValueError(f"حقل {field} مطلوب.")
        if len(text) > limit:
            raise ValueError(f"حقل {field} أطول من المسموح.")
        return text

    @staticmethod
    def validate_email(email):
        if len(email) > 254 or email.count("@") != 1 or "." not in email.rsplit("@", 1)[-1]:
            raise ValueError("اكتب بريدًا إلكترونيًا صحيحًا.")
        return email.lower()

    def register_parent(self, payload):
        name = self.clean_text(payload.get("name"), "الاسم", 100)
        email = self.validate_email(self.clean_text(payload.get("email"), "البريد الإلكتروني", 254))
        password = self.clean_text(payload.get("password"), "كلمة المرور", 256)
        child_name = self.clean_text(payload.get("child_name"), "اسم الطفل", 60)
        age_value = payload.get("child_age")
        age = None if age_value in (None, "") else int(age_value)
        if age is not None and not 2 <= age <= 18:
            raise ValueError("عمر الطفل يجب أن يكون بين سنتين و١٨ سنة.")
        if len(password) < 10:
            raise ValueError("كلمة المرور يجب ألا تقل عن ١٠ أحرف.")
        if payload.get("consent") is not True:
            raise ValueError("يلزم تأكيد موافقة وليّ الأمر.")

        salt, password_hash = hash_password(password)
        with database() as connection:
            cursor = connection.execute(
                "INSERT INTO users (name, email, role, password_salt, password_hash) VALUES (?, ?, 'parent', ?, ?)",
                (name, email, salt, password_hash),
            )
            parent_id = cursor.lastrowid
            connection.execute(
                "INSERT INTO children (parent_id, name, age) VALUES (?, ?, ?)",
                (parent_id, child_name, age),
            )
            user = connection.execute("SELECT * FROM users WHERE id = ?", (parent_id,)).fetchone()
            token = create_session(connection, parent_id)
            result = self.user_payload(connection, user)
        self.send_json(201, {"user": result}, cookie=token)
        notify("تسجيل وليّ أمر جديد", f"أنشأ وليّ أمر حسابًا في Together: {name} ({email}).")

    def register_specialist(self, payload):
        invite_code = os.environ.get("TOGETHER_SPECIALIST_INVITE_CODE", "")
        supplied_code = payload.get("invite_code", "")
        if not invite_code or not isinstance(supplied_code, str) or not hmac.compare_digest(invite_code, supplied_code):
            self.send_json(403, {"error": "رمز دعوة المختصين غير صحيح أو غير مفعّل."})
            return

        name = self.clean_text(payload.get("name"), "الاسم", 100)
        email = self.validate_email(self.clean_text(payload.get("email"), "البريد الإلكتروني", 254))
        password = self.clean_text(payload.get("password"), "كلمة المرور", 256)
        if len(password) < 10:
            raise ValueError("كلمة المرور يجب ألا تقل عن ١٠ أحرف.")
        salt, password_hash = hash_password(password)
        with database() as connection:
            cursor = connection.execute(
                "INSERT INTO users (name, email, role, password_salt, password_hash) VALUES (?, ?, 'specialist', ?, ?)",
                (name, email, salt, password_hash),
            )
            user = connection.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
            token = create_session(connection, user["id"])
            result = self.user_payload(connection, user)
        self.send_json(201, {"user": result}, cookie=token)
        notify("تسجيل مختص جديد", f"أنشأ مختص حسابًا في Together: {name} ({email}).")

    def add_child(self, payload):
        name = self.clean_text(payload.get("name"), "اسم الطفل", 60)
        age_value = payload.get("age")
        age = None if age_value in (None, "") else int(age_value)
        if age is not None and not 2 <= age <= 18:
            raise ValueError("عمر الطفل يجب أن يكون بين سنتين و١٨ سنة.")
        with database() as connection:
            user = self.require_user(connection, "parent")
            if not user:
                return
            cursor = connection.execute(
                "INSERT INTO children (parent_id, name, age) VALUES (?, ?, ?)",
                (user["id"], name, age),
            )
            child = connection.execute(
                "SELECT id, name, age FROM children WHERE id = ?", (cursor.lastrowid,)
            ).fetchone()
        self.send_json(201, {"child": dict(child)})

    def login(self, payload):
        email = self.validate_email(self.clean_text(payload.get("email"), "البريد الإلكتروني", 254))
        password = self.clean_text(payload.get("password"), "كلمة المرور", 256)
        with database() as connection:
            user = connection.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
            if user:
                _, candidate = hash_password(password, bytes.fromhex(user["password_salt"]))
                valid = hmac.compare_digest(candidate, user["password_hash"])
            else:
                hash_password(password, bytes(16))
                valid = False
            if not valid:
                self.send_json(401, {"error": "البريد الإلكتروني أو كلمة المرور غير صحيحة."})
                return

            token = create_session(connection, user["id"])
            result = self.user_payload(connection, user)
            event_type = f"{user['role']}_login"
            label = "وليّ الأمر" if user["role"] == "parent" else "المختص"
            connection.execute(
                "INSERT INTO activity_events (user_id, event_type, details) VALUES (?, ?, ?)",
                (user["id"], event_type, f"دخول {label}: {user['name']}"),
            )
        notify("تسجيل دخول", f"سجّل {label} الدخول إلى Together: {user['name']} ({user['email']}).")
        self.send_json(200, {"user": result}, cookie=token)

    def logout(self):
        with database() as connection:
            cookie = SimpleCookie()
            cookie.load(self.headers.get("Cookie", ""))
            morsel = cookie.get(COOKIE_NAME)
            if morsel:
                token_hash = hashlib.sha256(morsel.value.encode("utf-8")).hexdigest()
                connection.execute("DELETE FROM sessions WHERE token_hash = ?", (token_hash,))
        self.send_json(200, {"ok": True}, clear_cookie=True)

    def record_activity(self, payload):
        game = self.clean_text(payload.get("game"), "اللعبة", 40)
        event_type = payload.get("event")
        if game not in {"memory", "color", "pattern"} or event_type not in {"started", "completed"}:
            raise ValueError("بيانات النشاط غير صالحة.")
        try:
            child_id = int(payload.get("child_id"))
        except (TypeError, ValueError):
            raise ValueError("اختار ملف الطفل أولًا.")

        with database() as connection:
            user = self.require_user(connection, "parent")
            if not user:
                return
            child = connection.execute(
                "SELECT id, name FROM children WHERE id = ? AND parent_id = ?",
                (child_id, user["id"]),
            ).fetchone()
            if not child:
                self.send_json(404, {"error": "ملف الطفل غير موجود."})
                return
            connection.execute(
                "INSERT INTO activity_events (user_id, child_id, event_type, game, details) VALUES (?, ?, ?, ?, ?)",
                (user["id"], child_id, f"game_{event_type}", game, f"{child['name']} - {game}"),
            )
        label = "بدأ اللعب" if event_type == "started" else "أنهى اللعبة"
        notify("نشاط طفل", f"{label}: {child['name']} في لعبة {game}.")
        self.send_json(201, {"ok": True})

    def create_ticket(self, payload):
        subject = self.clean_text(payload.get("subject"), "عنوان المشكلة", 120)
        message = self.clean_text(payload.get("message"), "تفاصيل المشكلة", 4000)
        with database() as connection:
            user = self.current_user(connection)
            if user and user["role"] == "specialist":
                self.send_json(403, {"error": "استخدم لوحة المختصين للرد على الطلبات."})
                return
            if user:
                name = user["name"]
                email = user["email"]
                parent_id = user["id"]
                sender_role = "parent"
            else:
                name = self.clean_text(payload.get("name"), "الاسم", 100)
                email = self.validate_email(self.clean_text(payload.get("email"), "البريد الإلكتروني", 254))
                parent_id = None
                sender_role = "visitor"
            cursor = connection.execute(
                "INSERT INTO support_tickets (parent_id, contact_name, contact_email, subject) VALUES (?, ?, ?, ?)",
                (parent_id, name, email, subject),
            )
            ticket_id = cursor.lastrowid
            connection.execute(
                "INSERT INTO support_messages (ticket_id, sender_id, sender_role, message) VALUES (?, ?, ?, ?)",
                (ticket_id, parent_id, sender_role, message),
            )
        notify("طلب مساعدة جديد", f"طلب #{ticket_id} من {name}: {subject}\n{message}")
        self.send_json(201, {"ok": True, "ticket_id": ticket_id})

    def reply_to_ticket(self, path, payload):
        parts = path.strip("/").split("/")
        if len(parts) != 4 or not parts[2].isdigit():
            self.send_json(404, {"error": "المسار غير موجود."})
            return
        ticket_id = int(parts[2])
        message = self.clean_text(payload.get("message"), "الرد", 4000)
        with database() as connection:
            user = self.require_user(connection, "specialist")
            if not user:
                return
            ticket = connection.execute(
                "SELECT * FROM support_tickets WHERE id = ?", (ticket_id,)
            ).fetchone()
            if not ticket:
                self.send_json(404, {"error": "طلب المساعدة غير موجود."})
                return
            connection.execute(
                "INSERT INTO support_messages (ticket_id, sender_id, sender_role, message) VALUES (?, ?, 'specialist', ?)",
                (ticket_id, user["id"], message),
            )
            connection.execute(
                "UPDATE support_tickets SET status = 'answered' WHERE id = ?", (ticket_id,)
            )
        send_email_async(
            ticket["contact_email"],
            "تم الرد على طلبك في Together",
            f"مرحبًا {ticket['contact_name']}،\n\n{message}\n\nرقم الطلب: {ticket_id}",
        )
        self.send_json(201, {"ok": True})


def main():
    initialize_database()
    host = os.environ.get("TOGETHER_HOST", "127.0.0.1")
    port = int(os.environ.get("TOGETHER_PORT", "8000"))
    server = ThreadingHTTPServer((host, port), TogetherHandler)
    print(f"Together is running at http://{host}:{port}")
    print(f"SQLite database: {DATABASE_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    main()