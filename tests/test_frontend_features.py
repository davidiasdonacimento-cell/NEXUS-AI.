import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class FrontendAssetTests(unittest.TestCase):
    def read(self, relative):
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_main_application_script_is_loaded(self):
        html = self.read("templates/index.html")
        self.assertIn("filename='app.js'", html)

    def test_session_backup_script_is_loaded(self):
        html = self.read("templates/index.html")
        self.assertIn("filename='session-tools.js'", html)

    def test_command_palette_script_is_loaded(self):
        html = self.read("templates/index.html")
        self.assertIn("filename='command-palette.js'", html)

    def test_accessibility_script_is_loaded(self):
        html = self.read("templates/index.html")
        self.assertIn("filename='accessibility.js'", html)

    def test_backup_menu_entry_exists(self):
        html = self.read("templates/index.html")
        self.assertIn("data-action=\"backup\"", html)

    def test_command_menu_entry_exists(self):
        html = self.read("templates/index.html")
        self.assertIn("data-action=\"commands\"", html)

    def test_private_tab_is_not_written_to_saved_tabs(self):
        js = self.read("static/app.js")
        self.assertIn("state.tabs.filter(t=>!t.private)", js)

    def test_private_visits_are_not_recorded(self):
        js = self.read("static/app.js")
        self.assertIn("if(t.private||!http(url))return", js)

    def test_internal_search_uses_backend_endpoint(self):
        js = self.read("static/app.js")
        self.assertIn('fetch("/api/search?q="', js)

    def test_search_has_retry_button(self):
        js = self.read("static/app.js")
        self.assertIn("Tentar novamente", js)

    def test_search_displays_provider_diagnostics(self):
        js = self.read("static/app.js")
        self.assertIn("Detalhes da tentativa", js)

    def test_search_does_not_open_search_provider_in_new_tab(self):
        js = self.read("static/app.js")
        self.assertIn("view(\"searchPage\")", js)

    def test_keyboard_shortcut_for_new_tab_exists(self):
        js = self.read("static/app.js")
        self.assertIn('k==="t"', js)

    def test_keyboard_shortcut_for_private_tab_exists(self):
        js = self.read("static/app.js")
        self.assertIn('k==="n"', js)

    def test_command_palette_has_ctrl_k(self):
        js = self.read("static/command-palette.js")
        self.assertIn('key === "k"', js)

    def test_command_palette_supports_arrow_navigation(self):
        js = self.read("static/command-palette.js")
        self.assertIn('event.key === "ArrowDown"', js)
        self.assertIn('event.key === "ArrowUp"', js)

    def test_command_palette_supports_escape(self):
        js = self.read("static/command-palette.js")
        self.assertIn('event.key === "Escape"', js)

    def test_backup_excludes_private_tabs(self):
        js = self.read("static/session-tools.js")
        self.assertIn("private-tabs-excluded", js)
        self.assertIn("filter(validTab)", js)

    def test_backup_has_file_size_limit(self):
        js = self.read("static/session-tools.js")
        self.assertIn("2 * 1024 * 1024", js)

    def test_backup_checks_format_version(self):
        js = self.read("static/session-tools.js")
        self.assertIn('payload.format !== "nexus-browser-backup"', js)
        self.assertIn("payload.version !== 2", js)

    def test_backup_rejects_non_http_urls(self):
        js = self.read("static/session-tools.js")
        self.assertIn('url.protocol === "https:" || url.protocol === "http:"', js)

    def test_accessibility_preferences_are_persisted(self):
        js = self.read("static/accessibility.js")
        self.assertIn("nexus_accessibility_preferences", js)

    def test_accessibility_supports_font_scaling(self):
        js = self.read("static/accessibility.js")
        self.assertIn("fontScale", js)
        self.assertIn("--nexus-accessibility-scale", js)

    def test_accessibility_supports_reduced_motion(self):
        js = self.read("static/accessibility.js")
        self.assertIn("reduceMotion", js)
        self.assertIn("a11y-reduce-motion", js)

    def test_accessibility_supports_high_contrast(self):
        js = self.read("static/accessibility.js")
        self.assertIn("a11y-high-contrast", js)

    def test_accessibility_has_keyboard_focus_setting(self):
        js = self.read("static/accessibility.js")
        self.assertIn("focusOutline", js)

    def test_search_diagnostic_styles_exist(self):
        css = self.read("static/style.css")
        self.assertIn(".search-diagnostics", css)
        self.assertIn(".search-retry", css)

    def test_command_palette_styles_exist(self):
        css = self.read("static/style.css")
        self.assertIn(".command-palette", css)
        self.assertIn(".command-option.selected", css)

    def test_accessibility_styles_exist(self):
        css = self.read("static/style.css")
        self.assertIn(".a11y-panel", css)
        self.assertIn(".a11y-focus-outline", css)

    def test_reduced_motion_css_exists(self):
        css = self.read("static/style.css")
        self.assertIn("prefers-reduced-motion", css)
        self.assertIn(".a11y-reduce-motion", css)

    def test_service_worker_does_not_cache_api_requests(self):
        sw = self.read("static/sw.js")
        self.assertIn('url.pathname.startsWith("/api/")', sw)

    def test_service_worker_is_versioned(self):
        sw = self.read("static/sw.js")
        self.assertIn("nexus-browser-v2", sw)

    def test_iframe_has_restricted_sandbox(self):
        html = self.read("templates/index.html")
        self.assertIn('sandbox="allow-forms allow-scripts', html)

    def test_iframe_has_referrer_policy(self):
        html = self.read("templates/index.html")
        self.assertIn('referrerpolicy="strict-origin-when-cross-origin"', html)

    def test_accessibility_trigger_has_aria_label(self):
        js = self.read("static/accessibility.js")
        self.assertIn('setAttribute("aria-label", "Abrir opções de acessibilidade")', js)

    def test_command_palette_has_dialog_semantics(self):
        js = self.read("static/command-palette.js")
        self.assertIn('setAttribute("aria-modal", "true")', js)

    def test_backup_dialog_has_dialog_semantics(self):
        js = self.read("static/session-tools.js")
        self.assertIn('setAttribute("aria-modal", "true")', js)


if __name__ == "__main__":
    unittest.main()
