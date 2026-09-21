"""Demo webhook receiver: verifies Stripe signatures the way Stripe documents it.

  python3 demo/receiver.py <secret> [fail_first]

Prints a line per attempt so a viewer can see the signature check pass and the
retries arrive. `fail_first` makes it reject that many attempts with a 500 so
the retry/backoff behaviour is visible.
"""
import hashlib
import hmac
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRET = sys.argv[1]
FAIL_FIRST = int(sys.argv[2]) if len(sys.argv) > 2 else 0
state = {"n": 0}

G, R, Y, D, X = "\033[32m", "\033[31m", "\033[33m", "\033[90m", "\033[0m"


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("content-length", 0)))
        sig = self.headers.get("stripe-signature", "")
        parts = dict(p.split("=", 1) for p in sig.split(",") if "=" in p)

        # Exactly Stripe's documented scheme: HMAC-SHA256 over "<timestamp>.<body>"
        signed_payload = f"{parts.get('t','')}.".encode() + body
        expected = hmac.new(SECRET.encode(), signed_payload, hashlib.sha256).hexdigest()
        valid = hmac.compare_digest(expected, parts.get("v1", ""))

        state["n"] += 1
        n = state["n"]
        reject = n <= FAIL_FIRST
        code = 500 if reject else 200

        mark = f"{G}valid{X}" if valid else f"{R}INVALID{X}"
        verdict = f"{R}rejecting (500){X}" if reject else f"{G}accepted (200){X}"
        event = json.loads(body).get("type", "?")
        print(f"  attempt {n}  signature {mark}   event {D}{event}{X}   -> {verdict}", flush=True)

        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"ok": not reject}).encode())

    def log_message(self, *args):
        pass


print(f"{D}receiver listening on :4999 — verifying Stripe signatures{X}", flush=True)
if FAIL_FIRST:
    print(f"{D}will reject the first {FAIL_FIRST} attempt(s) to show retries{X}", flush=True)
HTTPServer(("127.0.0.1", 4999), Handler).serve_forever()
