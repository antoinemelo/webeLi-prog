#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import html
import io
import os
import posixpath
import socket
import sqlite3
import sys
import urllib.parse
from datetime import datetime
from http import HTTPStatus
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

# ========= CONFIG =========
PORT = 8021
ROOT = os.path.abspath("./partage")  # Dossier racine partagé
ALLOW_DELETE = True
ALLOW_RENAME = True
ALLOW_MKDIR = True

# Ne pas afficher les fichiers/dossiers cachés (commençant par ".")
HIDE_DOTFILES = True

# Métadonnées persistantes
DB_PATH = os.path.join(ROOT, ".metadata.db")
# ==========================


def get_main_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def safe_join(root: str, url_path: str) -> str:
    url_path = urllib.parse.unquote(url_path)
    url_path = posixpath.normpath(url_path)
    if url_path.startswith("../") or "/../" in url_path or url_path == "..":
        raise ValueError("Chemin non autorisé")
    rel = url_path.lstrip("/")
    full = os.path.abspath(os.path.join(root, rel))
    if os.path.commonpath([full, root]) != root:
        raise ValueError("Chemin non autorisé")
    return full


def build_breadcrumbs(url_path: str):
    parts = [p for p in url_path.strip("/").split("/") if p]
    crumbs = [("Racine", "/")]
    current = ""
    for p in parts:
        current += "/" + p
        crumbs.append((p, current + "/"))
    return crumbs


def parse_multipart(boundary: bytes, data: bytes):
    fields = {}
    files = []
    dash_boundary = b"--" + boundary
    end_boundary = b"--" + boundary + b"--"

    parts = data.split(dash_boundary)
    for part in parts:
        part = part.strip(b"\r\n")
        if not part or part == b"--" or part == end_boundary.strip(b"\r\n"):
            continue
        if b"\r\n\r\n" not in part:
            continue

        raw_headers, body = part.split(b"\r\n\r\n", 1)
        body = body.rstrip(b"\r\n")

        header_lines = raw_headers.split(b"\r\n")
        headers = {}
        for line in header_lines:
            if b":" in line:
                k, v = line.split(b":", 1)
                headers[k.strip().lower()] = v.strip()

        cd = headers.get(b"content-disposition", b"").decode("utf-8", "ignore")
        params = {}
        for item in cd.split(";"):
            item = item.strip()
            if "=" in item:
                a, b = item.split("=", 1)
                params[a.strip()] = b.strip().strip('"')

        name = params.get("name", "")
        filename = params.get("filename")

        if filename is not None and name:
            files.append({"name": name, "filename": filename, "content": body})
        elif name:
            try:
                fields[name] = body.decode("utf-8", "ignore")
            except Exception:
                fields[name] = ""
    return fields, files


# =========================
# SQLITE META
# =========================
def _norm_rel(relpath: str) -> str:
    rel = relpath.replace("\\", "/")
    rel = rel.lstrip("./")
    return rel


def rel_from_abs(abs_path: str) -> str:
    rel = os.path.relpath(abs_path, ROOT)
    return _norm_rel(rel)


def db_init():
    Path(ROOT).mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as con:
        con.execute("PRAGMA journal_mode=WAL;")
        con.execute("""
        CREATE TABLE IF NOT EXISTS file_meta(
            relpath TEXT PRIMARY KEY,
            user TEXT,
            ts TEXT
        )
        """)
        con.commit()


def db_upsert(relpath: str, user: str):
    user = (user or "").strip()[:60] or "Invité"
    ts = datetime.now().isoformat(timespec="seconds")
    relpath = _norm_rel(relpath)
    with sqlite3.connect(DB_PATH) as con:
        con.execute("""
        INSERT INTO file_meta(relpath, user, ts)
        VALUES(?,?,?)
        ON CONFLICT(relpath) DO UPDATE SET user=excluded.user, ts=excluded.ts
        """, (relpath, user, ts))
        con.commit()


def db_delete(relpath: str):
    relpath = _norm_rel(relpath)
    with sqlite3.connect(DB_PATH) as con:
        con.execute("DELETE FROM file_meta WHERE relpath=?", (relpath,))
        con.commit()


def db_delete_prefix(prefix: str):
    prefix = _norm_rel(prefix).rstrip("/") + "/"
    with sqlite3.connect(DB_PATH) as con:
        con.execute("DELETE FROM file_meta WHERE relpath LIKE ?", (prefix + "%",))
        con.commit()


def db_rename(old_relpath: str, new_relpath: str):
    old_relpath = _norm_rel(old_relpath)
    new_relpath = _norm_rel(new_relpath)
    with sqlite3.connect(DB_PATH) as con:
        con.execute("UPDATE file_meta SET relpath=? WHERE relpath=?", (new_relpath, old_relpath))
        con.commit()


def db_rename_prefix(old_prefix: str, new_prefix: str):
    old_prefix = _norm_rel(old_prefix).rstrip("/") + "/"
    new_prefix = _norm_rel(new_prefix).rstrip("/") + "/"
    with sqlite3.connect(DB_PATH) as con:
        rows = con.execute(
            "SELECT relpath, user, ts FROM file_meta WHERE relpath LIKE ?",
            (old_prefix + "%",),
        ).fetchall()

        if not rows:
            return

        for relpath, user, ts in rows:
            suffix = relpath[len(old_prefix):]
            new_rel = new_prefix + suffix
            con.execute("DELETE FROM file_meta WHERE relpath=?", (relpath,))
            con.execute(
                "INSERT OR REPLACE INTO file_meta(relpath, user, ts) VALUES(?,?,?)",
                (new_rel, user, ts),
            )
        con.commit()


def db_get_many(relpaths: list[str]) -> dict[str, tuple[str, str]]:
    if not relpaths:
        return {}
    relpaths = [_norm_rel(r) for r in relpaths]
    qmarks = ",".join(["?"] * len(relpaths))
    with sqlite3.connect(DB_PATH) as con:
        rows = con.execute(
            f"SELECT relpath, user, ts FROM file_meta WHERE relpath IN ({qmarks})",
            relpaths,
        ).fetchall()
    return {r[0]: (r[1], r[2]) for r in rows}


def db_prune_missing_global() -> int:
    """
    Nettoyage global : supprime de file_meta tout ce qui n'existe plus sur disque.
    """
    removed = 0
    with sqlite3.connect(DB_PATH) as con:
        rows = con.execute("SELECT relpath FROM file_meta").fetchall()
        to_delete = []
        for (relpath,) in rows:
            relpath = _norm_rel(relpath)
            abs_path = os.path.join(ROOT, relpath)
            if not os.path.exists(abs_path):
                to_delete.append((relpath,))
        if to_delete:
            con.executemany("DELETE FROM file_meta WHERE relpath=?", to_delete)
            removed = con.total_changes
            con.commit()
    return removed


def db_checkpoint():
    try:
        with sqlite3.connect(DB_PATH) as con:
            con.execute("PRAGMA wal_checkpoint(TRUNCATE);")
    except Exception:
        pass


# =========================
# HTTP HANDLER
# =========================
class FileWebHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        parsed = urllib.parse.urlparse(path)
        try:
            return safe_join(ROOT, parsed.path)
        except ValueError:
            return ROOT

    def log_message(self, format, *args):
        sys.stdout.write("[{:%H:%M:%S}] {} - {}\n".format(datetime.now(), self.client_address[0], format % args))

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        ctype = self.headers.get("Content-Type", "")
        length = int(self.headers.get("Content-Length", "0"))
        data = self.rfile.read(length)

        if "multipart/form-data" not in ctype or "boundary=" not in ctype:
            self.send_error(HTTPStatus.BAD_REQUEST, "Formulaire invalide")
            return

        boundary = ctype.split("boundary=", 1)[1].encode("utf-8", "ignore")
        fields, files = parse_multipart(boundary, data)
        action = fields.get("action", "")
        user = (fields.get("u") or "").strip()[:60] or "Invité"

        # ---- PRUNE (nettoyage global + refresh via redirect) ----
        if action == "prune":
            try:
                removed = db_prune_missing_global()
                db_checkpoint()
            except Exception as e:
                back = parsed.path if parsed.path.startswith("/") else "/"
                if not back.endswith("/"):
                    back += "/"
                self._redirect_back(back, msg=f"Erreur nettoyage DB: {e}")
                return

            back = parsed.path if parsed.path.startswith("/") else "/"
            if not back.endswith("/"):
                back += "/"
            self._redirect_back(back, msg=f"Serveur actualisé. Nettoyage de la base de données effectué ({removed} entrées nettoyées).")
            return

        # ---- Actions nécessitant un dossier valide ----
        try:
            target_dir = safe_join(ROOT, parsed.path)
        except ValueError:
            self.send_error(HTTPStatus.FORBIDDEN, "Chemin non autorisé")
            return

        if not os.path.isdir(target_dir):
            self.send_error(HTTPStatus.NOT_FOUND, "Dossier introuvable")
            return

        # ---- UPLOAD ----
        if action == "upload":
            count = 0
            for f in files:
                filename = os.path.basename(f["filename"])
                if not filename:
                    continue
                dest = os.path.join(target_dir, filename)

                if os.path.exists(dest):
                    base, ext = os.path.splitext(filename)
                    n = 1
                    while True:
                        cand = os.path.join(target_dir, f"{base} ({n}){ext}")
                        if not os.path.exists(cand):
                            dest = cand
                            break
                        n += 1

                with open(dest, "wb") as out:
                    out.write(f["content"])

                db_upsert(rel_from_abs(dest), user)
                count += 1

            self._redirect_back(parsed.path, msg=f"{count} fichier(s) envoyé(s) par {user}.")
            return

        # ---- MKDIR ----
        if action == "mkdir":
            if not ALLOW_MKDIR:
                self.send_error(HTTPStatus.FORBIDDEN, "Création de dossier désactivée")
                return
            name = (fields.get("dirname") or "").strip()
            name = name.replace("/", "").replace("\\", "")
            if not name:
                self._redirect_back(parsed.path, msg="Nom de dossier vide.")
                return
            new_dir = os.path.join(target_dir, name)
            try:
                os.mkdir(new_dir)
                db_upsert(rel_from_abs(new_dir), user)
                self._redirect_back(parsed.path, msg=f"Dossier créé: {name} (par {user})")
            except FileExistsError:
                self._redirect_back(parsed.path, msg="Dossier existe déjà.")
            except Exception as e:
                self._redirect_back(parsed.path, msg=f"Erreur création dossier: {e}")
            return

        # ---- DELETE ----
        if action == "delete":
            if not ALLOW_DELETE:
                self.send_error(HTTPStatus.FORBIDDEN, "Suppression désactivée")
                return
            rel = (fields.get("rel") or "").strip()
            try:
                target = safe_join(ROOT, posixpath.join(parsed.path, rel))
            except ValueError:
                self.send_error(HTTPStatus.FORBIDDEN, "Chemin non autorisé")
                return

            try:
                if os.path.isdir(target):
                    os.rmdir(target)
                    db_delete_prefix(rel_from_abs(target))
                    db_delete(rel_from_abs(target))
                    self._redirect_back(parsed.path, msg="Dossier supprimé (vide).")
                else:
                    os.remove(target)
                    db_delete(rel_from_abs(target))
                    self._redirect_back(parsed.path, msg="Fichier supprimé.")
            except OSError as e:
                self._redirect_back(parsed.path, msg=f"Suppression impossible: {e}")
            return

        # ---- RENAME ----
        if action == "rename":
            if not ALLOW_RENAME:
                self.send_error(HTTPStatus.FORBIDDEN, "Renommage désactivé")
                return
            rel = (fields.get("rel") or "").strip()
            newname = (fields.get("newname") or "").strip()
            newname = os.path.basename(newname)
            if not newname:
                self._redirect_back(parsed.path, msg="Nouveau nom vide.")
                return

            try:
                src = safe_join(ROOT, posixpath.join(parsed.path, rel))
                dst = safe_join(ROOT, posixpath.join(parsed.path, newname))
            except ValueError:
                self.send_error(HTTPStatus.FORBIDDEN, "Chemin non autorisé")
                return

            try:
                is_dir = os.path.isdir(src)
                os.rename(src, dst)

                if is_dir:
                    db_rename_prefix(rel_from_abs(src), rel_from_abs(dst))
                    db_rename(rel_from_abs(src), rel_from_abs(dst))
                else:
                    db_rename(rel_from_abs(src), rel_from_abs(dst))

                self._redirect_back(parsed.path, msg="Renommage effectué.")
            except OSError as e:
                self._redirect_back(parsed.path, msg=f"Renommage impossible: {e}")
            return

        self.send_error(HTTPStatus.BAD_REQUEST, "Action inconnue")

    def _redirect_back(self, path, msg=""):
        q = ""
        if msg:
            q = "?msg=" + urllib.parse.quote(msg)
        self.send_response(HTTPStatus.SEE_OTHER)
        dest = path if path.startswith("/") else "/"
        if not dest.endswith("/"):
            dest += "/"
        self.send_header("Location", dest + q)
        self.end_headers()

    def list_directory(self, path):
        try:
            entries = os.listdir(path)
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND, "Impossible d’ouvrir le dossier")
            return None

        if HIDE_DOTFILES:
            entries = [n for n in entries if not n.startswith(".")]

        parsed = urllib.parse.urlparse(self.path)
        breadcrumbs = build_breadcrumbs(parsed.path)
        qs = urllib.parse.parse_qs(parsed.query)
        msg = qs.get("msg", [""])[0]

        enc_path = parsed.path if parsed.path.endswith("/") else parsed.path + "/"

        entries.sort(key=lambda n: (not os.path.isdir(os.path.join(path, n)), n.lower()))

        relpaths_for_meta = []
        for name in entries:
            full = os.path.join(path, name)
            relpaths_for_meta.append(rel_from_abs(full))
        meta = db_get_many(relpaths_for_meta)

        def fmt_ts(ts: str) -> str:
            if not ts:
                return "—"
            try:
                return ts.replace("T", " ")
            except Exception:
                return ts

        def fmt_size(n: int) -> str:
            try:
                n = int(n)
            except Exception:
                return "?"
            units = ["o", "Ko", "Mo", "Go", "To"]
            i = 0
            f = float(n)
            while f >= 1024 and i < len(units) - 1:
                f /= 1024.0
                i += 1
            if i == 0:
                return f"{n} {units[i]}"
            return f"{f:.1f} {units[i]}"

        f = io.StringIO()
        f.write("<!doctype html><html lang='fr'><head>")
        f.write("<meta charset='utf-8'/>")
        f.write("<meta name='viewport' content='width=device-width, initial-scale=1'/>")
        f.write("<title>Serveur fichiers</title>")

        f.write("""
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
<style>
  body { background: #0b1220; }
  .app-shell { max-width: 1100px; }
  .glass {
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.10);
    border-radius: 16px;
    backdrop-filter: blur(8px);
  }
  .muted { color: rgba(255,255,255,.65); }
  a { text-decoration: none; }
  .file-row:hover { background: rgba(255,255,255,.04); }

  .dropzone{
    border: 2px dashed rgba(255,255,255,.25);
    border-radius: 16px;
    padding: 18px;
    transition: .15s ease;
    cursor: pointer;
    min-height: 140px;
  }
  .dropzone.dragover{
    border-color: rgba(13,110,253,.8);
    background: rgba(13,110,253,.08);
  }

  .alert-success{
    color: rgba(180,255,205,.95) !important;
    background: rgba(25,135,84,.18) !important;
    border: 1px solid rgba(25,135,84,.35) !important;
  }

  .table{ --bs-table-bg: transparent; }
  .table thead th{ background: transparent !important; color: rgba(255,255,255,.75); border-bottom-color: rgba(255,255,255,.15); }
  .table td{ color: rgba(255,255,255,.92) !important; border-bottom-color: rgba(255,255,255,.10); }
  .table tbody tr{ background: rgba(255,255,255,.03) !important; }
  .table tbody tr:hover{ background: rgba(255,255,255,.06) !important; }
  .table a{ color: rgba(255,255,255,.92) !important; }
  .table a:hover{ color: #fff !important; }

  .badge-soft{
    color: rgba(255,255,255,.85) !important;
    background: rgba(255,255,255,.10);
    border: 1px solid rgba(255,255,255,.15);
  }

  input.form-control, .btn{ border-radius: 12px; }
  .icon-btn{
    width: 40px; height: 40px;
    display: inline-flex; align-items:center; justify-content:center;
    border-radius: 12px;
  }
</style>
""")

        f.write("</head><body class='text-light'>")
        f.write("<div class='container py-4 app-shell'>")

        # Header
        f.write(f"""
<div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
  <div class="flex-grow-1 min-w-0">
    <div class="d-flex align-items-center gap-2">
      <i class="bi bi-cloud-arrow-up fs-4"></i>
      <h1 class="h4 mb-0">Serveur de fichiers
          <form method="POST" enctype="multipart/form-data" action="{html.escape(enc_path)}" class="d-inline">
              <input type="hidden" name="action" value="prune">
              <input type="hidden" name="u" id="uFieldPrune" value="">
              <button type="submit" class="btn btn-outline-light btn-sm" title="Actualiser + nettoyage DB">
                 <i class="bi bi-arrow-clockwise me-1"></i>Actualiser
              </button>
           </form>
      </h1>
    </div>

    <div class="muted small mt-1 d-flex align-items-center justify-content-between w-100"
         style="letter-spacing:-0.02em; gap:12px;">

      <div class="d-flex flex-wrap align-items-center gap-1 flex-grow-1 min-w-0">
        <i class="bi bi-folder2-open me-1"></i>
""")

        for i, (label, link) in enumerate(breadcrumbs):
            if i > 0:
                f.write("<span class='text-white-50 mx-1'>/</span>")
            if i == len(breadcrumbs) - 1:
                f.write(f"<span class='fw-semibold text-white-50'>{html.escape(label)}</span>")
            else:
                f.write(f"<a href='{html.escape(link)}' class='text-white-50 text-decoration-none'>{html.escape(label)}</a>")

        f.write(f"""
      </div>

      <div class="d-flex align-items-center gap-1 text-nowrap flex-shrink-0">
        Utilisateur :
        <span id="uiUser" class="text-white-50">—</span>
        <button id="changeUser" type="button"
                class="btn btn-link btn-sm text-white-50 p-0 ms-1"
                style="text-decoration:none">
          <i class="bi bi-pencil"></i>
        </button>
      </div>

    </div>
  </div>
</div>
""")

        if msg:
            f.write(f"""
<div class="alert alert-success glass border-0 py-2">
  <i class="bi bi-check-circle me-2"></i>{html.escape(msg)}
</div>
""")

        # Actions area
        f.write("<div class='glass p-3 mb-3'>")
        f.write("<div class='row g-3 align-items-stretch'>")

        f.write(f"""
<div class="col-12 col-lg-7">
  <form id="uploadForm" method="POST" enctype="multipart/form-data" action="{html.escape(enc_path)}">
    <input type="hidden" name="action" value="upload">
    <input type="hidden" name="u" id="uField" value="">
    <input id="fileInput" class="d-none" type="file" name="file" multiple>

    <div id="dropzone" class="dropzone d-flex flex-column justify-content-center">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-box-arrow-in-down fs-4"></i>
        <div>
          <div class="fw-semibold">Glissez-déposez ou cliquez ici pour sélectionner vos fichiers</div>
        </div>
      </div>

      <div id="picked" class="mt-3 small muted"></div>
    </div>

    <div class="mt-3 d-flex gap-2">
      <button type="submit" class="btn btn-primary btn-sm">
        <i class="bi bi-upload me-1"></i>Envoyer
      </button>
      <button type="button" id="clearBtn" class="btn btn-outline-light btn-sm">
        <i class="bi bi-x-circle me-1"></i>Vider
      </button>
    </div>
  </form>
</div>
""")

        if ALLOW_MKDIR:
            f.write(f"""
<div class="col-12 col-lg-5">
  <div class="h-100 d-flex flex-column justify-content-center">
    <div class="fw-semibold mb-2"><i class="bi bi-folder-plus me-2"></i>Dossier</div>
    <form method="POST" enctype="multipart/form-data" action="{html.escape(enc_path)}" class="d-flex gap-2">
      <input type="hidden" name="action" value="mkdir">
      <input type="hidden" name="u" id="uFieldMkdir" value="">
      <input class="form-control form-control-sm" type="text" name="dirname" placeholder="Nom du nouveau dossier">
      <button class="btn btn-success btn-sm" type="submit">
        <i class="bi bi-plus-lg me-1"></i>Créer
      </button>
    </form>
    <div class="muted small mt-2"><i>Note : évitez les caractères spéciaux.</i></div>
  </div>
</div>
""")

        f.write("</div></div>")

        f.write(f"""
<form id="actionForm" method="POST" enctype="multipart/form-data" action="{html.escape(enc_path)}" class="d-none">
  <input type="hidden" name="action" id="af_action" value="">
  <input type="hidden" name="rel" id="af_rel" value="">
  <input type="hidden" name="newname" id="af_newname" value="">
  <input type="hidden" name="u" id="af_u" value="">
</form>
""")

        f.write("<div class='glass p-3'>")
        f.write("""
<div class="d-flex align-items-center justify-content-between mb-2">
  <div class="fw-semibold"><i class="bi bi-list-ul me-2"></i>Contenu</div>
  <div class="muted small">Tri : dossiers d’abord</div>
</div>
<p></p>
""")
        f.write("<div class='table-responsive'>")
        f.write("<table class='table table-sm align-middle mb-0'>")
        f.write("<thead><tr>")
        f.write("<th>Nom</th>")
        f.write("<th>Déposé / créé par</th>")
        f.write("<th>Quand</th>")
        f.write("<th class='text-end'>Taille</th>")
        f.write("<th class='text-end'>Actions</th>")
        f.write("</tr></thead><tbody>")

        if parsed.path != "/":
            parent = posixpath.normpath(posixpath.join(parsed.path, ".."))
            if not parent.endswith("/"):
                parent += "/"
            f.write(f"""
<tr class="file-row">
  <td>
    <a class="text-light" href="{html.escape(parent)}">
      <i class="bi bi-arrow-90deg-up me-2"></i>..
      <span class="badge badge-soft ms-2">parent</span>
    </a>
  </td>
  <td class="muted">—</td>
  <td class="muted">—</td>
  <td class="text-end muted">—</td>
  <td class="text-end muted">—</td>
</tr>
""")

        for name in entries:
            full = os.path.join(path, name)
            is_dir = os.path.isdir(full)
            disp = html.escape(name)
            href = urllib.parse.quote(name)

            icon = "bi-folder2-open" if is_dir else "bi-file-earmark"
            badge = "dossier" if is_dir else "fichier"

            r = rel_from_abs(full)
            who, when = meta.get(r, ("—", "—"))
            when = fmt_ts("" if when == "—" else when)

            size_s = "—"
            if not is_dir:
                try:
                    size_s = fmt_size(os.path.getsize(full))
                except OSError:
                    size_s = "?"

            actions_html = "<span class='muted'>—</span>"
            if (ALLOW_RENAME or ALLOW_DELETE):
                actions = []
                if ALLOW_RENAME:
                    actions.append(f"""
<li>
  <button class="dropdown-item" type="button" data-rel="{html.escape(name)}" onclick="renameItem(this.dataset.rel)">
    <i class="bi bi-pencil-square me-2"></i>Renommer
  </button>
</li>
""")
                if ALLOW_DELETE:
                    actions.append(f"""
<li>
  <button class="dropdown-item text-danger" type="button" data-rel="{html.escape(name)}" onclick="deleteItem(this.dataset.rel)">
    <i class="bi bi-trash3 me-2"></i>Supprimer
  </button>
</li>
""")
                actions_html = f"""
<div class="dropdown">
  <button class="btn btn-outline-light btn-sm icon-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Actions">
    <i class="bi bi-three-dots-vertical"></i>
  </button>
  <ul class="dropdown-menu dropdown-menu-dark dropdown-menu-end">
    {''.join(actions)}
  </ul>
</div>
"""

            link = f"{href}/" if is_dir else href

            f.write(f"""
<tr class="file-row">
  <td>
    <a class="text-light" href="{link}">
      <i class="bi {icon} me-2"></i>{disp}{'/' if is_dir else ''}
      <span class="badge badge-soft ms-2">{badge}</span>
    </a>
  </td>
  <td class="muted">{html.escape(str(who))}</td>
  <td class="muted">{html.escape(str(when))}</td>
  <td class="text-end muted">{html.escape(str(size_s))}</td>
  <td class="text-end">{actions_html}</td>
</tr>
""")

        f.write("</tbody></table><p>&nbsp;</p><p>&nbsp;</p></div></div>")

        f.write("""
<div class="modal fade" id="userModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content glass text-light border-0">
      <div class="modal-header border-0">
        <h5 class="modal-title"><i class="bi bi-person-circle me-2"></i>Bienvenue</h5>
      </div>
      <div class="modal-body">
        <div class="muted mb-2">Entrez votre prénom ou vos initiales</div>
        <input id="userNameInput" class="form-control" type="text" placeholder="Ex : Ignace" maxlength="60" autofocus>
        <div class="muted small mt-2"><i>Enregistré uniquement en local</i></div>
      </div>
      <div class="modal-footer border-0">
        <button type="button" class="btn btn-outline-light" id="skipUser">Passer</button>
        <button type="button" class="btn btn-primary" id="saveUser">
          <i class="bi bi-check2 me-1"></i>Valider
        </button>
      </div>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

<script>
  const KEY = "fileweb_username_v1";
  const uiUser = document.getElementById("uiUser");
  const changeBtn = document.getElementById("changeUser");

  const uField = document.getElementById("uField");
  const uFieldMkdir = document.getElementById("uFieldMkdir");
  const uFieldPrune = document.getElementById("uFieldPrune");
  const af_u = document.getElementById("af_u");

  const modalEl = document.getElementById("userModal");
  const modal = new bootstrap.Modal(modalEl, {backdrop: 'static', keyboard: false});
  const inputUser = document.getElementById("userNameInput");
  const saveBtn = document.getElementById("saveUser");
  const skipBtn = document.getElementById("skipUser");

  const url = new URL(window.location.href);
  const uFromUrl = (url.searchParams.get("u") || "").trim();
  if (uFromUrl) {
    localStorage.setItem(KEY, uFromUrl.slice(0, 60));
    url.searchParams.delete("u");
    window.history.replaceState({}, "", url.toString());
  }

  function getUser(){
    return (localStorage.getItem(KEY) || "").trim();
  }
  function renderUser(){
    const u = getUser();
    const val = u ? u : "Invité";
    uiUser.textContent = val;
    if (uField) uField.value = val;
    if (uFieldMkdir) uFieldMkdir.value = val;
    if (uFieldPrune) uFieldPrune.value = val;
    if (af_u) af_u.value = val;
  }
  function setUser(name){
    const n = (name || "").trim().slice(0, 60);
    if (n) localStorage.setItem(KEY, n);
    else localStorage.removeItem(KEY);
    renderUser();
  }
  function openModal(prefill=""){
    inputUser.value = prefill;
    setTimeout(() => inputUser.focus(), 150);
    modal.show();
  }

  renderUser();
  if (!getUser()) openModal("");

  saveBtn.addEventListener("click", () => { setUser(inputUser.value); modal.hide(); });
  skipBtn.addEventListener("click", () => { setUser(""); modal.hide(); });

  inputUser.addEventListener("keydown", (e) => { if (e.key === "Enter") saveBtn.click(); });
  changeBtn?.addEventListener("click", () => { openModal(getUser()); });

  // Drag & Drop upload
  const dz = document.getElementById('dropzone');
  const inputFiles = document.getElementById('fileInput');
  const formUpload = document.getElementById('uploadForm');
  const picked = document.getElementById('picked');
  const clearBtn = document.getElementById('clearBtn');

  function renderPicked(){
    if (!inputFiles.files || inputFiles.files.length === 0){
      picked.textContent = "Aucun fichier sélectionné.";
      return;
    }
    const names = [...inputFiles.files].map(f => f.name + " (" + f.size + " o)");
    picked.textContent = names.join(" • ");
  }

  dz.addEventListener('click', () => inputFiles.click());
  inputFiles.addEventListener('change', () => { renderPicked(); });

  clearBtn?.addEventListener('click', () => { inputFiles.value = ""; renderPicked(); });

  ['dragenter','dragover'].forEach(evt => {
    dz.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.add('dragover'); });
  });
  ['dragleave','drop'].forEach(evt => {
    dz.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.remove('dragover'); });
  });

  dz.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    inputFiles.files = files;
    renderPicked();
    formUpload.submit();
  });

  renderPicked();

  // Actions rename/delete
  const af = document.getElementById("actionForm");
  const af_action = document.getElementById("af_action");
  const af_rel = document.getElementById("af_rel");
  const af_newname = document.getElementById("af_newname");

  window.renameItem = function(rel){
    const current = rel || "";
    const nn = prompt("Nouveau nom pour : " + current, current);
    if (!nn) return;
    af_action.value = "rename";
    af_rel.value = current;
    af_newname.value = nn;
    renderUser();
    af.submit();
  };

  window.deleteItem = function(rel){
    const current = rel || "";
    if (!confirm("Supprimer : " + current + " ?")) return;
    af_action.value = "delete";
    af_rel.value = current;
    af_newname.value = "";
    renderUser();
    af.submit();
  };
</script>
</div>
</body></html>
""")

        encoded = f.getvalue().encode("utf-8", "surrogateescape")
        f.close()

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        return io.BytesIO(encoded)


def main():
    os.makedirs(ROOT, exist_ok=True)
    db_init()

    ip = get_main_ip()
    print("\n======= Serveur de fichiers HTTP ========")
    print(f"Racine  : {ROOT}")
    print(f"URL     : http://{ip}:{PORT}/")
    print("Arrêt   : CTRL+C")
    print("=========================================\n")

    os.chdir(ROOT)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), FileWebHandler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServeur arrêté proprement !")
    finally:
        server.server_close()
        db_checkpoint()


if __name__ == "__main__":
    main()