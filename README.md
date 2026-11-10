# NEXUS BROWSER

NEXUS BROWSER é uma aplicação web progressiva (PWA) com identidade visual própria, interface de navegador e pesquisa integrada.

## Recursos implementados

- Página inicial exclusiva NEXUS.
- Abas múltiplas, alternância entre abas e fechamento individual.
- Abas anônimas que não são gravadas na lista persistente de abas nem no histórico local.
- Barra de endereço que reconhece URLs e termos de pesquisa.
- Pesquisa integrada com resultados apresentados dentro da interface NEXUS.
- Abertura de resultados na área de navegação incorporada.
- Navegação voltar/avançar dentro do histórico de navegação mantido pelo NEXUS.
- Atualizar e voltar à página inicial.
- Favoritos, barra de favoritos e atalhos personalizados.
- Exportação e importação de favoritos em JSON.
- Histórico local com opção para apagar.
- Painel de downloads com explicação das permissões do navegador do dispositivo.
- Temas escuro, claro e roxo.
- Preferências de inicialização e exibição da barra de favoritos.
- Atalhos de teclado: Ctrl+T, Ctrl+Shift+N, Ctrl+W, Ctrl+L, Ctrl+R, Alt+Seta esquerda/direita e Ctrl+Tab.
- PWA com cache do shell para permitir carregamento básico offline.
- Endpoint de saúde /health e configuração /api/config.

## Pesquisa integrada

O backend consulta resultados HTML do DuckDuckGo e converte os links para uma resposta JSON. A página de resultados é renderizada pelo próprio NEXUS, sem abrir automaticamente uma página externa do Google ou do DuckDuckGo.

A disponibilidade depende da conectividade do Render com o provedor de pesquisa. Se o provedor limitar ou bloquear a consulta, o NEXUS exibe uma mensagem de indisponibilidade.

## Limitações técnicas importantes

O NEXUS é uma aplicação web hospedada no Render. Ele não contém Chromium, não substitui o Google Chrome nativo e não possui um motor de navegação remoto.

As páginas externas são exibidas em um iframe quando o site permite. Alguns sites bloqueiam incorporação por X-Frame-Options ou Content Security Policy (CSP). Nenhum código de interface pode remover essas regras do site remoto. Nesses casos, a página pode não abrir dentro do NEXUS e será necessário usar a opção de abrir no navegador do dispositivo.

O modo anônimo do NEXUS é uma sessão privada local da aplicação: não grava as visitas no histórico do NEXUS e não persiste a aba. Ele não oculta a atividade dos sites visitados, do provedor de internet, da rede ou do próprio serviço remoto. Não equivale ao modo anônimo do Chrome.

Histórico, favoritos, atalhos, temas e abas normais são armazenados no localStorage do navegador/dispositivo. Não existe sincronização em nuvem entre dispositivos.

O NEXUS não consegue ler o gerenciador de downloads do Android ou de outro navegador. Os downloads iniciados por sites são controlados pelo navegador e pelo sistema operacional.

## Implantação no Render

- Runtime: Python
- Build command: pip install -r requirements.txt
- Start command: gunicorn app:app --bind 0.0.0.0:$PORT
- Health check path: /health

O serviço Render já conectado ao repositório pode fazer deploy automático após cada commit na branch main.

## Segurança e privacidade

- Os endpoints de pesquisa e resolução validam os dados recebidos.
- O backend limita o tamanho de requisições.
- O NEXUS não solicita permissões de câmera, microfone ou geolocalização.
- O modo anônimo não grava as abas privadas no armazenamento persistente do NEXUS.
- Os dados locais podem ser apagados pelo menu.
