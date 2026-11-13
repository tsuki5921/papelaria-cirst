"""Testes automatizados da API (pytest)."""
import io

from backend import auth


def first_product(client, **filters):
    return client.get("/api/products", query_string=filters).get_json()[0]


# ---------------------------------------------------------------- páginas e arquivos
def test_todas_as_paginas_carregam(client):
    for page in ["/", "/index.html", "/admin.html", "/css/style.css", "/js/core/layout.js",
                 "/robots.txt", "/img/favicon.svg"]:
        assert client.get(page).status_code == 200, page


def test_loja_e_um_arquivo_unico_autossuficiente(client):
    html = client.get("/").get_data(as_text=True)
    assert "<style>" in html and "<script>" in html
    assert 'src="js/' not in html and 'href="css/' not in html  # nada externo do próprio site
    assert html.count("data:image/jpeg;base64,") == 8           # as 8 fotos embutidas


def test_csp_da_loja_permite_apenas_os_scripts_embutidos(client):
    csp = client.get("/").headers["Content-Security-Policy"]
    assert "'sha256-" in csp and "unsafe-inline" not in csp and "unsafe-eval" not in csp


def test_paginas_antigas_redirecionam(client):
    casos = {"/produtos.html?categoria=biblias": "/#/produtos?cat=biblias",
             "/produto.html?p=biblia-nvi-ele-vive": "/#/produto/biblia-nvi-ele-vive",
             "/ofertas.html": "/#/ofertas", "/carrinho.html": "/#/carrinho",
             "/sobre.html": "/#/sobre", "/contato.html": "/#/contato", "/produtos.html": "/#/produtos"}
    for antigo, novo in casos.items():
        r = client.get(antigo)
        assert r.status_code == 301 and r.headers["Location"] == novo, antigo


def test_imagens_dos_produtos_existem(client):
    for p in client.get("/api/products").get_json():
        assert client.get("/" + p["image"]).status_code == 200, p["image"]


def test_404_html_e_json(client):
    r = client.get("/nao-existe.html")
    assert r.status_code == 404 and b"encontrada" in r.data
    assert client.get("/api/nada").get_json()["error"]


def test_path_traversal_bloqueado(client):
    assert client.get("/../backend/app.py").status_code == 404
    assert client.get("/%2e%2e/backend/app.py").status_code == 404


def test_cabecalhos_de_seguranca(client):
    r = client.get("/")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert "default-src 'self'" in r.headers["Content-Security-Policy"]
    assert r.headers["X-Frame-Options"] == "DENY"


# ---------------------------------------------------------------- catálogo público
def test_health(client):
    assert client.get("/api/health").get_json() == {"status": "ok"}


def test_lista_produtos_e_categorias(client):
    produtos = client.get("/api/products").get_json()
    assert len(produtos) == 8
    cats = client.get("/api/categories").get_json()
    slugs = [c["slug"] for c in cats]
    for esperado in ["biblias", "cadernos", "canetas", "lapis", "mochilas", "estojos", "papeis", "acessorios"]:
        assert esperado in slugs
    assert next(c for c in cats if c["slug"] == "biblias")["product_count"] == 5


def test_busca_ignora_acentos_e_maiusculas(client):
    for termo in ["biblia", "BÍBLIA", "bíblia"]:
        assert len(client.get("/api/products", query_string={"q": termo}).get_json()) == 5
    assert client.get("/api/products?q=chapman").get_json()[0]["slug"] == "as-5-linguagens-do-amor"
    assert client.get("/api/products?q=xyzinexistente").get_json() == []


def test_filtros(client):
    assert {p["category"]["slug"] for p in client.get("/api/products?category=biblias").get_json()} == {"biblias"}
    ofertas = client.get("/api/products?offer=1").get_json()
    assert ofertas and all(p["on_sale"] for p in ofertas)
    faixa = client.get("/api/products?min_price=50&max_price=80").get_json()
    assert faixa and all(5000 <= p["final_cents"] <= 8000 for p in faixa)
    assert client.get("/api/products?min_price=90&max_price=10").status_code == 400
    assert client.get("/api/products?min_price=abc").status_code == 400


def test_ordenacao_por_preco(client):
    asc = [p["final_cents"] for p in client.get("/api/products?sort=price_asc").get_json()]
    desc = [p["final_cents"] for p in client.get("/api/products?sort=price_desc").get_json()]
    assert asc == sorted(asc) and desc == sorted(desc, reverse=True)


def test_detalhe_por_slug_e_id(client):
    p = client.get("/api/products/biblia-nvi-ele-vive").get_json()
    assert p["name"].startswith("Bíblia Sagrada NVI")
    assert client.get(f"/api/products/{p['id']}").get_json()["slug"] == p["slug"]
    assert client.get("/api/products/nao-existe").status_code == 404


def test_desconto_calculado(client):
    p = client.get("/api/products/biblia-harpa-deus-e-bom").get_json()
    assert p["final_cents"] == p["promo_cents"] == 7990
    assert p["discount_percent"] == 11


def test_configuracoes_publicas_nao_expoem_senha(client):
    s = client.get("/api/settings").get_json()
    assert "admin_password_hash" not in s and s["store_name"] == "Papelaria Cristã"


# ---------------------------------------------------------------- pedidos
def novo_pedido(client, itens, **extra):
    body = {"customer_name": "Maria", "customer_phone": "(11) 98765-4321", "items": itens, **extra}
    return client.post("/api/orders", json=body)


def test_pedido_calcula_total_no_servidor(client):
    a = first_product(client, q="pao diario")
    b = client.get("/api/products/biblia-harpa-deus-e-bom").get_json()
    r = novo_pedido(client, [{"product_id": a["id"], "quantity": 2}, {"product_id": b["id"], "quantity": 1},
                             {"product_id": a["id"], "quantity": 1}])  # itens repetidos são somados
    assert r.status_code == 201
    pedido = r.get_json()
    assert pedido["total_cents"] == 3 * a["final_cents"] + b["final_cents"]
    assert pedido["status"] == "pendente" and pedido["code"].startswith("PC")
    assert pedido["whatsapp_url"] is None  # WhatsApp ainda não configurado


def test_pedido_ignora_preco_enviado_pelo_cliente(client):
    p = first_product(client)
    r = novo_pedido(client, [{"product_id": p["id"], "quantity": 1, "unit_cents": 1}], total_cents=1)
    assert r.get_json()["total_cents"] == p["final_cents"]


def test_pedido_validacoes(client):
    p = first_product(client)
    assert novo_pedido(client, []).status_code == 400
    assert novo_pedido(client, [{"product_id": p["id"], "quantity": 0}]).status_code == 400
    assert novo_pedido(client, [{"product_id": 99999, "quantity": 1}]).status_code == 400
    assert novo_pedido(client, [{"product_id": p["id"], "quantity": p["stock"] + 1}]).status_code == 400
    r = client.post("/api/orders", json={"customer_name": "", "customer_phone": "12", "items": [{"product_id": p["id"], "quantity": 1}]})
    assert set(r.get_json()["fields"]) == {"customer_name", "customer_phone"}
    assert client.post("/api/orders", data="nao-json").status_code == 400


def test_pedido_com_whatsapp_configurado(client, admin):
    client.put("/api/admin/settings", headers=admin, json={"store_name": "Papelaria Cristã", "whatsapp": "5511999990000"})
    p = first_product(client)
    url = novo_pedido(client, [{"product_id": p["id"], "quantity": 1}]).get_json()["whatsapp_url"]
    assert url.startswith("https://wa.me/5511999990000?text=")


# ---------------------------------------------------------------- autenticação
def test_admin_exige_login(client):
    for method, path in [("get", "/api/admin/products"), ("post", "/api/admin/products"),
                         ("get", "/api/admin/orders"), ("put", "/api/admin/settings"),
                         ("delete", "/api/admin/products/1"), ("get", "/api/admin/summary")]:
        assert getattr(client, method)(path, json={}).status_code == 401, path
    assert client.get("/api/admin/products", headers={"Authorization": "Bearer falso"}).status_code == 401


def test_login_senha_errada_e_limite(client):
    for _ in range(auth.MAX_ATTEMPTS):
        assert client.post("/api/admin/login", json={"password": "errada"}).status_code == 401
    assert client.post("/api/admin/login", json={"password": "errada"}).status_code == 429


def test_logout_invalida_token(client, admin):
    assert client.get("/api/admin/summary", headers=admin).status_code == 200
    client.post("/api/admin/logout", headers=admin)
    assert client.get("/api/admin/summary", headers=admin).status_code == 401


def test_senha_guardada_com_hash(app):
    from backend.db import connect
    valor = connect(app.config["DATABASE"]).execute(
        "SELECT value FROM settings WHERE key='admin_password_hash'").fetchone()[0]
    assert valor.startswith("pbkdf2_sha256$") and "senha-de-teste" not in valor


# ---------------------------------------------------------------- CRUD de produtos
NOVO = {"name": "Caderno Floral Salmo 23", "category": "cadernos", "price": "34,90",
        "stock": 10, "description": "Caderno <b>lindo</b>", "featured": True}


def test_cadastrar_editar_excluir(client, admin):
    r = client.post("/api/admin/products", headers=admin, json=NOVO)
    assert r.status_code == 201
    p = r.get_json()
    assert p["price_cents"] == 3490 and p["slug"] == "caderno-floral-salmo-23" and p["stock"] == 10
    assert client.get("/api/products?category=cadernos").get_json()[0]["id"] == p["id"]

    r = client.put(f"/api/admin/products/{p['id']}", headers=admin, json={"promo_price": "29.90", "name": "Caderno Floral"})
    assert r.get_json()["promo_cents"] == 2990 and r.get_json()["slug"] == "caderno-floral"

    r = client.put(f"/api/admin/products/{p['id']}", headers=admin, json={"active": False})
    assert client.get(f"/api/products/{p['id']}").status_code == 404  # oculto na loja
    assert client.get(f"/api/admin/products/{p['id']}", headers=admin).status_code == 200

    assert client.delete(f"/api/admin/products/{p['id']}", headers=admin).status_code == 200
    assert client.delete(f"/api/admin/products/{p['id']}", headers=admin).status_code == 404


def test_slug_unico(client, admin):
    a = client.post("/api/admin/products", headers=admin, json=NOVO).get_json()
    b = client.post("/api/admin/products", headers=admin, json=NOVO).get_json()
    assert a["slug"] != b["slug"]


def test_validacao_de_produto(client, admin):
    r = client.post("/api/admin/products", headers=admin,
                    json={"name": "x", "category": "inexistente", "price": "-1", "stock": -3})
    assert set(r.get_json()["fields"]) >= {"name", "category", "price", "stock"}
    r = client.post("/api/admin/products", headers=admin, json={**NOVO, "promo_price": "40"})
    assert "promo_price" in r.get_json()["fields"]
    r = client.post("/api/admin/products", headers=admin, json={**NOVO, "image": "../../etc/passwd"})
    assert "image" in r.get_json()["fields"]


def test_texto_salvo_sem_executar_html(client, admin):
    p = client.post("/api/admin/products", headers=admin, json={**NOVO, "name": "<script>alert(1)</script>"}).get_json()
    assert p["name"] == "<script>alert(1)</script>"  # guardado como texto; o front-end escapa ao exibir


# ---------------------------------------------------------------- estoque
def test_ajuste_de_estoque_e_historico(client, admin):
    p = first_product(client)
    r = client.post(f"/api/admin/products/{p['id']}/stock", headers=admin, json={"delta": 3, "reason": "Reposição"})
    assert r.get_json()["stock"] == p["stock"] + 3
    r = client.post(f"/api/admin/products/{p['id']}/stock", headers=admin, json={"delta": -999})
    assert r.status_code == 400
    assert client.post(f"/api/admin/products/{p['id']}/stock", headers=admin, json={"delta": 0}).status_code == 400
    mov = client.get(f"/api/admin/stock/movements?product_id={p['id']}", headers=admin).get_json()
    assert mov[0]["reason"] == "Reposição" and mov[0]["stock_after"] == p["stock"] + 3


def test_confirmar_pedido_baixa_estoque_e_cancelar_devolve(client, admin):
    p = first_product(client)
    pedido = novo_pedido(client, [{"product_id": p["id"], "quantity": 2}]).get_json()
    assert client.get(f"/api/products/{p['id']}").get_json()["stock"] == p["stock"]  # pendente não baixa

    r = client.patch(f"/api/admin/orders/{pedido['id']}", headers=admin, json={"status": "confirmado"})
    assert r.status_code == 200
    assert client.get(f"/api/products/{p['id']}").get_json()["stock"] == p["stock"] - 2

    client.patch(f"/api/admin/orders/{pedido['id']}", headers=admin, json={"status": "cancelado"})
    assert client.get(f"/api/products/{p['id']}").get_json()["stock"] == p["stock"]


def test_transicao_invalida_de_pedido(client, admin):
    p = first_product(client)
    pedido = novo_pedido(client, [{"product_id": p["id"], "quantity": 1}]).get_json()
    assert client.patch(f"/api/admin/orders/{pedido['id']}", headers=admin, json={"status": "concluido"}).status_code == 400
    assert client.patch(f"/api/admin/orders/{pedido['id']}", headers=admin, json={"status": "xyz"}).status_code == 400
    assert client.patch("/api/admin/orders/9999", headers=admin, json={"status": "cancelado"}).status_code == 404


def test_confirmacao_sem_estoque_nao_altera_nada(client, admin):
    p = first_product(client)
    pedido = novo_pedido(client, [{"product_id": p["id"], "quantity": p["stock"]}]).get_json()
    client.post(f"/api/admin/products/{p['id']}/stock", headers=admin, json={"delta": -p["stock"]})
    r = client.patch(f"/api/admin/orders/{pedido['id']}", headers=admin, json={"status": "confirmado"})
    assert r.status_code == 400
    assert client.get(f"/api/admin/orders?status=pendente", headers=admin).get_json()[0]["id"] == pedido["id"]


def test_resumo(client, admin):
    s = client.get("/api/admin/summary", headers=admin).get_json()
    assert s["products_active"] == 8 and s["whatsapp_configured"] is False


# ---------------------------------------------------------------- configurações e upload
def test_configuracoes_validacao(client, admin):
    r = client.put("/api/admin/settings", headers=admin,
                   json={"store_name": "Papelaria Cristã", "instagram": "javascript:alert(1)", "email": "x"})
    assert set(r.get_json()["fields"]) == {"instagram", "email"}
    r = client.put("/api/admin/settings", headers=admin,
                   json={"store_name": "Papelaria Cristã", "whatsapp": "+55 (11) 99999-0000",
                         "instagram": "https://instagram.com/papelaria"})
    assert r.get_json()["whatsapp"] == "5511999990000"


def test_upload_de_imagem(client, admin):
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
    r = client.post("/api/admin/upload", headers=admin, data={"image": (io.BytesIO(png), "foto.png")},
                    content_type="multipart/form-data")
    assert r.status_code == 201
    path = r.get_json()["path"]
    assert path.endswith(".png") and client.get("/" + path).status_code == 200


def test_upload_rejeita_arquivo_que_nao_e_imagem(client, admin):
    r = client.post("/api/admin/upload", headers=admin,
                    data={"image": (io.BytesIO(b"<?php echo 1; ?>"), "foto.jpg")}, content_type="multipart/form-data")
    assert r.status_code == 400


def test_certificado_https_gerado_e_reaproveitado(tmp_path):
    from backend.certs import ensure_certificate
    cert, key = ensure_certificate(tmp_path)
    conteudo = open(cert).read()
    assert "BEGIN CERTIFICATE" in conteudo and "PRIVATE KEY" in open(key).read()
    assert ensure_certificate(tmp_path) == (cert, key) and open(cert).read() == conteudo


def test_certificado_inclui_ip_da_rede_e_respeita_certificado_proprio(tmp_path):
    from cryptography import x509

    from backend.certs import ensure_certificate
    cert, _ = ensure_certificate(tmp_path, extra_ips=["192.168.0.10"])
    san = x509.load_pem_x509_certificate(open(cert, "rb").read()).extensions.get_extension_for_class(
        x509.SubjectAlternativeName).value
    assert "192.168.0.10" in [str(ip) for ip in san.get_values_for_type(x509.IPAddress)]
    # certificado próprio (ex.: mkcert, sem o arquivo de controle) nunca é sobrescrito
    (tmp_path / "gerado-automaticamente.txt").unlink()
    antes = open(cert).read()
    ensure_certificate(tmp_path, extra_ips=["10.0.0.5"])
    assert open(cert).read() == antes


def test_inicializacao_usa_proxima_porta_livre():
    import socket

    import run
    with socket.socket() as ocupada:
        ocupada.bind(("127.0.0.1", 0))
        ocupada.listen()
        assert run.port_free("127.0.0.1", ocupada.getsockname()[1]) is False
