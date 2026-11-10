# NEXUS AI

Workspace web responsivo em português, construído com Flask, HTML, CSS e JavaScript.

## Recursos incluídos
- Painel responsivo para celular e computador.
- Navegação entre Assistente IA, projetos, estúdio de texto, central de mídia e notas.
- Projetos, documentos e notas salvos no armazenamento local do navegador.
- Pré-visualização local de imagens e vídeos.
- Endpoint de saúde em `/health`.
- Deploy preparado para Render com Gunicorn.

## Desenvolvimento local
```bash
pip install -r requirements.txt
python app.py
```

## Render
- Runtime: Python
- Build: `pip install -r requirements.txt`
- Start: `gunicorn app:app --bind 0.0.0.0:$PORT`
- Health check: `/health`

## Integração de IA
O endpoint `POST /api/assistant` está preparado. Para habilitar respostas reais, configure uma variável de ambiente `GEMINI_API_KEY` no Render e implemente/ative o provedor escolhido. Nenhuma chave deve ser colocada no código ou commitada no GitHub.

## Persistência
A versão inicial salva projetos, documentos e notas no navegador do dispositivo. Isso não sincroniza automaticamente entre dispositivos e pode ser apagado ao limpar os dados do navegador.
