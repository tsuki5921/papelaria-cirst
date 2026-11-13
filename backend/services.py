"""Regras de negócio compartilhadas entre as rotas públicas e administrativas."""
import secrets
from datetime import datetime
from urllib.parse import quote

from .db import get_db
from .validators import (ValidationError, clean_email, clean_phone, clean_str, clean_url,
                         normalize, parse_bool, parse_int, parse_money, slugify)

PUBLIC_SETTINGS = ("store_name", "whatsapp", "phone", "email", "address", "hours", "instagram", "facebook")
LOW_STOCK = 2

ORDER_TRANSITIONS = {
    "pendente": {"confirmado", "cancelado"},
    "confirmado": {"enviado", "concluido", "cancelado"},
    "enviado": {"concluido", "cancelado"},
    "concluido": set(),
    "cancelado": set(),
}
# Estados em que o estoque já foi baixado
STOCK_TAKEN = {"confirmado", "enviado", "concluido"}

PRODUCT_SELECT = """
    SELECT p.*, c.slug AS category_slug, c.name AS category_name,
           COALESCE(p.promo_cents, p.price_cents) AS final_cents
    FROM products p JOIN categories c ON c.id = p.category_id
"""


def fmt_brl(cents):
    value = f"{cents / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {value}"


def product_dict(row, admin=False):
    data = {
        "id": row["id"],
        "slug": row["slug"],
        "name": row["name"],
        "description": row["description"],
        "category": {"slug": row["category_slug"], "name": row["category_name"]},
        "price_cents": row["price_cents"],
        "promo_cents": row["promo_cents"],
        "final_cents": row["final_cents"],
        "on_sale": row["promo_cents"] is not None,
        "discount_percent": (round(100 - row["promo_cents"] * 100 / row["price_cents"])
                             if row["promo_cents"] is not None and row["price_cents"] else 0),
        "stock": row["stock"],
        "in_stock": row["stock"] > 0,
        "image": row["image"],
        "featured": bool(row["featured"]),
    }
    if admin:
        data.update(active=bool(row["active"]), created_at=row["created_at"], updated_at=row["updated_at"])
    return data


def list_products(args, admin=False):
    errors = {}
    where, params = [], []
    if not admin or args.get("active") == "1":
        where.append("p.active = 1")
    q = clean_str(args.get("q"), "q", errors, max_len=80, required=False)
    if q:
        for term in normalize(q).split():
            where.append("(norm(p.name) LIKE ? OR norm(p.description) LIKE ? OR norm(c.name) LIKE ?)")
            params += [f"%{term}%"] * 3
    if args.get("ids"):
        ids = [int(i) for i in str(args.get("ids")).split(",") if i.strip().isdigit()][:100]
        if not ids:
            errors["ids"] = "Lista de produtos inválida."
        else:
            where.append(f"p.id IN ({','.join('?' * len(ids))})")
            params += ids
    if args.get("category"):
        where.append("c.slug = ?")
        params.append(args.get("category"))
    if args.get("offer") == "1":
        where.append("p.promo_cents IS NOT NULL")
    if args.get("featured") == "1":
        where.append("p.featured = 1")
    if args.get("in_stock") == "1":
        where.append("p.stock > 0")
    if admin and args.get("low_stock") == "1":
        where.append(f"p.stock <= {LOW_STOCK}")
    min_c = parse_money(args.get("min_price"), "min_price", errors, required=False)
    max_c = parse_money(args.get("max_price"), "max_price", errors, required=False)
    if min_c is not None:
        where.append("COALESCE(p.promo_cents, p.price_cents) >= ?")
        params.append(min_c)
    if max_c is not None:
        where.append("COALESCE(p.promo_cents, p.price_cents) <= ?")
        params.append(max_c)
    if min_c is not None and max_c is not None and min_c > max_c:
        errors["max_price"] = "O preço máximo deve ser maior que o mínimo."
    limit = parse_int(args.get("limit"), "limit", errors, min_value=1, max_value=200, required=False, default=100)
    if errors:
        raise ValidationError(errors)

    order = {
        "price_asc": "final_cents ASC, p.name",
        "price_desc": "final_cents DESC, p.name",
        "name": "p.name COLLATE NOCASE",
        "newest": "p.id DESC",
    }.get(args.get("sort"), "p.featured DESC, (p.stock > 0) DESC, p.name COLLATE NOCASE")
    sql = PRODUCT_SELECT + (" WHERE " + " AND ".join(where) if where else "") + f" ORDER BY {order} LIMIT ?"
    rows = get_db().execute(sql, params + [limit]).fetchall()
    return [product_dict(r, admin) for r in rows]


def get_product(key, admin=False):
    field = "p.id" if str(key).isdigit() else "p.slug"
    sql = PRODUCT_SELECT + f" WHERE {field} = ?" + ("" if admin else " AND p.active = 1")
    row = get_db().execute(sql, (key,)).fetchone()
    return product_dict(row, admin) if row else None


def list_categories():
    rows = get_db().execute(
        """SELECT c.slug, c.name, c.icon,
                  (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
           FROM categories c ORDER BY c.position, c.name"""
    ).fetchall()
    return [dict(r) for r in rows]


def get_settings(public=True):
    rows = get_db().execute("SELECT key, value FROM settings").fetchall()
    data = {r["key"]: r["value"] for r in rows}
    return {k: data.get(k, "") for k in PUBLIC_SETTINGS} if public else data


def save_settings(payload):
    errors = {}
    clean = {
        "store_name": clean_str(payload.get("store_name"), "store_name", errors, min_len=2, max_len=80),
        "whatsapp": clean_phone(payload.get("whatsapp"), "whatsapp", errors, required=False),
        "phone": clean_str(payload.get("phone"), "phone", errors, max_len=40, required=False),
        "email": clean_email(payload.get("email"), "email", errors),
        "address": clean_str(payload.get("address"), "address", errors, max_len=200, required=False),
        "hours": clean_str(payload.get("hours"), "hours", errors, max_len=120, required=False),
        "instagram": clean_url(payload.get("instagram"), "instagram", errors),
        "facebook": clean_url(payload.get("facebook"), "facebook", errors),
    }
    if errors:
        raise ValidationError(errors)
    db = get_db()
    with db:
        for k, v in clean.items():
            db.execute("INSERT INTO settings(key, value) VALUES (?, ?) "
                       "ON CONFLICT(key) DO UPDATE SET value = excluded.value", (k, v))
    return get_settings()


# ---------------------------------------------------------------- produtos (admin)

def _validate_product(payload, partial=False, current=None):
    errors = {}
    data = {}
    db = get_db()

    def has(k):
        return not partial or k in payload

    if has("name"):
        data["name"] = clean_str(payload.get("name"), "name", errors, min_len=3, max_len=120)
    if has("description"):
        data["description"] = clean_str(payload.get("description"), "description", errors,
                                        max_len=2000, required=False)
    if has("category"):
        row = db.execute("SELECT id FROM categories WHERE slug = ?", (payload.get("category"),)).fetchone()
        if row:
            data["category_id"] = row["id"]
        else:
            errors["category"] = "Categoria inválida."
    if has("price"):
        data["price_cents"] = parse_money(payload.get("price"), "price", errors)
        if data["price_cents"] == 0:
            errors["price"] = "O preço deve ser maior que zero."
    if has("promo_price"):
        data["promo_cents"] = parse_money(payload.get("promo_price"), "promo_price", errors, required=False)
    if has("stock"):
        data["stock"] = parse_int(payload.get("stock"), "stock", errors, min_value=0, max_value=100000)
    if has("image"):
        image = clean_str(payload.get("image"), "image", errors, max_len=300, required=False)
        if image and not (image.startswith("img/") and ".." not in image):
            errors["image"] = "Imagem inválida. Envie uma foto pelo painel."
        data["image"] = image
    if has("featured"):
        data["featured"] = 1 if parse_bool(payload.get("featured", False)) else 0
    if has("active"):
        data["active"] = 1 if parse_bool(payload.get("active", True)) else 0

    price = data.get("price_cents", current["price_cents"] if current else None)
    promo = data.get("promo_cents", current["promo_cents"] if current else None)
    if price is not None and promo is not None and promo >= price and "price" not in errors:
        errors["promo_price"] = "O preço promocional deve ser menor que o preço normal."
    if errors:
        raise ValidationError(errors)
    return data


def _unique_slug(name, exclude_id=None):
    base = slugify(name)
    slug, n = base, 2
    db = get_db()
    while db.execute("SELECT 1 FROM products WHERE slug = ? AND id IS NOT ?", (slug, exclude_id)).fetchone():
        slug = f"{base}-{n}"
        n += 1
    return slug


def create_product(payload):
    data = _validate_product(payload)
    data["slug"] = _unique_slug(data["name"])
    db = get_db()
    cols = ", ".join(data)
    with db:
        cur = db.execute(f"INSERT INTO products({cols}) VALUES ({', '.join('?' * len(data))})",
                         tuple(data.values()))
        if data["stock"]:
            db.execute("INSERT INTO stock_movements(product_id, delta, stock_after, reason) VALUES (?, ?, ?, ?)",
                       (cur.lastrowid, data["stock"], data["stock"], "Cadastro do produto"))
    return get_product(cur.lastrowid, admin=True)


def update_product(product_id, payload):
    db = get_db()
    current = db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not current:
        return None
    data = _validate_product(payload, partial=True, current=current)
    if "name" in data and data["name"] != current["name"]:
        data["slug"] = _unique_slug(data["name"], exclude_id=product_id)
    if not data:
        return get_product(product_id, admin=True)
    with db:
        sets = ", ".join(f"{k} = ?" for k in data)
        db.execute(f"UPDATE products SET {sets}, updated_at = datetime('now') WHERE id = ?",
                   (*data.values(), product_id))
        if "stock" in data and data["stock"] != current["stock"]:
            db.execute("INSERT INTO stock_movements(product_id, delta, stock_after, reason) VALUES (?, ?, ?, ?)",
                       (product_id, data["stock"] - current["stock"], data["stock"], "Edição do produto"))
    return get_product(product_id, admin=True)


def delete_product(product_id):
    db = get_db()
    with db:
        cur = db.execute("DELETE FROM products WHERE id = ?", (product_id,))
    return cur.rowcount > 0


def adjust_stock(product_id, payload):
    errors = {}
    delta = parse_int(payload.get("delta"), "delta", errors, min_value=-100000, max_value=100000)
    reason = clean_str(payload.get("reason") or "Ajuste manual", "reason", errors, max_len=120)
    if delta == 0:
        errors["delta"] = "Informe uma quantidade diferente de zero."
    if errors:
        raise ValidationError(errors)
    db = get_db()
    with db:
        row = db.execute("SELECT stock FROM products WHERE id = ?", (product_id,)).fetchone()
        if not row:
            return None
        new_stock = row["stock"] + delta
        if new_stock < 0:
            raise ValidationError({"delta": f"Estoque insuficiente. Disponível: {row['stock']}."})
        db.execute("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?",
                   (new_stock, product_id))
        db.execute("INSERT INTO stock_movements(product_id, delta, stock_after, reason) VALUES (?, ?, ?, ?)",
                   (product_id, delta, new_stock, reason))
    return get_product(product_id, admin=True)


def stock_movements(product_id=None, limit=100):
    sql = """SELECT m.*, p.name AS product_name FROM stock_movements m
             JOIN products p ON p.id = m.product_id"""
    params = []
    if product_id:
        sql += " WHERE m.product_id = ?"
        params.append(product_id)
    sql += " ORDER BY m.id DESC LIMIT ?"
    return [dict(r) for r in get_db().execute(sql, params + [limit]).fetchall()]


# ---------------------------------------------------------------- pedidos

def create_order(payload):
    errors = {}
    name = clean_str(payload.get("customer_name"), "customer_name", errors, min_len=2, max_len=80)
    phone = clean_phone(payload.get("customer_phone"), "customer_phone", errors)
    notes = clean_str(payload.get("notes"), "notes", errors, max_len=1000, required=False)
    items = payload.get("items")
    if not isinstance(items, list) or not items:
        errors["items"] = "O carrinho está vazio."
    elif len(items) > 50:
        errors["items"] = "Itens demais em um único pedido."
    if errors:
        raise ValidationError(errors)

    db = get_db()
    merged = {}
    for item in items:
        if not isinstance(item, dict):
            raise ValidationError({"items": "Item inválido."})
        e = {}
        pid = parse_int(item.get("product_id"), "product_id", e, min_value=1)
        qty = parse_int(item.get("quantity"), "quantity", e, min_value=1, max_value=99)
        if e:
            raise ValidationError({"items": "Produto ou quantidade inválidos."})
        merged[pid] = merged.get(pid, 0) + qty

    lines, total = [], 0
    for pid, qty in merged.items():
        row = db.execute(PRODUCT_SELECT + " WHERE p.id = ? AND p.active = 1", (pid,)).fetchone()
        if not row:
            raise ValidationError({"items": "Um dos produtos não está mais disponível."})
        if qty > row["stock"]:
            raise ValidationError({"items": f"“{row['name']}”: apenas {row['stock']} em estoque."})
        lines.append((row["id"], row["name"], row["final_cents"], qty))
        total += row["final_cents"] * qty

    code = "PC" + datetime.now().strftime("%y%m%d") + "-" + secrets.token_hex(2).upper()
    with db:
        cur = db.execute(
            "INSERT INTO orders(code, customer_name, customer_phone, notes, total_cents) VALUES (?, ?, ?, ?, ?)",
            (code, name, phone, notes, total),
        )
        db.executemany(
            "INSERT INTO order_items(order_id, product_id, product_name, unit_cents, quantity) VALUES (?, ?, ?, ?, ?)",
            [(cur.lastrowid, *line) for line in lines],
        )
    order = get_order(cur.lastrowid)
    order["whatsapp_url"] = whatsapp_url(order_message(order))
    return order


def order_message(order):
    store = get_settings().get("store_name") or "Papelaria Cristã"
    lines = [f"Olá, {store}! Gostaria de fazer o pedido *{order['code']}*:", ""]
    for it in order["items"]:
        lines.append(f"• {it['quantity']}x {it['product_name']} — {fmt_brl(it['unit_cents'] * it['quantity'])}")
    lines += ["", f"*Total: {fmt_brl(order['total_cents'])}*", f"Nome: {order['customer_name']}"]
    if order["notes"]:
        lines.append(f"Observações: {order['notes']}")
    return "\n".join(lines)


def whatsapp_url(message):
    number = get_settings().get("whatsapp")
    return f"https://wa.me/{number}?text={quote(message)}" if number else None


def get_order(order_id):
    db = get_db()
    row = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not row:
        return None
    order = dict(row)
    order["items"] = [dict(r) for r in db.execute(
        "SELECT product_id, product_name, unit_cents, quantity FROM order_items WHERE order_id = ?", (order_id,))]
    return order


def list_orders(status=None):
    db = get_db()
    sql, params = "SELECT id FROM orders", []
    if status:
        sql += " WHERE status = ?"
        params.append(status)
    sql += " ORDER BY id DESC LIMIT 200"
    return [get_order(r["id"]) for r in db.execute(sql, params).fetchall()]


def update_order_status(order_id, new_status):
    db = get_db()
    order = get_order(order_id)
    if not order:
        return None
    current = order["status"]
    if new_status not in ORDER_TRANSITIONS:
        raise ValidationError({"status": "Status inválido."})
    if new_status not in ORDER_TRANSITIONS[current]:
        raise ValidationError({"status": f"Não é possível mudar de “{current}” para “{new_status}”."})
    with db:
        if new_status in STOCK_TAKEN and current not in STOCK_TAKEN:
            # Baixa de estoque na confirmação — tudo ou nada.
            for it in order["items"]:
                if it["product_id"] is None:
                    continue
                row = db.execute("SELECT stock, name FROM products WHERE id = ?", (it["product_id"],)).fetchone()
                if row["stock"] < it["quantity"]:
                    raise ValidationError({"status": f"Estoque insuficiente de “{row['name']}” "
                                                     f"(disponível: {row['stock']})."})
                new_stock = row["stock"] - it["quantity"]
                db.execute("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?",
                           (new_stock, it["product_id"]))
                db.execute("INSERT INTO stock_movements(product_id, delta, stock_after, reason) VALUES (?, ?, ?, ?)",
                           (it["product_id"], -it["quantity"], new_stock, f"Pedido {order['code']} confirmado"))
        elif new_status == "cancelado" and current in STOCK_TAKEN:
            for it in order["items"]:
                if it["product_id"] is None:
                    continue
                row = db.execute("SELECT stock FROM products WHERE id = ?", (it["product_id"],)).fetchone()
                new_stock = row["stock"] + it["quantity"]
                db.execute("UPDATE products SET stock = ?, updated_at = datetime('now') WHERE id = ?",
                           (new_stock, it["product_id"]))
                db.execute("INSERT INTO stock_movements(product_id, delta, stock_after, reason) VALUES (?, ?, ?, ?)",
                           (it["product_id"], it["quantity"], new_stock, f"Pedido {order['code']} cancelado"))
        db.execute("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?", (new_status, order_id))
    return get_order(order_id)


def summary():
    db = get_db()
    one = lambda sql: db.execute(sql).fetchone()[0]  # noqa: E731
    return {
        "products_active": one("SELECT COUNT(*) FROM products WHERE active = 1"),
        "products_total": one("SELECT COUNT(*) FROM products"),
        "out_of_stock": one("SELECT COUNT(*) FROM products WHERE stock = 0"),
        "low_stock": one(f"SELECT COUNT(*) FROM products WHERE stock BETWEEN 1 AND {LOW_STOCK}"),
        "orders_pending": one("SELECT COUNT(*) FROM orders WHERE status = 'pendente'"),
        "revenue_cents": one("SELECT COALESCE(SUM(total_cents), 0) FROM orders "
                             "WHERE status IN ('confirmado', 'enviado', 'concluido')"),
        "whatsapp_configured": bool(get_settings().get("whatsapp")),
    }
