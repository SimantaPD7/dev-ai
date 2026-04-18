"""
routes/chat_routes.py — API endpoints for the chat feature.

Blueprint pattern keeps routes modular — each feature gets its own file.
"""

from flask import Blueprint, request, jsonify, session, current_app
from services.chat_service import chat_with_ai

chat_bp = Blueprint("chat", __name__)


def _get_history() -> list[dict]:
    """Retrieve the conversation history stored in the server-side session."""
    return session.get("history", [])


def _save_history(history: list[dict]) -> None:
    """
    Persist history back to the session, trimming to MAX_HISTORY entries
    so memory doesn't grow forever.
    """
    max_h = current_app.config["MAX_HISTORY"]
    session["history"] = history[-max_h:]
    session.modified = True   # tell Flask the session changed so it saves it


@chat_bp.route("/chat", methods=["POST"])
def chat():
    """
    POST /api/chat
    Body: { "message": "Hello!" }
    Returns: { "reply": "Hi there!", "history_length": 2 }
    """
    data = request.get_json(silent=True)
    if not data or not data.get("message", "").strip():
        return jsonify({"error": "message field is required"}), 400

    user_message = data["message"].strip()
    history      = _get_history()

    # Append user turn
    history.append({"role": "user", "content": user_message})

    try:
        reply = chat_with_ai(history)
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        current_app.logger.error(f"OpenAI error: {e}")
        return jsonify({"error": "AI service unavailable. Check your API key."}), 503

    # Append assistant turn and save
    history.append({"role": "assistant", "content": reply})
    _save_history(history)

    return jsonify({"reply": reply, "history_length": len(history)})


@chat_bp.route("/history", methods=["GET"])
def get_history():
    """
    GET /api/history
    Returns the current session's conversation history.
    """
    return jsonify({"history": _get_history()})


@chat_bp.route("/clear", methods=["POST"])
def clear_history():
    """
    POST /api/clear
    Wipes the conversation history for the current session.
    """
    session.pop("history", None)
    return jsonify({"message": "Chat history cleared."})