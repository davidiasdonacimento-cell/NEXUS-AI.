(() => {
  "use strict";

  const HISTORY_KEY = "nx_history_v2";
  const SHORTCUT_KEY = "nx_shortcuts_v2";
  let box;
  let input;
  let selected = -1;
  let items = [];

  function read(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function build() {
    const form = document.getElementById("addressForm");
    input = document.getElementById("address");
    if (!form || !input) return;
    box = document.createElement("div");
    box.id = "nexusAddressSuggestions";
    box.className = "address-suggestions";
    box.setAttribute("role", "listbox");
    box.setAttribute("aria-label", "Sugestões de endereço e histórico");
    form.append(box);
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", box.id);
    input.addEventListener("input", update);
    input.addEventListener("focus", update);
    input.addEventListener("keydown", keyboard);
    document.addEventListener("click", event => {
      if (!form.contains(event.target)) hide();
    });
  }

  function candidates(query) {
    const normalized = query.toLocaleLowerCase("pt-BR");
    if (!normalized) return [];
    const history = read(HISTORY_KEY).map(item => ({
      label: item.title || item.url,
      url: item.url,
      kind: "Histórico"
    }));
    const shortcuts = read(SHORTCUT_KEY).map(item => ({
      label: item.name || item.url,
      url: item.url,
      kind: "Atalho"
    }));
    const unique = new Map();
    [...history, ...shortcuts].forEach(item => {
      if (!item.url || unique.has(item.url)) return;
      const searchable = (item.label + " " + item.url).toLocaleLowerCase("pt-BR");
      if (searchable.includes(normalized)) unique.set(item.url, item);
    });
    return [...unique.values()].slice(0, 7);
  }

  function render() {
    box.replaceChildren();
    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "address-suggestion" + (index === selected ? " selected" : "");
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(index === selected));
      const icon = document.createElement("span");
      icon.className = "suggestion-icon";
      icon.textContent = item.kind === "Histórico" ? "◷" : "☆";
      const text = document.createElement("span");
      text.className = "suggestion-text";
      const title = document.createElement("strong");
      title.textContent = item.label;
      const url = document.createElement("small");
      url.textContent = item.url;
      text.append(title, url);
      const kind = document.createElement("small");
      kind.className = "suggestion-kind";
      kind.textContent = item.kind;
      button.append(icon, text, kind);
      button.addEventListener("mousedown", event => event.preventDefault());
      button.addEventListener("click", () => choose(item));
      box.append(button);
    });
    box.classList.toggle("visible", items.length > 0);
  }

  function update() {
    selected = -1;
    items = candidates(input.value.trim());
    render();
  }

  function choose(item) {
    input.value = item.url;
    hide();
    const form = document.getElementById("addressForm");
    if (form) form.requestSubmit();
  }

  function hide() {
    if (box) box.classList.remove("visible");
    selected = -1;
  }

  function keyboard(event) {
    if (!items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selected = Math.min(selected + 1, items.length - 1);
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      selected = Math.max(selected - 1, 0);
      render();
    } else if (event.key === "Enter" && selected >= 0) {
      event.preventDefault();
      choose(items[selected]);
    } else if (event.key === "Escape") {
      hide();
    }
  }

  function init() {
    build();
    window.addEventListener("storage", update);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.NexusSuggestions = Object.freeze({ refresh: update, close: hide });
})();
