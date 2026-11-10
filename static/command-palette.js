(() => {
  "use strict";

  const COMMANDS = [
    { id: "new-tab", label: "Abrir nova aba", detail: "Ctrl + T", keywords: "aba guia nova", action: () => click("#newTab") },
    { id: "private-tab", label: "Abrir aba anônima", detail: "Ctrl + Shift + N", keywords: "privado anonimo incógnito", action: () => click("#privateToggle") },
    { id: "home", label: "Ir para página inicial", detail: "Página inicial", keywords: "inicio home", action: () => click("#homeButton") },
    { id: "history", label: "Abrir histórico", detail: "Navegação", keywords: "visitas histórico", action: () => click("#historyButton") },
    { id: "bookmarks", label: "Abrir favoritos", detail: "Sites salvos", keywords: "marcadores favoritos", action: () => click("#manageBookmarks") },
    { id: "downloads", label: "Abrir downloads", detail: "Arquivos", keywords: "baixados downloads", action: () => click("#downloadsButton") },
    { id: "settings", label: "Configurações", detail: "Personalização", keywords: "preferências ajustes tema", action: () => click("[data-panel='settings']") },
    { id: "reload", label: "Recarregar página", detail: "Ctrl + R", keywords: "atualizar refresh", action: () => click("#reload") },
    { id: "favorite", label: "Adicionar página aos favoritos", detail: "Salvar site", keywords: "favoritar salvar", action: () => click("#bookmarkCurrent") },
    { id: "backup", label: "Backup e restauração", detail: "Exportar ou importar", keywords: "backup restaurar exportar importar", action: () => click("[data-action='backup']") },
    { id: "focus-address", label: "Focar barra de endereço", detail: "Ctrl + L", keywords: "pesquisar url endereço", action: () => focusAddress() },
    { id: "close-palette", label: "Fechar esta janela", detail: "Esc", keywords: "fechar cancelar", action: () => close() }
  ];

  let selected = 0;
  let visible = COMMANDS.slice();
  let dialog = null;
  let input = null;
  let list = null;

  function click(selector) {
    const target = document.querySelector(selector);
    if (target) target.click();
  }

  function focusAddress() {
    const address = document.getElementById("address");
    if (!address) return;
    address.focus();
    address.select();
  }

  function close() {
    if (dialog) dialog.classList.remove("visible");
  }

  function score(command, query) {
    const value = (command.label + " " + command.keywords).toLocaleLowerCase("pt-BR");
    const terms = query.toLocaleLowerCase("pt-BR").split(/\s+/).filter(Boolean);
    let points = 0;
    for (const term of terms) {
      if (command.label.toLocaleLowerCase("pt-BR").startsWith(term)) points += 8;
      else if (command.label.toLocaleLowerCase("pt-BR").includes(term)) points += 5;
      else if (value.includes(term)) points += 2;
      else return -1;
    }
    return points;
  }

  function render() {
    if (!list) return;
    list.replaceChildren();
    visible.forEach((command, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "command-option" + (index === selected ? " selected" : "");
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(index === selected));
      const main = document.createElement("span");
      main.className = "command-option-main";
      const title = document.createElement("strong");
      title.textContent = command.label;
      const detail = document.createElement("small");
      detail.textContent = command.detail;
      main.append(title, detail);
      button.append(main);
      button.addEventListener("mouseenter", () => {
        selected = index;
        updateSelection();
      });
      button.addEventListener("click", () => execute(command));
      list.append(button);
    });
    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "command-empty";
      empty.textContent = "Nenhum comando encontrado.";
      list.append(empty);
    }
  }

  function updateSelection() {
    list.querySelectorAll(".command-option").forEach((node, index) => {
      node.classList.toggle("selected", index === selected);
      node.setAttribute("aria-selected", String(index === selected));
    });
  }

  function filter() {
    const query = input.value.trim();
    visible = COMMANDS
      .map(command => ({ command, points: score(command, query) }))
      .filter(item => item.points >= 0)
      .sort((a, b) => b.points - a.points)
      .map(item => item.command);
    selected = 0;
    render();
  }

  function execute(command) {
    close();
    window.setTimeout(() => command.action(), 30);
  }

  function build() {
    if (dialog) return;
    dialog = document.createElement("section");
    dialog.id = "nexusCommandPalette";
    dialog.className = "command-palette-backdrop";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Comandos rápidos");
    const panel = document.createElement("div");
    panel.className = "command-palette";
    const heading = document.createElement("div");
    heading.className = "command-heading";
    heading.textContent = "Comandos rápidos";
    input = document.createElement("input");
    input.type = "search";
    input.placeholder = "Digite um comando...";
    input.setAttribute("aria-label", "Filtrar comandos");
    list = document.createElement("div");
    list.className = "command-list";
    list.setAttribute("role", "listbox");
    const footer = document.createElement("div");
    footer.className = "command-footer";
    footer.textContent = "↑ ↓ navegar · Enter executar · Esc fechar";
    panel.append(heading, input, list, footer);
    dialog.append(panel);
    document.body.append(dialog);
    input.addEventListener("input", filter);
    input.addEventListener("keydown", event => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        selected = Math.min(selected + 1, visible.length - 1);
        updateSelection();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        selected = Math.max(selected - 1, 0);
        updateSelection();
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (visible[selected]) execute(visible[selected]);
      } else if (event.key === "Escape") {
        close();
      }
    });
    dialog.addEventListener("click", event => {
      if (event.target === dialog) close();
    });
  }

  function open() {
    build();
    input.value = "";
    visible = COMMANDS.slice();
    selected = 0;
    render();
    dialog.classList.add("visible");
    input.focus();
  }

  document.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && (key === "k" || (event.shiftKey && key === "p"))) {
      event.preventDefault();
      open();
    } else if (event.key === "Escape" && dialog?.classList.contains("visible")) {
      close();
    }
  });

  document.addEventListener("click", event => {
    if (event.target.closest("[data-action='commands']")) {
      event.preventDefault();
      open();
    }
  });

  window.NexusCommands = Object.freeze({ open, close });
})();
