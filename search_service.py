"""NEXUS Browser search aggregation.

The service uses public HTML result pages and extracts ordinary HTTP(S) links.
It deliberately does not proxy the destination pages or execute remote scripts.
"""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote_plus, unquote, urlparse
from urllib.request import Request, urlopen

LOGGER = logging.getLogger("nexus.search")
MAX_QUERY_LENGTH = 500
MAX_RESULTS = 15
MAX_RESPONSE_BYTES = 2_000_000
DEFAULT_TIMEOUT = 8
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 NEXUSBrowser/2.1"
)


@dataclass(frozen=True)
class SearchProvider:
    name: str
    endpoint: str
    parser: str


PROVIDERS = (
    SearchProvider(
        "DuckDuckGo",
        "https://html.duckduckgo.com/html/?q={query}",
        "duckduckgo",
    ),
    SearchProvider(
        "DuckDuckGo Lite",
        "https://lite.duckduckgo.com/lite/?q={query}",
        "generic",
    ),
    SearchProvider(
        "Bing",
        "https://www.bing.com/search?q={query}",
        "generic",
    ),
    SearchProvider(
        "Brave Search",
        "https://search.brave.com/search?q={query}",
        "generic",
    ),
    SearchProvider(
        "Yahoo Search",
        "https://search.yahoo.com/search?p={query}",
        "generic",
    ),
    SearchProvider(
        "Google Search",
        "https://www.google.com/search?q={query}",
        "generic",
    ),
)


def clean_query(value: object) -> str:
    """Normalize a query without interpreting it as an address or HTML."""
    value = re.sub(r"\s+", " ", str(value or "")).strip()
    return value[:MAX_QUERY_LENGTH]


def is_web_url(value: object) -> bool:
    if not isinstance(value, str) or len(value) > 2048:
        return False
    try:
        parsed = urlparse(value)
    except ValueError:
        return False
    return parsed.scheme in ("http", "https") and bool(parsed.hostname)


def unwrap_result_url(value: str) -> str:
    """Unwrap common search-engine redirect URLs."""
    value = value.strip()
    if value.startswith("//"):
        value = "https:" + value
    try:
        parsed = urlparse(value)
    except ValueError:
        return ""
    host = (parsed.hostname or "").lower()
    if host.endswith("duckduckgo.com") and parsed.path.rstrip("/") == "/l":
        target = parse_qs(parsed.query).get("uddg", [""])[0]
        value = unquote(target)
    elif host.endswith("bing.com") and parsed.path.lower().startswith("/ck/a"):
        target = parse_qs(parsed.query).get("u", [""])[0]
        if target.startswith("a1"):
            import base64
            try:
                target = base64.urlsafe_b64decode(target[2:] + "==").decode("utf-8")
            except Exception:
                target = ""
        value = target
    return value if is_web_url(value) else ""


def _ignored_host(host: str) -> bool:
    host = host.lower().split(":")[0]
    blocked = (
        "duckduckgo.com",
        "bing.com",
        "microsoft.com",
        "google.com",
        "googleusercontent.com",
        "facebook.com",
        "twitter.com",
    )
    return any(host == item or host.endswith("." + item) for item in blocked)


class ResultLinkParser(HTMLParser):
    """Extract anchors from search HTML without depending on CSS class names."""

    def __init__(self, mode: str = "generic") -> None:
        super().__init__(convert_charrefs=True)
        self.mode = mode
        self.links: list[dict[str, str]] = []
        self._anchor: dict[str, str] | None = None
        self._anchor_depth = 0
        self._text: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        classes = set((values.get("class") or "").split())
        if tag in ("script", "style", "noscript"):
            self._skip_depth += 1
            return
        if self._skip_depth:
            return
        if tag == "a":
            href = values.get("href") or ""
            if self._anchor is None:
                self._anchor = {"href": href, "class": " ".join(classes)}
                self._anchor_depth = 1
                self._text = []
            else:
                self._anchor_depth += 1
        elif self._anchor is not None:
            self._anchor_depth += 1

    def handle_data(self, data: str) -> None:
        if self._anchor is not None and not self._skip_depth:
            text = " ".join(data.split())
            if text:
                self._text.append(text)

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "noscript") and self._skip_depth:
            self._skip_depth -= 1
            return
        if self._skip_depth or self._anchor is None:
            return
        if tag == "a":
            self._anchor_depth -= 1
            if self._anchor_depth <= 0:
                self._finish_anchor()
        elif self._anchor_depth > 1:
            self._anchor_depth -= 1

    def _finish_anchor(self) -> None:
        anchor = self._anchor or {}
        title = re.sub(r"\s+", " ", " ".join(self._text)).strip()
        url = unwrap_result_url(anchor.get("href", ""))
        host = urlparse(url).hostname or "" if url else ""
        classes = set(anchor.get("class", "").split())
        preferred = bool(classes.intersection({
            "result__a", "result-link", "b_title", "tilk", "result-title"
        }))
        if (
            url
            and title
            and len(title) > 2
            and not _ignored_host(host)
            and not title.lower().startswith(("cached", "translate", "feedback"))
        ):
            self.links.append({
                "title": title[:240],
                "url": url,
                "snippet": "",
                "_preferred": "1" if preferred else "0",
            })
        self._anchor = None
        self._anchor_depth = 0
        self._text = []

    def results(self, limit: int = MAX_RESULTS) -> list[dict[str, str]]:
        unique: dict[str, dict[str, str]] = {}
        for item in self.links:
            url = item["url"]
            if url not in unique:
                unique[url] = item
        values = list(unique.values())
        values.sort(key=lambda item: item.get("_preferred") != "1")
        return [
            {key: value for key, value in item.items() if not key.startswith("_")}
            for item in values[:limit]
        ]


def parse_result_html(body: str, mode: str = "generic") -> list[dict[str, str]]:
    parser = ResultLinkParser(mode=mode)
    parser.feed(body)
    parser.close()
    return parser.results()


def _fetch(provider: SearchProvider, query: str, timeout: int) -> tuple[str, str]:
    endpoint = provider.endpoint.format(query=quote_plus(query))
    request = Request(
        endpoint,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "DNT": "1",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        content_type = response.headers.get("Content-Type", "")
        if "text/html" not in content_type and "application/xhtml" not in content_type:
            raise ValueError("O provedor não retornou HTML.")
        raw = response.read(MAX_RESPONSE_BYTES)
    return raw.decode("utf-8", errors="replace"), provider.name


def search(query: object, timeout: int = DEFAULT_TIMEOUT) -> dict:
    """Try providers in order and return structured results plus diagnostics."""
    normalized = clean_query(query)
    if not normalized:
        return {
            "query": "",
            "provider": None,
            "results": [],
            "error": "Digite algo para pesquisar.",
            "attempts": [],
        }

    attempts: list[dict[str, str]] = []
    started = time.monotonic()
    for provider in PROVIDERS:
        try:
            body, provider_name = _fetch(provider, normalized, timeout)
            results = parse_result_html(body, provider.parser)
            attempts.append({
                "provider": provider_name,
                "status": "results" if results else "empty",
            })
            if results:
                elapsed = round((time.monotonic() - started) * 1000)
                LOGGER.info(
                    "Search success provider=%s count=%d elapsed_ms=%d",
                    provider_name, len(results), elapsed,
                )
                return {
                    "query": normalized,
                    "provider": provider_name,
                    "results": results,
                    "error": None,
                    "attempts": attempts,
                    "elapsed_ms": elapsed,
                }
            LOGGER.info("Search provider returned no links: %s", provider_name)
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
            LOGGER.warning("Search provider failed (%s): %s", provider.name, exc)
            attempts.append({
                "provider": provider.name,
                "status": "error",
                "message": str(exc)[:160],
            })

    return {
        "query": normalized,
        "provider": None,
        "results": [],
        "error": "Os buscadores não retornaram resultados agora. Tente novamente em instantes.",
        "attempts": attempts,
        "elapsed_ms": round((time.monotonic() - started) * 1000),
    }


def result_is_safe(item: object) -> bool:
    if not isinstance(item, dict):
        return False
    return (
        isinstance(item.get("title"), str)
        and isinstance(item.get("url"), str)
        and is_web_url(item["url"])
    )


def sanitize_results(items: Iterable[object]) -> list[dict[str, str]]:
    cleaned = []
    for item in items:
        if not result_is_safe(item):
            continue
        cleaned.append({
            "title": item["title"][:240],
            "url": item["url"][:2048],
            "snippet": str(item.get("snippet") or "")[:500],
        })
        if len(cleaned) >= MAX_RESULTS:
            break
    return cleaned
