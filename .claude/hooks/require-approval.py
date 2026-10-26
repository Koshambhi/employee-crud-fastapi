"""PreToolUse hook (Bash): mechanically enforce the SDLC approval gates.

Blocks (exit code 2, reason on stderr):
  - git merge                      always (merging is a human action)
  - git commit on main/master      always
  - git push                       unless .claude/state/push.approved exists
  - gh pr create                   unless .claude/state/pr.approved exists

The orchestrator creates a marker file only after the user explicitly approves
the matching gate (G5), and deletes it once the action is done.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

STATE = Path(__file__).resolve().parent.parent / "state"


def current_branch() -> str:
    try:
        out = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True, text=True, timeout=10,
        )
        return out.stdout.strip()
    except Exception:
        return ""


def block(reason: str) -> None:
    print(f"BLOCKED by SDLC approval hook: {reason}", file=sys.stderr)
    sys.exit(2)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return
    cmd = (payload.get("tool_input") or {}).get("command", "")

    if re.search(r"\bgit\s+merge\b", cmd):
        block("git merge is a human action; ask the user to merge.")
    if re.search(r"\bgit\s+commit\b", cmd) and current_branch() in ("main", "master"):
        block("committing directly on main/master is not allowed; use a feature branch.")
    if re.search(r"\bgit\s+push\b", cmd) and not (STATE / "push.approved").exists():
        block("git push needs user approval (gate G5). Ask the user, then create .claude/state/push.approved.")
    if re.search(r"\bgh\s+pr\s+create\b", cmd) and not (STATE / "pr.approved").exists():
        block("gh pr create needs user approval (gate G5). Ask the user, then create .claude/state/pr.approved.")


if __name__ == "__main__":
    main()
