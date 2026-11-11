"""Temporary browser-to-Worker replies for the school's plain HTTP server.

No student code is executed here and no project file is written to disk.
The browser posts replies; its Worker waits for them on a separate connection.
"""

import json
import secrets
import threading
import time
from urllib.parse import urlparse


BRIDGE_PATH = "/labs/python/_bridge/"
MAX_REPLY = 8 * 1024 * 1024


class BridgeError(Exception):
    def __init__(self, status, message):
        self.status = status
        super().__init__(message)


class PythonBridge:
    def __init__(self, *, timeout=25, ttl=120, max_sessions=128, max_bytes=64 * 1024 * 1024):
        self.timeout = timeout
        self.ttl = ttl
        self.max_sessions = max_sessions
        self.max_bytes = max_bytes
        self.condition = threading.Condition()
        self.sessions = {}
        self.buffered_bytes = 0

    def _remove(self, token):
        session = self.sessions.pop(token, None)
        if session:
            self.buffered_bytes -= len(session["reply"] or b"")
        self.condition.notify_all()

    def dispatch(self, action, data):
        with self.condition:
            now = time.monotonic()
            for token, session in list(self.sessions.items()):
                if now - session["touched"] > self.ttl and not session["waiting"]:
                    self._remove(token)
            if action == "open":
                if len(self.sessions) >= self.max_sessions:
                    raise BridgeError(503, "Le relais Python est occupé. Réessayez dans un instant.")
                token = secrets.token_urlsafe(32)
                self.sessions[token] = {"touched": now, "id": 1, "reply": None, "waiting": False}
                return {"token": token}
            token = data.get("token")
            if not isinstance(token, str):
                raise BridgeError(400, "Session Python invalide.")
            if action == "close":
                self._remove(token)
                return {}
            session = self.sessions.get(token)
            if session is None:
                raise BridgeError(410, "Le relais Python a expiré. Relancez le programme.")
            session["touched"] = now
            if action == "touch":
                return {}
            request_id = data.get("id")
            if type(request_id) is not int or request_id != session["id"]:
                raise BridgeError(409, "Réponse Python périmée ou désordonnée.")
            if action == "answer":
                response = data.get("response")
                if not isinstance(response, dict) or not ({"value", "error"} & response.keys()):
                    raise BridgeError(400, "Réponse Python invalide.")
                reply = json.dumps(response, ensure_ascii=False, separators=(",", ":")).encode(
                    "utf-8", errors="backslashreplace"
                )
                if len(reply) > MAX_REPLY:
                    raise BridgeError(413, "La réponse Python dépasse 8 Mo.")
                if session["reply"] is not None:
                    raise BridgeError(409, "Une réponse existe déjà.")
                if self.buffered_bytes + len(reply) > self.max_bytes:
                    raise BridgeError(503, "Le relais Python est occupé.")
                session["reply"] = reply
                self.buffered_bytes += len(reply)
                self.condition.notify_all()
                return {}
            if action != "wait":
                raise BridgeError(404, "Commande de relais inconnue.")
            if session["waiting"]:
                raise BridgeError(409, "Une attente existe déjà.")
            session["waiting"] = True
            try:
                self.condition.wait_for(
                    lambda: session["reply"] is not None or token not in self.sessions,
                    timeout=self.timeout,
                )
                if token not in self.sessions:
                    raise BridgeError(410, "Exécution Python interrompue.")
                session["touched"] = time.monotonic()
                if session["reply"] is None:
                    return {"pending": True}
                reply = session["reply"]
                self.buffered_bytes -= len(reply)
                session["reply"] = None
                session["id"] += 1
                return {"response": json.loads(reply)}
            finally:
                session["waiting"] = False


class PythonBridgeHandler:
    """Mixin for a ThreadingHTTPServer handler; POSTs never touch the filesystem."""

    def do_POST(self):
        path = urlparse(self.path).path
        if not path.startswith(BRIDGE_PATH):
            self.send_error(404)
            return
        self.close_connection = True
        try:
            # JSON plus an exact Origin check prevents cross-site form requests.
            origin = self.headers.get("Origin")
            if origin != "http://" + self.headers.get("Host", ""):
                raise BridgeError(403, "Origine du relais refusée.")
            if self.headers.get_content_type() != "application/json":
                raise BridgeError(415, "Le relais attend du JSON.")
            if self.headers.get("Transfer-Encoding"):
                raise BridgeError(400, "Encodage de requête non pris en charge.")
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise BridgeError(400, "Longueur invalide.") from None
            if not 0 < length <= MAX_REPLY + 4096:
                raise BridgeError(413, "Requête Python trop volumineuse.")
            self.connection.settimeout(30)
            try:
                data = json.loads(self.rfile.read(length))
            except (ValueError, RecursionError):
                raise BridgeError(400, "JSON invalide.") from None
            if not isinstance(data, dict):
                raise BridgeError(400, "Requête Python invalide.")
            value = self.server.python_bridge.dispatch(path[len(BRIDGE_PATH):], data)
            status = 200
        except BridgeError as error:
            status, value = error.status, {"error": str(error)}
        body = json.dumps(value, ensure_ascii=False).encode("utf-8", errors="backslashreplace")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass  # The pupil can stop a Worker while its HTTP request is waiting.
