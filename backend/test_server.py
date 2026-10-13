import http.client
import json
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from http.server import ThreadingHTTPServer


sys.path.insert(0, str(Path(__file__).resolve().parent))
import server


class TogetherApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.previous_database = server.DATABASE_PATH
        server.DATABASE_PATH = Path(self.temp_dir.name) / "test.sqlite3"
        self.previous_invite = os.environ.get("TOGETHER_SPECIALIST_INVITE_CODE")
        os.environ["TOGETHER_SPECIALIST_INVITE_CODE"] = "test-invite-code"
        self.previous_notify = os.environ.pop("TOGETHER_NOTIFY_EMAIL", None)
        self.previous_smtp = os.environ.pop("TOGETHER_SMTP_HOST", None)
        server.initialize_database()
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.TogetherHandler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.httpd.server_address[1]

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=2)
        server.DATABASE_PATH = self.previous_database
        if self.previous_invite is None:
            os.environ.pop("TOGETHER_SPECIALIST_INVITE_CODE", None)
        else:
            os.environ["TOGETHER_SPECIALIST_INVITE_CODE"] = self.previous_invite
        if self.previous_notify is not None:
            os.environ["TOGETHER_NOTIFY_EMAIL"] = self.previous_notify
        if self.previous_smtp is not None:
            os.environ["TOGETHER_SMTP_HOST"] = self.previous_smtp
        self.temp_dir.cleanup()

    def request(self, method, path, payload=None, cookie=None, origin=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Content-Type": "application/json"} if body is not None else {}
        if cookie:
            headers["Cookie"] = cookie
        if origin:
            headers["Origin"] = origin
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        content = response.read()
        result = json.loads(content) if content else {}
        set_cookie = response.getheader("Set-Cookie", "").split(";", 1)[0]
        connection.close()
        return response.status, result, set_cookie

    def create_parent(self):
        status, result, cookie = self.request(
            "POST",
            "/api/register/parent",
            {
                "name": "Parent Test",
                "email": "parent@example.test",
                "password": "long-test-password",
                "child_name": "Child Test",
                "child_age": 8,
                "consent": True,
            },
        )
        self.assertEqual(status, 201)
        return result["user"], cookie

    def test_parent_tracks_child_game_and_private_dashboard(self):
        user, cookie = self.create_parent()
        child_id = user["children"][0]["id"]

        status, _, _ = self.request(
            "POST",
            "/api/activity",
            {"event": "started", "game": "memory", "child_id": child_id},
            cookie,
        )
        self.assertEqual(status, 201)

        status, dashboard, _ = self.request("GET", "/api/parent/dashboard", cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(len(dashboard["events"]), 1)
        self.assertEqual(dashboard["events"][0]["child_name"], "Child Test")

        status, _, _ = self.request("GET", "/api/specialist/dashboard", cookie=cookie)
        self.assertEqual(status, 403)

    def test_login_notification_and_local_preview_cors(self):
        self.create_parent()
        status, _, cookie = self.request(
            "POST",
            "/api/login",
            {"email": "parent@example.test", "password": "long-test-password"},
        )
        self.assertEqual(status, 200)
        self.assertTrue(cookie.startswith("together_session="))

        with server.database() as connection:
            event = connection.execute(
                "SELECT event_type FROM activity_events WHERE user_id = 1 ORDER BY id DESC LIMIT 1"
            ).fetchone()
            notification = connection.execute(
                "SELECT event_type FROM notifications ORDER BY id DESC LIMIT 1"
            ).fetchone()
        self.assertEqual(event["event_type"], "parent_login")
        self.assertEqual(notification["event_type"], "تسجيل دخول")

        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        connection.request(
            "OPTIONS",
            "/api/login",
            headers={
                "Origin": "http://127.0.0.1:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        response = connection.getresponse()
        self.assertEqual(response.status, 204)
        self.assertEqual(
            response.getheader("Access-Control-Allow-Origin"),
            "http://127.0.0.1:3000",
        )
        connection.close()

    def test_specialist_can_reply_to_support_request(self):
        status, ticket_result, _ = self.request(
            "POST",
            "/api/support",
            {
                "name": "Visitor Test",
                "email": "visitor@example.test",
                "subject": "Test request",
                "message": "Please help.",
            },
        )
        self.assertEqual(status, 201)

        status, specialist, specialist_cookie = self.request(
            "POST",
            "/api/register/specialist",
            {
                "name": "Specialist Test",
                "email": "specialist@example.test",
                "password": "long-test-password",
                "invite_code": "test-invite-code",
            },
        )
        self.assertEqual(status, 201)
        self.assertEqual(specialist["user"]["role"], "specialist")

        status, dashboard, _ = self.request(
            "GET", "/api/specialist/dashboard", cookie=specialist_cookie
        )
        self.assertEqual(status, 200)
        self.assertEqual(dashboard["tickets"][0]["id"], ticket_result["ticket_id"])
        self.assertTrue(
            any(item["event_type"] == "طلب مساعدة جديد" for item in dashboard["notifications"])
        )

        status, _, _ = self.request(
            "POST",
            f"/api/support/{ticket_result['ticket_id']}/reply",
            {"message": "We received your request."},
            specialist_cookie,
        )
        self.assertEqual(status, 201)

        status, dashboard, _ = self.request(
            "GET", "/api/specialist/dashboard", cookie=specialist_cookie
        )
        self.assertEqual(status, 200)
        ticket = dashboard["tickets"][0]
        self.assertEqual(ticket["status"], "answered")
        self.assertEqual(ticket["messages"][-1]["sender_role"], "specialist")


if __name__ == "__main__":
    unittest.main()