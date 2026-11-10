"""Text files for the browser workshop, independent of the DOM.

Positions count Unicode characters, including relative seeks, as in the course.
This teaching model deliberately differs from CPython's byte-based text cookies.
"""

from io import UnsupportedOperation
from operator import index


class VirtualFileNotFoundError(FileNotFoundError):
    """Keep Python's exception type while allowing metadata in Brython."""


class VirtualFileExistsError(FileExistsError):
    """Keep Python's exception type while allowing metadata in Brython."""


def file_error(exception_type, number, message, filename):
    # Brython's OSError does not unpack the three-argument CPython constructor.
    error = exception_type(message + " : " + filename)
    error.errno = number
    error.strerror = message
    error.filename = filename
    return error


class VirtualFileSystem:
    def __init__(self, files=None, on_change=None, on_read=None):
        self.files = dict(files or {})
        self.on_change = on_change
        self.on_read = on_read
        self.handles = []

    def refresh(self, name):
        if self.on_read is not None:
            content = self.on_read(name)
            if content is None:
                self.files.pop(name, None)
            else:
                self.files[name] = content

    def get_content(self, name):
        self.refresh(name)
        if name not in self.files:
            raise file_error(VirtualFileNotFoundError, 2, "Fichier introuvable dans Projet.", name)
        return self.files[name]

    def set_content(self, name, content):
        self.files[name] = content
        if self.on_change is not None:
            self.on_change(name, content)

    def open(self, file, mode="r", buffering=-1, encoding=None, errors=None,
             newline=None, closefd=True, opener=None):
        if not isinstance(file, str):
            raise TypeError("Le nom du fichier doit être une chaîne.")
        # A flat workspace: './essai.txt' and 'essai.txt' name the same file.
        while file.startswith("./"):
            file = file[2:]
        if not file or file in (".", "..") or any(c in file for c in "/\\\x00"):
            raise ValueError("Utiliser un nom de fichier sans dossier, par exemple essai.txt.")
        if not isinstance(mode, str):
            raise TypeError("Le mode doit être une chaîne.")
        if (not mode or any(c not in "rwax+tb" for c in mode)
                or any(mode.count(c) > 1 for c in mode)
                or sum(c in mode for c in "rwax") != 1
                or ("b" in mode and "t" in mode)):
            raise ValueError("Mode d'ouverture invalide : " + mode)
        if "b" in mode:
            raise UnsupportedOperation("Cet atelier utilise des fichiers texte UTF-8.")
        if encoding is not None and encoding.lower().replace("_", "-") not in ("utf-8", "utf8"):
            raise LookupError("Cet atelier utilise l'encodage UTF-8.")
        if newline is not None or errors not in (None, "strict") or buffering != -1 or not closefd or opener is not None:
            raise UnsupportedOperation("Option d'ouverture non prise en charge dans cet atelier.")
        action = next(c for c in mode if c in "rwax")
        self.refresh(file)
        if action == "r" and file not in self.files:
            raise file_error(VirtualFileNotFoundError, 2, "Fichier introuvable. Créez-le ou importez-le dans Projet.", file)
        if action == "x" and file in self.files:
            raise file_error(VirtualFileExistsError, 17, "Ce fichier existe déjà.", file)
        if action in "wx" or file not in self.files:
            self.set_content(file, "")
        handle = VirtualFile(self, file, mode, action)
        self.handles.append(handle)
        return handle

    def close_all(self):
        for handle in self.handles:
            handle.close()
        self.handles.clear()


class VirtualFile:
    encoding = "utf-8"
    errors = "strict"

    def __init__(self, filesystem, name, mode, action):
        self._fs = filesystem
        self.name = name
        self.mode = mode
        self.closed = False
        self._action = action
        self._position = len(self._content()) if action == "a" else 0

    def _content(self):
        return self._fs.get_content(self.name)

    def __repr__(self):
        return f"<VirtualFile name={self.name!r} mode={self.mode!r} encoding={self.encoding!r}>"

    def _check_closed(self):
        if self.closed:
            raise ValueError("I/O operation on closed file")

    def readable(self):
        self._check_closed()
        return self._action == "r" or "+" in self.mode

    def writable(self):
        self._check_closed()
        return self._action in "wax" or "+" in self.mode

    def seekable(self):
        self._check_closed()
        return True

    def read(self, size=-1):
        if not self.readable():
            raise UnsupportedOperation("not readable")
        size = -1 if size is None else index(size)
        content = self._content()
        end = len(content) if size < 0 else self._position + size
        result = content[self._position:end]
        self._position += len(result)
        return result

    def readline(self, size=-1):
        if not self.readable():
            raise UnsupportedOperation("not readable")
        size = -1 if size is None else index(size)
        content = self._content()
        end = content.find("\n", self._position)
        end = len(content) if end < 0 else end + 1
        if size >= 0:
            end = min(end, self._position + size)
        return self.read(max(0, end - self._position))

    def readlines(self, hint=-1):
        hint = index(hint)
        lines = []
        total = 0
        for line in self:
            lines.append(line)
            total += len(line)
            if hint > 0 and total > hint:
                break
        return lines

    def write(self, text):
        if not self.writable():
            raise UnsupportedOperation("not writable")
        if not isinstance(text, str):
            raise TypeError("write() argument must be str")
        content = self._content()
        if self._action == "a":
            self._position = len(content)
        if text:
            content = content.ljust(self._position, "\x00")
            end = self._position + len(text)
            self._fs.set_content(self.name, content[:self._position] + text + content[end:])
            self._position = end
        return len(text)

    def writelines(self, lines):
        if not self.writable():
            raise UnsupportedOperation("not writable")
        for line in lines:
            self.write(line)

    def tell(self):
        self._check_closed()
        return self._position

    def seek(self, offset, whence=0):
        self._check_closed()
        offset, whence = index(offset), index(whence)
        if whence not in (0, 1, 2):
            raise ValueError("whence must be 0, 1 or 2")
        base = (0, self._position, len(self._content()))[whence]
        position = base + offset
        if position < 0:
            raise ValueError("negative seek position")
        self._position = position
        return position

    def flush(self):
        self._check_closed()

    def close(self):
        # Writes are already synchronized; closing a reader never rewrites data.
        self.closed = True

    def __iter__(self):
        self._check_closed()
        return self

    def __next__(self):
        line = self.readline()
        if line == "":
            raise StopIteration
        return line

    def __enter__(self):
        self._check_closed()
        return self

    def __exit__(self, *args):
        self.close()
        return False
