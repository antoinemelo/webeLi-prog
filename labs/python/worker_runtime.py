"""Bridge Python in the Worker to the page's live files, input and Turtle."""

from browser import self
import builtins
import json
import sys
from types import ModuleType
from execution import execute


def request(kind, data):
    response = json.loads(self.workshopRequest(kind, json.dumps(data)))
    if "error" in response:
        error = response["error"]
        exception = getattr(builtins, error.get("type", "RuntimeError"), RuntimeError)
        raise exception(error["message"])
    return response.get("value")


def encode(value):
    if isinstance(value, RemoteTurtle):
        return {"ref": value._reference}
    if isinstance(value, tuple):
        return {"tuple": [encode(item) for item in value]}
    if isinstance(value, list):
        return [encode(item) for item in value]
    if isinstance(value, dict):
        return {key: encode(item) for key, item in value.items()}
    return value


def decode(value):
    if isinstance(value, dict):
        if "ref" in value:
            return RemoteTurtle(value["ref"])
        if "tuple" in value:
            return tuple(decode(item) for item in value["tuple"])
        return {key: decode(item) for key, item in value.items()}
    if isinstance(value, list):
        return [decode(item) for item in value]
    return value


def turtle_attribute(reference, name):
    response = request("turtle", {"action": "get", "ref": reference, "name": name})
    if isinstance(response, dict) and response.get("callable"):
        def call(*args, **kwargs):
            return decode(request("turtle", {"action": "call", "ref": reference,
                "name": name, "args": encode(args), "kwargs": encode(kwargs)}))
        return call
    return decode(response)


class RemoteTurtle:
    def __init__(self, reference):
        self._reference = reference

    def __getattr__(self, name):
        return turtle_attribute(self._reference, name)


def turtle_getattr(name):
    if name == "__all__":
        return request("turtle", {"action": "names"})
    if name.startswith("__"):
        raise AttributeError(name)
    return turtle_attribute(0, name)


def run(code, files):
    # Each run gets fresh program globals, handles and Turtle references.
    turtle_module = ModuleType("turtle")
    turtle_module.__getattr__ = turtle_getattr
    sys.modules["turtle"] = turtle_module
    line = execute(
        code,
        json.loads(files),
        self.workshopOutput,
        lambda name, content: request("file_write", {"name": name, "content": content}),
        lambda name: request("file_read", {"name": name}),
        lambda message: request("input", {"message": message}),
    )
    self.workshopFinished(line)


self.workshopRun = run
self.workshopReady()
