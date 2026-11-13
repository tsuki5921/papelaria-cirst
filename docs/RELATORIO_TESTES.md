# Relatório de testes — Papelaria Cristã

**Data:** 12/11/2026  ·  **Resultado final: 51 de 51 testes aprovados** (33 de API + 18 no navegador)
**Ambiente:** Python 3.13, Flask 3.1, Google Chrome (via Playwright), Linux.

```bash
pytest -v      # reproduz todos os testes
```

## 1. Os 10 testes solicitados

| # | Teste pedido | Como foi verificado | Resultado |
|---|---|---|---|
| 1 | Todas as páginas carregam | 9 páginas + CSS/JS/imagens com HTTP 200 (`test_todas_as_paginas_carregam`, `test_imagens_dos_produtos_existem`); cada página aberta no navegador sem erros de JavaScript (`test_paginas_carregam_sem_erros...`) | ✅ |
| 2 | Botões e links | Rastreamento de **todos os links internos** de todas as páginas, nenhum quebrado (`test_nenhum_link_quebrado`); botões exercitados nos fluxos abaixo (adicionar, +/−, remover, finalizar, filtros, chips, menu mobile, editar, estoque, excluir, confirmar pedido, sair) | ✅ |
| 3 | Busca de produtos | Busca pelo cabeçalho no navegador; API ignora acentos/maiúsculas (“biblia”, “BÍBLIA”, “bíblia” → 5 resultados); busca sem resultado mostra mensagem | ✅ |
| 4 | Filtros por categoria | Categoria, faixa de preço, ofertas, disponíveis, ordenação, remoção por chip, “Limpar filtros”, validação mín > máx, categoria vazia mostra “em breve” | ✅ (após correção) |
| 5 | Adicionar e remover do carrinho | Adicionar pelo cartão e pela página do produto, contador do ícone, +/−, remover, carrinho vazio, limite pelo estoque | ✅ |
| 6 | Cálculo dos valores | Total e economia conferidos no navegador a cada alteração; total recalculado no servidor ignorando preço enviado pelo cliente; preço alterado no navegador é corrigido ao abrir o carrinho | ✅ |
| 7 | Cadastro de produtos | No painel: validação, promoção ≥ preço rejeitada, upload de foto, cadastro, aparece na loja, ajuste de estoque, exclusão. Na API: criar/editar/ocultar/excluir, slug único, validações, upload só aceita imagens reais | ✅ |
| 8 | API Python | 33 testes: catálogo, pedidos, autenticação, estoque, transições de pedido, configurações, upload, cabeçalhos de segurança | ✅ |
| 9 | Responsividade | Todas as páginas em **375 px (celular), 768 px (tablet) e 1366 px (computador)**, sem rolagem horizontal; menu mobile abre e navega; capturas de tela revisadas visualmente | ✅ |
| 10 | Corrigir erros | 6 problemas encontrados e corrigidos (seção 3); suíte completa reexecutada após cada correção | ✅ |

## 2. Testes de segurança incluídos

| Verificação | Resultado |
|---|---|
| Rotas do painel sem token ou com token falso → 401 | ✅ |
| 5 senhas erradas → bloqueio 429 | ✅ |
| Logout invalida o token | ✅ |
| Senha armazenada só como hash PBKDF2 | ✅ |
| Configurações públicas não expõem o hash da senha | ✅ |
| Tentativa de ler arquivos fora do site (`../backend/app.py`) → 404 | ✅ |
| Upload de arquivo PHP disfarçado de `.jpg` → recusado | ✅ |
| Caminho de imagem com `../` no cadastro → recusado | ✅ |
| Link `javascript:` nas redes sociais → recusado | ✅ |
| Nome de produto `<script>` salvo como texto e exibido escapado | ✅ |
| Cabeçalhos CSP, X-Frame-Options, nosniff presentes | ✅ |
| Pedido com quantidade acima do estoque ou produto inexistente → 400 | ✅ |
| Confirmação de pedido sem estoque não altera nada (transação desfeita) | ✅ |

## 3. Erros encontrados e corrigidos

| # | Onde | Problema | Correção | Verificado por |
|---|---|---|---|---|
| 1 | `index.html` | Estilos inline seriam bloqueados pela CSP | Movidos para classes CSS | Captura de tela |
| 2 | Painel (JS) | `79.90` digitado no preço era lido como R$ 7.990,00 | Leitura aceita ponto ou vírgula | Revisão + `test_admin_cadastra...` |
| 3 | Carrinho (JS/API) | Sincronização limitada aos 200 primeiros produtos | Filtro `ids=` na API | `test_carrinho_ajusta_preco_alterado` |
| 4 | `404.html` | Sem CSS quando a URL tinha subpasta | `<base href="/">` | `test_404_html_e_json` |
| 5 | Catálogo (JS) | **“Limpar filtros” não funcionava** (evento de reset cancelado) | Reset do navegador + nova busca | `test_filtros_por_categoria_preco_e_chips` (falhava, passou a passar) |
| 6 | Painel (JS) | Configurações podiam ser editadas antes de carregar e eram sobrescritas | Formulário inativo até carregar | `test_admin_configura_whatsapp...` |

## 4. Limitações conhecidas (não são erros)

- **Fontes do Google**: no ambiente de teste não havia acesso à internet; o site usou as fontes de reserva sem quebrar o layout. Em produção, as fontes carregam normalmente.
- **Pagamento online** não está integrado: o pedido é registrado e finalizado pelo WhatsApp. A integração com um gateway depende de conta e chaves da loja.
- **Limites de tentativas** (login e pedidos) ficam em memória e zeram quando o servidor reinicia.
- **Preços e estoques iniciais** dos 8 produtos são valores de referência — o painel exibe um aviso até que sejam revisados.

## 5. Saída da última execução

```
tests/test_api.py ................................. 33 passed
tests/test_e2e.py .................. 18 passed
============================= 51 passed in 49.22s ==============================
```
