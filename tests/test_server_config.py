import importlib.util
import io
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


static_server = load("static_server", "ServeurHTTP_Web.py")
ftp_server = load("ftp_server", "ServeurFTP_Fichiers.py")


class ServerConfigTests(unittest.TestCase):
    def test_python_and_its_glossary_enable_isolated_workers(self):
        for path in ("/labs/python/", "/labs/python/worker.js", "/assets/aide/?atelier=python"):
            handler = object.__new__(static_server.StaticHandler)
            handler.path = path
            handler.request_version = "HTTP/1.1"
            handler.wfile = io.BytesIO()
            handler.end_headers()
            headers = handler.wfile.getvalue().decode("latin-1")
            self.assertIn("Cross-Origin-Opener-Policy: same-origin", headers)
            self.assertIn("Cross-Origin-Embedder-Policy: require-corp", headers)

    def test_other_workshops_keep_their_embedding_policy(self):
        handler = object.__new__(static_server.StaticHandler)
        handler.path = "/labs/html/"
        handler.request_version = "HTTP/1.1"
        handler.wfile = io.BytesIO()
        handler.end_headers()
        self.assertNotIn(b"Cross-Origin-Embedder-Policy", handler.wfile.getvalue())

    def test_static_server_is_local_by_default(self):
        args = static_server.parse_args([])
        self.assertEqual(args.host, "127.0.0.1")
        self.assertEqual(args.port, 8000)

    def test_ftp_server_is_local_and_has_no_hardcoded_password(self):
        args = ftp_server.parse_args([])
        self.assertEqual(args.host, "127.0.0.1")
        self.assertIsNone(args.password)


if __name__ == "__main__":
    unittest.main()
