import importlib.util
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
