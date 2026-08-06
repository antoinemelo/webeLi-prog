import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class LongDocumentEditorTests(unittest.TestCase):
    def test_editor_owns_a_stable_scrollable_viewport(self):
        css = (ROOT / "assets/css/app.css").read_text(encoding="utf-8")
        codearea_rule = re.search(r"\.codearea\s*\{(?P<body>.*?)\}", css, re.DOTALL)
        self.assertIsNotNone(codearea_rule)
        declarations = codearea_rule.group("body")
        self.assertIn("height:100%", declarations)
        self.assertIn("overflow:auto", declarations)
        self.assertIn("scrollbar-width:thin", css)

    def test_editor_height_is_not_frozen_by_javascript(self):
        for relative_path in ("assets/js/markdown.js", "assets/js/python.js"):
            source = (ROOT / relative_path).read_text(encoding="utf-8")
            self.assertNotRegex(source, r"codeEl\.style\.height\s*=")

    def test_markdown_and_python_gutters_expose_line_targets(self):
        for relative_path in ("assets/js/markdown.js", "assets/js/python.js"):
            source = (ROOT / relative_path).read_text(encoding="utf-8")
            self.assertIn('data-line="${n}"', source)

        common = (ROOT / "assets/js/app.js").read_text(encoding="utf-8")
        self.assertIn('querySelector(".gutter")', common)
        self.assertIn("textarea.setSelectionRange", common)


if __name__ == "__main__":
    unittest.main()
