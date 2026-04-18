"""
routes/command_routes.py — API endpoints for the command system.
"""

from flask import Blueprint, request, jsonify
from services.command_service import execute_command, COMMANDS

command_bp = Blueprint("commands", __name__)


@command_bp.route("/command", methods=["POST"])
def run_command():
    """
    POST /api/command
    Body: { "command": "/open youtube" }
    Returns: { "success": true, "message": "Opening YouTube..." }
    """
    data = request.get_json(silent=True)
    if not data or not data.get("command", "").strip():
        return jsonify({"error": "command field is required"}), 400

    result = execute_command(data["command"])
    status = 200 if result["success"] else 400
    return jsonify(result), status


@command_bp.route("/commands", methods=["GET"])
def list_commands():
    """
    GET /api/commands
    Returns all registered commands and their descriptions.
    """
    commands = {
        name: meta["description"]
        for name, meta in COMMANDS.items()
    }
    return jsonify({"commands": commands})