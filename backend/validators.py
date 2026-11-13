"""Validações executadas no servidor (nunca confiar só no front-end)."""
import re
import unicodedata
from decimal import Decimal, InvalidOperation


class ValidationError(Exception):
    def __init__(self, errors):
        if isinstance(errors, str):
            errors = {"geral": errors}
        self.errors = errors
        super().__init__("; ".join(f"{k}: {v}" for k, v in errors.items()))


def normalize(text):
    """Minúsculas e sem acentos — usado na busca ("biblia" encontra "Bíblia")."""
    if text is None:
        return ""
    text = unicodedata.normalize("NFKD", str(text))
    return "".join(c for c in text if not unicodedata.combining(c)).lower()


def slugify(text):
    slug = re.sub(r"[^a-z0-9]+", "-", normalize(text)).strip("-")
    return slug[:80] or "produto"


def clean_str(value, field, errors, *, min_len=0, max_len=255, required=True):
    if value is None:
        value = ""
    if not isinstance(value, (str, int, float)):
        errors[field] = "Valor inválido."
        return ""
    value = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", str(value)).strip()
    if required and not value:
        errors[field] = "Campo obrigatório."
    elif value and len(value) < min_len:
        errors[field] = f"Mínimo de {min_len} caracteres."
    elif len(value) > max_len:
        errors[field] = f"Máximo de {max_len} caracteres."
    return value


def parse_money(value, field, errors, *, required=True):
    """Aceita 79.9, "79,90", "R$ 1.299,90". Retorna centavos (int) ou None."""
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            errors[field] = "Informe um valor."
        return None
    if isinstance(value, bool):
        errors[field] = "Valor inválido."
        return None
    if isinstance(value, (int, float)):
        raw = str(value)
    else:
        raw = str(value).replace("R$", "").strip()
        if "," in raw:
            raw = raw.replace(".", "").replace(",", ".")
    try:
        amount = Decimal(raw)
    except InvalidOperation:
        errors[field] = "Valor inválido."
        return None
    if amount < 0:
        errors[field] = "O valor não pode ser negativo."
        return None
    if amount > Decimal("100000"):
        errors[field] = "Valor acima do permitido."
        return None
    return int((amount * 100).quantize(Decimal("1")))


def parse_int(value, field, errors, *, min_value=None, max_value=None, required=True, default=None):
    if value is None or value == "":
        if required:
            errors[field] = "Campo obrigatório."
        return default
    if isinstance(value, bool):
        errors[field] = "Deve ser um número inteiro."
        return default
    try:
        if isinstance(value, float) and not value.is_integer():
            raise ValueError
        number = int(value)
    except (TypeError, ValueError):
        errors[field] = "Deve ser um número inteiro."
        return default
    if min_value is not None and number < min_value:
        errors[field] = f"Deve ser no mínimo {min_value}."
    elif max_value is not None and number > max_value:
        errors[field] = f"Deve ser no máximo {max_value}."
    return number


def parse_bool(value):
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "sim", "on", "yes"}


def clean_phone(value, field, errors, *, required=True):
    digits = re.sub(r"\D", "", str(value or ""))
    if not digits:
        if required:
            errors[field] = "Informe um telefone."
        return ""
    if not 10 <= len(digits) <= 13:
        errors[field] = "Telefone inválido. Use DDD + número."
    return digits


def clean_url(value, field, errors):
    value = clean_str(value, field, errors, max_len=300, required=False)
    if value and not re.match(r"^https://[\w.-]+\.[a-z]{2,}(/\S*)?$", value, re.I):
        errors[field] = "Use um endereço completo começando com https://"
    return value


def clean_email(value, field, errors):
    value = clean_str(value, field, errors, max_len=120, required=False)
    if value and not re.match(r"^[^@\s]+@[^@\s]+\.[a-z]{2,}$", value, re.I):
        errors[field] = "E-mail inválido."
    return value
