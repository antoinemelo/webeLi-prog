"""Execute one student program; the browser runs this module in a Worker."""

import builtins
import sys
import traceback
from virtual_files import VirtualFileSystem


class OutputStream:
    encoding = "utf-8"

    def __init__(self, write):
        self._write = write

    def write(self, text):
        self._write(str(text))
        return len(text)

    def flush(self):
        pass


def execute(code, files, output, on_change, on_read=None, prompt=None):
    stream = OutputStream(output)
    old_stdout, old_stderr = sys.stdout, sys.stderr
    old_open, old_input, old_exit = builtins.open, builtins.input, sys.exit
    filesystem = VirtualFileSystem(files, on_change, on_read)
    error_line = None
    try:
        sys.stdout = sys.stderr = stream
        builtins.open = filesystem.open
        if prompt is not None:
            def input_text(message=""):
                value = prompt(str(message))
                if value is None:
                    raise EOFError("Saisie annulée")
                return str(value)
            builtins.input = input_text

        def exit_script(code=None):
            raise SystemExit(code)
        sys.exit = exit_script
        exec(compile(code, "<atelier>", "exec"), {"__name__": "__main__"})
    except SystemExit as exc:
        exit_code = getattr(exc, "code", exc.args[0] if exc.args else None)
        if exit_code is not None:
            output(str(exit_code) + "\n")
    except Exception as exc:
        frames = traceback.extract_tb(exc.__traceback__)
        student_frames = [frame for frame in frames if frame.filename == "<atelier>"]
        error_line = getattr(exc, "lineno", None)
        if student_frames:
            error_line = student_frames[-1].lineno
        header = "Erreur de syntaxe" if isinstance(exc, SyntaxError) else "Erreur"
        if error_line:
            header += f" :: à la ligne {error_line}"
        output(header + "\n\n" + "".join(traceback.format_exception_only(type(exc), exc)))
    finally:
        filesystem.close_all()
        builtins.open, builtins.input, sys.exit = old_open, old_input, old_exit
        sys.stdout, sys.stderr = old_stdout, old_stderr
    return error_line
