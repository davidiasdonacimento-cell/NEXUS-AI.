import os
from datetime import datetime, timezone
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "change-this-in-production")

@app.get("/")
def home():
    return render_template("index.html")

@app.get("/health")
def health():
    return jsonify(status="ok", app="NEXUS AI", timestamp=datetime.now(timezone.utc).isoformat())

@app.post("/api/assistant")
def assistant():
    data = request.get_json(silent=True) or {}
    prompt = str(data.get("prompt", "")).strip()
    if not prompt:
        return jsonify(error="Digite uma solicitação."), 400
    # A provider API is intentionally not called until the owner configures a key.
    return jsonify(
        message="O NEXUS AI está pronto para receber um provedor de IA. Configure GEMINI_API_KEY no ambiente do Render para ativar respostas reais.",
        configured=False
    ), 200

@app.get("/api/config")
def config():
    return jsonify(ai_configured=bool(os.environ.get("GEMINI_API_KEY")))

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
