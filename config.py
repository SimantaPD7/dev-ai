import os
import warnings
from dotenv import load_dotenv

load_dotenv()

# Check critical envs
if not os.getenv("OPENAI_API_KEY"):
    raise RuntimeError("❌ OPENAI_API_KEY is missing in .env")

if not os.getenv("SECRET_KEY"):
    warnings.warn(
        "⚠️ SECRET_KEY not set — using temporary key",
        stacklevel=2
    )

class Config:
    # Security
    SECRET_KEY = os.getenv("SECRET_KEY") or os.urandom(24)

    # OpenAI / OpenRouter
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    MAX_TOKENS = int(os.getenv("MAX_TOKENS", 1024))
    TEMPERATURE = float(os.getenv("TEMPERATURE", 0.7))

    # System Prompt
    SYSTEM_PROMPT = os.getenv(
        "SYSTEM_PROMPT",
        "You are Dev, a helpful, concise, and friendly AI assistant."
    )

    # App
    DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    MAX_HISTORY = int(os.getenv("MAX_HISTORY", 20))