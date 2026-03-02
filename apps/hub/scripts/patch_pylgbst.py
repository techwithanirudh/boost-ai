"""
Patch pylgbst's cbleak.py to survive multi-port feedback messages.

The LEGO Boost hub sends combined A+B motor feedback as a "multi-port" BLE
notification. pylgbst's _processing thread calls self._handler() which hits an
unhandled AssertionError in messages.py ("TODO: implement multi-port feedback
message"), crashing the thread and breaking all subsequent motor commands.

This patch wraps the handler call in a try/except so the thread keeps running.
Run after every `poetry install`.
"""

import subprocess
import sys
from pathlib import Path

OLD = "                self._handler(msg[0], bytes(msg[1]))\n"
NEW = (
    "                try:\n"
    "                    self._handler(msg[0], bytes(msg[1]))\n"
    "                except AssertionError as _e:\n"
    "                    logging.debug(\"Ignoring unhandled hub message: %s\", _e)\n"
)


def find_cbleak() -> Path:
    result = subprocess.run(
        [sys.executable, "-c",
         "import pylgbst.comms.cbleak as m; print(m.__file__)"],
        capture_output=True, text=True, check=True,
    )
    return Path(result.stdout.strip())


def main() -> None:
    target = find_cbleak()
    text = target.read_text()

    if NEW.strip() in text:
        print(f"Already patched: {target}")
        return

    if OLD not in text:
        print(f"ERROR: expected line not found in {target}")
        print("The pylgbst version may have changed — review manually.")
        sys.exit(1)

    target.write_text(text.replace(OLD, NEW))
    print(f"Patched: {target}")


if __name__ == "__main__":
    main()
