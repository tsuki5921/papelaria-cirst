"""Autenticação do painel administrativo.

- Senha guardada como hash PBKDF2-SHA256 (240 mil iterações + salt aleatório).
- Sessões por token aleatório; no banco fica apenas o SHA-256 do token.
- Limite de tentativas de login por IP para dificultar força bruta.
"""
import hashlib
import hmac
import secrets
import time
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import jsonify, request

from .db import get_db

ITERATIONS = 240_000
SESSION_HOURS = 8
MAX_ATTEMPTS = 5
WINDOW_SECONDS = 15 * 60
_attempts = {}  # ip -> [timestamps]


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), ITERATIONS).hex()
    return f"pbkdf2_sha256${ITERATIONS}${salt}${digest}"


def verify_password(password, stored):
    try:
        _algo, iterations, salt, digest = stored.split("$")
        check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations)).hex()
        return hmac.compare_digest(check, digest)
    except (ValueError, AttributeError):
        return False


def set_admin_password(conn, password):
    if len(password) < 8:
        raise ValueError("A senha precisa ter pelo menos 8 caracteres.")
    with conn:
        conn.execute(
            "INSERT INTO settings(key, value) VALUES ('admin_password_hash', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (hash_password(password),),
        )
        conn.execute("DELETE FROM admin_sessions")


def _token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def _now():
    return datetime.now(timezone.utc)


def too_many_attempts(ip):
    now = time.time()
    recent = [t for t in _attempts.get(ip, []) if now - t < WINDOW_SECONDS]
    _attempts[ip] = recent
    return len(recent) >= MAX_ATTEMPTS


def register_failure(ip):
    _attempts.setdefault(ip, []).append(time.time())


def reset_attempts():
    _attempts.clear()


def create_session():
    token = secrets.token_urlsafe(32)
    db = get_db()
    with db:
        db.execute("DELETE FROM admin_sessions WHERE expires_at < ?", (_now().isoformat(),))
        db.execute(
            "INSERT INTO admin_sessions(token_hash, expires_at) VALUES (?, ?)",
            (_token_hash(token), (_now() + timedelta(hours=SESSION_HOURS)).isoformat()),
        )
    return token


def _bearer():
    header = request.headers.get("Authorization", "")
    return header[7:].strip() if header.startswith("Bearer ") else ""


def destroy_session():
    token = _bearer()
    if token:
        db = get_db()
        with db:
            db.execute("DELETE FROM admin_sessions WHERE token_hash = ?", (_token_hash(token),))


def is_authenticated():
    token = _bearer()
    if not token:
        return False
    row = get_db().execute(
        "SELECT expires_at FROM admin_sessions WHERE token_hash = ?", (_token_hash(token),)
    ).fetchone()
    return bool(row) and datetime.fromisoformat(row["expires_at"]) > _now()


def require_admin(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not is_authenticated():
            return jsonify(error="Sessão expirada ou acesso não autorizado. Faça login."), 401
        return view(*args, **kwargs)
    return wrapper
