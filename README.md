# NEXUS BROWSER

Navegador web em formato de aplicação web progressiva (PWA), com pesquisa e atalhos para sites.

## Recursos
- Pesquisa por Google, Bing, DuckDuckGo e Brave Search.
- Barra de endereço, área de navegação incorporada, histórico local e favoritos.
- Interface adaptável para celular e computador.
- Instalação como PWA quando o navegador/dispositivo oferece suporte.

## Limitações importantes
Este projeto é uma aplicação web, não o aplicativo Google Chrome e não contém uma compilação completa do Chromium no servidor. Ele usa o motor do navegador do dispositivo. Muitos sites bloqueiam carregamento em iframe por políticas de segurança (CSP / X-Frame-Options); nesses casos, use "Abrir fora" ou abra o resultado em uma nova aba. O histórico e os favoritos ficam no armazenamento local do navegador e não sincronizam entre dispositivos.

## Deploy no Render
- Runtime: Python
- Build: `pip install -r requirements.txt`
- Start: `gunicorn app:app --bind 0.0.0.0:$PORT`
- Health check: `/health`

O serviço existente do Render permanece conectado ao repositório e fará deploy automático após o commit.
