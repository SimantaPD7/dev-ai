"""
services/command_service.py — Parses and executes local commands.

Commands are triggered by typing a slash prefix (e.g. /open youtube).
To add a new command: add an entry to COMMANDS dict below. That's it.
"""

import webbrowser
import subprocess
import platform
from datetime import datetime


# ─── Command Registry ──────────────────────────────────────────────────────────
# Each key is the command slug; value is a dict with:
#   "description" — shown in /help
#   "handler"     — callable that receives the argument string, returns a message

def _open_url(url: str, label: str):
    """Helper: opens a URL in the default browser."""
    def handler(_args: str) -> str:
        webbrowser.open(url)
        return f"✅ Opening {label} in your browser..."
    return handler


def _search_web(args: str) -> str:
    """Search Google for the provided query."""
    query = args.strip()
    if not query:
        return "⚠️ Usage: /search <your query>"
    url = f"https://www.google.com/search?q={query.replace(' ', '+')}"
    webbrowser.open(url)
    return f"🔍 Searching Google for: **{query}**"


def _get_time(_args: str) -> str:
    now = datetime.now()
    return f"🕐 Current date & time: **{now.strftime('%A, %B %d %Y  %H:%M:%S')}**"


def _get_help(_args: str) -> str:
    lines = ["**Available commands:**\n"]
    for name, meta in COMMANDS.items():
        lines.append(f"• `/{name}` — {meta['description']}")
    return "\n".join(lines)


def _clear_chat(_args: str) -> str:
    # The frontend listens for this special token and clears the UI
    return "__CLEAR_CHAT__"


def _sysinfo(_args: str) -> str:
    uname = platform.uname()
    return (
        f"💻 **System Info**\n"
        f"OS: {uname.system} {uname.release}\n"
        f"Machine: {uname.machine}\n"
        f"Processor: {uname.processor or 'N/A'}\n"
        f"Node: {uname.node}"
    )


COMMANDS: dict[str, dict] = {
    # ── Websites ───────────────────────────────────────────────
    "youtube":  {"description": "Open YouTube",         "handler": _open_url("https://youtube.com",  "YouTube")},
    "github":   {"description": "Open GitHub",          "handler": _open_url("https://github.com",   "GitHub")},
    "gmail":    {"description": "Open Gmail",           "handler": _open_url("https://mail.google.com", "Gmail")},
    "maps":     {"description": "Open Google Maps",     "handler": _open_url("https://maps.google.com", "Google Maps")},
    "reddit":   {"description": "Open Reddit",          "handler": _open_url("https://reddit.com",   "Reddit")},
    "chatgpt":  {"description": "Open ChatGPT website", "handler": _open_url("https://chat.openai.com", "ChatGPT")},
    # ── Utilities ──────────────────────────────────────────────
    "search":   {"description": "Search the web: /search <query>", "handler": _search_web},
    "time":     {"description": "Show current date & time",        "handler": _get_time},
    "sysinfo":  {"description": "Show system information",         "handler": _sysinfo},
    "clear":    {"description": "Clear the chat window",           "handler": _clear_chat},
    "help":     {"description": "List all available commands",     "handler": _get_help},
}
# ───────────────────────────────────────────────────────────────────────────────


def execute_command(raw: str) -> dict:
    """
    Parse a slash-command string and execute it.

    Args:
        raw: The full user input, e.g. "/search python tutorials"

    Returns:
        {"success": bool, "message": str}
    """
    # Strip the leading slash and split into command + arguments
    parts  = raw.lstrip("/").split(maxsplit=1)
    slug   = parts[0].lower()
    args   = parts[1] if len(parts) > 1 else ""

    if slug not in COMMANDS:
        suggestions = [k for k in COMMANDS if k.startswith(slug[:2])]
        hint = f" Did you mean: {', '.join(suggestions)}?" if suggestions else ""
        return {
            "success": False,
            "message": f"❌ Unknown command `/{slug}`.{hint} Type `/help` to see all commands."
        }

    try:
        result = COMMANDS[slug]["handler"](args)
        return {"success": True, "message": result}
    except Exception as exc:
        return {"success": False, "message": f"❌ Command failed: {exc}"}


def is_command(text: str) -> bool:
    """Returns True if the input looks like a slash command."""
    return text.strip().startswith("/")