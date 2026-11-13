"""Papelaria Cristã — servidor Flask (API REST + arquivos do site)."""
import os
import secrets
import time
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory

from . import auth, services
from .db import close_db, connect, get_db, init_db
from .validators import ValidationError

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
IMAGE_SIGNATURES = {b"\xff\xd8\xff": "jpg", b"\x89PNG\r\n\x1a\n": "png"}
_order_hits = {}


def create_app(config=None):
    app = Flask(__name__, static_folder=None)
    app.config.update(
        DATABASE=os.environ.get("PAPELARIA_DB", str(ROOT / "data" / "papelaria.db")),
        UPLOAD_DIR=str(FRONTEND / "img" / "uploads"),
        MAX_CONTENT_LENGTH=5 * 1024 * 1024,  # 5 MB
        ORDER_RATE_LIMIT=20,
    )
    if config:
        app.config.update(config)
    app.json.ensure_ascii = False
    app.json.sort_keys = False

    init_db(app.config["DATABASE"])
    _ensure_admin_password(app)
    app.teardown_appcontext(close_db)

    # ------------------------------------------------------------ erros
    @app.errorhandler(ValidationError)
    def _validation(err):
        return jsonify(error="Verifique os dados informados.", fields=err.errors), 400

    @app.errorhandler(404)
    def _not_found(_e):
        if request.path.startswith("/api/"):
            return jsonify(error="Recurso não encontrado."), 404
        return send_from_directory(FRONTEND, "404.html"), 404

    @app.errorhandler(405)
    def _not_allowed(_e):
        return jsonify(error="Método não permitido."), 405

    @app.errorhandler(413)
    def _too_large(_e):
        return jsonify(error="Arquivo muito grande (máximo 5 MB)."), 413

    @app.errorhandler(500)
    def _server_error(_e):
        return jsonify(error="Erro interno. Tente novamente."), 500

    @app.after_request
    def _security_headers(resp):
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        resp.headers["Content-Security-Policy"] = (
            "default-src 'self'; img-src 'self' data:; script-src 'self'; "
            "style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; "
            "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        )
        if request.path.startswith("/api/"):
            resp.headers["Cache-Control"] = "no-store"
        return resp

    def body():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise ValidationError("Envie os dados em formato JSON.")
        return data

    # ------------------------------------------------------------ API pública
    @app.get("/api/health")
    def health():
        get_db().execute("SELECT 1")
        return jsonify(status="ok")

    @app.get("/api/categories")
    def categories():
        return jsonify(services.list_categories())

    @app.get("/api/products")
    def products():
        return jsonify(services.list_products(request.args))

    @app.get("/api/products/<key>")
    def product(key):
        item = services.get_product(key)
        if not item:
            return jsonify(error="Produto não encontrado."), 404
        return jsonify(item)

    @app.get("/api/settings")
    def settings():
        return jsonify(services.get_settings())

    @app.post("/api/orders")
    def create_order():
        ip = request.remote_addr or "?"
        now = time.time()
        hits = [t for t in _order_hits.get(ip, []) if now - t < 600]
        if len(hits) >= app.config["ORDER_RATE_LIMIT"]:
            return jsonify(error="Muitos pedidos em sequência. Aguarde alguns minutos."), 429
        order = services.create_order(body())
        _order_hits[ip] = hits + [now]
        return jsonify(order), 201

    # ------------------------------------------------------------ autenticação
    @app.post("/api/admin/login")
    def login():
        ip = request.remote_addr or "?"
        if auth.too_many_attempts(ip):
            return jsonify(error="Muitas tentativas. Aguarde 15 minutos."), 429
        password = str(body().get("password", ""))
        stored = services.get_settings(public=False).get("admin_password_hash", "")
        if not password or not auth.verify_password(password, stored):
            auth.register_failure(ip)
            return jsonify(error="Senha incorreta."), 401
        return jsonify(token=auth.create_session())

    @app.post("/api/admin/logout")
    def logout():
        auth.destroy_session()
        return jsonify(ok=True)

    # ------------------------------------------------------------ API administrativa
    @app.get("/api/admin/summary")
    @auth.require_admin
    def admin_summary():
        return jsonify(services.summary())

    @app.get("/api/admin/products")
    @auth.require_admin
    def admin_products():
        return jsonify(services.list_products(request.args, admin=True))

    @app.get("/api/admin/products/<int:pid>")
    @auth.require_admin
    def admin_product(pid):
        item = services.get_product(pid, admin=True)
        return (jsonify(item), 200) if item else (jsonify(error="Produto não encontrado."), 404)

    @app.post("/api/admin/products")
    @auth.require_admin
    def admin_create_product():
        return jsonify(services.create_product(body())), 201

    @app.put("/api/admin/products/<int:pid>")
    @auth.require_admin
    def admin_update_product(pid):
        item = services.update_product(pid, body())
        return (jsonify(item), 200) if item else (jsonify(error="Produto não encontrado."), 404)

    @app.delete("/api/admin/products/<int:pid>")
    @auth.require_admin
    def admin_delete_product(pid):
        if not services.delete_product(pid):
            return jsonify(error="Produto não encontrado."), 404
        return jsonify(ok=True)

    @app.post("/api/admin/products/<int:pid>/stock")
    @auth.require_admin
    def admin_adjust_stock(pid):
        item = services.adjust_stock(pid, body())
        return (jsonify(item), 200) if item else (jsonify(error="Produto não encontrado."), 404)

    @app.get("/api/admin/stock/movements")
    @auth.require_admin
    def admin_movements():
        pid = request.args.get("product_id", type=int)
        return jsonify(services.stock_movements(pid))

    @app.get("/api/admin/orders")
    @auth.require_admin
    def admin_orders():
        return jsonify(services.list_orders(request.args.get("status") or None))

    @app.patch("/api/admin/orders/<int:oid>")
    @auth.require_admin
    def admin_update_order(oid):
        order = services.update_order_status(oid, str(body().get("status", "")))
        return (jsonify(order), 200) if order else (jsonify(error="Pedido não encontrado."), 404)

    @app.get("/api/admin/settings")
    @auth.require_admin
    def admin_settings():
        return jsonify(services.get_settings())

    @app.put("/api/admin/settings")
    @auth.require_admin
    def admin_save_settings():
        return jsonify(services.save_settings(body()))

    @app.post("/api/admin/upload")
    @auth.require_admin
    def admin_upload():
        file = request.files.get("image")
        if not file:
            raise ValidationError({"image": "Selecione uma imagem."})
        head = file.stream.read(16)
        file.stream.seek(0)
        ext = next((e for sig, e in IMAGE_SIGNATURES.items() if head.startswith(sig)), None)
        if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            ext = "webp"
        if not ext:
            raise ValidationError({"image": "Formato não suportado. Use JPG, PNG ou WEBP."})
        upload_dir = Path(app.config["UPLOAD_DIR"])
        upload_dir.mkdir(parents=True, exist_ok=True)
        name = f"{secrets.token_hex(8)}.{ext}"
        file.save(upload_dir / name)
        return jsonify(path=f"img/uploads/{name}"), 201

    # ------------------------------------------------------------ site (arquivos estáticos)
    @app.get("/img/uploads/<path:name>")
    def uploads(name):
        return send_from_directory(app.config["UPLOAD_DIR"], name)

    @app.get("/")
    def index():
        return send_from_directory(FRONTEND, "index.html")

    @app.get("/<path:path>")
    def static_files(path):
        if path.startswith("api/"):
            abort(404)
        return send_from_directory(FRONTEND, path)  # protege contra "../"

    return app


def _ensure_admin_password(app):
    conn = connect(app.config["DATABASE"])
    row = conn.execute("SELECT value FROM settings WHERE key = 'admin_password_hash'").fetchone()
    env_password = app.config.get("ADMIN_PASSWORD") or os.environ.get("ADMIN_PASSWORD")
    if env_password and (not row or not auth.verify_password(env_password, row["value"])):
        auth.set_admin_password(conn, env_password)
    elif not row or not row["value"]:
        generated = secrets.token_urlsafe(9)
        auth.set_admin_password(conn, generated)
        print("\n" + "=" * 62)
        print(f"  Senha do painel administrativo gerada: {generated}")
        print("  Guarde-a. Para trocar: python -m backend.manage senha")
        print("=" * 62 + "\n")
    conn.close()
