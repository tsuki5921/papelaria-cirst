# API REST — Papelaria Cristã

Base: `/api`. Requisições e respostas em JSON (UTF-8). Valores monetários em **centavos** (`7990` = R$ 79,90),
exceto na entrada do admin, que aceita `"79,90"`, `"79.90"` ou `79.9`.

Erros seguem o formato:

```json
{ "error": "Verifique os dados informados.", "fields": { "price": "Informe um valor." } }
```

| Código | Significado |
|---|---|
| 400 | Dados inválidos (`fields` traz o erro de cada campo) |
| 401 | Não autenticado / sessão expirada |
| 404 | Não encontrado |
| 413 | Arquivo maior que 5 MB |
| 429 | Muitas tentativas (login ou pedidos) |

## Públicas

### `GET /api/health`
`{"status": "ok"}`

### `GET /api/categories`
`[{ "slug": "biblias", "name": "Bíblias", "icon": "✝", "product_count": 5 }, ...]`

### `GET /api/products`
| Parâmetro | Descrição |
|---|---|
| `q` | Busca no nome, descrição e categoria (ignora acentos e maiúsculas) |
| `category` | Slug da categoria |
| `min_price`, `max_price` | Faixa de preço final em reais |
| `offer=1` | Somente em promoção |
| `in_stock=1` | Somente com estoque |
| `featured=1` | Somente destaques |
| `ids=1,2,3` | Produtos específicos (usado pelo carrinho) |
| `sort` | `price_asc`, `price_desc`, `name`, `newest` (padrão: destaques primeiro) |
| `limit` | 1–200 (padrão 100) |

Produto:
```json
{
  "id": 2, "slug": "biblia-harpa-deus-e-bom", "name": "Bíblia e Harpa “Deus é bom o tempo todo” — Lilás",
  "description": "...", "category": { "slug": "biblias", "name": "Bíblias" },
  "price_cents": 8990, "promo_cents": 7990, "final_cents": 7990, "on_sale": true, "discount_percent": 11,
  "stock": 5, "in_stock": true, "image": "img/produtos/biblia-harpa-deus-e-bom.jpg", "featured": true
}
```

### `GET /api/products/{id ou slug}`
Um produto ativo. 404 se não existir ou estiver oculto.

### `GET /api/settings`
Dados públicos da loja: `store_name, whatsapp, phone, email, address, hours, instagram, facebook`.

### `POST /api/orders`
```json
{ "customer_name": "Ana", "customer_phone": "11987654321", "notes": "Para presente",
  "items": [{ "product_id": 2, "quantity": 1 }] }
```
Resposta `201`: pedido com `code`, `total_cents` (calculado no servidor), `items`, `status: "pendente"` e
`whatsapp_url` (link com a mensagem pronta, ou `null` se o WhatsApp da loja não estiver configurado).
Valida estoque e disponibilidade. Limite: 20 pedidos / 10 min por IP.

## Administrativas

Enviar `Authorization: Bearer <token>`.

### `POST /api/admin/login` → `{ "token": "..." }`  ·  `POST /api/admin/logout`
Sessão de 8 horas. 5 tentativas erradas bloqueiam o IP por 15 minutos.

| Método e rota | Descrição |
|---|---|
| `GET /api/admin/summary` | Métricas: produtos ativos, esgotados, estoque baixo, pedidos pendentes, vendas |
| `GET /api/admin/products` | Todos os produtos (inclui ocultos e `active`) — aceita os filtros públicos + `low_stock=1` |
| `GET /api/admin/products/{id}` | Um produto |
| `POST /api/admin/products` | Cria. Campos: `name`*, `category`*, `price`*, `stock`*, `promo_price`, `description`, `image`, `featured`, `active` |
| `PUT /api/admin/products/{id}` | Atualiza (somente os campos enviados). `promo_price: ""` remove a promoção |
| `DELETE /api/admin/products/{id}` | Exclui (pedidos antigos mantêm o nome do produto) |
| `POST /api/admin/products/{id}/stock` | `{ "delta": -2, "reason": "Venda na loja" }` — nunca deixa negativo |
| `GET /api/admin/stock/movements?product_id=` | Histórico de movimentações |
| `GET /api/admin/orders?status=` | Pedidos (até 200, mais recentes primeiro) |
| `PATCH /api/admin/orders/{id}` | `{ "status": "confirmado" }` |
| `GET` / `PUT /api/admin/settings` | Lê / salva os dados da loja |
| `POST /api/admin/upload` | `multipart/form-data` com campo `image` → `{ "path": "img/uploads/abc.jpg" }` |

### Fluxo de status dos pedidos

```
pendente ──► confirmado ──► enviado ──► concluido
   │             │             │
   └─────────────┴─────────────┴──► cancelado
```
- **confirmado**: baixa o estoque de todos os itens (tudo ou nada; erro se faltar estoque).
- **cancelado** depois de confirmado: devolve o estoque.
- Toda alteração gera registro em `stock_movements`.
