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
        markdown = (ROOT / "assets/js/markdown.js").read_text(encoding="utf-8")
        python = (ROOT / "assets/js/python.js").read_text(encoding="utf-8")
        self.assertIn('data-line="${n}"', markdown)
        self.assertIn('data-line="${line}"', python)

        common = (ROOT / "assets/js/app.js").read_text(encoding="utf-8")
        self.assertIn('querySelector(".gutter")', common)
        self.assertIn("textarea.setSelectionRange", common)

    def test_python_uses_logical_lines_without_soft_wrap(self):
        html = (ROOT / "labs/python/index.html").read_text(encoding="utf-8")
        javascript = (ROOT / "assets/js/python.js").read_text(encoding="utf-8")
        self.assertIn('wrap="off"', html)
        self.assertNotIn("visibleWrapsForLine", javascript)

    def test_sql_gutter_does_not_translate_its_background_by_padding(self):
        javascript = (ROOT / "assets/js/sql.js").read_text(encoding="utf-8")
        self.assertIn("const offsetY = (first - 1) * lineHeight;", javascript)
        self.assertNotIn("(first - 1) * lineHeight + padTop", javascript)

    def test_html_preview_loads_images_as_one_project(self):
        html = (ROOT / "labs/html/index.html").read_text(encoding="utf-8")
        javascript = (ROOT / "assets/js/html.js").read_text(encoding="utf-8")
        self.assertIn('id="openAssets"', html)
        self.assertIn("showDirectoryPicker", javascript)
        self.assertIn('input.multiple = true', javascript)
        self.assertNotIn("suggestedName: src", javascript)
        self.assertIn("img { max-width: 100%; height: auto; object-fit: contain; }", javascript)

    def test_glossary_code_examples_are_copyable(self):
        glossary = (ROOT / "assets/aide/index.html").read_text(encoding="utf-8")
        self.assertIn('class="copy-example example-action"', glossary)
        self.assertIn('class="bi bi-copy"', glossary)
        self.assertIn("navigator.clipboard.writeText", glossary)
        self.assertIn('querySelector("code")', glossary)

    def test_glossary_examples_can_be_inserted_in_each_editor(self):
        glossary = (ROOT / "assets/aide/index.html").read_text(encoding="utf-8")
        common = (ROOT / "assets/js/app.js").read_text(encoding="utf-8")

        self.assertIn('class="insert-example example-action"', glossary)
        self.assertIn('class="bi bi-arrow-bar-left"', glossary)
        self.assertIn('action: "insertGlossaryCode"', glossary)
        self.assertIn('event.data.action !== "insertGlossaryCode"', common)
        self.assertIn('querySelector("textarea.codearea")', common)
        self.assertIn("textarea.setRangeText", common)

        for workshop in ("html", "markdown", "python", "sql"):
            page = (ROOT / "labs" / workshop / "index.html").read_text(encoding="utf-8")
            self.assertIn("../../assets/js/app.js", page)

    def test_stats_use_the_canonical_site_and_report_load_failures(self):
        stats = (ROOT / "stats.html").read_text(encoding="utf-8")
        self.assertIn('const STATS_SITE = "informatic.li"', stats)
        self.assertIn('id="statsStatus"', stats)
        self.assertIn("if (!res.ok)", stats)
        self.assertIn("Aucune statistique n’est disponible", stats)


if __name__ == "__main__":
    unittest.main()
