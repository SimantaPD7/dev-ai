"""
config.py — Centralized configuration.
All settings live here. Reads secrets from the .env file via python-dotenv.
"""

import os
import warnings
from dotenv import load_dotenv

# Load variables from .env into the environment
load_dotenv()

# Warn loudly if the secret key is still the placeholder
if not os.getenv("SECRET_KEY"):
    warnings.warn(
        "⚠️  SECRET_KEY not set in .env — sessions will break in production!",
        stacklevel=2
    )

class Config:
    # ─── Security ──────────────────────────────────────────────
    SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")

    # ─── OpenAI ────────────────────────────────────────────────
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")          # Required
    OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    MAX_TOKENS     = int(os.getenv("MAX_TOKENS", 1024))
    TEMPERATURE    = float(os.getenv("TEMPERATURE", 0.7))

    # ─── System prompt (personality of your assistant) ─────────
    SYSTEM_PROMPT = os.getenv(
        "SYSTEM_PROMPT",
        "You are Dev, a helpful, concise, and friendly AI assistant. "
        "Answer clearly and avoid unnecessary filler. "
        "If asked to run a command, reply with the command keyword only."
    )

    # ─── App ───────────────────────────────────────────────────
    DEBUG = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    MAX_HISTORY = int(os.getenv("MAX_HISTORY", 20))  # messages to keep in memory