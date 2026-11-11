"""Exercise the LAN relay, including concurrent pupils and HTTP boundaries."""

from concurrent.futures import ThreadPoolExecutor
from http.client import HTTPConnection
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import threading
import unittest
from unittest.mock import patch

from python_bridge import BRIDGE_PATH, MAX_REPLY, BridgeError, PythonBridge, PythonBridgeHandler


class PythonBridgeTests(unittest.TestCase):
    def setUp(self):
        self.bridge = PythonBridge(timeout=0.1)

    def session(self):
        return self.bridge.dispatch("open", {})["token"]

    def test_pupils_have_separate_responses_and_replies_can_arrive_before_wait(self):
        first, second = self.session(), self.session()
        for token, value in ((first, "Élève A"), (second, "Élève B")):
            self.bridge.dispatch("answer", {"token": token, "id": 1, "response": {"value": value}})
        for token, value in ((second, "Élève B"), (first, "Élève A")):
            self.assertEqual(self.bridge.dispatch("wait", {"token": token, "id": 1}),
                             {"response": {"value": value}})
        self.assertEqual(self.bridge.buffered_bytes, 0)
        with self.assertRaises(BridgeError):
            self.bridge.dispatch("wait", {"token": first, "id": 1})

    def test_waiting_worker_receives_reply_and_close_releases_waiter(self):
        self.bridge.timeout = 2
        token = self.session()
        with ThreadPoolExecutor() as pool:
            waiting = pool.submit(self.bridge.dispatch, "wait", {"token": token, "id": 1})
            self.bridge.dispatch("answer", {"token": token, "id": 1, "response": {"value": "Alice"}})
            self.assertEqual(waiting.result(timeout=3), {"response": {"value": "Alice"}})
            waiting = pool.submit(self.bridge.dispatch, "wait", {"token": token, "id": 2})
            self.bridge.dispatch("close", {"token": token})
            with self.assertRaises(BridgeError) as caught:
                waiting.result(timeout=3)
            self.assertEqual(caught.exception.status, 410)

    def test_long_input_can_retry_without_losing_its_response(self):
        token = self.session()
        request = {"token": token, "id": 1}
        self.assertEqual(self.bridge.dispatch("wait", request), {"pending": True})
        self.bridge.dispatch("answer", {**request, "response": {"value": None}})
        self.assertEqual(self.bridge.dispatch("wait", request), {"response": {"value": None}})

    def test_python_strings_preserve_isolated_surrogates(self):
        request = {"token": self.session(), "id": 1}
        self.bridge.dispatch("answer", {**request, "response": {"value": "\ud800"}})
        self.assertEqual(self.bridge.dispatch("wait", request), {"response": {"value": "\ud800"}})

    def test_bounds_expiry_and_unknown_tokens(self):
        self.bridge.max_sessions = 1
        self.bridge.max_bytes = 50
        token = self.session()
        with self.assertRaises(BridgeError):
            self.session()
        with self.assertRaises(BridgeError):
            self.bridge.dispatch("wait", {"token": "unknown", "id": 1})
        with self.assertRaises(BridgeError):
            self.bridge.dispatch("answer", {"token": token, "id": 1, "response": {"value": "x" * 100}})
        self.assertEqual(self.bridge.buffered_bytes, 0)
        with patch("python_bridge.time.monotonic", return_value=self.bridge.sessions[token]["touched"] + 121):
            replacement = self.session()
        self.assertNotEqual(token, replacement)
        self.assertNotIn(token, self.bridge.sessions)

    def test_heartbeat_keeps_computation_alive_and_close_frees_buffer(self):
        token = self.session()
        started = self.bridge.sessions[token]["touched"]
        for elapsed in (60, 120, 180):
            with patch("python_bridge.time.monotonic", return_value=started + elapsed):
                self.bridge.dispatch("touch", {"token": token})
        self.bridge.dispatch("answer", {"token": token, "id": 1, "response": {"value": "conservé"}})
        self.assertGreater(self.bridge.buffered_bytes, 0)
        self.bridge.dispatch("close", {"token": token})
        self.assertEqual(self.bridge.buffered_bytes, 0)
        self.assertNotIn(token, self.bridge.sessions)


class RelayHandler(PythonBridgeHandler, SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class PythonBridgeHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), RelayHandler)
        cls.server.python_bridge = PythonBridge(timeout=0.1)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def post(self, action, data, headers=None):
        connection = HTTPConnection(*self.server.server_address, timeout=3)
        host = "%s:%s" % self.server.server_address
        request_headers = {"Origin": "http://" + host, "Content-Type": "application/json"}
        request_headers.update(headers or {})
        connection.request("POST", BRIDGE_PATH + action, json.dumps(data), request_headers)
        response = connection.getresponse()
        status, body = response.status, json.loads(response.read())
        connection.close()
        return status, body

    def test_http_roundtrip_and_cancelled_input(self):
        status, opened = self.post("open", {})
        self.assertEqual(status, 200)
        request = {"token": opened["token"], "id": 1}
        self.assertEqual(self.post("answer", {**request, "response": {"value": None}})[0], 200)
        self.assertEqual(self.post("wait", request), (200, {"response": {"value": None}}))
        self.assertEqual(self.post("close", request)[0], 200)
        self.assertEqual(self.post("wait", {**request, "id": 2})[0], 410)

    def test_refuses_cross_origin_forms_and_oversized_bodies(self):
        self.assertEqual(self.post("open", {}, {"Origin": "http://another-school.test"})[0], 403)
        self.assertEqual(self.post("open", {}, {"Content-Type": "text/plain"})[0], 415)
        self.assertEqual(self.post("open", {}, {"Content-Length": str(MAX_REPLY + 4097)})[0], 413)
        self.assertEqual(self.post("open", [])[0], 400)


if __name__ == "__main__":
    unittest.main()
