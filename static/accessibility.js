(() => {
  "use strict";

  const STORAGE_KEY = "nexus_accessibility_preferences";
  const defaults = {
    fontScale: 1,
    contrast: false,
    reduceMotion: false,
    underlineLinks: false,
    focusOutline: true
  };
  let preferences = load();
  let panel = null;

  function load() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return Object.assign({}, defaults, stored);
    } catch {
      return Object.assign({}, defaults);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn("Accessibility preferences could not be saved", error);
    }
    apply();
  }

  function apply() {
    const root = document.documentElement;
    root.style.setProperty("--nexus-accessibility-scale", String(preferences.fontScale));
    document.body.classList.toggle("a11y-high-contrast", preferences.contrast);
    document.body.classList.toggle("a11y-reduce-motion", preferences.reduceMotion);
    document.body.classList.toggle("a11y-underline-links", preferences.underlineLinks);
    document.body.classList.toggle("a11y-focus-outline", preferences.focusOutline);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function control(label, description, value, onChange) {
    const row = element("label", "a11y-control");
    const text = element("span", "a11y-control-text");
    text.append(element("strong", "", label), element("small", "", description));
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(value);
    input.addEventListener("change", () => onChange(input.checked));
    row.append(text, input);
    return row;
  }

  function makePanel() {
    if (panel) return panel;
    panel = element("section", "a11y-panel");
    panel.id = "nexusAccessibilityPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "a11yTitle");
    const header = element("div", "a11y-header");
    const title = element("h2", "", "Acessibilidade");
    title.id = "a11yTitle";
    const close = element("button", "a11y-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Fechar acessibilidade");
    close.addEventListener("click", closePanel);
    header.append(title, close);
    const description = element("p", "a11y-description",
      "Ajuste a leitura e os controles visuais do NEXUS neste dispositivo.");
    const scale = element("div", "a11y-scale");
    const scaleLabel = element("label", "", "Tamanho do texto");
    scaleLabel.htmlFor = "a11yScale";
    const range = document.createElement("input");
    range.id = "a11yScale";
    range.type = "range";
    range.min = "0.9";
    range.max = "1.3";
    range.step = "0.05";
    range.value = String(preferences.fontScale);
    range.addEventListener("input", () => {
      preferences.fontScale = Number(range.value);
      save();
    });
    scale.append(scaleLabel, range);
    const toggles = element("div", "a11y-toggles");
    toggles.append(
      control("Alto contraste", "Aumenta a distinção entre texto e fundo.", preferences.contrast, value => {
        preferences.contrast = value;
        save();
      }),
      control("Reduzir animações", "Diminui transições e movimentos da interface.", preferences.reduceMotion, value => {
        preferences.reduceMotion = value;
        save();
      }),
      control("Sublinhar links", "Ajuda a identificar links clicáveis.", preferences.underlineLinks, value => {
        preferences.underlineLinks = value;
        save();
      }),
      control("Realçar foco do teclado", "Mostra com clareza qual controle está selecionado.", preferences.focusOutline, value => {
        preferences.focusOutline = value;
        save();
      })
    );
    const reset = element("button", "a11y-reset", "Restaurar padrão");
    reset.type = "button";
    reset.addEventListener("click", () => {
      preferences = Object.assign({}, defaults);
      range.value = String(preferences.fontScale);
      panel.querySelectorAll('input[type="checkbox"]').forEach((input, index) => {
        input.checked = [preferences.contrast, preferences.reduceMotion, preferences.underlineLinks, preferences.focusOutline][index];
      });
      save();
    });
    panel.append(header, description, scale, toggles, reset);
    document.body.append(panel);
    panel.addEventListener("keydown", event => {
      if (event.key === "Escape") closePanel();
    });
    return panel;
  }

  function openPanel() {
    makePanel().classList.add("visible");
    const close = panel.querySelector(".a11y-close");
    if (close) close.focus();
  }

  function closePanel() {
    if (panel) panel.classList.remove("visible");
    const trigger = document.getElementById("nexusAccessibilityButton");
    if (trigger) trigger.focus();
  }

  function makeTrigger() {
    if (document.getElementById("nexusAccessibilityButton")) return;
    const button = element("button", "a11y-trigger", "A");
    button.id = "nexusAccessibilityButton";
    button.type = "button";
    button.title = "Opções de acessibilidade";
    button.setAttribute("aria-label", "Abrir opções de acessibilidade");
    button.addEventListener("click", openPanel);
    document.body.append(button);
  }

  function init() {
    apply();
    makeTrigger();
    window.addEventListener("storage", event => {
      if (event.key === STORAGE_KEY) {
        preferences = load();
        apply();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.NexusAccessibility = Object.freeze({
    open: openPanel,
    close: closePanel,
    reset: () => {
      preferences = Object.assign({}, defaults);
      save();
    },
    getPreferences: () => Object.assign({}, preferences)
  });
})();
