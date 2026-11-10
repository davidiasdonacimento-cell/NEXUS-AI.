(() => {
  "use strict";

  const KEYS = {
    tabs: "nx_tabs_v2",
    bookmarks: "nx_bookmarks_v2",
    history: "nx_history_v2",
    shortcuts: "nx_shortcuts_v2",
    settings: "nx_settings_v2"
  };
  const MAX_FILE_SIZE = 2 * 1024 * 1024;
  const MAX_ITEMS = 500;
  const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn("NEXUS backup read failed", error);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      notify("Não foi possível salvar o backup neste dispositivo.");
      return false;
    }
  }

  function safeUrl(value) {
    if (typeof value !== "string" || value.length > 2048) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }

  function validTab(item) {
    return isObject(item) &&
      typeof item.title === "string" &&
      (item.url === "nexus://home" ||
       (typeof item.url === "string" && item.url.startsWith("nexus://search/")) ||
       safeUrl(item.url));
  }

  function validBookmark(item) {
    return isObject(item) &&
      typeof item.name === "string" &&
      safeUrl(item.url);
  }

  function validHistory(item) {
    return isObject(item) &&
      typeof item.title === "string" &&
      safeUrl(item.url) &&
      Number.isFinite(Number(item.time));
  }

  function validShortcut(item) {
    return isObject(item) &&
      typeof item.name === "string" &&
      safeUrl(item.url);
  }

  function collect() {
    const tabs = read(KEYS.tabs, []);
    const bookmarks = read(KEYS.bookmarks, []);
    const history = read(KEYS.history, []);
    const shortcuts = read(KEYS.shortcuts, []);
    const settings = read(KEYS.settings, {});
    return {
      format: "nexus-browser-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      privacy: "private-tabs-excluded",
      data: {
        tabs: Array.isArray(tabs) ? tabs.filter(validTab).slice(0, 18) : [],
        bookmarks: Array.isArray(bookmarks) ? bookmarks.filter(validBookmark).slice(0, 100) : [],
        history: Array.isArray(history) ? history.filter(validHistory).slice(0, 300) : [],
        shortcuts: Array.isArray(shortcuts) ? shortcuts.filter(validShortcut).slice(0, 20) : [],
        settings: isObject(settings) ? settings : {}
      }
    };
  }

  function downloadBackup() {
    const payload = collect();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "nexus-browser-backup-" +
      new Date().toISOString().slice(0, 10) + ".json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    notify("Backup exportado. Guarde o arquivo em um local seguro.");
  }

  function mergeByUrl(current, incoming, limit) {
    const map = new Map();
    [...incoming, ...current].forEach(item => {
      if (item && item.url && !map.has(item.url)) map.set(item.url, item);
    });
    return [...map.values()].slice(0, limit);
  }

  function validateBackup(payload) {
    if (!isObject(payload)) throw new Error("O arquivo não contém um objeto válido.");
    if (payload.format !== "nexus-browser-backup") {
      throw new Error("Este arquivo não é um backup do NEXUS.");
    }
    if (payload.version !== 2) {
      throw new Error("Versão de backup não compatível.");
    }
    if (!isObject(payload.data)) throw new Error("O conteúdo do backup está incompleto.");
    const data = payload.data;
    const tabs = Array.isArray(data.tabs) ? data.tabs.filter(validTab).slice(0, 18) : [];
    const bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks.filter(validBookmark).slice(0, MAX_ITEMS) : [];
    const history = Array.isArray(data.history) ? data.history.filter(validHistory).slice(0, MAX_ITEMS) : [];
    const shortcuts = Array.isArray(data.shortcuts) ? data.shortcuts.filter(validShortcut).slice(0, 20) : [];
    const settings = isObject(data.settings) ? data.settings : {};
    return { tabs, bookmarks, history, shortcuts, settings };
  }

  function importBackupFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      notify("O arquivo ultrapassa o limite de 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => notify("Não foi possível ler o arquivo.");
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || ""));
        const incoming = validateBackup(payload);
        const accepted = window.confirm(
          "Importar " + incoming.bookmarks.length + " favoritos, " +
          incoming.history.length + " registros de histórico e " +
          incoming.shortcuts.length + " atalhos? Os dados atuais serão mesclados."
        );
        if (!accepted) return;
        const currentBookmarks = read(KEYS.bookmarks, []);
        const currentHistory = read(KEYS.history, []);
        const currentShortcuts = read(KEYS.shortcuts, []);
        const currentTabs = read(KEYS.tabs, []);
        const ok = write(KEYS.bookmarks, mergeByUrl(
          Array.isArray(currentBookmarks) ? currentBookmarks : [],
          incoming.bookmarks, 100
        )) && write(KEYS.history, mergeByUrl(
          Array.isArray(currentHistory) ? currentHistory : [],
          incoming.history, 300
        )) && write(KEYS.shortcuts, mergeByUrl(
          Array.isArray(currentShortcuts) ? currentShortcuts : [],
          incoming.shortcuts, 20
        ));
        const mergedTabs = mergeByUrl(
          Array.isArray(currentTabs) ? currentTabs : [],
          incoming.tabs, 18
        );
        if (mergedTabs.length) write(KEYS.tabs, mergedTabs);
        write(KEYS.settings, Object.assign({}, incoming.settings, read(KEYS.settings, {})));
        if (!ok) return;
        notify("Backup importado. Recarregue a página para atualizar os painéis.");
      } catch (error) {
        notify(error.message || "Backup inválido.");
      }
    };
    reader.readAsText(file);
  }

  function notify(message) {
    const toast = document.getElementById("toast");
    if (!toast) {
      window.alert(message);
      return;
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  function makeDialog() {
    let dialog = document.getElementById("backupDialog");
    if (dialog) return dialog;
    dialog = document.createElement("section");
    dialog.id = "backupDialog";
    dialog.className = "utility-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "backupDialogTitle");
    const title = document.createElement("h2");
    title.id = "backupDialogTitle";
    title.textContent = "Backup e restauração";
    const description = document.createElement("p");
    description.textContent = "Exporte seus favoritos, histórico, atalhos e abas normais. Abas anônimas nunca são incluídas.";
    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.textContent = "Exportar backup";
    exportButton.addEventListener("click", downloadBackup);
    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.textContent = "Importar backup";
    importButton.addEventListener("click", () => fileInput.click());
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/json,.json";
    fileInput.hidden = true;
    fileInput.addEventListener("change", () => {
      importBackupFile(fileInput.files && fileInput.files[0]);
      fileInput.value = "";
    });
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Fechar";
    closeButton.className = "utility-dialog-close";
    closeButton.addEventListener("click", () => dialog.classList.remove("visible"));
    dialog.append(title, description, exportButton, importButton, fileInput, closeButton);
    document.body.append(dialog);
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.classList.remove("visible");
    });
    return dialog;
  }

  function openDialog() {
    makeDialog().classList.add("visible");
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-action='backup']");
    if (!button) return;
    event.preventDefault();
    openDialog();
  });

  window.NexusBackup = Object.freeze({
    export: downloadBackup,
    collect,
    validate: validateBackup
  });
})();
