"""Testes de ponta a ponta no navegador (Playwright).

Instalação:  pip install playwright && playwright install chromium
Para usar um Chrome já instalado: CHROME_PATH=/caminho/do/chrome pytest tests/test_e2e.py
"""
import os
import re
import threading
from pathlib import Path

import pytest
from werkzeug.serving import make_server

from backend import auth
from backend.app import create_app

playwright = pytest.importorskip("playwright.sync_api")
ROOT = Path(__file__).resolve().parent.parent
PASSWORD = "senha-e2e-12345"
ROTAS = ["#/", "#/produtos", "#/ofertas", "#/produto/biblia-nvi-ele-vive", "#/favoritos",
         "#/carrinho", "#/sobre", "#/contato"]
TELAS = {"celular": (375, 812), "tablet": (768, 1024), "computador": (1366, 900)}


@pytest.fixture(scope="module")
def server(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("e2e")
    auth.reset_attempts()
    app = create_app({"DATABASE": str(tmp / "e2e.db"), "UPLOAD_DIR": str(tmp / "up"), "ADMIN_PASSWORD": PASSWORD,
                      "ORDER_RATE_LIMIT": 1000})
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


def novo_contexto(browser, base_url=None, **kw):
    # bypass_csp: só para o Playwright avaliar expressões de espera (o site mantém a CSP).
    ctx = browser.new_context(viewport={"width": 1366, "height": 900}, base_url=base_url, bypass_csp=True, **kw)
    # Fontes do Google e busca de CEP são externas: bloqueadas para o teste não depender da internet.
    ctx.route(re.compile(r"fonts\.(googleapis|gstatic)\.com|viacep\.com\.br"), lambda r: r.abort())
    pg = ctx.new_page()
    pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    pg.on("console", lambda m: pg.errors.append(m.text)
          if m.type == "error" and not re.search(r"fonts\.g|viacep|ERR_FAILED|status of 4\d\d", m.text) else None)
    return ctx, pg


@pytest.fixture
def page(browser, server):
    ctx, pg = novo_contexto(browser, server)
    yield pg
    ctx.close()


def abrir(page, rota):
    page.goto(rota if rota.startswith(("http", "file")) else "/" + rota)
    page.wait_for_function("document.documentElement.dataset.modo")


def money(page, sel):
    """Lê um valor em reais depois que a animação de contagem terminar."""
    anterior = None
    for _ in range(30):
        atual = page.text_content(sel)
        if atual == anterior:
            break
        anterior = atual
        page.wait_for_timeout(80)
    return float(re.sub(r"[^\d,]", "", anterior).replace(",", "."))


# ---------------------------------------------------------------- 1. páginas, telas e erros
@pytest.mark.parametrize("tela", TELAS)
def test_todas_as_rotas_carregam_sem_erros_e_sem_rolagem_horizontal(page, tela):
    page.set_viewport_size(dict(zip(("width", "height"), TELAS[tela])))
    abrir(page, "")
    assert page.evaluate("document.documentElement.dataset.modo") == "servidor"
    for rota in ROTAS:
        page.goto("/" + rota)
        page.wait_for_timeout(150)
        assert "não encontrad" not in page.text_content("#app").lower(), rota
        overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
        assert overflow <= 1, f"{rota} tem rolagem horizontal em {tela} ({overflow}px)"
    page.goto("/admin.html", wait_until="networkidle")
    assert page.errors == []


def test_imagens_carregam(page):
    for rota in ["#/", "#/produtos"]:
        abrir(page, rota)
        page.evaluate("document.querySelectorAll('img[loading=lazy]').forEach(i => i.loading = 'eager')")
        page.wait_for_load_state("networkidle")
        quebradas = page.evaluate("[...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.slice(0, 80))")
        assert quebradas == []


@pytest.mark.parametrize("largura", [800, 910, 1092, 1280, 1366, 1920])
def test_pc_usa_layout_de_computador(page, largura):
    """Notebooks com zoom de 125%/150% no Windows ficam entre ~850 e 1100 px no navegador."""
    page.set_viewport_size({"width": largura, "height": 800})
    abrir(page, "#/produtos")
    assert page.is_visible("#menu-pc >> text=Ofertas"), "menu completo deve aparecer no PC"
    assert page.is_hidden("#abrir-menu") and page.is_hidden(".barra-inferior")
    filtros, lista = page.locator("#filtros").bounding_box(), page.locator("#lista").bounding_box()
    assert lista["x"] >= filtros["x"] + filtros["width"] - 1, "filtros ao lado da lista"


@pytest.mark.parametrize("largura", [360, 390, 414])
def test_celular_menu_barra_inferior_e_filtros(page, largura):
    page.set_viewport_size({"width": largura, "height": 800})
    abrir(page, "#/produtos")
    assert page.is_visible(".barra-inferior") and page.is_hidden("#menu-pc")
    assert page.is_hidden("#filtros")
    page.click("#abrir-filtros")
    page.wait_for_selector("#filtros.aberto")
    page.check('#filtros input[name="cat"][value="livros"]')
    page.click("#filtros .botao-filtros")
    page.wait_for_function("document.querySelectorAll('#lista .cartao').length === 1")
    page.click("#abrir-menu")
    page.click("#menu-lateral >> text=Sobre nós")
    page.wait_for_url(re.compile("#/sobre"))
    page.wait_for_selector('#menu-lateral[aria-hidden="true"]', state="attached")
    page.wait_for_selector("#menu-lateral .painel-lateral__caixa", state="hidden")
    page.click(".barra-inferior >> text=Favoritos")
    page.wait_for_url(re.compile("#/favoritos"))


# ---------------------------------------------------------------- 2. links
def test_nenhum_link_quebrado(page):
    vistos, quebrados = set(), []
    for rota in ROTAS:
        abrir(page, rota)
        for href in page.eval_on_selector_all("a[href]", "els => els.map(e => e.getAttribute('href'))"):
            if href.startswith(("http", "mailto:", "tel:")) or href in vistos:
                continue
            vistos.add(href)
            if href.startswith("#/"):
                page.goto("/" + href)
                page.wait_for_timeout(60)
                if "não encontrad" in page.text_content("#app").lower():
                    quebrados.append((rota, href))
            elif page.request.get(page.url.split("#")[0].rsplit("/", 1)[0] + "/" + href).status != 200:
                quebrados.append((rota, href))
    assert len(vistos) > 25 and quebrados == []


def test_rota_inexistente_e_produto_inexistente(page):
    abrir(page, "#/nao-existe")
    assert "Página não encontrada" in page.text_content("#app")
    page.goto("/#/produto/nao-existe")
    page.wait_for_selector("text=Produto não encontrado")


def test_paginas_antigas_continuam_funcionando(page):
    page.goto("/produto.html?p=biblia-nvi-ele-vive")
    page.wait_for_selector("h1:has-text('Ele Vive')")


# ---------------------------------------------------------------- 3/4. busca e filtros
def test_busca_com_sugestoes(page):
    abrir(page, "")
    page.fill("#busca-campo", "biblia")
    page.wait_for_selector("#sugestoes:not([hidden]) a")
    assert page.locator("#sugestoes a").count() == 6  # 5 sugestões + "ver todos"
    assert "5 resultados" in page.text_content("#sugestoes .todos")
    page.press("#busca-campo", "Enter")
    page.wait_for_url(re.compile(r"#/produtos\?q=biblia"))
    page.wait_for_function("document.querySelectorAll('#lista .cartao').length === 5")
    page.fill("#busca-campo", "chapman")
    page.wait_for_selector("#sugestoes a:has-text('Linguagens')")
    page.click("#sugestoes a:has-text('Linguagens')")
    page.wait_for_url(re.compile("#/produto/as-5-linguagens-do-amor"))


def test_filtros_ordenacao_chips_e_limpar(page):
    abrir(page, "#/produtos")
    contar = "document.querySelectorAll('#lista .cartao').length"
    assert page.evaluate(contar) == 8
    page.check('input[name="cat"][value="biblias"]')
    page.wait_for_function(f"{contar} === 5")
    assert "cat=biblias" in page.url
    page.click('[data-faixa="50-80"]')
    page.wait_for_function(f"{contar} === 4")
    page.select_option("#f-ordem", "menor")
    precos = page.eval_on_selector_all("#lista .preco__atual", "els => els.map(e => e.textContent)")
    valores = [float(re.sub(r"[^\d,]", "", p).replace(",", ".")) for p in precos]
    assert valores == sorted(valores)
    page.click('[data-tirar="cat"]')
    page.wait_for_function(f"{contar} > 4")
    page.fill("#f-min", "100")
    page.fill("#f-max", "10")
    page.press("#f-max", "Enter")
    assert "mínimo" in page.text_content("#erro-preco")
    page.click("#filtros [data-limpar]")
    page.wait_for_function(f"{contar} === 8")
    assert page.text_content("#erro-preco") == ""


def test_categoria_vazia_ofertas_e_favoritos(page):
    abrir(page, "#/produtos?cat=mochilas")
    assert "em breve" in page.text_content("#lista").lower()
    page.goto("/#/ofertas")
    page.wait_for_function("document.querySelectorAll('#lista .cartao').length === 3")
    assert page.locator("#lista .selo--oferta").count() == 3


# ---------------------------------------------------------------- 5/6. carrinho, cálculos e pedido
def test_fluxo_completo_de_compra(page, server):
    abrir(page, "#/produtos?q=pao")
    page.click("[data-add]")
    page.wait_for_selector(".toast:has-text('Pão Diário')")
    assert page.text_content("#abrir-carrinho .contador") == "1"

    # página do produto: quantidade limitada ao estoque (5)
    page.goto("/#/produto/biblia-harpa-deus-e-bom")
    for _ in range(6):
        if page.is_enabled('[data-q="1"]'):
            page.click('[data-q="1"]')
    assert page.text_content(".comprar output") == "5"
    page.click('[data-q="-1"]')
    page.click('[data-q="-1"]')
    page.click("[data-comprar-add]")
    assert page.text_content("#abrir-carrinho .contador") == "4"

    # gaveta do carrinho
    page.click("#abrir-carrinho")
    page.wait_for_selector("#gaveta.aberto")
    assert page.locator(".gaveta-item").count() == 2
    assert money(page, "#gaveta .total-linha strong") == pytest.approx(49.90 + 3 * 79.90)
    page.click('#gaveta [data-qtd-mais="2"]') if page.locator('#gaveta [data-qtd-mais="2"]').count() else None
    page.click("#gaveta >> text=Finalizar compra")
    page.wait_for_url(re.compile("#/carrinho"))

    total_antes = money(page, "#total")
    item = page.locator(".item-carrinho", has_text="Pão Diário")
    item.locator("[data-qtd-mais]").click()
    assert money(page, "#total") == pytest.approx(total_antes + 49.90)
    item.locator("[data-remover]").click()
    page.click(".toast >> text=Desfazer")
    assert page.locator(".item-carrinho").count() == 2
    page.locator(".item-carrinho", has_text="Pão Diário").locator("[data-remover]").click()
    assert page.locator(".item-carrinho").count() == 1
    esperado = money(page, "#total")

    # validação
    page.click("#finalizar")
    assert page.get_attribute("#c-nome", "aria-invalid") == "true"
    page.fill("#c-nome", "Ana Souza")
    page.fill("#c-tel", "11987654321")
    assert page.input_value("#c-tel") == "(11) 98765-4321"
    page.check('input[name="entrega"][value="entregar"]')
    page.click("#finalizar")
    assert page.text_content('[data-erro="cep"]') and page.text_content('[data-erro="rua"]')
    page.fill("#c-cep", "01001000")
    page.wait_for_selector("#cep-dica:has-text('manualmente')")  # serviço de CEP indisponível no teste
    page.fill("#c-rua", "Rua das Flores"); page.fill("#c-num", "100")
    page.fill("#c-bairro", "Centro"); page.fill("#c-cidade", "São Paulo / SP")
    page.check('input[name="pagamento"][value="Pix"]')
    page.check("#c-presente")
    page.fill("#c-msg", "Com carinho")
    page.click("#finalizar")
    page.wait_for_selector("#tela-sucesso")
    codigo = re.search(r"PC\d{6}-\w{4}", page.text_content("#tela-sucesso h1")).group()
    assert "Rua das Flores" in page.text_content("#resumo-pedido")
    assert page.is_hidden("#abrir-carrinho .contador") or page.text_content("#abrir-carrinho .contador") == ""

    # o pedido foi registrado na API com o total calculado no servidor
    token = page.request.post(server + "api/admin/login", data={"password": PASSWORD}).json()["token"]
    pedidos = page.request.get(server + "api/admin/orders", headers={"Authorization": f"Bearer {token}"}).json()
    pedido = next(o for o in pedidos if o["code"] == codigo)
    assert pedido["total_cents"] / 100 == pytest.approx(esperado)
    assert "Pix" in pedido["notes"] and "presente" in pedido["notes"].lower() and "Rua das Flores" in pedido["notes"]


def test_carrinho_usa_preco_e_estoque_atuais(page, server):
    abrir(page, "#/produtos?q=chapman")
    page.click("[data-add]")
    page.evaluate("""() => { const c = JSON.parse(localStorage.pc_cart_v1); c[0].qty = 50; c[0].final_cents = 1;
                     localStorage.pc_cart_v1 = JSON.stringify(c); }""")
    page.goto("/#/carrinho")
    page.reload()
    page.wait_for_selector("#total")
    assert money(page, "#total") == pytest.approx(5 * 39.90)  # limitado ao estoque, preço do servidor


def test_carrinho_vazio_sugere_produtos(page):
    abrir(page, "#/carrinho")
    assert "carrinho está vazio" in page.text_content("#app")
    assert page.locator("#app .cartao").count() >= 1


def test_favoritos_espiar_e_carrossel(page):
    abrir(page, "")
    primeiro = page.locator("#vitrine [data-fav]").first
    primeiro.click()
    assert primeiro.get_attribute("aria-pressed") == "true"
    assert page.text_content(".acoes-topo .contador") == "1"
    page.goto("/#/favoritos")
    assert page.locator("#app .cartao").count() == 1
    page.click("#favs-carrinho")
    assert page.text_content("#abrir-carrinho .contador") == "1"

    page.goto("/#/")
    page.locator("#vitrine .cartao").first.hover()
    page.locator("#vitrine [data-espiar]").first.click()
    page.wait_for_selector("#modal-espiar[open] h2")
    page.click("#modal-espiar [data-fechar-modal]")
    assert page.is_hidden("#modal-espiar")

    page.click(".carrossel__seta--dir")
    assert page.get_attribute('[data-ir-slide="1"]', "aria-current") == "true"
    page.click('[data-ir-slide="0"]')
    assert page.get_attribute('[data-ir-slide="0"]', "aria-current") == "true"


# ---------------------------------------------------------------- animações
def test_animacoes_voo_coracoes_ondulacao_e_confete(page):
    abrir(page, "#/produtos")
    page.evaluate("""() => { window.__vistos = new Set();
      new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.className && window.__vistos.add(String(n.className)))))
        .observe(document.body, { childList: true, subtree: true }); }""")
    page.locator("#lista [data-add]").first.click()
    page.locator("#lista [data-fav]").first.click()
    page.wait_for_timeout(200)
    vistos = page.evaluate("[...window.__vistos]")
    assert "voando" in vistos, "foto deve voar até o carrinho"
    assert "particula" in vistos, "corações ao favoritar"
    assert "ondulacao" in vistos, "ondulação no botão"
    page.wait_for_timeout(1200)
    assert page.locator(".voando, .particula").count() == 0, "elementos temporários são removidos"
    page.goto("/#/carrinho")
    page.fill("#c-nome", "Ana"); page.fill("#c-tel", "11987654321")
    page.click("#finalizar")
    page.wait_for_selector("#tela-sucesso .check-anima")
    page.wait_for_selector(".confete", state="attached")


def test_sem_animacoes_para_quem_prefere_menos_movimento(browser, server):
    ctx, pg = novo_contexto(browser, server, reduced_motion="reduce")
    try:
        abrir(pg, "#/produtos")
        pg.locator("#lista [data-add]").first.click()
        pg.wait_for_timeout(100)
        assert pg.locator(".voando, .ondulacao").count() == 0
        assert pg.text_content("#abrir-carrinho .contador") == "1"  # a ação funciona normalmente
        assert pg.is_hidden(".petalas") if pg.locator(".petalas").count() else True
    finally:
        ctx.close()


# ---------------------------------------------------------------- arquivo único aberto sem servidor
def test_index_html_funciona_sozinho_sem_servidor(browser):
    ctx, pg = novo_contexto(browser)
    try:
        abrir(pg, (ROOT / "frontend" / "index.html").as_uri())
        assert pg.evaluate("document.documentElement.dataset.modo") == "independente"
        assert pg.locator("#vitrine .cartao").count() >= 4
        pg.goto((ROOT / "frontend" / "index.html").as_uri() + "#/produto/biblia-yeshua-leao-harpa")
        pg.click("[data-comprar-add]")
        pg.goto((ROOT / "frontend" / "index.html").as_uri() + "#/carrinho")
        pg.fill("#c-nome", "Maria"); pg.fill("#c-tel", "11999998888")
        pg.click("#finalizar")
        pg.wait_for_selector("#tela-sucesso")
        assert pg.locator("#copiar-pedido").count() == 1
        assert pg.locator("#enviar-whats").count() == 0  # WhatsApp não configurado: nenhum botão inútil
        assert "Área da loja" not in pg.text_content("#rodape")  # painel só existe com o servidor
        assert pg.errors == []
    finally:
        ctx.close()


# ---------------------------------------------------------------- painel administrativo
def login(page):
    page.goto("/admin.html")
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
    page.set_input_files("#p-foto", str(ROOT / "frontend/img/produtos/biblia-nvi-ele-vive.jpg"))
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
    page.click("#tab-estoque")
    page.wait_for_selector("#tabela-movimentos >> text=Venda na loja física")

    # aparece na loja, com a foto enviada
    loja = page.context.new_page()
    loja.goto("/#/produtos?cat=canetas")
    loja.wait_for_selector(".cartao:has-text('Caneta Gel')")
    assert "img/uploads/" in loja.get_attribute(".cartao img", "src")
    loja.close()

    page.click("#tab-produtos")
    page.locator("#tabela-produtos tr", has_text="Caneta Gel").locator('[data-acao="excluir"]').click()
    page.click("#confirmar-sim")
    page.wait_for_selector("text=Produto excluído.")


def test_admin_configura_whatsapp_e_loja_usa(page):
    login(page)
    page.click("#tab-config")
    page.wait_for_function("document.querySelector('#cf-nome').value !== ''")
    page.fill("#cf-insta", "instagram.com/x")
    page.click("#form-config [type=submit]")
    page.wait_for_selector('[data-erro="instagram"]:has-text("https://")')
    page.fill("#cf-insta", "https://instagram.com/papelariacrista")
    page.fill("#cf-whats", "5511912345678")
    page.fill("#cf-end", "Rua Exemplo, 100")
    page.click("#form-config [type=submit]")
    page.wait_for_selector("text=Configurações salvas.")

    abrir(page, "#/contato")
    assert page.locator(".canal").count() == 3
    assert page.is_visible("#form-contato")
    page.click("#form-contato [type=submit]")
    assert page.text_content('[data-erro="nome"]')
    page.fill("#m-nome", "Rute"); page.fill("#m-msg", "Vocês têm Bíblia de estudo?")
    page.click("#form-contato [type=submit]")
    assert "Rute" in page.get_attribute("#contato-link", "href").replace("%20", " ")
    page.goto("/#/produto/biblia-nvi-ele-vive")
    href = page.get_attribute("a:has-text('Tirar dúvidas')", "href")
    assert href.startswith("https://wa.me/5511912345678?text=")
    page.click("[data-comprar-add]")
    page.goto("/#/carrinho")
    page.fill("#c-nome", "Lia"); page.fill("#c-tel", "11988887777")
    page.click("#finalizar")
    page.wait_for_selector("#enviar-whats")
    assert page.get_attribute("#enviar-whats", "href").startswith("https://wa.me/5511912345678?text=")
    assert "Área da loja" in page.text_content("#rodape")


def test_admin_confirma_pedido_e_baixa_estoque(page, server):
    pid = page.request.get(server + "api/products/biblia-yeshua-leao-harpa").json()["id"]
    antes = page.request.get(server + f"api/products/{pid}").json()["stock"]
    page.request.post(server + "api/orders", data={"customer_name": "João", "customer_phone": "11988887777",
                                                   "items": [{"product_id": pid, "quantity": 2}]})
    login(page)
    page.click("#tab-pedidos")
    page.locator(".pedido", has_text="João").first.locator('[data-status="confirmado"]').click()
    page.wait_for_selector("text=Pedido marcado como confirmado.")
    assert page.request.get(server + f"api/products/{pid}").json()["stock"] == antes - 2


def test_admin_sair(page):
    login(page)
    page.click("#sair")
    page.wait_for_selector("#login-view:not([hidden])")
    page.reload()
    assert page.is_visible("#login-view")


# ---------------------------------------------------------------- HTTPS
def test_loja_funciona_em_https(browser, tmp_path):
    from backend.certs import ensure_certificate
    cert = ensure_certificate(tmp_path / "certs")
    app = create_app({"DATABASE": str(tmp_path / "s.db"), "UPLOAD_DIR": str(tmp_path / "u"), "ADMIN_PASSWORD": PASSWORD})
    srv = make_server("127.0.0.1", 0, app, threaded=True, ssl_context=cert)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    ctx, pg = novo_contexto(browser, f"https://localhost:{srv.server_port}/", ignore_https_errors=True)
    try:
        abrir(pg, "#/produtos")
        assert pg.url.startswith("https://") and pg.evaluate("window.isSecureContext") is True
        assert pg.evaluate("document.documentElement.dataset.modo") == "servidor"
        pg.click("[data-add]")
        assert pg.text_content("#abrir-carrinho .contador") == "1"
        assert pg.errors == []
    finally:
        ctx.close()
        srv.shutdown()
