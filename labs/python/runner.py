"""Turtle renderer on the page; student programs execute only in a Worker."""

from browser import document, window
import json
import sys

objects = {}
next_reference = 1


def reset_turtle():
    global next_reference
    objects.clear()
    next_reference = 1


def encode(value):
    global next_reference
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, tuple):
        return {"tuple": [encode(item) for item in value]}
    if isinstance(value, list):
        return [encode(item) for item in value]
    if isinstance(value, dict):
        return {key: encode(item) for key, item in value.items()}
    for reference, existing in objects.items():
        if existing is value:
            return {"ref": reference}
    reference = next_reference
    next_reference += 1
    objects[reference] = value
    return {"ref": reference}


def decode(value):
    if isinstance(value, dict):
        if "ref" in value:
            return objects[value["ref"]]
        if "tuple" in value:
            return tuple(decode(item) for item in value["tuple"])
        return {key: decode(item) for key, item in value.items()}
    if isinstance(value, list):
        return [decode(item) for item in value]
    return value


def turtle_request(raw):
    try:
        request = json.loads(raw)
        if not objects:
            document["turtlediv"].clear()
            if "turtle" in sys.modules:
                del sys.modules["turtle"]
            import turtle
            turtle.set_defaults(turtle_canvas_wrapper=document["turtlediv"])
            objects[0] = turtle
        if request["action"] == "names":
            value = [name for name in dir(objects[0]) if not name.startswith("_")]
        else:
            target = objects[request["ref"]]
            attribute = getattr(target, request["name"])
            if request["action"] == "get":
                value = {"callable": True} if callable(attribute) else encode(attribute)
            else:
                value = encode(attribute(*decode(request["args"]), **decode(request["kwargs"])))
        return json.dumps({"value": value})
    except Exception as exc:
        return json.dumps({"error": {"type": type(exc).__name__, "message": str(exc)}})


window.pythonTurtleRequest = turtle_request
window.pythonTurtleReset = reset_turtle
document["run"].disabled = False
