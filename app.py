import os
import re
import json
import logging
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import quote_plus, urlparse, parse_qs, unquote
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from search_service import search as run_search, clean_query
from flask import Flask, jsonify, render_template, request, abort, make_response

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", os.urandom(32))
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
log = logging.getLogger("nexus")

SEARCH_ENGINES = {
    "duckduckgo": "DuckDuckGo",
    "google": "Google",
    "bing": "Bing",
    "brave": "Brave",
}
MAX_QUERY_LENGTH = 500
MAX_URL_LENGTH = 2048
SEARCH_TIMEOUT = 9
USER_AGENT = "Mozilla/5.0 (compatible; NexusBrowser/2.0; +https://nexus-ai-whvc.onrender.com)"


def valid_http_url(value):
    if not isinstance(value, str) or len(value) > MAX_URL_LENGTH:
        return False
    try:
        parsed = urlparse(value)
        return parsed.scheme in ("http", "https") and bool(parsed.netloc)
    except ValueError:
        return False


def normalize_query(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:MAX_QUERY_LENGTH]


class SearchResultParser(HTMLParser):
    """Small parser for DuckDuckGo HTML results; no third-party parser required."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.results = []
        self.current = None
        self.capture = None
        self.buffer = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = attrs.get("class", "").split()
        if tag == "a" and ("result__a" in classes or "result-link" in classes):
            self.current = {"title": "", "url": attrs.get("href", ""), "snippet": ""}
            self.capture = "title"
            self.buffer = []
        elif tag in ("a", "div", "td") and self.current and (
            "result__snippet" in classes or "result-snippet" in classes
        ):
            self.capture = "snippet"
            self.buffer = []

    def handle_data(self, data):
        if self.capture:
            self.buffer.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.capture == "title" and self.current:
            self.current["title"] = " ".join("".join(self.buffer).split())
            self.capture = None
            self.buffer = []
            self._finish_if_ready()
        elif tag in ("a", "div", "td") and self.capture == "snippet" and self.current:
            self.current["snippet"] = " ".join("".join(self.buffer).split())
            self.capture = None
            self.buffer = []
            self._finish_if_ready()

    def _finish_if_ready(self):
        if self.current and self.current.get("title") and self.current.get("url"):
            url = self.current["url"]
            if url.startswith("//"):
                url = "https:" + url
            if "duckduckgo.com/l/?" in url:
                target = parse_qs(urlparse(url).query).get("uddg", [""])[0]
                url = unquote(target)
            if valid_http_url(url):
                self.current["url"] = url
                if self.current not in self.results:
                    self.results.append(self.current)
            self.current = None
            self.capture = None
            self.buffer = []


def search_web(query):
    query = normalize_query(query)
    if not query:
        return []
    endpoint = "https://html.duckduckgo.com/html/?q=" + quote_plus(query)
    req = Request(endpoint, headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
    })
    with urlopen(req, timeout=SEARCH_TIMEOUT) as response:
        body = response.read(1_500_000).decode("utf-8", errors="replace")
    parser = SearchResultParser()
    parser.feed(body)
    return parser.results[:12]


@app.after_request
def security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.get("/")
def home():
    response = make_response(render_template("index.html"))
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.get("/health")
def health():
    return jsonify(
        status="ok",
        app="NEXUS BROWSER",
        version="2.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/api/config")
def config():
    return jsonify(
        app="NEXUS BROWSER",
        version="2.0",
        search_engines=SEARCH_ENGINES,
        default_engine="duckduckgo",
        features=[
            "multi-tabs", "private-tabs", "bookmarks", "history",
            "internal-search", "themes", "keyboard-shortcuts", "pwa",
        ],
        browser_engine="motor do navegador do dispositivo",
        server_chromium=False,
    )


@app.get("/api/search")
def api_search():
    query = clean_query(request.args.get("q", ""))
    if not query:
        return jsonify(
            query="",
            provider=None,
            results=[],
            error="Digite algo para pesquisar.",
            attempts=[],
        ), 400
    result = run_search(query)
    status_code = 200 if result.get("results") else 503
    return jsonify(result), status_code


@app.get("/api/resolve")
def resolve():
    value = str(request.args.get("url", "")).strip()
    if not valid_http_url(value):
        return jsonify(error="Endereço inválido."), 400
    parsed = urlparse(value)
    return jsonify(url=value, host=parsed.netloc, secure=parsed.scheme == "https")


@app.errorhandler(400)
def bad_request(error):
    return jsonify(error=getattr(error, "description", "Requisição inválida.")), 400


@app.errorhandler(404)
def not_found(error):
    if request.path.startswith("/api/"):
        return jsonify(error="Recurso não encontrado."), 404
    return "Página não encontrada", 404


@app.errorhandler(413)
def too_large(error):
    return jsonify(error="A solicitação excedeu o limite permitido."), 413


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
