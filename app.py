import os
from datetime import datetime, timezone
from urllib.parse import urlencode
from flask import Flask, jsonify, redirect, render_template, request, abort

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32))

SEARCH_ENGINES = {
    "google": "https://www.google.com/search",
    "bing": "https://www.bing.com/search",
    "duckduckgo": "https://duckduckgo.com/",
    "brave": "https://search.brave.com/search",
}

@app.get("/")
def home():
    return render_template("index.html")

@app.get("/health")
def health():
    return jsonify(status="ok", app="NEXUS BROWSER", timestamp=datetime.now(timezone.utc).isoformat())

@app.get("/search")
def search():
    query = request.args.get("q", "").strip()
    engine = request.args.get("engine", "google").lower()
    if not query or len(query) > 500:
        abort(400, description="Digite uma pesquisa válida.")
    if engine not in SEARCH_ENGINES:
        engine = "google"
    return redirect(SEARCH_ENGINES[engine] + "?" + urlencode({"q": query}), code=302)

@app.get("/api/config")
def config():
    return jsonify(app="NEXUS BROWSER", search_engines=list(SEARCH_ENGINES.keys()), browser_engine="engine do navegador do dispositivo")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
