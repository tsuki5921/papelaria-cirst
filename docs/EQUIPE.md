# Organização do trabalho por agentes

O projeto foi desenvolvido pelo Claude, organizado nos quatro papéis pedidos. Cada parte do código tem um
"dono" e passou pela revisão dos outros papéis antes de ser considerada pronta.

| Agente | Responsável por | Arquivos |
|---|---|---|
| **1 · HTML** | Estrutura semântica, acessibilidade, SEO | `frontend/*.html`, `robots.txt` |
| **2 · CSS** | Identidade visual, responsividade, animações | `frontend/css/style.css`, `img/favicon.svg` |
| **3 · JavaScript** | Carrinho, busca, filtros, validações, painel | `frontend/js/**` |
| **4 · Python** | API, banco, estoque, autenticação, testes | `backend/**`, `tests/**` |

## Padrões combinados entre os agentes

- Nomes de classes CSS em português e no padrão bloco/elemento (`.produto__nome`, `.btn--rosa`).
- Nenhum `style=""` nem `<script>` inline: a política de segurança (CSP) do servidor bloqueia os dois.
- Todo texto vindo do banco é escapado com `esc()` antes de entrar no HTML.
- Valores monetários sempre em centavos (inteiros) entre API e front-end.
- Erros da API sempre no formato `{error, fields}`; o front mostra cada erro no campo correspondente.
- Nada de botão sem ação: o que depende de configuração (WhatsApp, e-mail) só aparece quando configurado.

## Revisões cruzadas e o que mudou por causa delas

| Revisor → revisado | Problema encontrado | Correção |
|---|---|---|
| Python → HTML | `style=""` em `index.html` seria bloqueado pela CSP | Trocado por classes (`.secao--colada`, `.ornamento--hero`) |
| Python → JavaScript | Preço digitado como `79.90` no painel era lido como 7990 | Leitura de valores aceita vírgula ou ponto |
| Python → JavaScript | Sincronização do carrinho buscava só os 200 primeiros produtos | Novo filtro `ids=` na API |
| HTML → Python | Página 404 em endereços com subpasta carregava sem CSS | `<base href="/">` na 404 |
| Testes (E2E) → JavaScript | “Limpar filtros” não limpava nada | Evento `reset` corrigido |
| Testes (E2E) → JavaScript | Era possível editar Configurações antes de os dados carregarem | Formulário fica inativo até carregar |
| Cliente → CSS | No PC com zoom do Windows a loja abria no layout de celular | Novos pontos de quebra (PC a partir de 760 px) |
| Cliente → Python | Rodar em HTTPS no computador | `backend/certs.py` + `run.py` em HTTPS por padrão |

Detalhes de cada teste em [RELATORIO_TESTES.md](RELATORIO_TESTES.md).
