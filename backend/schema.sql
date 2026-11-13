-- Papelaria Cristã — esquema do banco de dados (SQLite)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT    NOT NULL UNIQUE,
    name        TEXT    NOT NULL,
    icon        TEXT    NOT NULL DEFAULT '✦',
    position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slug            TEXT    NOT NULL UNIQUE,
    name            TEXT    NOT NULL,
    description     TEXT    NOT NULL DEFAULT '',
    category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
    promo_cents     INTEGER CHECK (promo_cents IS NULL OR (promo_cents >= 0 AND promo_cents < price_cents)),
    stock           INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image           TEXT    NOT NULL DEFAULT '',
    featured        INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
    active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- Histórico de movimentações de estoque (auditoria)
CREATE TABLE IF NOT EXISTS stock_movements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    delta       INTEGER NOT NULL,
    stock_after INTEGER NOT NULL,
    reason      TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);

CREATE TABLE IF NOT EXISTS orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    code            TEXT    NOT NULL UNIQUE,
    customer_name   TEXT    NOT NULL,
    customer_phone  TEXT    NOT NULL,
    notes           TEXT    NOT NULL DEFAULT '',
    total_cents     INTEGER NOT NULL CHECK (total_cents >= 0),
    status          TEXT    NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'confirmado', 'enviado', 'concluido', 'cancelado')),
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name    TEXT    NOT NULL,
    unit_cents      INTEGER NOT NULL CHECK (unit_cents >= 0),
    quantity        INTEGER NOT NULL CHECK (quantity > 0)
);

-- Configurações editáveis da loja (contato, redes sociais)
CREATE TABLE IF NOT EXISTS settings (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash  TEXT PRIMARY KEY,
    expires_at  TEXT NOT NULL
);
