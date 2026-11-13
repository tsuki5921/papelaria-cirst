"""Acesso ao banco de dados SQLite."""
import sqlite3
from pathlib import Path

from flask import current_app, g

from . import seed_data
from .validators import normalize

SCHEMA = Path(__file__).with_name("schema.sql")


def connect(path):
    conn = sqlite3.connect(path, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.create_function("norm", 1, normalize, deterministic=True)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def get_db():
    if "db" not in g:
        g.db = connect(current_app.config["DATABASE"])
    return g.db


def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db(path, seed=True):
    """Cria as tabelas e, se o banco estiver vazio, insere os dados iniciais."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = connect(path)
    with conn:
        conn.executescript(SCHEMA.read_text(encoding="utf-8"))
        for key, value in seed_data.DEFAULT_SETTINGS.items():
            conn.execute("INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)", (key, value))
        if seed and conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0] == 0:
            for pos, (slug, name, icon) in enumerate(seed_data.CATEGORIES):
                conn.execute(
                    "INSERT INTO categories(slug, name, icon, position) VALUES (?, ?, ?, ?)",
                    (slug, name, icon, pos),
                )
            cats = {r["slug"]: r["id"] for r in conn.execute("SELECT id, slug FROM categories")}
            for p in seed_data.PRODUCTS:
                cur = conn.execute(
                    """INSERT INTO products(slug, name, description, category_id, price_cents,
                       promo_cents, stock, image, featured)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (p["slug"], p["name"], p["description"], cats[p["category"]], p["price"],
                     p["promo"], p["stock"], p["image"], p["featured"]),
                )
                conn.execute(
                    "INSERT INTO stock_movements(product_id, delta, stock_after, reason) VALUES (?, ?, ?, ?)",
                    (cur.lastrowid, p["stock"], p["stock"], "Estoque inicial"),
                )
    conn.close()


def backup_db(src_path, dest_path):
    """Cópia consistente do banco (funciona com o servidor rodando)."""
    Path(dest_path).parent.mkdir(parents=True, exist_ok=True)
    src = sqlite3.connect(src_path)
    dst = sqlite3.connect(dest_path)
    with dst:
        src.backup(dst)
    src.close()
    dst.close()
