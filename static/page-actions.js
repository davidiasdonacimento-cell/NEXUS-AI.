(() => {
  "use strict";

  let root;
  let menu;
  let observer;

  function currentUrl() {
    const field = document.getElementById("address");
    const value = field ? field.value.trim() : "";
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function notify(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  async function copyAddress() {
    const url = currentUrl();
    if (!url) return notify("Nenhum endereço de site disponível.");
    try {
      await navigator.clipboard.writeText(url);
      notify("Endereço copiado.");
    } catch {
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      field.select();
      const success = document.execCommand("copy");
      field.remove();
      notify(success ? "Endereço copiado." : "Não foi possível copiar o endereço.");
    }
  }

  function openExternal() {
    const url = currentUrl();
    if (!url) return notify("Nenhum site aberto.");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function favorite() {
    const button = document.getElementById("bookmarkCurrent");
    if (button) button.click();
    else notify("Use a estrela para salvar este site.");
  }

  function reload() {
    const button = document.getElementById("reload");
    if (button) button.click();
  }

  function actionButton(label, description, callback) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-action-item";
    const title = document.createElement("strong");
    title.textContent = label;
    const sub = document.createElement("small");
    sub.textContent = description;
    button.append(title, sub);
    button.addEventListener("click", () => {
      callback();
      menu.classList.remove("visible");
    });
    return button;
  }

  function build() {
    if (root) return;
    root = document.createElement("div");
    root.id = "nexusPageActions";
    root.className = "page-actions-root";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "page-actions-trigger";
    trigger.textContent = "⋯";
    trigger.title = "Ações da página";
    trigger.setAttribute("aria-label", "Abrir ações da página");
    menu = document.createElement("div");
    menu.className = "page-actions-menu";
    menu.setAttribute("role", "menu");
    menu.append(
      actionButton("Copiar endereço", "Copiar link da página", copyAddress),
      actionButton("Abrir fora do NEXUS", "Usar navegador do dispositivo", openExternal),
      actionButton("Adicionar aos favoritos", "Salvar esta página", favorite),
      actionButton("Recarregar página", "Buscar conteúdo novamente", reload)
    );
    trigger.addEventListener("click", () => menu.classList.toggle("visible"));
    root.append(trigger, menu);
    document.body.append(root);
    document.addEventListener("click", event => {
      if (!root.contains(event.target)) menu.classList.remove("visible");
    });
  }

  function updateVisibility() {
    const page = document.getElementById("webPage");
    if (!page || !root) return;
    root.classList.toggle("visible", page.classList.contains("active"));
  }

  function init() {
    build();
    const page = document.getElementById("webPage");
    if (page && "MutationObserver" in window) {
      observer = new MutationObserver(updateVisibility);
      observer.observe(page, { attributes: true, attributeFilter: ["class"] });
    }
    updateVisibility();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.NexusPageActions = Object.freeze({
    copyAddress,
    openExternal,
    updateVisibility
  });
})();
