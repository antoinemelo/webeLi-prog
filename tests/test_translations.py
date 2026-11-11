import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DICTIONARY = (ROOT / "assets/js/dico.js").read_text(encoding="utf-8")


def language_body(language):
    match = re.search(rf"\b{language}:\s*\{{", DICTIONARY)
    if not match:
        raise AssertionError(f"Langue absente: {language}")
    start = match.end()
    depth = 1
    index = start
    quote = None
    escaped = False
    while index < len(DICTIONARY) and depth:
        char = DICTIONARY[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        elif char in "'\"`":
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
        index += 1
    return DICTIONARY[start:index - 1]


def translation_keys(language):
    return re.findall(r"^\s*([A-Za-z_$][\w$]*)\s*:", language_body(language), re.M)


class TranslationTests(unittest.TestCase):
    def test_languages_have_no_duplicate_keys(self):
        for language in ("fr", "de", "en"):
            keys = translation_keys(language)
            duplicates = {key for key in keys if keys.count(key) > 1}
            self.assertEqual(duplicates, set(), language)

    def test_every_html_key_exists_in_every_language(self):
        used = set()
        for path in ROOT.rglob("*.html"):
            used.update(
                re.findall(
                    r'data-i18n=["\']([^"\']+)',
                    path.read_text(encoding="utf-8"),
                )
            )
        for language in ("fr", "de", "en"):
            self.assertEqual(used - set(translation_keys(language)), set(), language)


if __name__ == "__main__":
    unittest.main()
