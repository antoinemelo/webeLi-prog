#!/usr/bin/env python3
"""Serveur FTP historique pour un atelier sur reseau local de confiance."""

import argparse
import os
import secrets
import socket
from pathlib import Path

from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer


BASE_DIR = Path(__file__).resolve().parent


def get_main_ip() -> str:
    """Retourne l'adresse LAN probable sans rendre Internet obligatoire."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


class AtelierFTPHandler(FTPHandler):
    def on_connect(self):
        print(f"Connexion    : {self.remote_ip}")

    def on_login(self, username):
        print(f"Login        : {username} ({self.remote_ip})")

    def on_file_received(self, file):
        print(f"Recu         : {Path(file).name}")

    def on_disconnect(self):
        print(f"Deconnexion  : {self.remote_ip}")


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Serveur FTP non chiffre, reserve a un reseau local de confiance."
    )
    parser.add_argument("--host", default="127.0.0.1", help="Adresse d'ecoute")
    parser.add_argument("--port", type=int, default=2121, help="Port d'ecoute")
    parser.add_argument(
        "--root",
        type=Path,
        default=BASE_DIR / "partage",
        help="Dossier partage",
    )
    parser.add_argument("--user", default=os.getenv("FTP_USER", "atelier"))
    parser.add_argument(
        "--password",
        default=os.getenv("FTP_PASSWORD"),
        help="Secret FTP (preferer FTP_PASSWORD)",
    )
    parser.add_argument(
        "--lecture-seule",
        action="store_true",
        help="Autoriser uniquement la consultation et le telechargement",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    root = args.root.expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    password = args.password or secrets.token_urlsafe(12)
    permissions = "elr" if args.lecture_seule else "elradfmwMT"

    authorizer = DummyAuthorizer()
    authorizer.add_user(args.user, password, str(root), perm=permissions)

    handler = AtelierFTPHandler
    handler.authorizer = authorizer
    server = FTPServer((args.host, args.port), handler)

    display_ip = get_main_ip() if args.host == "0.0.0.0" else args.host
    print("\n========= Serveur FTP (non chiffre) =========")
    print(f"Racine       : {root}")
    print(f"URL          : ftp://{display_ip}:{args.port}/")
    print(f"Utilisateur  : {args.user}")
    print(f"Mot de passe : {password}")
    print(f"Mode         : {'lecture seule' if args.lecture_seule else 'lecture/ecriture'}")
    print("Arret        : CTRL+C")
    print("Ne pas exposer ce service sur Internet.")
    print("==============================================\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServeur arrete proprement.")
    finally:
        server.close_all()


if __name__ == "__main__":
    main()
