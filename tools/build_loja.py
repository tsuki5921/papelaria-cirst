"""Gera frontend/index.html — a loja inteira em UM arquivo.

Junta frontend/loja/index.template.html + loja.css + loja.js e embute o catálogo
(backend/seed_data.py) com as fotos em base64. O resultado abre com dois cliques,
sem servidor, e também funciona servido pelo backend (usa a API automaticamente).

    python tools/build_loja.py
"""
import base64
import io
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend import seed_data  # noqa: E402

SRC = ROOT / "frontend" / "loja"
OUT = ROOT / "frontend" / "index.html"
IMG_WIDTH = 720  # largura das fotos embutidas (nitidez boa em telas de alta densidade)


def image_data_uri(rel_path):
    path = ROOT / "frontend" / rel_path
    raw = path.read_bytes()
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        if im.width > IMG_WIDTH:
            im = im.resize((IMG_WIDTH, round(im.height * IMG_WIDTH / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=80, optimize=True, progressive=True)
        raw = buf.getvalue()
    except ImportError:
        pass  # sem Pillow: embute a foto original
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()


def catalog():
    cats = {slug: {"slug": slug, "name": name, "icon": icon, "product_count": 0}
            for slug, name, icon in seed_data.CATEGORIES}
    products = []
    for i, p in enumerate(seed_data.PRODUCTS, start=1):
        final = p["promo"] if p["promo"] is not None else p["price"]
        cat = cats[p["category"]]
        cat["product_count"] += 1
        products.append({
            "id": i, "slug": p["slug"], "name": p["name"], "description": p["description"],
            "category": {"slug": cat["slug"], "name": cat["name"]},
            "price_cents": p["price"], "promo_cents": p["promo"], "final_cents": final,
            "on_sale": p["promo"] is not None,
            "discount_percent": round(100 - p["promo"] * 100 / p["price"]) if p["promo"] is not None else 0,
            "stock": p["stock"], "in_stock": p["stock"] > 0,
            "image": image_data_uri(p["image"]), "featured": bool(p["featured"]),
        })
    settings = {k: v for k, v in seed_data.DEFAULT_SETTINGS.items()}
    return {"products": products, "categories": list(cats.values()), "settings": settings}


def main():
    template = (SRC / "index.template.html").read_text(encoding="utf-8")
    css = (SRC / "loja.css").read_text(encoding="utf-8")
    js = (SRC / "loja.js").read_text(encoding="utf-8")
    data = json.dumps(catalog(), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    marker = "/*__DADOS__*/ { products: [], categories: [], settings: {} }"
    assert marker in js, "marcador de dados não encontrado em loja.js"
    js = js.replace(marker, data)
    favicon = "data:image/svg+xml;base64," + base64.b64encode((ROOT / "frontend/img/favicon.svg").read_bytes()).decode()
    html = (template.replace("__CSS__", css).replace("__JS__", js).replace("__FAVICON__", favicon))
    OUT.write_text(html, encoding="utf-8")
    print(f"Gerado {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
