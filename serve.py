#!/usr/bin/env python3
"""
Serve the app and proxy football-data.org so the browser never hits their API directly
(CORS allows http://localhost but not http://localhost:5500).

Run: python serve.py
Then open http://127.0.0.1:5500/ (or http://localhost:5500/)

API key: set FOOTBALL_DATA_API_KEY env var, or keep it in config.js (same as sync-env script).
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "5500"))
UPSTREAM = "https://api.football-data.org/v4"


def load_api_key() -> str:
    k = os.environ.get("FOOTBALL_DATA_API_KEY", "").strip()
    if k:
        return k
    cfg = ROOT / "config.js"
    if cfg.exists():
        m = re.search(r'FOOTBALL_DATA_API_KEY:\s*"([^"]*)"', cfg.read_text(encoding="utf-8"))
        if m:
            return m.group(1).strip()
    return ""


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        path = self.path.split("?", 1)[0].lower()
        if not path.startswith("/api/"):
            if path in ("/", "/index.html") or path.endswith(".html"):
                self.send_header("Cache-Control", "no-cache")
            elif path.endswith((".css", ".js")):
                self.send_header(
                    "Cache-Control",
                    "public, max-age=86400, stale-while-revalidate=604800",
                )
            elif "/data/" in path and path.endswith(".json"):
                self.send_header(
                    "Cache-Control",
                    "public, max-age=120, stale-while-revalidate=300",
                )
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        super().end_headers()

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/config.js":
            self.send_error(404)
            return
        if path == "/api/pl/standings":
            self._proxy("/competitions/PL/standings")
        elif path == "/api/pl/teams":
            self._proxy("/competitions/PL/teams")
        else:
            super().do_GET()

    def _proxy(self, upstream_path: str) -> None:
        key = load_api_key()
        if not key:
            self._send_json(500, {"error": "Missing API key. Set FOOTBALL_DATA_API_KEY or config.js"})
            return
        url = f"{UPSTREAM}{upstream_path}"
        req = urllib.request.Request(url, headers={"X-Auth-Token": key})
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                body = resp.read()
                status = resp.status
        except urllib.error.HTTPError as e:
            body = e.read() or b"{}"
            status = e.code
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        except Exception as e:
            self._send_json(502, {"error": str(e)})
            return

        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, code: int, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    os.chdir(ROOT)
    with ThreadingHTTPServer(("", PORT), Handler) as httpd:
        print(f"Serving {ROOT}")
        print(f"Open http://127.0.0.1:{PORT}/  — Refresh Standings uses /api/pl/* (no CORS).")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
