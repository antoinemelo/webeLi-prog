#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse
from pathlib import Path
import argparse
import mimetypes
import os
import sys
import time
import socket
import threading


# =========================
# CONFIG
# =========================
HOST = "127.0.0.1"
PORT = 8000
ROOT_DIR = Path(__file__).resolve().parent
DEFAULT_INDEX = "index.html"
CACHE_SECONDS = 60


# =========================
# MIME TYPES
# =========================
EXTRA_MIME = {
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
}
for ext, ctype in EXTRA_MIME.items():
    mimetypes.add_type(ctype, ext, strict=False)


# =========================
# IP AUTO-DETECTION
# =========================
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


# =========================
# CONNECTION COUNTER
# =========================
active_connections = 0
counter_lock = threading.Lock()

def inc_connections():
    global active_connections
    with counter_lock:
        active_connections += 1
        return active_connections

def dec_connections():
    global active_connections
    with counter_lock:
        active_connections -= 1
        return active_connections


# =========================
# HANDLER
# =========================
class StaticHandler(SimpleHTTPRequestHandler):
    server_version = "StaticSchoolHTTP/1.2"
    cache_seconds = CACHE_SECONDS

    def setup(self):
        super().setup()
        current = inc_connections()
        print(f"🔵 +1 connexion | {current} sont actuellement actives")

    def finish(self):
        try:
            super().finish()
        finally:
            current = dec_connections()
            print(f"⚪ Connexion -1  | Actives : {current}")

    def translate_path(self, path):
        parsed = urlparse(path)
        clean = unquote(parsed.path).lstrip("/")
        candidate = (ROOT_DIR / clean).resolve()

        root = str(ROOT_DIR)
        cand = str(candidate)
        if cand != root and not cand.startswith(root + os.sep):
            return str(ROOT_DIR / "__forbidden__")

        return str(candidate)

    def do_GET(self):
        parsed = urlparse(self.path)
        url_path = unquote(parsed.path)

        if url_path.endswith("/"):
            self.path = url_path + DEFAULT_INDEX
        else:
            fs_path = Path(self.translate_path(self.path))
            if fs_path.exists() and fs_path.is_dir():
                self.send_response(301)
                self.send_header("Location", url_path + "/")
                self.end_headers()
                return

        super().do_GET()

    def end_headers(self):
        if self.cache_seconds <= 0:
            self.send_header("Cache-Control", "no-store, max-age=0")
        else:
            self.send_header("Cache-Control", f"public, max-age={self.cache_seconds}")

        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        super().end_headers()

    def log_message(self, fmt, *args):
        ts = time.strftime("%H:%M:%S")
        sys.stderr.write(f"[{ts}] {self.client_address[0]} {fmt % args}\n")


# =========================
# MAIN
# =========================
def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Serveur statique InformaticLi")
    parser.add_argument("--host", default=HOST, help="Adresse d'ecoute")
    parser.add_argument("--port", type=int, default=PORT, help="Port HTTP")
    parser.add_argument(
        "--cache-secondes",
        type=int,
        default=CACHE_SECONDS,
        help="Duree du cache navigateur (0 pour desactiver)",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    os.chdir(ROOT_DIR)
    ip = get_local_ip() if args.host == "0.0.0.0" else args.host

    StaticHandler.cache_seconds = max(0, args.cache_secondes)
    httpd = ThreadingHTTPServer((args.host, args.port), StaticHandler)

    print("\n========= Serveur WEB ============")
    print(f"Racine  : {ROOT_DIR}")
    print(f"URL     : http://{ip}:{args.port}/")
    print("Arrêt   : CTRL+C")
    print("===================================\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        print("\nServeur arrêté.")


if __name__ == "__main__":
    main()
