from pathlib import Path

def looks_binary(path: Path, sample_size: int = 2048) -> bool:
    """Heuristique : si le fichier contient des bytes nuls, on le considère binaire."""
    try:
        with path.open("rb") as f:
            chunk = f.read(sample_size)
        return b"\x00" in chunk
    except OSError:
        return True  # inaccessible => on ignore

def search_in_tree(root_dir: str, needle: str, *,
                   extensions: set[str] | None = None,
                   ignore_dirs: set[str] | None = None) -> None:
    root = Path(root_dir)

    ignore_dirs = ignore_dirs or {".git", ".venv", "venv", "__pycache__", "node_modules"}
    needle_lower = needle.lower()

    for path in root.rglob("*"):
        if not path.is_file():
            continue

        # Ignore certains dossiers (si un parent correspond)
        if any(part in ignore_dirs for part in path.parts):
            continue

        # Filtre d'extensions (optionnel)
        if extensions is not None and path.suffix.lower() not in extensions:
            continue

        # Ignore les binaires
        if looks_binary(path):
            continue

        # Essais d'encodage : utf-8 puis latin-1 (souvent “passe partout”)
        for enc in ("utf-8", "latin-1"):
            try:
                with path.open("r", encoding=enc, errors="strict") as f:
                    for i, line in enumerate(f, start=1):
                        if needle_lower in line.lower():
                            print(f"{path}:{i}: {line.rstrip()}")
                break  # succès => pas besoin d'essayer l'autre encodage
            except (UnicodeDecodeError, OSError):
                continue

if __name__ == "__main__":
    # Exemple : chercher "password" dans tout le projet
    search_in_tree(
        root_dir=".",
        needle='sql-wasm.js',
        extensions={".py", ".txt", ".md", ".html", ".css", ".js"}  # None => tous les fichiers texte
    )
