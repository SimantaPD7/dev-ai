"""
app.py — Main entry point for the AI Assistant Flask app.
Run this file to start the server: python app.py
"""

from flask import Flask
from routes.chat_routes import chat_bp
from routes.command_routes import command_bp
from config import Config

def create_app():
    """
    Application factory pattern — creates and configures the Flask app.
    This pattern makes the app easier to test and scale later.
    """
    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.config.from_object(Config)

    # Register blueprints (modular route groups)
    app.register_blueprint(chat_bp,    url_prefix="/api")
    app.register_blueprint(command_bp, url_prefix="/api")

    # Serve the frontend
    from flask import render_template
    @app.route("/")
    def index():
        return render_template("index.html")

    return app


if __name__ == "__main__":
    app = create_app()
    print("🤖 Dev (AI Assistant) running at http://localhost:5000")
    app.run(debug=True, port=5000)