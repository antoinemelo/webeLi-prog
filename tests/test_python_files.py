"""Regression tests for course p. 58-63 and Coco_TP05 / Coco_TP06."""

import importlib.util
import builtins
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "virtual_files", ROOT / "labs/python/virtual_files.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
VirtualFileSystem = MODULE.VirtualFileSystem


class PythonFileTests(unittest.TestCase):
    def setUp(self):
        self.fs = VirtualFileSystem({"essai.txt": "1ere ligne\n2e ligne\nfin\n"})

    def test_reads_share_a_cursor_and_reach_eof(self):
        with self.fs.open("essai.txt", encoding="utf-8") as fd:
            self.assertEqual(fd.read(5), "1ere ")
            self.assertEqual(fd.readline(), "ligne\n")
            self.assertEqual(fd.readlines(), ["2e ligne\n", "fin\n"])
            self.assertEqual(fd.read(), "")
            self.assertEqual(fd.readline(), "")
            self.assertEqual(fd.readlines(), [])
            self.assertEqual(fd.tell(), 24)
            fd.seek(0)
            self.assertEqual(list(fd), ["1ere ligne\n", "2e ligne\n", "fin\n"])
        self.assertTrue(fd.closed)

    def test_empty_lines_unicode_and_missing_final_newline(self):
        self.fs.set_content("accents.txt", "Éléphant\n\n🦒fin")
        with self.fs.open("accents.txt") as fd:
            self.assertEqual(fd.readline(1), "É")
            self.assertEqual(fd.readline(), "léphant\n")
            self.assertEqual(next(fd), "\n")
            self.assertEqual(next(fd), "🦒fin")
            self.assertRaises(StopIteration, next, fd)
            fd.seek(0)
            self.assertEqual(fd.readlines(1), ["Éléphant\n"])
            self.assertEqual(fd.read(), "\n🦒fin")
        with self.fs.open("empty.txt", "w+") as fd:
            self.assertEqual(list(fd), [])

    def test_missing_read_file_raises_without_creating_it(self):
        for mode in ("r", "r+"):
            with self.assertRaises(FileNotFoundError) as caught:
                self.fs.open("inexistant.txt", mode)
            self.assertEqual(caught.exception.filename, "inexistant.txt")
            self.assertTrue(caught.exception.strerror)
        self.assertNotIn("inexistant.txt", self.fs.files)

    def test_tp05_modes_replace_append_and_update(self):
        self.fs.set_content("test.txt", "Bonjour le monde")
        with self.fs.open("test.txt") as fd:
            self.assertEqual(fd.read(), "Bonjour le monde")
        with self.fs.open("test.txt", "w") as fd:
            self.assertEqual(self.fs.files["test.txt"], "")
            self.assertEqual(fd.write("Salut"), 5)
            self.assertFalse(fd.readable())
            self.assertTrue(fd.writable())
        with self.fs.open("test.txt", "a") as fd:
            fd.seek(0)
            fd.write(" le monde")
        self.assertEqual(self.fs.files["test.txt"], "Salut le monde")
        with self.fs.open("test.txt", "r+") as fd:
            fd.seek(6)
            fd.write("LA")
            fd.seek(0)
            self.assertEqual(fd.read(), "Salut LA monde")

    def test_tp05_read_then_append_at_end(self):
        self.fs.set_content("donnees.txt", "Première ligne\nDeuxième ligne\n")
        fd = self.fs.open("donnees.txt", "r+")
        self.assertEqual(fd.readline(), "Première ligne\n")
        fd.seek(0, 2)
        fd.write("FIN DU DOCUMENT\n")
        fd.close()
        self.assertEqual(self.fs.files["donnees.txt"], "Première ligne\nDeuxième ligne\nFIN DU DOCUMENT\n")

    def test_writelines_and_print_do_not_coerce_or_add_extra_newlines(self):
        with self.fs.open("output.txt", "w", encoding="utf-8") as fd:
            self.assertIsNone(fd.writelines(iter(["a", "b\n"])))
            print("Été", 2026, sep=" : ", file=fd)
            print("fin", end="", file=fd, flush=True)
            self.assertRaises(TypeError, fd.write, 5)
        self.assertEqual(self.fs.files["output.txt"], "ab\nÉté : 2026\nfin")

    def test_course_relative_seeks_and_positions(self):
        with self.fs.open("essai.txt") as fd:
            self.assertEqual(fd.seek(5), 5)
            self.assertEqual(fd.read(5), "ligne")
            self.assertEqual(fd.tell(), 10)
            self.assertEqual(fd.seek(0, 2), 24)
            fd.seek(-4, 2)
            self.assertEqual(fd.read(3), "fin")
            fd.seek(-3, 1)
            self.assertEqual(fd.read(3), "fin")
            self.assertRaises(ValueError, fd.seek, -1)
            self.assertRaises(ValueError, fd.seek, 0, 3)
            self.assertRaises(TypeError, fd.seek, 1.5)

    def test_permissions_invalid_modes_and_closed_files(self):
        fd = self.fs.open("essai.txt")
        self.assertRaises(io.UnsupportedOperation, fd.write, "hello")
        fd.close()
        fd.close()
        for operation in (fd.read, fd.readline, fd.readlines, fd.tell, fd.flush, fd.readable, fd.__enter__):
            self.assertRaises(ValueError, operation)
        self.assertRaises(ValueError, fd.write, "x")
        for mode in ("", "rw", "rr", "r++", "q", "+", "rbt"):
            self.assertRaises(ValueError, self.fs.open, "essai.txt", mode)
        self.assertRaises(io.UnsupportedOperation, self.fs.open, "essai.txt", "rb")
        self.assertRaises(LookupError, self.fs.open, "essai.txt", encoding="latin-1")
        with self.fs.open("new.txt", "x") as fd:
            self.assertRaises(io.UnsupportedOperation, fd.read)
        self.assertRaises(FileExistsError, self.fs.open, "new.txt", "x")
        for name in ("", "..", "../secret.txt", "/etc/passwd", "a/b.txt", "a\\b"):
            self.assertRaises(ValueError, self.fs.open, name, "w")

    def test_handles_have_independent_positions_and_share_updates(self):
        changes = []
        self.fs.on_change = lambda name, text: changes.append((name, text))
        reader = self.fs.open("./essai.txt")
        writer = self.fs.open("essai.txt", "r+")
        writer.write("TEST")
        self.assertEqual(reader.read(4), "TEST")
        writer.seek(0)
        writer.write("RELU")
        reader.close()
        self.assertTrue(self.fs.files["essai.txt"].startswith("RELU"))
        self.assertEqual(changes[-1][1], self.fs.files["essai.txt"])
        self.fs.close_all()
        self.assertTrue(writer.closed)

    def test_context_manager_closes_after_exception(self):
        with self.assertRaises(RuntimeError):
            with self.fs.open("created.txt", "w") as fd:
                fd.write("conservé")
                raise RuntimeError("élève")
        self.assertTrue(fd.closed)
        self.assertEqual(self.fs.files["created.txt"], "conservé")

    def test_open_handle_reads_live_edits_and_new_files(self):
        live = {"data.txt": "début\nancien\n"}
        fs = VirtualFileSystem(live, lambda name, text: live.update({name: text}), live.get)
        fd = fs.open("data.txt", "r+")
        self.assertEqual(fd.readline(), "début\n")
        live["data.txt"] = "début\nmodifié en direct\n"
        self.assertEqual(fd.readline(), "modifié en direct\n")
        fd.seek(0, 2)
        fd.write("suite\n")
        self.assertEqual(live["data.txt"], "début\nmodifié en direct\nsuite\n")
        live["nouveau.txt"] = "créé pendant l’exécution"
        self.assertEqual(fs.open("nouveau.txt").read(), live["nouveau.txt"])
        del live["data.txt"]
        self.assertRaises(FileNotFoundError, fd.read)

    def test_all_course_activities_execute_and_leave_files_available(self):
        activities = json.loads((ROOT / "labs/python/activities.json").read_text(encoding="utf-8"))
        self.assertEqual(len(activities), 9)
        for activity in activities:
            with self.subTest(activity=activity["id"]):
                fs = VirtualFileSystem(activity["files"])
                output = io.StringIO()
                def capture(*args, **kwargs):
                    kwargs.setdefault("file", output)
                    print(*args, **kwargs)
                exec(activity["code"], {"open": fs.open, "print": capture})
                fs.close_all()
                if activity["id"] == "ecriture":
                    self.assertEqual(len(fs.files), 3)
                    self.assertEqual(set(fs.files.values()), {"1ere ligne\n2e ligne\nfin\n"})

    def test_tp06_animals_can_be_filtered_and_drawn(self):
        activities = json.loads((ROOT / "labs/python/activities.json").read_text(encoding="utf-8"))
        activity = next(item for item in activities if item["id"] == "tp06-ex1")
        fs = VirtualFileSystem(activity["files"])
        namespace = {"open": fs.open}
        exec('''import random
with open("mes_animaux.txt", encoding="utf-8") as fd:
    animaux = fd.readlines()
animaux = [ligne.strip() for ligne in animaux if not ligne.startswith("*")]
choix = random.choice(animaux)
''', namespace)
        self.assertEqual(len(namespace["animaux"]), 6)
        self.assertIn(namespace["choix"], namespace["animaux"])
        self.assertIn("ÉléphantZèbré", namespace["animaux"])


class PythonRunnerTests(unittest.TestCase):
    def setUp(self):
        self.files = {}
        self.lines = []
        spec = importlib.util.spec_from_file_location("execution", ROOT / "labs/python/execution.py")
        self.runner = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {"virtual_files": MODULE}):
            spec.loader.exec_module(self.runner)

    def run_code(self, code):
        original = (builtins.open, builtins.input, sys.stdout, sys.stderr, sys.exit)
        output = []
        line = self.runner.execute(
            code, self.files, output.append,
            lambda name, content: self.files.update({name: content}),
            lambda name: self.files.get(name),
            lambda message: "réponse",
        )
        self.lines.append(line)
        self.assertEqual((builtins.open, builtins.input, sys.stdout, sys.stderr, sys.exit), original)
        return "".join(output)

    def test_error_keeps_prior_output_points_to_student_line_and_allows_next_run(self):
        output = self.run_code('print("avant")\nopen("absent.txt")')
        self.assertIn("avant\nErreur :: à la ligne 2", output)
        self.assertIn("FileNotFoundError", output)
        self.assertIn("absent.txt", output)
        self.assertEqual(self.lines[-1], 2)
        self.assertEqual(self.run_code('print("après")'), "après\n")

    def test_course_error_handler_stderr_and_exit(self):
        output = self.run_code('''import sys
try:
    open("inexistant.txt", "r")
except IOError as err:
    sys.stderr.write("Error: %s\\n" % err.strerror)
    sys.exit("Abandon...")
print("ne doit pas apparaître")
''')
        self.assertIn("Error: Fichier introuvable", output)
        self.assertTrue(output.endswith("Abandon...\n"))
        self.assertNotIn("ne doit pas apparaître", output)

    def test_written_data_survives_errors_and_subsequent_runs(self):
        self.run_code('fd = open("data.txt", "w")\nfd.write("Été")\n1 / 0')
        self.assertEqual(self.files["data.txt"], "Été")
        self.assertEqual(self.run_code('print(open("data.txt").read())'), "Été\n")


if __name__ == "__main__":
    unittest.main()
