(() => {
  "use strict";

  let indicator;
  let label;
  let detail;
  let lastState = null;
  let timer = null;

  function build() {
    if (indicator) return;
    indicator = document.createElement("button");
    indicator.id = "nexusNetworkStatus";
    indicator.className = "network-status";
    indicator.type = "button";
    indicator.setAttribute("aria-live", "polite");
    indicator.setAttribute("aria-label", "Estado da conexão");
    const dot = document.createElement("i");
    dot.className = "network-dot";
    label = document.createElement("span");
    label.className = "network-label";
    detail = document.createElement("small");
    detail.className = "network-detail";
    indicator.append(dot, label, detail);
    indicator.addEventListener("click", checkServer);
    const footer = document.querySelector(".status-right");
    if (footer) footer.prepend(indicator);
  }

  function render(status, message) {
    if (!indicator) return;
    indicator.dataset.state = status;
    label.textContent = status === "online" ? "Conectado" :
      status === "offline" ? "Sem internet" : "Verificando";
    detail.textContent = message || "";
    indicator.title = message || label.textContent;
    if (lastState !== status && lastState !== null) {
      announce(status === "online" ? "Conexão restaurada." : "Conexão indisponível.");
    }
    lastState = status;
  }

  function announce(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(announce.timer);
    announce.timer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  async function checkServer() {
    if (!navigator.onLine) {
      render("offline", "O dispositivo está sem conexão de rede.");
      return false;
    }
    render("checking", "Verificando conexão com o NEXUS...");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch("/health?check=" + Date.now(), {
        method: "GET",
        cache: "no-store",
        headers: { "Accept": "application/json" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error("Servidor respondeu " + response.status);
      const data = await response.json();
      if (data.status !== "ok") throw new Error("Serviço não confirmou estado saudável.");
      render("online", "Servidor NEXUS operacional · toque para verificar novamente.");
      return true;
    } catch (error) {
      render("offline", "Não foi possível confirmar o servidor. Toque para tentar novamente.");
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  function onOnline() {
    checkServer();
  }

  function onOffline() {
    render("offline", "O navegador informou que não há conexão de rede.");
  }

  function init() {
    build();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (!navigator.onLine) onOffline();
    else checkServer();
    timer = setInterval(() => {
      if (navigator.onLine) checkServer();
    }, 90000);
    window.addEventListener("pagehide", () => {
      if (timer) clearInterval(timer);
    }, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.NexusNetwork = Object.freeze({
    check: checkServer,
    getStatus: () => lastState
  });
})();
