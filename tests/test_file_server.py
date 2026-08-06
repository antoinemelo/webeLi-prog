import importlib.util
import os
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "file_server", ROOT / "ServeurHTTP_Fichiers.py"
)
file_server = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(file_server)


class SafeJoinTests(unittest.TestCase):
    def test_accepts_path_inside_root(self):
        with tempfile.TemporaryDirectory() as directory:
            expected = os.path.join(directory, "cours", "exemple.txt")
            self.assertEqual(
                file_server.safe_join(directory, "/cours/exemple.txt"),
                expected,
            )

    def test_rejects_parent_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                file_server.safe_join(directory, "/../../etc/passwd")

    def test_rejects_symlink_outside_root(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            link = Path(directory) / "sortie"
            try:
                link.symlink_to(outside, target_is_directory=True)
            except (OSError, NotImplementedError):
                self.skipTest("Liens symboliques non disponibles")
            with self.assertRaises(ValueError):
                file_server.safe_join(directory, "/sortie/secret.txt")


class MultipartTests(unittest.TestCase):
    def test_preserves_trailing_newlines_in_uploaded_file(self):
        boundary = "informatic-boundary"
        content = b"premiere ligne\r\nseconde ligne\r\n"
        body = (
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="action"\r\n\r\n'
            "upload\r\n"
            f"--{boundary}\r\n"
            'Content-Disposition: form-data; name="file"; filename="cours.txt"\r\n'
            "Content-Type: text/plain\r\n\r\n"
        ).encode("ascii") + content + f"\r\n--{boundary}--\r\n".encode("ascii")

        fields, files = file_server.parse_multipart(
            f"multipart/form-data; boundary={boundary}", body
        )

        self.assertEqual(fields["action"], "upload")
        self.assertEqual(files[0]["filename"], "cours.txt")
        self.assertEqual(files[0]["content"], content)

    def test_rejects_non_multipart_payload(self):
        with self.assertRaises(ValueError):
            file_server.parse_multipart("text/plain", b"texte")


class HiddenPathTests(unittest.TestCase):
    def test_detects_hidden_segments(self):
        self.assertTrue(file_server.contains_hidden_part("/.metadata.db"))
        self.assertTrue(file_server.contains_hidden_part("/cours/.secret/note"))
        self.assertFalse(file_server.contains_hidden_part("/cours/note.txt"))


class MetadataTests(unittest.TestCase):
    def test_prefix_operations_escape_sql_wildcards(self):
        old_root, old_db = file_server.ROOT, file_server.DB_PATH
        try:
            with tempfile.TemporaryDirectory() as directory:
                file_server.ROOT = directory
                file_server.DB_PATH = os.path.join(directory, ".metadata.db")
                file_server.db_init()
                file_server.db_upsert("classe_1/note.txt", "A")
                file_server.db_upsert("classeX1/note.txt", "B")

                file_server.db_delete_prefix("classe_1")

                remaining = file_server.db_get_many(
                    ["classe_1/note.txt", "classeX1/note.txt"]
                )
                self.assertNotIn("classe_1/note.txt", remaining)
                self.assertIn("classeX1/note.txt", remaining)
        finally:
            file_server.ROOT, file_server.DB_PATH = old_root, old_db


if __name__ == "__main__":
    unittest.main()
