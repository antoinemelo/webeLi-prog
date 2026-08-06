from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer
from pathlib import Path
import socket
import datetime

# =========================
# CONFIGURATION
# =========================
HOST = "0.0.0.0"
PORT = 2121
USER = "apr"
PASS = "ecg"
ROOT = Path("./partage").resolve()

# =========================
# OUTILS
# =========================
def get_main_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()

# =========================
# HANDLER PERSONNALISÉ
# =========================
class AtelierFTPHandler(FTPHandler):

    def on_connect(self):
        print(f"Connexion : {self.remote_ip}")

    def on_login(self, username):
        print(f"Login     : {username} ({self.remote_ip})")

    def on_file_received(self, file):
        print(f"Reçu      : {Path(file).name}")

    def on_disconnect(self):
        print(f"Déconnexion : {self.remote_ip}")

# =========================
# INITIALISATION
# =========================
ROOT.mkdir(parents=True, exist_ok=True)

authorizer = DummyAuthorizer()
authorizer.add_user(USER, PASS, str(ROOT), perm="elradfmwMT")

handler = AtelierFTPHandler
handler.authorizer = authorizer

server = FTPServer((HOST, PORT), handler)

# =========================
# BANNIÈRE
# =========================
ip = get_main_ip()

print("\n========= Serveur FTP ============")
print(f"Racine     : {ROOT}")
print(f"usr / pwd  : {USER} / {PASS}")
print(f"Terminal   : ftp {ip} {PORT}")
print("Arrêt      : CTRL+C")
print("===================================\n")

# =========================
# LANCEMENT
# =========================
try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\nServeur arrêté proprement.")