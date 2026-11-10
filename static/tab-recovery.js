(() => {
  "use strict";

  const KEY = "nexus_recently_closed_tabs";
  const LIMIT = 10;

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function write(items) {
    try {
      localStorage.setItem(KEY, JSON.stringify(items.slice(0, LIMIT)));
    } catch (error) {
      console.warn("NEXUS could not save recently closed tabs", error);
    }
  }

  function safeTab(value) {
    if (!value || typeof value !== "object" || value.private) return false;
    if (typeof value.title !== "string" || typeof value.url !== "string") return false;
    if (value.url === "nexus://home" || value.url.startsWith("nexus://search/")) return true;
    try {
      const url = new URL(value.url);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }

  function remember(event) {
    const detail = event.detail;
    if (!safeTab(detail)) return;
    const items = read();
    items.unshift({
      title: detail.title.slice(0, 100),
      url: detail.url,
      closedAt: Date.now()
    });
    write(items.filter((item, index) => items.findIndex(other => other.url === item.url) === index));
    updateMenu();
  }

  function restoreLast() {
    const items = read();
    if (!items.length) {
      notify("Não há abas fechadas recentemente.");
      return;
    }
    const item = items.shift();
    const tabs = readStoredTabs();
    if (tabs.length >= 18) {
      notify("Feche uma aba antes de restaurar outra.");
      return;
    }
    tabs.push({
      id: "restored-" + Date.now().toString(36),
      title: item.title || "Aba restaurada",
      url: item.url,
      pinned: false,
      back: [],
      forward: []
    });
    try {
      localStorage.setItem("nx_tabs_v2", JSON.stringify(tabs));
      localStorage.setItem(KEY, JSON.stringify(items));
      location.reload();
    } catch {
      notify("Não foi possível restaurar esta aba.");
    }
  }

  function readStoredTabs() {
    try {
      const tabs = JSON.parse(localStorage.getItem("nx_tabs_v2") || "[]");
      return Array.isArray(tabs) ? tabs.filter(safeTab) : [];
    } catch {
      return [];
    }
  }

  function notify(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove("show"), 2500);
  }

  function updateMenu() {
    const button = document.querySelector("[data-action='reopen-tab']");
    if (button) {
      const count = read().length;
      button.disabled = count === 0;
      const label = button.querySelector("span");
      if (label) label.textContent = count ? "Reabrir aba fechada (" + count + ")" : "Nenhuma aba fechada";
    }
  }

  function init() {
    window.addEventListener("nexus:tabclosing", remember);
    document.addEventListener("click", event => {
      if (event.target.closest("[data-action='reopen-tab']")) {
        event.preventDefault();
        restoreLast();
      }
    });
    updateMenu();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.NexusTabRecovery = Object.freeze({
    list: read,
    restoreLast,
    clear: () => write([])
  });
})();
