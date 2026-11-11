#!/usr/bin/env python3
"""Validation statique legere, sans installation d'un outil frontend."""

from __future__ import annotations

import shutil
import sqlite3
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import posixpath


ROOT = Path(__file__).resolve().parents[1]
IGNORED_PARTS = {".git", ".gitdata", ".venv", "venv", "__pycache__"}


class DocumentParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.references: list[tuple[str, str, str]] = []
        self.ids: set[str] = set()
        self.duplicate_ids: set[str] = set()
        self.unsafe_blank_links: list[str] = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        element_id = values.get("id")
        if element_id:
            if element_id in self.ids:
                self.duplicate_ids.add(element_id)
            self.ids.add(element_id)
        if tag == "a" and values.get("target") == "_blank":
            rel = set((values.get("rel") or "").split())
            if "noopener" not in rel:
                self.unsafe_blank_links.append(values.get("href") or "")
        for attribute in ("href", "src"):
            if attribute in values:
                self.references.append((tag, attribute, values[attribute] or ""))


def project_files(pattern: str):
    for path in sorted(ROOT.rglob(pattern)):
        if not any(part in IGNORED_PARTS for part in path.parts):
            yield path


def check_python(errors: list[str]):
    for path in project_files("*.py"):
        try:
            compile(path.read_text(encoding="utf-8"), str(path), "exec")
        except (SyntaxError, UnicodeError) as exc:
            errors.append(f"Python invalide: {path.relative_to(ROOT)}: {exc}")


def check_javascript(errors: list[str]):
    node = shutil.which("node")
    if not node:
        print("INFO: Node.js absent, controle JavaScript ignore.")
        return
    for path in project_files("*.js"):
        if "dist" in path.parts:
            continue
        result = subprocess.run(
            [node, "--check", str(path)],
            text=True,
            capture_output=True,
            check=False,
        )
        if result.returncode:
            detail = (result.stderr or result.stdout).strip().splitlines()[-1]
            errors.append(f"JavaScript invalide: {path.relative_to(ROOT)}: {detail}")


def resolve_local_reference(document: Path, raw: str) -> Path | None:
    if not raw or raw.startswith(("#", "mailto:", "tel:", "data:", "javascript:")):
        return None
    parsed = urlsplit(raw)
    if parsed.scheme or parsed.netloc:
        return None
    path = unquote(parsed.path)
    if not path:
        return None
    document_url = "/" + document.relative_to(ROOT).as_posix()
    if path.startswith("/"):
        normalized = posixpath.normpath(path)
    else:
        normalized = posixpath.normpath(posixpath.join(posixpath.dirname(document_url), path))
    return ROOT / normalized.lstrip("/")


def check_html(errors: list[str]):
    for path in project_files("*.html"):
        parser = DocumentParser()
        try:
            parser.feed(path.read_text(encoding="utf-8"))
        except (UnicodeError, ValueError) as exc:
            errors.append(f"HTML illisible: {path.relative_to(ROOT)}: {exc}")
            continue
        for duplicate in sorted(parser.duplicate_ids):
            errors.append(f"ID HTML duplique: {path.relative_to(ROOT)}: #{duplicate}")
        for href in parser.unsafe_blank_links:
            errors.append(
                f"Lien target=_blank sans rel=noopener: {path.relative_to(ROOT)}: {href}"
            )
        for tag, attribute, raw in parser.references:
            target = resolve_local_reference(path, raw)
            if target is None:
                continue
            exists = target.exists()
            if target.is_dir():
                exists = (target / "index.html").is_file()
            if not exists:
                errors.append(
                    f"Lien local absent: {path.relative_to(ROOT)}: "
                    f"{tag}[{attribute}]={raw}"
                )


def check_databases(errors: list[str]):
    for relative in ("assets/aide/aide.db", "assets/liens/link.db"):
        path = ROOT / relative
        try:
            with sqlite3.connect(f"file:{path}?mode=ro", uri=True) as connection:
                result = connection.execute("PRAGMA quick_check").fetchone()[0]
            if result != "ok":
                errors.append(f"SQLite invalide: {relative}: {result}")
        except sqlite3.Error as exc:
            errors.append(f"SQLite illisible: {relative}: {exc}")


def main() -> int:
    errors: list[str] = []
    check_python(errors)
    check_javascript(errors)
    check_html(errors)
    check_databases(errors)

    if errors:
        print("ECHEC DE VALIDATION")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Validation statique reussie.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
