import unittest
from unittest.mock import patch

from search_service import (
    PROVIDERS,
    ResultLinkParser,
    clean_query,
    is_web_url,
    parse_result_html,
    result_is_safe,
    sanitize_results,
    search,
    unwrap_result_url,
)


class QueryNormalizationTests(unittest.TestCase):
    def test_none_becomes_empty(self):
        self.assertEqual(clean_query(None), "")

    def test_empty_string_stays_empty(self):
        self.assertEqual(clean_query(""), "")

    def test_whitespace_is_trimmed(self):
        self.assertEqual(clean_query("  hello world  "), "hello world")

    def test_repeated_whitespace_is_collapsed(self):
        self.assertEqual(clean_query("hello\n\t world"), "hello world")

    def test_query_is_limited(self):
        self.assertEqual(len(clean_query("x" * 900)), 500)

    def test_number_is_converted(self):
        self.assertEqual(clean_query(12345), "12345")

    def test_unicode_is_preserved(self):
        self.assertEqual(clean_query("pesquisa em português"), "pesquisa em português")

    def test_markup_is_not_interpreted(self):
        self.assertEqual(clean_query("<script>alert(1)</script>"), "<script>alert(1)</script>")


class UrlValidationTests(unittest.TestCase):
    def test_https_is_valid(self):
        self.assertTrue(is_web_url("https://example.com"))

    def test_http_is_valid(self):
        self.assertTrue(is_web_url("http://example.com/path"))

    def test_javascript_is_invalid(self):
        self.assertFalse(is_web_url("javascript:alert(1)"))

    def test_data_is_invalid(self):
        self.assertFalse(is_web_url("data:text/html,hello"))

    def test_file_is_invalid(self):
        self.assertFalse(is_web_url("file:///etc/passwd"))

    def test_missing_host_is_invalid(self):
        self.assertFalse(is_web_url("https:///missing-host"))

    def test_relative_url_is_invalid(self):
        self.assertFalse(is_web_url("/relative/path"))

    def test_non_string_is_invalid(self):
        self.assertFalse(is_web_url(None))

    def test_overlong_url_is_invalid(self):
        self.assertFalse(is_web_url("https://example.com/" + "x" * 3000))

    def test_malformed_bracket_is_invalid(self):
        self.assertFalse(is_web_url("https://[broken"))


class RedirectUnwrappingTests(unittest.TestCase):
    def test_protocol_relative_url_is_https(self):
        self.assertEqual(unwrap_result_url("//example.com/a"), "https://example.com/a")

    def test_normal_https_url_is_preserved(self):
        self.assertEqual(unwrap_result_url("https://example.com/a"), "https://example.com/a")

    def test_normal_http_url_is_preserved(self):
        self.assertEqual(unwrap_result_url("http://example.com/a"), "http://example.com/a")

    def test_javascript_redirect_is_rejected(self):
        self.assertEqual(unwrap_result_url("javascript:alert(1)"), "")

    def test_empty_url_is_rejected(self):
        self.assertEqual(unwrap_result_url(""), "")


class HtmlParserTests(unittest.TestCase):
    def test_duckduckgo_result_class(self):
        html = '<a class="result__a" href="https://example.com/a">Example title</a>'
        results = parse_result_html(html)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["title"], "Example title")
        self.assertEqual(results[0]["url"], "https://example.com/a")

    def test_generic_anchor_is_supported(self):
        html = '<h2><a href="https://example.org/">Example Org</a></h2>'
        self.assertEqual(len(parse_result_html(html)), 1)

    def test_nested_markup_inside_anchor(self):
        html = '<a href="https://example.com"><span>Nested</span> <b>Title</b></a>'
        self.assertEqual(parse_result_html(html)[0]["title"], "Nested Title")

    def test_entities_are_decoded(self):
        html = '<a href="https://example.com">Tom &amp; Jerry</a>'
        self.assertEqual(parse_result_html(html)[0]["title"], "Tom & Jerry")

    def test_duckduckgo_redirect_is_unwrapped(self):
        html = '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fx">Example</a>'
        self.assertEqual(parse_result_html(html)[0]["url"], "https://example.com/x")

    def test_search_engine_homepage_is_filtered(self):
        html = '<a href="https://duckduckgo.com/about">About</a>'
        self.assertEqual(parse_result_html(html), [])

    def test_empty_anchor_is_filtered(self):
        html = '<a href="https://example.com"></a>'
        self.assertEqual(parse_result_html(html), [])

    def test_non_http_link_is_filtered(self):
        html = '<a href="javascript:alert(1)">Bad link</a>'
        self.assertEqual(parse_result_html(html), [])

    def test_duplicate_urls_are_removed(self):
        html = (
            '<a href="https://example.com">First title</a>'
            '<a href="https://example.com">Second title</a>'
        )
        results = parse_result_html(html)
        self.assertEqual(len(results), 1)

    def test_script_content_is_not_collected(self):
        html = '<script><a href="https://bad.example">Injected</a></script>'
        self.assertEqual(parse_result_html(html), [])

    def test_style_content_is_not_collected(self):
        html = '<style><a href="https://bad.example">Hidden</a></style>'
        self.assertEqual(parse_result_html(html), [])

    def test_anchor_with_nested_elements_closes(self):
        html = '<a href="https://example.com"><span><b>Nested title</b></span></a>'
        self.assertEqual(len(parse_result_html(html)), 1)

    def test_title_is_trimmed(self):
        html = '<a href="https://example.com">  Example   title </a>'
        self.assertEqual(parse_result_html(html)[0]["title"], "Example title")

    def test_title_is_limited(self):
        html = '<a href="https://example.com">' + ("A" * 500) + "</a>"
        self.assertLessEqual(len(parse_result_html(html)[0]["title"]), 240)

    def test_parser_can_be_reused_for_multiple_links(self):
        html = (
            '<a href="https://one.example">One result</a>'
            '<a href="https://two.example">Two result</a>'
        )
        self.assertEqual(len(parse_result_html(html)), 2)

    def test_preferred_result_links_are_prioritized(self):
        html = (
            '<a href="https://generic.example">Generic result</a>'
            '<a class="result__a" href="https://preferred.example">Preferred result</a>'
        )
        results = parse_result_html(html)
        self.assertEqual(results[0]["url"], "https://preferred.example")

    def test_broken_markup_does_not_crash(self):
        parser = ResultLinkParser()
        parser.feed('<a href="https://example.com">Unclosed title')
        parser.close()
        self.assertIsInstance(parser.results(), list)


class SanitizationTests(unittest.TestCase):
    def test_safe_result_is_accepted(self):
        self.assertTrue(result_is_safe({
            "title": "Example",
            "url": "https://example.com",
        }))

    def test_missing_title_is_rejected(self):
        self.assertFalse(result_is_safe({"url": "https://example.com"}))

    def test_missing_url_is_rejected(self):
        self.assertFalse(result_is_safe({"title": "Example"}))

    def test_unsafe_url_is_rejected(self):
        self.assertFalse(result_is_safe({
            "title": "Bad",
            "url": "javascript:alert(1)",
        }))

    def test_non_dict_is_rejected(self):
        self.assertFalse(result_is_safe("https://example.com"))

    def test_sanitizer_limits_result_count(self):
        data = [
            {"title": "Result " + str(i), "url": "https://example.com/" + str(i)}
            for i in range(40)
        ]
        self.assertEqual(len(sanitize_results(data)), 15)

    def test_sanitizer_limits_title_length(self):
        data = [{"title": "T" * 400, "url": "https://example.com"}]
        self.assertEqual(len(sanitize_results(data)[0]["title"]), 240)

    def test_sanitizer_limits_snippet_length(self):
        data = [{
            "title": "Example",
            "url": "https://example.com",
            "snippet": "S" * 800,
        }]
        self.assertEqual(len(sanitize_results(data)[0]["snippet"]), 500)

    def test_sanitizer_skips_invalid_entries(self):
        data = [
            None,
            {"title": "Unsafe", "url": "javascript:alert(1)"},
            {"title": "Good", "url": "https://example.com"},
        ]
        self.assertEqual(len(sanitize_results(data)), 1)


class ProviderFallbackTests(unittest.TestCase):
    def test_empty_query_does_not_call_provider(self):
        with patch("search_service._fetch") as fetch:
            result = search("   ")
            fetch.assert_not_called()
        self.assertEqual(result["results"], [])
        self.assertIsNotNone(result["error"])

    def test_first_provider_success_stops_fallback(self):
        body = '<a class="result__a" href="https://example.com">Example</a>'
        with patch("search_service._fetch", return_value=(body, "DuckDuckGo")) as fetch:
            result = search("example")
        self.assertEqual(result["provider"], "DuckDuckGo")
        self.assertEqual(len(result["results"]), 1)
        fetch.assert_called_once()

    def test_empty_first_provider_uses_second(self):
        good = '<a href="https://example.org">Example Org</a>'
        with patch("search_service._fetch", side_effect=[("", "DuckDuckGo"), (good, "DuckDuckGo Lite")]):
            result = search("example")
        self.assertEqual(result["provider"], "DuckDuckGo Lite")
        self.assertEqual(len(result["attempts"]), 2)

    def test_provider_error_uses_next_provider(self):
        good = '<a href="https://example.org">Example Org</a>'
        with patch("search_service._fetch", side_effect=[TimeoutError("timeout"), (good, "DuckDuckGo Lite")]):
            result = search("example")
        self.assertEqual(result["provider"], "DuckDuckGo Lite")

    def test_all_provider_failures_return_diagnostics(self):
        with patch("search_service._fetch", side_effect=TimeoutError("timeout")):
            result = search("example")
        self.assertEqual(result["results"], [])
        self.assertEqual(len(result["attempts"]), len(PROVIDERS))
        self.assertTrue(all(item["status"] == "error" for item in result["attempts"]))

    def test_all_empty_providers_return_empty_status(self):
        with patch("search_service._fetch", return_value=("", "Provider")):
            result = search("example")
        self.assertEqual(result["results"], [])
        self.assertTrue(all(item["status"] == "empty" for item in result["attempts"]))

    def test_success_response_includes_elapsed_time(self):
        body = '<a href="https://example.org">Example Org</a>'
        with patch("search_service._fetch", return_value=(body, "Provider")):
            result = search("example")
        self.assertGreaterEqual(result["elapsed_ms"], 0)

    def test_provider_order_is_explicit(self):
        self.assertEqual(PROVIDERS[0].name, "DuckDuckGo")
        self.assertEqual(PROVIDERS[1].name, "DuckDuckGo Lite")
        self.assertEqual(PROVIDERS[2].name, "Bing")


if __name__ == "__main__":
    unittest.main()
