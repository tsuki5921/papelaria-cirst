"""Testes de ponta a ponta no navegador (Playwright).

Instalação:  pip install playwright && playwright install chromium
Para usar um Chrome já instalado: CHROME_PATH=/caminho/do/chrome pytest tests/test_e2e.py
"""
import os
import re
import threading
from urllib.parse import urljoin, urlparse

import pytest
from werkzeug.serving import make_server

from backend import auth
from backend.app import create_app

playwright = pytest.importorskip("playwright.sync_api")
PASSWORD = "senha-e2e-12345"
PAGES = ["index.html", "produtos.html", "ofertas.html", "produto.html?p=biblia-nvi-ele-vive",
         "sobre.html", "contato.html", "carrinho.html", "admin.html"]
VIEWPORTS = {"celular": (375, 812), "tablet": (768, 1024), "computador": (1366, 900)}


@pytest.fixture(scope="module")
def server(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("e2e")
    auth.reset_attempts()
    app = create_app({"DATABASE": str(tmp / "e2e.db"), "UPLOAD_DIR": str(tmp / "up"), "ADMIN_PASSWORD": PASSWORD})
    srv = make_server("127.0.0.1", 0, app, threaded=True)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_port}/"
    srv.shutdown()


@pytest.fixture(scope="module")
def browser():
    with playwright.sync_playwright() as p:
        path = os.environ.get("CHROME_PATH")
        try:
            b = p.chromium.launch(executable_path=path) if path else p.chromium.launch()
        except Exception as e:  # navegador não instalado
            pytest.skip(f"Navegador indisponível: {e}")
        yield b
        b.close()


@pytest.fixture
def page(browser, server):
    # bypass_csp: só para o Playwright poder avaliar expressões de espera (o site mantém a CSP)
    ctx = browser.new_context(viewport={"width": 1366, "height": 900}, base_url=server, bypass_csp=True)
    # Fontes do Google são opcionais (há fontes de reserva); bloqueadas para o teste não depender da internet.
    ctx.route(re.compile(r"fonts\.(googleapis|gstatic)\.com"), lambda r: r.abort())
    pg = ctx.new_page()
    pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    pg.on("console", lambda m: pg.errors.append(m.text)
          if m.type == "error" and "fonts.g" not in m.text and "ERR_FAILED" not in m.text else None)
    yield pg
    ctx.close()


# ---------------------------------------------------------------- 1. páginas e responsividade
@pytest.mark.parametrize("vp", VIEWPORTS)
def test_paginas_carregam_sem_erros_e_sem_rolagem_horizontal(page, vp):
    page.set_viewport_size(dict(zip(("width", "height"), VIEWPORTS[vp])))
    for path in PAGES:
        page.goto(path, wait_until="networkidle")
        assert page.locator("header.header").count() == 1, path
        assert page.locator("footer.rodape").count() == 1, path
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        assert overflow <= 1, f"{path} tem rolagem horizontal em {vp} ({overflow}px)"
    assert page.errors == []


def test_imagens_carregam(page):
    for path in ["index.html", "produtos.html"]:
        page.goto(path, wait_until="networkidle")
        page.evaluate("document.querySelectorAll('img[loading=lazy]').forEach(i => i.loading = 'eager')")
        page.wait_for_load_state("networkidle")
        broken = page.evaluate("[...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src)")
        assert broken == []


# ---------------------------------------------------------------- 2. links
def test_nenhum_link_quebrado(page, server):
    seen, broken = set(), []
    for path in PAGES:
        page.goto(path, wait_until="networkidle")
        for href in page.eval_on_selector_all("a[href]", "els => els.map(e => e.getAttribute('href'))"):
            if href.startswith(("http", "mailto:", "tel:", "#")):
                continue
            url = urljoin(server + path, href)
            if url in seen:
                continue
            seen.add(url)
            resp = page.request.get(url)
            if resp.status != 200:
                broken.append((path, href, resp.status))
    assert len(seen) > 20 and broken == []


# ---------------------------------------------------------------- 3/4. busca e filtros
def test_busca_pelo_cabecalho(page):
    page.goto("index.html")
    page.fill("#busca-topo", "biblia")
    page.press("#busca-topo", "Enter")
    page.wait_for_url(re.compile(r"produtos\.html\?q=biblia"))
    page.wait_for_selector(".produto")
    assert page.locator(".produto").count() == 5
    assert "5 produtos" in page.text_content("#contagem")


def test_filtros_por_categoria_preco_e_chips(page):
    page.goto("produtos.html", wait_until="networkidle")
    assert page.locator(".produto").count() == 8
    page.check('input[name="categoria"][value="livros"]')
    page.wait_for_function("document.querySelectorAll('.produto').length === 1")
    assert "categoria=livros" in page.url
    page.click('[data-remover="categoria"]')
    page.wait_for_function("document.querySelectorAll('.produto').length === 8")
    page.fill("#f-min", "60"); page.fill("#f-max", "80"); page.press("#f-max", "Enter")
    page.wait_for_function("document.querySelectorAll('.produto').length === 4")
    page.fill("#f-min", "100"); page.press("#f-min", "Enter")
    assert "não pode ser maior" in page.text_content("#erro-preco")
    page.click("button[type=reset]")
    page.wait_for_function("document.querySelectorAll('.produto').length === 8")


def test_categoria_vazia_mostra_em_breve(page):
    page.goto("produtos.html?categoria=mochilas", wait_until="networkidle")
    assert "em breve" in page.text_content("#lista").lower()


def test_pagina_de_ofertas_mostra_somente_ofertas(page):
    page.goto("ofertas.html", wait_until="networkidle")
    assert page.locator(".produto").count() == 3
    assert page.locator(".produto .etiqueta--oferta").count() == 3


def test_produto_inexistente(page):
    page.goto("produto.html?p=nao-existe", wait_until="networkidle")
    assert "Produto não encontrado" in page.text_content("#produto")


def test_menu_mobile(page):
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto("index.html")
    assert not page.is_visible("#menu")
    page.click(".menu-toggle")
    assert page.is_visible("#menu")
    page.click("#menu >> text=Sobre nós")
    page.wait_for_url(re.compile("sobre.html"))


# ---------------------------------------------------------------- 5/6. carrinho e cálculos
def money(page, sel):
    txt = page.text_content(sel)
    return float(re.sub(r"[^\d,]", "", txt).replace(",", "."))


def test_fluxo_completo_de_carrinho_e_pedido(page):
    page.goto("produtos.html?q=pao", wait_until="networkidle")
    page.click("[data-add-cart]")
    page.wait_for_selector(".toast")
    assert page.text_content("#cart-badge") == "1"

    page.goto("produto.html?p=biblia-harpa-deus-e-bom", wait_until="networkidle")
    page.click('[data-qtd="1"]')
    page.click('[data-qtd="1"]')
    assert page.text_content("#qtd") == "3"
    page.click("#adicionar")
    assert page.text_content("#cart-badge") == "4"

    page.goto("carrinho.html", wait_until="networkidle")
    assert page.locator(".cart-item").count() == 2
    assert money(page, "#r-total") == pytest.approx(49.90 + 3 * 79.90)
    assert money(page, "#r-economia") == pytest.approx(3 * 10.00)

    item = page.locator(".cart-item", has_text="Deus é bom")
    item.locator('[data-acao="menos"]').click()
    assert money(page, "#r-total") == pytest.approx(49.90 + 2 * 79.90)
    item.locator('[data-acao="mais"]').click()
    item.locator('[data-acao="mais"]').click()
    item.locator('[data-acao="mais"]').click()  # estoque é 5
    assert item.locator("output").text_content() == "5"
    assert item.locator('[data-acao="mais"]').is_disabled()
    page.locator(".cart-item", has_text="Pão Diário").locator('[data-acao="remover"]').click()
    assert page.locator(".cart-item").count() == 1
    assert money(page, "#r-total") == pytest.approx(5 * 79.90)

    # validação do formulário
    page.click("#finalizar")
    assert page.get_attribute("#c-nome", "aria-invalid") == "true"
    assert page.text_content('[data-erro="customer_phone"]')
    page.fill("#c-nome", "Ana Souza")
    page.fill("#c-tel", "11987654321")
    assert page.input_value("#c-tel") == "(11) 98765-4321"
    page.click("#finalizar")
    page.wait_for_selector("#sucesso:not([hidden])")
    assert re.search(r"Pedido PC\d{6}-\w{4} registrado", page.text_content("#sucesso"))
    assert page.is_hidden("#cart-badge")


def test_carrinho_vazio(page):
    page.goto("carrinho.html", wait_until="networkidle")
    assert "carrinho está vazio" in page.text_content("#itens")
    assert page.is_hidden("#resumo")


def test_carrinho_ajusta_preco_alterado(page):
    page.goto("produtos.html?q=chapman", wait_until="networkidle")
    page.click("[data-add-cart]")
    page.evaluate("""() => { const c = JSON.parse(localStorage.pc_cart_v1); c[0].final_cents = 1; c[0].qty = 50;
                     localStorage.pc_cart_v1 = JSON.stringify(c); }""")
    page.goto("carrinho.html", wait_until="networkidle")
    assert "preço" in page.text_content("#avisos") and "quantidade ajustada" in page.text_content("#avisos")
    assert money(page, "#r-total") == pytest.approx(5 * 39.90)


# ---------------------------------------------------------------- 7/8. painel administrativo
def login(page):
    page.goto("admin.html")
    page.fill("#senha", "errada")
    page.click("#login-form button")
    page.wait_for_selector('[data-erro="password"]:has-text("Senha incorreta")')
    page.fill("#senha", PASSWORD)
    page.click("#login-form button")
    page.wait_for_selector("#painel:not([hidden])")


def test_admin_cadastra_edita_estoque_e_exclui(page):
    login(page)
    assert page.locator(".metrica").count() == 5
    page.click("#tab-produtos")
    page.wait_for_selector("#tabela-produtos tr")
    page.click("#novo-produto")
    page.click("#salvar-produto")
    assert page.text_content('[data-erro="name"]')
    page.fill("#p-nome", "Caneta Gel Versículos")
    page.select_option("#p-cat", "canetas")
    page.fill("#p-preco", "12,50")
    page.fill("#p-promo", "15")
    page.fill("#p-estoque", "7")
    page.click("#salvar-produto")
    assert "menor que o preço normal" in page.text_content('[data-erro="promo_price"]')
    page.fill("#p-promo", "9,90")
    page.set_input_files("#p-foto", "frontend/img/produtos/biblia-nvi-ele-vive.jpg")
    page.wait_for_function("document.querySelector('#p-preview').src.includes('img/uploads/')")
    page.click("#salvar-produto")
    page.wait_for_selector("text=Produto cadastrado.")
    row = page.locator("#tabela-produtos tr", has_text="Caneta Gel")
    assert "7" in row.locator("td").nth(5).text_content()

    row.locator('[data-acao="estoque"]').click()
    page.select_option("#e-tipo", "-1")
    page.fill("#e-qtd", "50")
    page.click("#form-estoque [type=submit]")
    assert "insuficiente" in page.text_content('[data-erro="delta"]')
    page.fill("#e-qtd", "2")
    page.fill("#e-motivo", "Venda na loja física")
    page.click("#form-estoque [type=submit]")
    page.wait_for_selector("text=Estoque atualizado.")
    assert "5" in page.locator("#tabela-produtos tr", has_text="Caneta Gel").locator("td").nth(5).text_content()

    page.click("#tab-estoque")
    page.wait_for_selector("#tabela-movimentos >> text=Venda na loja física")

    # aparece na loja
    store = page.context.new_page()
    store.goto("produtos.html?categoria=canetas", wait_until="networkidle")
    assert store.locator(".produto", has_text="Caneta Gel").count() == 1
    store.close()

    page.click("#tab-produtos")
    page.locator("#tabela-produtos tr", has_text="Caneta Gel").locator('[data-acao="excluir"]').click()
    page.click("#confirmar-sim")
    page.wait_for_selector("text=Produto excluído.")
    assert page.locator("#tabela-produtos tr", has_text="Caneta Gel").count() == 0


def test_admin_configura_whatsapp_e_contato_aparece(page):
    login(page)
    page.click("#tab-config")
    page.wait_for_function("document.querySelector('#cf-nome').value !== ''")  # aguarda carregar
    page.fill("#cf-insta", "instagram.com/x")
    page.click("#form-config [type=submit]")
    page.wait_for_selector('[data-erro="instagram"]:has-text("https://")')
    page.fill("#cf-insta", "https://instagram.com/papelariacrista")
    page.fill("#cf-whats", "5511912345678")
    page.fill("#cf-end", "Rua Exemplo, 100")
    page.click("#form-config [type=submit]")
    page.wait_for_selector("text=Configurações salvas.")

    page.goto("contato.html", wait_until="networkidle")
    assert page.locator(".contato-card").count() == 3
    assert page.is_visible("#form-contato")
    page.goto("produto.html?p=biblia-nvi-ele-vive", wait_until="networkidle")
    href = page.get_attribute(".btn--whats", "href")
    assert href.startswith("https://wa.me/5511912345678?text=")


def test_admin_confirma_pedido_e_baixa_estoque(page, server):
    pid = page.request.get(server + "api/products/biblia-yeshua-leao-harpa").json()["id"]
    before = page.request.get(server + f"api/products/{pid}").json()["stock"]
    page.request.post(server + "api/orders", data={"customer_name": "João", "customer_phone": "11988887777",
                                                   "items": [{"product_id": pid, "quantity": 2}]})
    login(page)
    page.click("#tab-pedidos")
    pedido = page.locator(".pedido", has_text="João").first
    pedido.locator('[data-status="confirmado"]').click()
    page.wait_for_selector("text=Pedido marcado como confirmado.")
    assert page.request.get(server + f"api/products/{pid}").json()["stock"] == before - 2


def test_admin_sair(page):
    login(page)
    page.click("#sair")
    page.wait_for_selector("#login-view:not([hidden])")
    page.reload()
    assert page.is_visible("#login-view")
