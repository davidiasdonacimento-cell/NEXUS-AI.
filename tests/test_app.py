import unittest
from unittest.mock import patch

import app as nexus_app


class NexusApplicationTests(unittest.TestCase):
    def setUp(self):
        nexus_app.app.config.update(TESTING=True)
        self.client = nexus_app.app.test_client()

    def test_home_page_returns_success(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"NEXUS", response.data)

    def test_home_page_has_no_cache_header(self):
        response = self.client.get("/")
        self.assertIn("no-cache", response.headers.get("Cache-Control", ""))

    def test_health_endpoint_is_json(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "ok")

    def test_health_identifies_application(self):
        response = self.client.get("/health")
        self.assertEqual(response.get_json()["app"], "NEXUS BROWSER")

    def test_config_lists_browser_features(self):
        response = self.client.get("/api/config")
        data = response.get_json()
        self.assertIn("multi-tabs", data["features"])
        self.assertIn("private-tabs", data["features"])
        self.assertIn("internal-search", data["features"])

    def test_config_does_not_claim_server_chromium(self):
        response = self.client.get("/api/config")
        self.assertFalse(response.get_json()["server_chromium"])

    def test_search_requires_query(self):
        response = self.client.get("/api/search")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["results"], [])

    def test_search_rejects_whitespace_query(self):
        response = self.client.get("/api/search?q=%20%20%20")
        self.assertEqual(response.status_code, 400)

    @patch("app.run_search")
    def test_search_returns_integrated_results(self, mocked):
        mocked.return_value = {
            "query": "example",
            "provider": "Test Search",
            "results": [{
                "title": "Example Domain",
                "url": "https://example.com",
                "snippet": "Example result",
            }],
            "attempts": [{"provider": "Test Search", "status": "results"}],
            "error": None,
        }
        response = self.client.get("/api/search?q=example")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["provider"], "Test Search")
        self.assertEqual(data["results"][0]["url"], "https://example.com")

    @patch("app.run_search")
    def test_search_returns_service_unavailable_when_all_providers_fail(self, mocked):
        mocked.return_value = {
            "query": "example",
            "provider": None,
            "results": [],
            "error": "Temporariamente indisponível",
            "attempts": [
                {"provider": "A", "status": "error"},
                {"provider": "B", "status": "empty"},
            ],
        }
        response = self.client.get("/api/search?q=example")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(len(response.get_json()["attempts"]), 2)

    @patch("app.run_search")
    def test_search_normalizes_query_before_call(self, mocked):
        mocked.return_value = {
            "query": "hello world",
            "provider": "Test",
            "results": [{"title": "Hello", "url": "https://example.com"}],
            "attempts": [],
        }
        self.client.get("/api/search?q=hello%20%20%20world")
        mocked.assert_called_once_with("hello world")

    def test_resolve_accepts_https(self):
        response = self.client.get("/api/resolve?url=https%3A%2F%2Fexample.com")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["secure"])

    def test_resolve_accepts_http(self):
        response = self.client.get("/api/resolve?url=http%3A%2F%2Fexample.com")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.get_json()["secure"])

    def test_resolve_rejects_javascript(self):
        response = self.client.get("/api/resolve?url=javascript%3Aalert(1)")
        self.assertEqual(response.status_code, 400)

    def test_resolve_rejects_file_protocol(self):
        response = self.client.get("/api/resolve?url=file%3A%2F%2F%2Fetc%2Fpasswd")
        self.assertEqual(response.status_code, 400)

    def test_security_headers_are_present(self):
        response = self.client.get("/health")
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response.headers["Referrer-Policy"], "strict-origin-when-cross-origin")

    def test_permissions_policy_disables_sensitive_features(self):
        response = self.client.get("/health")
        policy = response.headers["Permissions-Policy"]
        self.assertIn("camera=()", policy)
        self.assertIn("microphone=()", policy)
        self.assertIn("geolocation=()", policy)

    def test_unknown_api_route_returns_json(self):
        response = self.client.get("/api/does-not-exist")
        self.assertEqual(response.status_code, 404)
        self.assertIsInstance(response.get_json(), dict)

    def test_unknown_page_route_returns_404(self):
        response = self.client.get("/page-that-does-not-exist")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
