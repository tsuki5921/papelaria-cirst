/* ==========================================================================
   Papelaria Cristã — loja em um único arquivo.
   Funciona de dois jeitos:
   1. Aberto sozinho (dois cliques no index.html, ou hospedado): usa o catálogo
      embutido abaixo e finaliza os pedidos direto pelo WhatsApp.
   2. Servido pelo backend Python (python run.py): usa os produtos, estoque e
      contatos do painel administrativo e registra os pedidos na API.
   ========================================================================== */
(() => {
  "use strict";

  /* ✏️  USANDO O index.html SOZINHO (sem o servidor Python)?
     Preencha os dados da loja aqui. Com o servidor, vale o que estiver no painel. */
  const CONFIGURACAO_LOJA = {
    whatsapp: "",   // DDI + DDD + número, só dígitos. Ex.: "5511987654321"
    phone: "",      // Ex.: "(11) 3333-4444"
    email: "",
    address: "",
    hours: "",      // Ex.: "Seg. a sáb., 9h às 18h"
    instagram: "",  // link completo: "https://instagram.com/sualoja"
    facebook: "",
  };

  const DADOS = /*__DADOS__*/ { products: [], categories: [], settings: {} };

  /* ------------------------------------------------------------------ utilidades */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const money = (c) => brl.format((c || 0) / 100);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const norm = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const digits = (v) => String(v ?? "").replace(/\D/g, "");
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const reduzMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado */ } },
  };
  const linhaCheia = (l) => l.slice(0, l.length >= 8 ? 8 : l.length >= 4 ? 4 : l.length); // sem cartão sozinho na linha
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  const ICON = {
    heart: '<svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-9.2-8.6C1.2 8.3 3 4.5 6.6 4.5c2 0 3.4 1.1 4.4 2.6 1-1.5 2.4-2.6 4.4-2.6 3.6 0 5.4 3.8 3.8 6.9C19 15.6 12 20 12 20z"/></svg>',
    eye: '<svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    bag: '<svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    check: '<svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
    whats: '<svg class="icone" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.2-.2-.4-.3z"/></svg>',
    share: '<svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    left: '<svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    right: '<svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    copy: '<svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    filter: '<svg class="icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
    flor: '<svg viewBox="0 0 100 100" aria-hidden="true"><path fill="currentColor" d="M50 4c9 19 9 31 0 46-9-15-9-27 0-46zm0 92c-9-19-9-31 0-46 9 15 9 27 0 46zM4 50c19-9 31-9 46 0-15 9-27 9-46 0zm92 0c-19 9-31 9-46 0 15-9 27-9 46 0z"/></svg>',
  };

  let logoN = 0;
  const logo = () => {
    const id = `g${++logoN}`;
    return `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f9dbe5"/><stop offset=".55" stop-color="#ddcdf1"/><stop offset="1" stop-color="#e2edfb"/></linearGradient></defs>
      <circle cx="24" cy="24" r="23" fill="url(#${id})"/><path d="M24 9v29M16.5 17.5h15" stroke="#3b2659" stroke-width="3" stroke-linecap="round"/>
      <path d="M10.5 35c4.5-.6 7.6-3.6 8.4-8.2-4.5.6-7.6 3.6-8.4 8.2z" fill="#c45a7c"/><path d="M37.5 35c-4.5-.6-7.6-3.6-8.4-8.2 4.5.6 7.6 3.6 8.4 8.2z" fill="#3a6cad"/></svg>`;
  };

  const VERSICULOS = [
    ["Lâmpada para os meus pés é a tua palavra, e luz para o meu caminho.", "Salmos 119:105"],
    ["Darei a vocês um coração novo e porei um espírito novo em vocês.", "Ezequiel 36:26"],
    ["O Senhor é o meu pastor; de nada terei falta.", "Salmos 23:1"],
    ["Tudo posso naquele que me fortalece.", "Filipenses 4:13"],
    ["O amor é paciente, o amor é bondoso.", "1 Coríntios 13:4"],
    ["Entregue o seu caminho ao Senhor; confie nele, e ele agirá.", "Salmos 37:5"],
    ["Tudo o que fizerem, façam de todo o coração, como para o Senhor.", "Colossenses 3:23"],
    ["Alegrem-se sempre no Senhor. Novamente direi: alegrem-se!", "Filipenses 4:4"],
  ];

  /* ------------------------------------------------------------------ estado */
  const S = {
    live: false,
    products: [],
    categories: [],
    settings: {},
    cart: store.get("pc_cart_v1", []).filter((i) => Number.isInteger(i?.id) && i.qty > 0).map((i) => ({ id: i.id, qty: i.qty })),
    favs: store.get("pc_favs_v1", []).filter(Number.isInteger),
    recent: store.get("pc_recent_v1", []).filter(Number.isInteger),
  };
  const byId = (id) => S.products.find((p) => p.id === id);
  const bySlug = (slug) => S.products.find((p) => p.slug === slug);

  async function api(path, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || 10000);
    try {
      const r = await fetch(`/api${path}`, {
        method: opts.method || "GET",
        headers: opts.body ? { "Content-Type": "application/json" } : {},
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw Object.assign(new Error(data?.error || "Erro ao falar com a loja."), { status: r.status, fields: data?.fields || {} });
      return data;
    } catch (e) {
      if (e.name === "AbortError" || e instanceof TypeError) throw Object.assign(new Error("Sem conexão com a loja. Tente novamente."), { status: 0, fields: {} });
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async function carregarDados() {
    if (/^https?:$/.test(location.protocol)) {
      try {
        const ok = await api("/health", { timeout: 2500 });
        if (ok?.status === "ok") {
          const [p, c, s] = await Promise.all([api("/products?limit=200"), api("/categories"), api("/settings")]);
          Object.assign(S, { products: p, categories: c, settings: s, live: true });
          return;
        }
      } catch { /* sem servidor: usa o catálogo embutido */ }
    }
    S.products = DADOS.products;
    S.categories = DADOS.categories;
    const preenchidos = Object.fromEntries(Object.entries(CONFIGURACAO_LOJA).filter(([, v]) => v));
    S.settings = { ...DADOS.settings, ...preenchidos };
  }

  /* ------------------------------------------------------------------ carrinho e favoritos */
  const cart = {
    itens() {
      return S.cart.map((i) => ({ ...i, p: byId(i.id) })).filter((i) => i.p && i.p.in_stock)
        .map((i) => ({ ...i, qty: Math.min(i.qty, i.p.stock, 99) }));
    },
    count() { return this.itens().reduce((s, i) => s + i.qty, 0); },
    total() { return this.itens().reduce((s, i) => s + i.qty * i.p.final_cents, 0); },
    cheio() { return this.itens().reduce((s, i) => s + i.qty * i.p.price_cents, 0); },
    qtd(id) { return S.cart.find((i) => i.id === id)?.qty || 0; },
    add(id, qty = 1) {
      const p = byId(id);
      if (!p || !p.in_stock) return 0;
      const atual = this.qtd(id);
      const add = Math.max(0, Math.min(qty, Math.min(p.stock, 99) - atual));
      if (!add) return 0;
      const item = S.cart.find((i) => i.id === id);
      if (item) item.qty += add; else S.cart.push({ id, qty: add });
      this.salvar(true);
      return add;
    },
    set(id, qty) {
      const p = byId(id);
      if (qty <= 0 || !p) return this.remover(id);
      const item = S.cart.find((i) => i.id === id);
      if (item) item.qty = Math.min(qty, p.stock, 99);
      this.salvar();
    },
    remover(id) { S.cart = S.cart.filter((i) => i.id !== id); this.salvar(); },
    limpar() { S.cart = []; this.salvar(); },
    salvar(anima) {
      S.cart = this.itens().map(({ id, qty }) => ({ id, qty }));
      store.set("pc_cart_v1", S.cart);
      atualizarContadores(anima ? "carrinho" : null);
      if ($("#gaveta").classList.contains("aberto")) renderGaveta();
      if (rotaAtual().nome === "carrinho" && !$("#tela-sucesso")) renderCarrinhoItens();
    },
  };

  function alternarFavorito(id, botao) {
    const p = byId(id);
    if (!p) return;
    const tem = S.favs.includes(id);
    S.favs = tem ? S.favs.filter((f) => f !== id) : [id, ...S.favs];
    store.set("pc_favs_v1", S.favs);
    $$(`[data-fav="${id}"]`).forEach((b) => {
      b.setAttribute("aria-pressed", String(!tem));
      b.setAttribute("aria-label", `${tem ? "Adicionar aos" : "Remover dos"} favoritos: ${p.name}`);
    });
    if (botao) { botao.classList.remove("coracao-anima"); void botao.offsetWidth; botao.classList.add("coracao-anima"); }
    if (!tem) explosao(botao);
    atualizarContadores(tem ? null : "favs");
    toast(tem ? `Removido dos favoritos.` : `“${p.name}” salvo nos favoritos.`, tem ? "" : "ok", { img: p.image });
    if (rotaAtual().nome === "favoritos") route();
  }

  function registrarVisto(id) {
    S.recent = [id, ...S.recent.filter((r) => r !== id)].slice(0, 8);
    store.set("pc_recent_v1", S.recent);
  }

  function atualizarContadores(anima) {
    const valores = { carrinho: cart.count(), favs: S.favs.filter(byId).length };
    $$("[data-contador]").forEach((el) => {
      const n = valores[el.dataset.contador];
      el.textContent = n ? (n > 99 ? "99+" : n) : "";
      el.dataset.n = n;
      if (anima === el.dataset.contador) { el.classList.remove("pulsa"); void el.offsetWidth; el.classList.add("pulsa"); }
    });
    $("#abrir-carrinho").setAttribute("aria-label", `Abrir carrinho (${plural(valores.carrinho, "item", "itens")})`);
  }

  /* ------------------------------------------------------------------ animações */
  const anima = !reduzMovimento && typeof Element.prototype.animate === "function";

  /** Alvo visível do carrinho: barra inferior no celular, ícone do topo no PC. */
  function alvoCarrinho() {
    const barra = $('.barra-inferior [data-rota="carrinho"]');
    return barra && barra.offsetParent ? barra : $("#abrir-carrinho");
  }

  /** A foto do produto "voa" até o carrinho. */
  function voarParaCarrinho(origem) {
    const alvo = alvoCarrinho();
    const pulsar = () => { alvo.classList.remove("alvo-carrinho"); void alvo.offsetWidth; alvo.classList.add("alvo-carrinho"); };
    if (!anima || !origem) return pulsar();
    const a = origem.getBoundingClientRect();
    const b = alvo.getBoundingClientRect();
    if (!a.width || a.bottom < 0 || a.top > innerHeight) return pulsar();
    const lado = Math.min(a.width, a.height, 180);
    const voo = document.createElement("img");
    voo.src = origem.currentSrc || origem.src;
    voo.alt = "";
    voo.className = "voando";
    Object.assign(voo.style, { width: `${lado}px`, height: `${lado * 1.25}px`, left: `${a.left + (a.width - lado) / 2}px`, top: `${a.top + (a.height - lado * 1.25) / 2}px` });
    document.body.append(voo);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    voo.animate([
      { transform: "translate(0, 0) scale(1) rotate(0)", opacity: 1 },
      { transform: `translate(${dx * .45}px, ${dy * .45 - 120}px) scale(.55) rotate(-8deg)`, opacity: 1, offset: .45 },
      { transform: `translate(${dx}px, ${dy}px) scale(.08) rotate(10deg)`, opacity: .35 },
    ], { duration: 820, easing: "cubic-bezier(.5, 0, .3, 1)" }).finished.then(() => { voo.remove(); pulsar(); }, () => voo.remove());
  }

  /** Pequena explosão de partículas a partir de um elemento. */
  function explosao(el, simbolos = ["♥", "♥", "✿", "♥"], qtd = 10) {
    if (!anima || !el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < qtd; i++) {
      const p = document.createElement("span");
      p.className = "particula";
      p.textContent = simbolos[i % simbolos.length];
      p.style.left = `${cx - 7}px`;
      p.style.top = `${cy - 7}px`;
      document.body.append(p);
      const ang = (Math.PI * 2 * i) / qtd + Math.random() * .4;
      const dist = 34 + Math.random() * 26;
      p.animate([
        { transform: "translate(0, 0) scale(.4)", opacity: 1 },
        { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist - 12}px) scale(1)`, opacity: 0 },
      ], { duration: 650 + Math.random() * 250, easing: "cubic-bezier(.2, .8, .3, 1)" }).finished.then(() => p.remove(), () => p.remove());
    }
  }

  /** Confete de pétalas (pedido concluído). */
  function confete() {
    if (!anima) return;
    const cores = ["#f3bfd0", "#c7b0e6", "#e2edfb", "#d9718f", "#9474c9", "#4f84c8", "#fff"];
    for (let i = 0; i < 46; i++) {
      const c = document.createElement("span");
      c.className = "confete";
      c.style.background = cores[i % cores.length];
      c.style.left = `${innerWidth / 2}px`;
      c.style.top = `${innerHeight * .35}px`;
      document.body.append(c);
      const ang = Math.random() * Math.PI * 2;
      const forca = 120 + Math.random() * Math.min(innerWidth * .4, 320);
      const x = Math.cos(ang) * forca, y = Math.sin(ang) * forca * .6 - 120;
      c.animate([
        { transform: "translate(0, 0) rotate(0) scale(.6)", opacity: 1 },
        { transform: `translate(${x}px, ${y}px) rotate(${Math.random() * 360}deg) scale(1)`, opacity: 1, offset: .35 },
        { transform: `translate(${x * 1.2}px, ${y + 420 + Math.random() * 200}px) rotate(${Math.random() * 720}deg) scale(.9)`, opacity: 0 },
      ], { duration: 2200 + Math.random() * 1200, easing: "cubic-bezier(.15, .7, .35, 1)" }).finished.then(() => c.remove(), () => c.remove());
    }
  }

  /** Valor em reais que "conta" até o novo número. */
  function animarValor(el, para) {
    if (!el) return;
    const de = Number(el.dataset.valor ?? para);
    el.dataset.valor = para;
    if (!anima || de === para) { el.textContent = money(para); return; }
    const t0 = performance.now(), dur = 450;
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = money(Math.round(de + (para - de) * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
    el.classList.remove("muda"); void el.offsetWidth; el.classList.add("muda");
  }

  /* ------------------------------------------------------------------ toasts */
  function toast(msg, tipo = "", { img, acao } = {}) {
    const el = document.createElement("div");
    el.className = `toast${tipo ? ` toast--${tipo}` : ""}`;
    el.innerHTML = `${img ? `<img src="${esc(img)}" alt="">` : ""}<span class="toast__txt">${esc(msg)}</span>${acao ? `<button type="button">${esc(acao.label)}</button>` : ""}`;
    if (acao) el.querySelector("button").addEventListener("click", () => { acao.fn(); fechar(); });
    $("#toasts").append(el);
    const fechar = () => { el.classList.add("sai"); setTimeout(() => el.remove(), 300); };
    setTimeout(fechar, 4200);
  }

  function adicionar(id, qty = 1, botao) {
    const p = byId(id);
    const n = cart.add(id, qty);
    if (!n) {
      toast(p && !p.in_stock ? "Produto esgotado." : `Todas as unidades disponíveis de “${p?.name}” já estão no carrinho.`, "erro");
      return 0;
    }
    const foto = botao?.closest(".cartao")?.querySelector(".cartao__midia img")
      || botao?.closest(".espiar")?.querySelector(".espiar__foto img")
      || (botao?.closest(".produto__info") && $("#foto-zoom img"));
    voarParaCarrinho(foto);
    if (botao) {
      const original = botao.innerHTML;
      botao.classList.add("adicionado");
      botao.innerHTML = `${ICON.check} Adicionado`;
      setTimeout(() => { botao.classList.remove("adicionado"); botao.innerHTML = original; }, 1600);
    }
    toast(`${n > 1 ? `${n}× ` : ""}${p.name}`, "ok", { img: p.image, acao: { label: "Ver carrinho", fn: () => abrirPainel("gaveta") } });
    return n;
  }

  /* ------------------------------------------------------------------ componentes */
  function selos(p) {
    const s = [];
    if (!p.in_stock) s.push('<span class="selo selo--esgotado">Esgotado</span>');
    if (p.on_sale) s.push(`<span class="selo selo--oferta">−${p.discount_percent}%</span>`);
    else if (p.featured) s.push('<span class="selo selo--destaque">Destaque</span>');
    if (p.in_stock && p.stock <= 2) s.push(`<span class="selo selo--ultimas">${p.stock === 1 ? "Última unidade" : `Últimas ${p.stock}`}</span>`);
    return s.join("");
  }

  function precoHtml(p, economia = true) {
    return `<div class="preco"><span class="preco__atual">${money(p.final_cents)}</span>
      ${p.on_sale ? `<span class="preco__antigo"><span class="sr-only">De </span>${money(p.price_cents)}</span>
      ${economia ? `<span class="preco__economia">Economize ${money(p.price_cents - p.final_cents)}</span>` : ""}` : ""}</div>`;
  }

  function cartao(p) {
    const url = `#/produto/${encodeURIComponent(p.slug)}`;
    const fav = S.favs.includes(p.id);
    return `<article class="cartao${p.in_stock ? "" : " cartao--esgotado"} revela">
      <div class="cartao__midia">
        <a href="${url}" tabindex="-1" aria-hidden="true"><img src="${esc(p.image || "")}" alt="" loading="lazy" decoding="async" width="400" height="500"></a>
        <div class="selos">${selos(p)}</div>
        <div class="ferramentas">
          <button class="ferramenta" type="button" data-fav="${p.id}" aria-pressed="${fav}" aria-label="${fav ? "Remover dos" : "Adicionar aos"} favoritos: ${esc(p.name)}">${ICON.heart}</button>
          <button class="ferramenta ferramenta--espiar" type="button" data-espiar="${p.id}" aria-label="Espiar ${esc(p.name)}">${ICON.eye}</button>
        </div>
      </div>
      <div class="cartao__corpo">
        <span class="cartao__cat">${esc(p.category.name)}</span>
        <h3 class="cartao__nome"><a href="${url}">${esc(p.name)}</a></h3>
        ${precoHtml(p)}
        <div class="cartao__acao">${p.in_stock
          ? `<button class="btn btn--sm" type="button" data-add="${p.id}">${ICON.bag} Adicionar</button>`
          : `<a class="btn btn--sm btn--claro" href="${url}">Ver detalhes</a>`}</div>
      </div>
    </article>`;
  }

  const vazio = (icone, titulo, texto, acao = "") =>
    `<div class="vazio"><div class="vazio__icone" aria-hidden="true">${icone}</div><h2>${esc(titulo)}</h2><p>${esc(texto)}</p>${acao}</div>`;

  const migalhas = (itens) => `<nav class="migalhas" aria-label="Você está em"><ol>
    <li><a href="#/">Início</a></li>${itens.map(([t, h]) => h ? `<li><a href="${h}">${esc(t)}</a></li>` : `<li aria-current="page">${esc(t)}</li>`).join("")}</ol></nav>`;

  function contatos() {
    const s = S.settings;
    const fone = (d) => { const n = digits(d).replace(/^55(?=\d{10,11}$)/, ""); return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : d; };
    const out = [];
    if (s.whatsapp) out.push({ i: "💬", l: "WhatsApp", v: fone(s.whatsapp), h: `https://wa.me/${digits(s.whatsapp)}` });
    if (s.phone) out.push({ i: "📞", l: "Telefone", v: s.phone, h: `tel:${digits(s.phone)}` });
    if (s.email) out.push({ i: "✉️", l: "E-mail", v: s.email, h: `mailto:${s.email}` });
    if (s.address) out.push({ i: "📍", l: "Endereço", v: s.address, h: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}` });
    if (s.hours) out.push({ i: "🕐", l: "Horário", v: s.hours });
    if (s.instagram) out.push({ i: "📷", l: "Instagram", v: s.instagram.replace(/^https?:\/\/(www\.)?/, ""), h: s.instagram });
    if (s.facebook) out.push({ i: "👍", l: "Facebook", v: s.facebook.replace(/^https?:\/\/(www\.)?/, ""), h: s.facebook });
    return out;
  }
  const externo = (h) => /^https?:/.test(h) ? ' target="_blank" rel="noopener noreferrer"' : "";
  const linkWhats = (msg) => S.settings.whatsapp ? `https://wa.me/${digits(S.settings.whatsapp)}?text=${encodeURIComponent(msg)}` : null;

  /* ------------------------------------------------------------------ estrutura fixa */
  const MENU = [["", "Início"], ["produtos", "Produtos"], ["ofertas", "Ofertas"], ["favoritos", "Favoritos"], ["sobre", "Sobre nós"], ["contato", "Contato"]];

  function montarEstrutura() {
    $$("[data-logo]").forEach((el) => (el.outerHTML = logo()));
    $("#menu-pc").innerHTML = MENU.filter(([r]) => r !== "favoritos")
      .map(([r, t]) => `<li><a href="#/${r}" data-rota="${r}">${t}</a></li>`).join("");

    const comProdutos = S.categories.filter((c) => c.product_count > 0);
    $("#menu-lateral-corpo").innerHTML = `
      <ul class="menu-movel">${MENU.map(([r, t]) => `<li><a href="#/${r}" data-rota="${r}">${t}</a></li>`).join("")}
        <li><a href="#/carrinho" data-rota="carrinho">Carrinho <small data-contador="carrinho" class="contador"></small></a></li></ul>
      <p class="menu-movel__titulo">Categorias</p>
      <ul class="menu-movel">${S.categories.map((c) => `<li><a href="#/produtos?cat=${esc(c.slug)}">${esc(c.icon)} ${esc(c.name)} <small>${c.product_count || "em breve"}</small></a></li>`).join("")}</ul>`;

    const ano = new Date().getFullYear();
    const cont = contatos();
    $("#rodape").innerHTML = `<div class="container rodape__grade">
      <div><a class="marca" href="#/">${logo()}<span class="marca__nome">Papelaria Cristã<small>papelaria com propósito</small></span></a>
        <p>Bíblias, devocionais, livros e presentes escolhidos com carinho para acompanhar sua fé e abençoar quem você ama.</p></div>
      <div><h2>Navegue</h2><ul>${MENU.map(([r, t]) => `<li><a href="#/${r}">${t}</a></li>`).join("")}<li><a href="#/carrinho">Carrinho</a></li>
        ${S.live ? '<li><a href="admin.html">Área da loja</a></li>' : ""}</ul></div>
      <div><h2>Categorias</h2><ul>${comProdutos.map((c) => `<li><a href="#/produtos?cat=${esc(c.slug)}">${esc(c.name)}</a></li>`).join("")}</ul></div>
      <div><h2>Atendimento</h2><ul><li><a href="#/contato">Fale conosco</a></li>
        ${cont.map((c) => `<li>${c.h ? `<a href="${esc(c.h)}"${externo(c.h)}>${c.i} ${esc(c.v)}</a>` : `${c.i} ${esc(c.v)}`}</li>`).join("")}</ul></div>
    </div>
    <div class="container rodape__base"><span>© ${ano} Papelaria Cristã. Todos os direitos reservados.</span>
      <span>“Tudo o que fizerem, façam de todo o coração.” — Colossenses 3:23</span></div>`;

    // avisos rotativos do topo (só informações verdadeiras)
    const ofertas = S.products.filter((p) => p.on_sale && p.in_stock);
    const msgs = ["✝ Bíblias, devocionais, livros e presentes que inspiram fé",
      ofertas.length ? `✿ Até ${Math.max(...ofertas.map((p) => p.discount_percent))}% de desconto em produtos selecionados` : null,
      "🎁 Monte seu carrinho e finalize em poucos passos"].filter(Boolean);
    $("#aviso-topo").innerHTML = msgs.map((m, i) => `<p class="${i === 0 ? "ativo" : ""}">${esc(m)}</p>`).join("");
    if (msgs.length > 1 && !reduzMovimento) {
      let i = 0;
      setInterval(() => {
        const ps = $$("#aviso-topo p");
        ps[i].classList.replace("ativo", "saindo");
        const atual = ps[i];
        setTimeout(() => atual.classList.remove("saindo"), 600);
        i = (i + 1) % ps.length;
        ps[i].classList.add("ativo");
      }, 4500);
    }
    atualizarContadores();
  }

  /* ------------------------------------------------------------------ painéis (menu e gaveta) */
  let ultimoFoco = null;
  function abrirPainel(id) {
    const el = $(`#${id}`);
    ultimoFoco = document.activeElement;
    if (id === "gaveta") renderGaveta();
    el.classList.add("aberto");
    el.setAttribute("aria-hidden", "false");
    document.body.classList.add("travado");
    (id === "gaveta" ? $("#abrir-carrinho") : $("#abrir-menu")).setAttribute("aria-expanded", "true");
    setTimeout(() => el.querySelector("[data-fechar-painel].icone-btn")?.focus(), 50);
  }
  function fecharPaineis() {
    $$(".painel-lateral.aberto").forEach((el) => { el.classList.remove("aberto"); el.setAttribute("aria-hidden", "true"); });
    document.body.classList.remove("travado");
    $("#abrir-carrinho").setAttribute("aria-expanded", "false");
    $("#abrir-menu").setAttribute("aria-expanded", "false");
    ultimoFoco?.focus?.();
  }

  function renderGaveta() {
    const itens = cart.itens();
    const corpo = $("#gaveta-corpo");
    const rodape = $("#gaveta-rodape");
    if (!itens.length) {
      corpo.innerHTML = vazio("🛍", "Seu carrinho está vazio", "Que tal conhecer nossas Bíblias e presentes?");
      rodape.innerHTML = `<a class="btn btn--bloco" href="#/produtos" data-fechar-painel>Ver produtos</a>`;
      return;
    }
    corpo.innerHTML = itens.map(({ p, qty }) => `
      <div class="gaveta-item">
        <img src="${esc(p.image)}" alt="">
        <div>
          <h3><a href="#/produto/${encodeURIComponent(p.slug)}" data-fechar-painel>${esc(p.name)}</a></h3>
          <span class="dica">${money(p.final_cents)} cada</span>
          <div class="gaveta-item__linha">
            <div class="qtd qtd--sm" role="group" aria-label="Quantidade de ${esc(p.name)}">
              <button type="button" data-qtd-menos="${p.id}" aria-label="Diminuir">−</button><output>${qty}</output>
              <button type="button" data-qtd-mais="${p.id}" aria-label="Aumentar"${qty >= Math.min(p.stock, 99) ? " disabled" : ""}>+</button>
            </div>
            <strong>${money(p.final_cents * qty)}</strong>
          </div>
          <button class="link-remover" type="button" data-remover="${p.id}">Remover</button>
        </div>
      </div>`).join("");
    const economia = cart.cheio() - cart.total();
    rodape.innerHTML = `
      ${economia > 0 ? `<div class="resumo__linha resumo__linha--ok"><span>Você economiza</span><span>${money(economia)}</span></div>` : ""}
      <div class="total-linha"><span>Total</span><strong>${money(cart.total())}</strong></div>
      <a class="btn btn--bloco" href="#/carrinho" data-fechar-painel>Finalizar compra</a>
      <button class="btn btn--bloco btn--fantasma" type="button" data-fechar-painel>Continuar comprando</button>`;
  }

  /* ------------------------------------------------------------------ busca com sugestões */
  function buscar(termo, lista = S.products) {
    const partes = norm(termo).split(/\s+/).filter(Boolean);
    if (!partes.length) return lista;
    return lista.filter((p) => {
      const alvo = norm(`${p.name} ${p.description} ${p.category.name}`);
      return partes.every((t) => alvo.includes(t));
    });
  }

  function montarBusca() {
    const form = $("#busca");
    const campo = $("#busca-campo");
    const caixa = $("#sugestoes");
    const fecharSug = () => { caixa.hidden = true; campo.setAttribute("aria-expanded", "false"); };
    const mostrar = debounce(() => {
      const t = campo.value.trim();
      if (t.length < 2) return fecharSug();
      const res = buscar(t);
      caixa.innerHTML = res.length
        ? res.slice(0, 5).map((p) => `<a href="#/produto/${encodeURIComponent(p.slug)}"><img src="${esc(p.image)}" alt="">
            <div><strong>${esc(p.name)}</strong><span>${money(p.final_cents)}</span></div></a>`).join("")
          + `<a class="todos" href="#/produtos?q=${encodeURIComponent(t)}">Ver ${plural(res.length, "resultado", "resultados")} →</a>`
        : `<p>Nenhum produto para “${esc(t)}”.</p>`;
      caixa.hidden = false;
      campo.setAttribute("aria-expanded", "true");
    }, 160);
    campo.addEventListener("input", mostrar);
    campo.addEventListener("focus", mostrar);
    campo.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fecharSug();
      if (e.key === "ArrowDown" && !caixa.hidden) { e.preventDefault(); caixa.querySelector("a")?.focus(); }
    });
    caixa.addEventListener("keydown", (e) => {
      const links = $$("a", caixa);
      const i = links.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); links[Math.min(i + 1, links.length - 1)]?.focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); (i <= 0 ? campo : links[i - 1]).focus(); }
      if (e.key === "Escape") { fecharSug(); campo.focus(); }
    });
    caixa.addEventListener("click", () => { fecharSug(); campo.blur(); });
    document.addEventListener("click", (e) => { if (!form.contains(e.target)) fecharSug(); });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const t = campo.value.trim();
      fecharSug();
      if (!t) return campo.focus();
      location.hash = `#/produtos?q=${encodeURIComponent(t)}`;
      campo.blur();
    });
  }

  /* ------------------------------------------------------------------ roteador */
  function rotaAtual() {
    const h = location.hash.replace(/^#\/?/, "");
    const [caminho, qs] = h.split("?");
    const partes = caminho.split("/").filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
    return { nome: partes[0] || "", partes, q: new URLSearchParams(qs || "") };
  }

  const ROTAS = {
    "": paginaInicio,
    produtos: (r) => paginaCatalogo(r, false),
    ofertas: (r) => paginaCatalogo(r, true),
    produto: paginaProduto,
    favoritos: paginaFavoritos,
    carrinho: paginaCarrinho,
    sobre: paginaSobre,
    contato: paginaContato,
  };

  let limpezaPagina = null;
  let ultimaRota = null;
  function route() {
    const r = rotaAtual();
    const mesmaPagina = ultimaRota && ultimaRota.nome === r.nome && ["produtos", "ofertas"].includes(r.nome);
    if (mesmaPagina && atualizarCatalogo) { fecharPaineis(); atualizarCatalogo(r); ultimaRota = r; return; }
    limpezaPagina?.(); limpezaPagina = null; atualizarCatalogo = null;
    fecharPaineis();
    $("#modal-espiar").open && $("#modal-espiar").close();
    const app = $("#app");
    app.classList.remove("app-entra"); void app.offsetWidth; app.classList.add("app-entra");
    (ROTAS[r.nome] || pagina404)(r);
    $$("[data-rota]").forEach((a) => a.toggleAttribute("aria-current", a.dataset.rota === r.nome || (r.nome === "produto" && a.dataset.rota === "produtos")));
    $$("[data-rota]").forEach((a) => a.hasAttribute("aria-current") && a.setAttribute("aria-current", "page"));
    if (ultimaRota) { window.scrollTo(0, 0); app.focus({ preventScroll: true }); }
    ultimaRota = r;
    revelar();
  }

  function meta(titulo, desc) {
    document.title = titulo ? `${titulo} | Papelaria Cristã` : "Papelaria Cristã | Bíblias, devocionais, livros e presentes cristãos";
    if (desc) $('meta[name="description"]').setAttribute("content", desc);
    $('meta[property="og:title"]').setAttribute("content", document.title);
  }

  function dadosEstruturados(obj) {
    $("#ld-json")?.remove();
    if (!obj) return;
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = "ld-json";
    s.textContent = JSON.stringify(obj);
    document.head.append(s);
  }

  /* ------------------------------------------------------------------ página inicial */
  function paginaInicio() {
    meta(null, "Papelaria Cristã: Bíblias, devocionais, livros cristãos e kits de presente escolhidos com carinho.");
    dadosEstruturados({ "@context": "https://schema.org", "@type": "Store", name: "Papelaria Cristã", description: "Bíblias, devocionais, livros e presentes cristãos." });
    const P = (slug) => bySlug(slug);
    const ofertas = S.products.filter((p) => p.on_sale && p.in_stock);
    const maxDesc = ofertas.length ? Math.max(...ofertas.map((p) => p.discount_percent)) : 0;
    const destaqueOferta = [...ofertas].sort((a, b) => b.discount_percent - a.discount_percent)[0];
    const qtdBiblias = S.products.filter((p) => p.category.slug === "biblias").length;

    const slides = [
      { foto: P("biblia-letra-gigante-harpa-pink") || S.products[0], selo: "✝ Bíblias", h: "A Palavra que acompanha <em>cada momento</em>",
        t: `${qtdBiblias ? `${plural(qtdBiblias, "modelo", "modelos")}: ` : ""}letra gigante, com Harpa, NVI e infantis. Encontre a Bíblia ideal para você ou para presentear.`,
        a: [["Ver Bíblias", "#/produtos?cat=biblias", ""], ["Todos os produtos", "#/produtos", "btn--claro"]] },
      { foto: P("kit-oi-deus-sou-eu-de-novo"), selo: "🎁 Presentes", h: "Presentes que <em>falam ao coração</em>",
        t: "Kits, devocionais e livros para abençoar aniversários, batismos e datas especiais.",
        a: [["Ver kits de presente", "#/produtos?cat=kits-presente", "btn--rosa"], ["Devocionais", "#/produtos?cat=devocionais", "btn--claro"]] },
      destaqueOferta && { foto: destaqueOferta, selo: "✿ Ofertas", h: `Até <em>${maxDesc}% de desconto</em>`,
        t: `${plural(ofertas.length, "produto selecionado", "produtos selecionados")} com preço especial. Aproveite enquanto durar o estoque.`,
        a: [["Ver ofertas", "#/ofertas", "btn--rosa"]], etiqueta: `<span>De ${money(destaqueOferta.price_cents)} por</span> <b>${money(destaqueOferta.final_cents)}</b>` },
      { foto: P("pao-diario-diario-de-oracao"), selo: "🕊 Devocionais", h: "Um tempo diário <em>com Deus</em>",
        t: "Diários de oração e devocionais para registrar pedidos, gratidão e o que Deus fala ao seu coração.",
        a: [["Conhecer", "#/produtos?cat=devocionais", ""]] },
    ].filter((s) => s && s.foto);

    const v = VERSICULOS[Math.floor(Date.now() / 864e5) % VERSICULOS.length];
    const destaques = S.products.filter((p) => p.featured);
    const recentes = S.recent.map(byId).filter(Boolean).slice(0, 4);
    const kit = P("kit-oi-deus-sou-eu-de-novo");
    const pao = P("pao-diario-diario-de-oracao");

    $("#app").innerHTML = `
    <section class="hero container" aria-label="Destaques da loja">
      <div class="carrossel" id="carrossel" aria-roledescription="carrossel">
        <div class="petalas" aria-hidden="true"><i class="petala"></i><i class="petala"></i><i class="petala"></i><i class="petala"></i><i class="petala"></i><i class="petala"></i></div>
        <div class="carrossel__trilho" id="trilho" aria-live="off">
          ${slides.map((s, i) => `
          <div class="slide slide--${i + 1}${i === 0 ? " ativo" : ""}" role="group" aria-roledescription="slide" aria-label="${i + 1} de ${slides.length}"${i ? ' aria-hidden="true"' : ""}>
            <span class="ornamento ornamento--a">${ICON.flor}</span><span class="ornamento ornamento--b">${ICON.flor}</span>
            <div class="slide__texto">
              <span class="slide__selo">${s.selo}</span>
              ${i === 0 ? "<h1>" : "<h2>"}${s.h}${i === 0 ? "</h1>" : "</h2>"}
              <p>${esc(s.t)}</p>
              <div class="slide__acoes">${s.a.map(([t, h, c]) => `<a class="btn ${c}" href="${h}"${i ? ' tabindex="-1"' : ""}>${t}</a>`).join("")}</div>
            </div>
            <div class="slide__arte">
              <a class="slide__foto" href="#/produto/${encodeURIComponent(s.foto.slug)}"${i ? ' tabindex="-1"' : ""}><img src="${esc(s.foto.image)}" alt="${esc(s.foto.name)}"${i ? ' loading="lazy"' : ""}></a>
              ${s.etiqueta ? `<span class="slide__etiqueta">${s.etiqueta}</span>` : ""}
            </div>
          </div>`).join("")}
        </div>
        ${slides.length > 1 ? `
        <button class="carrossel__seta carrossel__seta--esq" type="button" data-slide="-1" aria-label="Slide anterior">${ICON.left}</button>
        <button class="carrossel__seta carrossel__seta--dir" type="button" data-slide="1" aria-label="Próximo slide">${ICON.right}</button>
        <div class="carrossel__pontos">${slides.map((_, i) => `<button type="button" data-ir-slide="${i}" aria-label="Ir para o slide ${i + 1}" aria-current="${i === 0}"></button>`).join("")}</div>
        <div class="carrossel__barra" id="barra"></div>` : ""}
      </div>
      <div class="beneficios">
        <div class="beneficio revela"><span class="beneficio__icone" aria-hidden="true">✝</span><div><strong>Produtos que inspiram fé</strong><small>Bíblias, livros e devocionais</small></div></div>
        <div class="beneficio revela"><span class="beneficio__icone" aria-hidden="true">🎁</span><div><strong>Perfeito para presentear</strong><small>Inclua uma mensagem no pedido</small></div></div>
        <div class="beneficio revela"><span class="beneficio__icone" aria-hidden="true">💬</span><div><strong>Atendimento próximo</strong><small>Finalize falando com a loja</small></div></div>
        <div class="beneficio revela"><span class="beneficio__icone" aria-hidden="true">🔒</span><div><strong>Compra transparente</strong><small>Valores conferidos pela loja</small></div></div>
      </div>
    </section>

    <section class="secao secao--sem-topo container" aria-labelledby="t-cat">
      <div class="secao__cab"><div><span class="sobretitulo">Explore</span><h2 id="t-cat">Categorias</h2><p>Encontre o que você procura com facilidade.</p></div>
        <a class="btn btn--claro btn--sm" href="#/produtos">Ver tudo</a></div>
      <div class="categorias">${S.categories.map((c) => `
        <a class="categoria revela${c.product_count ? "" : " categoria--breve"}" href="#/produtos?cat=${esc(c.slug)}">
          <span class="categoria__icone" aria-hidden="true">${esc(c.icon)}</span><strong>${esc(c.name)}</strong>
          <small>${c.product_count ? plural(c.product_count, "produto", "produtos") : "Em breve"}</small></a>`).join("")}</div>
    </section>

    <section class="secao secao--sem-topo container" aria-labelledby="t-vitrine">
      <div class="secao__cab"><div><span class="sobretitulo">Vitrine</span><h2 id="t-vitrine">Escolhidos com carinho</h2></div>
        <div class="abas" role="tablist" aria-label="Filtrar vitrine">
          <button role="tab" type="button" aria-selected="true" data-vitrine="destaques">Destaques</button>
          ${ofertas.length ? '<button role="tab" type="button" aria-selected="false" data-vitrine="ofertas">Ofertas</button>' : ""}
          <button role="tab" type="button" aria-selected="false" data-vitrine="todos">Todos</button>
        </div></div>
      <div class="grade grade--4" id="vitrine" role="tabpanel">${linhaCheia(destaques.length ? destaques : S.products).map(cartao).join("")}</div>
    </section>

    ${kit && pao ? `
    <section class="secao secao--sem-topo container" aria-labelledby="t-presente">
      <div class="presente revela">
        <div>
          <span class="sobretitulo">Para presentear</span>
          <h2 id="t-presente">Um presente que fica <em>para sempre</em></h2>
          <p>Uma Bíblia, um devocional ou um kit pensado com carinho é uma forma linda de dizer “estou orando por você”.</p>
          <ul class="lista-check"><li>Kits prontos para presentear</li><li>Indique no pedido que é para presente e escreva uma mensagem</li><li>Combine a entrega direto com a loja</li></ul>
          <a class="btn btn--rosa" href="#/produtos?cat=kits-presente">Ver presentes</a>
        </div>
        <div class="presente__fotos">
          <a href="#/produto/${kit.slug}"><img src="${esc(kit.image)}" alt="${esc(kit.name)}" loading="lazy"></a>
          <a href="#/produto/${pao.slug}"><img src="${esc(pao.image)}" alt="${esc(pao.name)}" loading="lazy"></a>
        </div>
      </div>
    </section>` : ""}

    <section class="container" aria-label="Versículo do dia">
      <div class="versiculo revela">${ICON.flor}
        <span class="versiculo__rotulo">Versículo do dia</span>
        <blockquote>“${esc(v[0])}”<cite>${esc(v[1])}</cite></blockquote>${ICON.flor}
      </div>
    </section>

    ${recentes.length ? `
    <section class="secao container" aria-labelledby="t-rec">
      <div class="secao__cab"><div><span class="sobretitulo">Continue de onde parou</span><h2 id="t-rec">Vistos recentemente</h2></div></div>
      <div class="grade grade--4">${recentes.map(cartao).join("")}</div>
    </section>` : ""}`;

    // vitrine com abas
    const vitrine = $("#vitrine");
    $$("[data-vitrine]").forEach((b) => b.addEventListener("click", () => {
      $$("[data-vitrine]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      const lista = { destaques: destaques.length ? destaques : S.products, ofertas, todos: S.products }[b.dataset.vitrine];
      vitrine.innerHTML = linhaCheia(lista).map(cartao).join("");
      revelar(true);
    }));

    limpezaPagina = iniciarCarrossel(slides.length);
  }

  function iniciarCarrossel(total) {
    if (total < 2) return null;
    const car = $("#carrossel");
    const trilho = $("#trilho");
    const barra = $("#barra");
    const TEMPO = 6500;
    let atual = 0;
    let timer = null;
    let pausado = false;

    const ir = (i) => {
      atual = (i + total) % total;
      trilho.style.transform = `translateX(-${atual * 100}%)`;
      $$(".slide", trilho).forEach((s, n) => {
        s.classList.toggle("ativo", n === atual);
        s.toggleAttribute("aria-hidden", n !== atual);
        $$("a", s).forEach((a) => (n === atual ? a.removeAttribute("tabindex") : a.setAttribute("tabindex", "-1")));
      });
      $$("[data-ir-slide]").forEach((b, n) => b.setAttribute("aria-current", String(n === atual)));
      reiniciar();
    };
    const reiniciar = () => {
      clearTimeout(timer);
      barra.classList.remove("anda"); void barra.offsetWidth;
      if (reduzMovimento) return;
      barra.style.setProperty("--tempo", `${TEMPO}ms`);
      barra.classList.add("anda");
      if (!pausado) timer = setTimeout(() => ir(atual + 1), TEMPO);
    };
    const pausar = (p) => {
      pausado = p;
      car.classList.toggle("pausado", p);
      if (p) clearTimeout(timer); else reiniciar();
    };
    car.addEventListener("click", (e) => {
      const seta = e.target.closest("[data-slide]");
      const ponto = e.target.closest("[data-ir-slide]");
      if (seta) ir(atual + Number(seta.dataset.slide));
      if (ponto) ir(Number(ponto.dataset.irSlide));
    });
    car.addEventListener("mouseenter", () => pausar(true));
    car.addEventListener("mouseleave", () => pausar(false));
    car.addEventListener("focusin", () => pausar(true));
    car.addEventListener("focusout", () => pausar(false));
    car.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") ir(atual + 1);
      if (e.key === "ArrowLeft") ir(atual - 1);
    });
    // deslizar com o dedo
    let x0 = null;
    trilho.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; pausar(true); }, { passive: true });
    trilho.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) ir(atual + (dx < 0 ? 1 : -1));
      x0 = null;
      pausar(false);
    });
    // profundidade: foto e enfeites acompanham o mouse
    if (anima && matchMedia("(hover: hover)").matches) {
      car.addEventListener("pointermove", (e) => {
        const r = car.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        car.style.setProperty("--mx", x.toFixed(3));
        car.style.setProperty("--my", y.toFixed(3));
      });
      car.addEventListener("pointerleave", () => { car.style.setProperty("--mx", 0); car.style.setProperty("--my", 0); });
    }
    const visibilidade = () => pausar(document.hidden);
    document.addEventListener("visibilitychange", visibilidade);
    reiniciar();
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", visibilidade); };
  }

  /* ------------------------------------------------------------------ catálogo e ofertas */
  let atualizarCatalogo = null;

  function paginaCatalogo(r, modoOfertas) {
    const cats = S.categories;
    $("#app").innerHTML = `
    <div class="container pagina-cab">
      <div id="cat-migalhas"></div>
      <h1 id="cat-titulo"></h1><p id="cat-sub"></p>
    </div>
    <div class="container catalogo">
      <form class="filtros" id="filtros" aria-label="Filtros">
        <div class="filtros__cab"><h2>Filtrar</h2><button class="icone-btn" type="button" data-fechar-filtros aria-label="Fechar filtros">✕</button></div>
        <div class="filtro"><label class="filtro__rotulo" for="f-q">Buscar</label><input id="f-q" name="q" type="search" maxlength="80" placeholder="Nome, autor, tema…"></div>
        <fieldset class="filtro"><legend>Categoria</legend>
          <label class="opcao"><input type="radio" name="cat" value=""> Todas <small>${S.products.length}</small></label>
          ${cats.map((c) => `<label class="opcao"><input type="radio" name="cat" value="${esc(c.slug)}"> ${esc(c.name)} <small>${c.product_count}</small></label>`).join("")}
        </fieldset>
        <fieldset class="filtro"><legend>Preço (R$)</legend>
          <div class="faixa-preco"><label class="sr-only" for="f-min">Preço mínimo</label><input id="f-min" name="min" type="number" min="0" step="1" inputmode="numeric" placeholder="Mín.">
          <label class="sr-only" for="f-max">Preço máximo</label><input id="f-max" name="max" type="number" min="0" step="1" inputmode="numeric" placeholder="Máx."></div>
          <div class="atalhos-preco"><button class="atalho" type="button" data-faixa="0-50">Até R$ 50</button><button class="atalho" type="button" data-faixa="50-80">R$ 50 a 80</button><button class="atalho" type="button" data-faixa="80-">Acima de R$ 80</button></div>
          <span class="erro" id="erro-preco" role="alert"></span>
        </fieldset>
        <fieldset class="filtro"><legend>Mostrar</legend>
          ${modoOfertas ? "" : '<label class="opcao"><input type="checkbox" name="ofertas"> Somente ofertas</label>'}
          <label class="opcao"><input type="checkbox" name="estoque"> Somente disponíveis</label>
          <label class="opcao"><input type="checkbox" name="favs"> Meus favoritos</label>
        </fieldset>
        <button class="btn btn--claro btn--bloco" type="button" data-limpar>Limpar filtros</button>
        <button class="btn btn--bloco botao-filtros" type="button" data-fechar-filtros>Ver resultados</button>
      </form>
      <section aria-labelledby="cat-titulo">
        <div class="resultado-cab">
          <p id="contagem" aria-live="polite"></p>
          <div class="direita">
            <button class="btn btn--claro btn--sm botao-filtros" type="button" id="abrir-filtros" aria-controls="filtros" aria-expanded="false">${ICON.filter} Filtrar</button>
            <label class="sr-only" for="f-ordem">Ordenar por</label>
            <select class="entrada" id="f-ordem" name="ordem" form="filtros">
              <option value="">Mais relevantes</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option>
              <option value="desconto">Maior desconto</option><option value="nome">Nome (A–Z)</option>
            </select>
          </div>
        </div>
        <div class="chips" id="chips"></div>
        <div class="grade" id="lista"></div>
      </section>
    </div>`;

    const form = $("#filtros");
    const f = form.elements;
    const ordem = $("#f-ordem");

    const lerForm = () => ({
      q: f.q.value.trim(), cat: form.querySelector('[name="cat"]:checked')?.value || "",
      min: f.min.value, max: f.max.value, ofertas: !!f.ofertas?.checked, estoque: f.estoque.checked, favs: f.favs.checked, ordem: ordem.value,
    });
    const escreverUrl = (st) => {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(st)) if (v === true) p.set(k, "1"); else if (v) p.set(k, v);
      const novo = `#/${modoOfertas ? "ofertas" : "produtos"}${p.toString() ? `?${p}` : ""}`;
      if (location.hash !== novo) history.replaceState(null, "", novo);
    };
    const preencher = (q) => {
      f.q.value = q.get("q") || "";
      const radio = form.querySelector(`[name="cat"][value="${CSS.escape(q.get("cat") || "")}"]`) || form.querySelector('[name="cat"][value=""]');
      radio.checked = true;
      f.min.value = q.get("min") || ""; f.max.value = q.get("max") || "";
      if (f.ofertas) f.ofertas.checked = q.get("ofertas") === "1";
      f.estoque.checked = q.get("estoque") === "1"; f.favs.checked = q.get("favs") === "1";
      ordem.value = q.get("ordem") || "";
    };

    const aplicar = () => {
      const st = lerForm();
      escreverUrl(st);
      const cat = cats.find((c) => c.slug === st.cat);
      const titulo = st.q ? `Resultados para “${st.q}”` : cat ? (modoOfertas ? `Ofertas em ${cat.name}` : cat.name) : modoOfertas ? "Ofertas especiais" : "Nossos produtos";
      $("#cat-titulo").textContent = titulo;
      $("#cat-sub").textContent = modoOfertas ? "Produtos selecionados com preço especial." : cat ? `Produtos da categoria ${cat.name}.` : "Bíblias, devocionais, livros e presentes escolhidos com carinho.";
      $("#cat-migalhas").innerHTML = migalhas(cat ? [[modoOfertas ? "Ofertas" : "Produtos", `#/${modoOfertas ? "ofertas" : "produtos"}`], [cat.name]] : [[modoOfertas ? "Ofertas" : "Produtos"]]);
      meta(cat ? cat.name : modoOfertas ? "Ofertas" : "Produtos", cat ? `${cat.name} na Papelaria Cristã.` : null);

      // validação de preço
      const min = st.min === "" ? null : Number(st.min);
      const max = st.max === "" ? null : Number(st.max);
      let erro = "";
      if ((min !== null && (isNaN(min) || min < 0)) || (max !== null && (isNaN(max) || max < 0))) erro = "Use valores positivos.";
      else if (min !== null && max !== null && min > max) erro = "O mínimo não pode ser maior que o máximo.";
      $("#erro-preco").textContent = erro;
      f.min.toggleAttribute("aria-invalid", !!erro); f.max.toggleAttribute("aria-invalid", !!erro);

      let lista = buscar(st.q);
      if (cat) lista = lista.filter((p) => p.category.slug === cat.slug);
      if (modoOfertas || st.ofertas) lista = lista.filter((p) => p.on_sale);
      if (st.estoque) lista = lista.filter((p) => p.in_stock);
      if (st.favs) lista = lista.filter((p) => S.favs.includes(p.id));
      if (!erro && min !== null) lista = lista.filter((p) => p.final_cents >= min * 100);
      if (!erro && max !== null) lista = lista.filter((p) => p.final_cents <= max * 100);
      const ord = {
        menor: (a, b) => a.final_cents - b.final_cents, maior: (a, b) => b.final_cents - a.final_cents,
        desconto: (a, b) => b.discount_percent - a.discount_percent, nome: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
      }[st.ordem] || ((a, b) => (b.in_stock - a.in_stock) || (b.featured - a.featured) || a.name.localeCompare(b.name, "pt-BR"));
      lista = [...lista].sort(ord);

      const chips = [];
      if (st.q) chips.push(["q", `“${st.q}”`]);
      if (cat) chips.push(["cat", cat.name]);
      if (st.min) chips.push(["min", `A partir de R$ ${st.min}`]);
      if (st.max) chips.push(["max", `Até R$ ${st.max}`]);
      if (st.ofertas) chips.push(["ofertas", "Ofertas"]);
      if (st.estoque) chips.push(["estoque", "Disponíveis"]);
      if (st.favs) chips.push(["favs", "Favoritos"]);
      $("#chips").innerHTML = chips.map(([k, t]) => `<button class="chip" type="button" data-tirar="${k}" aria-label="Remover filtro ${esc(t)}">${esc(t)} ✕</button>`).join("");

      $("#contagem").textContent = plural(lista.length, "produto encontrado", "produtos encontrados");
      const breve = cat && cat.product_count === 0 && !st.q;
      $("#lista").innerHTML = lista.length ? lista.map(cartao).join("")
        : breve ? vazio("✿", `${cat.name}: em breve`, "Estamos preparando novidades para esta categoria. Enquanto isso, conheça nossos outros produtos.", '<a class="btn" href="#/produtos">Ver todos os produtos</a>')
        : vazio("🔍", "Nenhum produto encontrado", "Tente outras palavras ou remova alguns filtros.", '<button class="btn" type="button" data-limpar>Limpar filtros</button>');
      revelar(true);
    };

    const limpar = () => { form.reset(); form.querySelector('[name="cat"][value=""]').checked = true; ordem.value = ""; aplicar(); };
    form.addEventListener("submit", (e) => { e.preventDefault(); aplicar(); });
    form.addEventListener("change", (e) => { if (e.target.name !== "q") aplicar(); });
    ordem.addEventListener("change", aplicar);
    f.q.addEventListener("input", debounce(aplicar, 250));
    const cliques = (e) => {
      if (e.target.closest("[data-limpar]")) limpar();
      const tirar = e.target.closest("[data-tirar]")?.dataset.tirar;
      if (tirar) {
        if (tirar === "cat") form.querySelector('[name="cat"][value=""]').checked = true;
        else if (["ofertas", "estoque", "favs"].includes(tirar)) f[tirar].checked = false;
        else f[tirar].value = "";
        aplicar();
      }
      const faixa = e.target.closest("[data-faixa]")?.dataset.faixa;
      if (faixa) { const [a, b] = faixa.split("-"); f.min.value = a === "0" ? "" : a; f.max.value = b || ""; aplicar(); }
      if (e.target.closest("#abrir-filtros")) { form.classList.add("aberto"); $("#abrir-filtros").setAttribute("aria-expanded", "true"); document.body.classList.add("travado"); }
      if (e.target.closest("[data-fechar-filtros]")) { form.classList.remove("aberto"); $("#abrir-filtros").setAttribute("aria-expanded", "false"); document.body.classList.remove("travado"); }
    };
    $("#app").addEventListener("click", cliques);

    preencher(r.q);
    aplicar();
    atualizarCatalogo = (nova) => { preencher(nova.q); aplicar(); };
    limpezaPagina = () => { document.body.classList.remove("travado"); $("#app").removeEventListener("click", cliques); };
  }

  /* ------------------------------------------------------------------ produto */
  function blocoCompra(p, contexto) {
    const wa = linkWhats(`Olá! Tenho interesse no produto “${p.name}” (${money(p.final_cents)}). Está disponível?`);
    const estoque = !p.in_stock ? '<span class="estoque estoque--zero">Esgotado no momento</span>'
      : p.stock <= 2 ? `<span class="estoque estoque--baixo">${p.stock === 1 ? "Última unidade!" : `Últimas ${p.stock} unidades`}</span>`
      : '<span class="estoque estoque--ok">Disponível em estoque</span>';
    // dentro de um quadro (ex.: página publicada) o link não é o da loja: sem botão de compartilhar
    const podeCompartilhar = /^https?:$/.test(location.protocol) && window.top === window;
    return `
      <span class="cartao__cat">${esc(p.category.name)}</span>
      ${contexto === "pagina" ? "<h1>" : `<h2 id="espiar-titulo">`}${esc(p.name)}${contexto === "pagina" ? "</h1>" : "</h2>"}
      ${precoHtml(p)}
      ${p.on_sale ? `<span class="selo selo--oferta">−${p.discount_percent}% de desconto</span>` : ""}
      <p class="mt">${estoque}</p>
      <p class="produto__desc">${esc(p.description)}</p>
      ${p.in_stock ? `
      <div class="comprar" data-comprar="${p.id}">
        <div class="qtd" role="group" aria-label="Quantidade">
          <button type="button" data-q="-1" aria-label="Diminuir quantidade">−</button><output aria-live="polite">1</output>
          <button type="button" data-q="1" aria-label="Aumentar quantidade">+</button>
        </div>
        <button class="btn" type="button" data-comprar-add>${ICON.bag} Adicionar ao carrinho</button>
        <button class="btn btn--rosa" type="button" data-comprar-agora>Comprar agora</button>
      </div>` : ""}
      <div class="acoes-secundarias">
        <button class="btn btn--claro btn--sm" type="button" data-fav="${p.id}" aria-pressed="${S.favs.includes(p.id)}" aria-label="Favoritar ${esc(p.name)}">${ICON.heart} Favoritar</button>
        ${podeCompartilhar ? `<button class="btn btn--claro btn--sm" type="button" data-compartilhar="${p.id}">${ICON.share} Compartilhar</button>` : ""}
        ${wa ? `<a class="btn btn--verde btn--sm" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">${ICON.whats} Tirar dúvidas</a>` : ""}
        ${contexto === "modal" ? `<a class="btn btn--fantasma btn--sm" href="#/produto/${encodeURIComponent(p.slug)}">Ver página completa →</a>` : ""}
      </div>`;
  }

  function ligarCompra(raiz, p) {
    const box = raiz.querySelector(`[data-comprar="${p.id}"]`);
    if (!box) return;
    let q = 1;
    const out = box.querySelector("output");
    const menos = box.querySelector('[data-q="-1"]');
    const mais = box.querySelector('[data-q="1"]');
    const add = box.querySelector("[data-comprar-add]");
    const agora = box.querySelector("[data-comprar-agora]");
    const sync = () => {
      const livre = Math.max(0, Math.min(p.stock, 99) - cart.qtd(p.id));
      q = Math.max(1, Math.min(q, livre || 1));
      out.textContent = q;
      menos.disabled = q <= 1;
      mais.disabled = q >= livre;
      add.disabled = livre === 0;
      if (livre === 0) add.textContent = "Já está tudo no carrinho";
    };
    box.addEventListener("click", (e) => {
      const d = e.target.closest("[data-q]");
      if (d) { q += Number(d.dataset.q); sync(); }
    });
    add.addEventListener("click", () => { adicionar(p.id, q, add); q = 1; setTimeout(sync, 1650); });
    agora.addEventListener("click", () => { if (cart.qtd(p.id) === 0) cart.add(p.id, q); location.hash = "#/carrinho"; });
    sync();
  }

  function paginaProduto(r) {
    const p = bySlug(r.partes[1]);
    if (!p) return pagina404(r, "Produto não encontrado", "Ele pode ter sido removido ou o endereço está incorreto.");
    registrarVisto(p.id);
    meta(p.name, p.description.slice(0, 155));
    dadosEstruturados({
      "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.description, category: p.category.name,
      offers: { "@type": "Offer", priceCurrency: "BRL", price: (p.final_cents / 100).toFixed(2), availability: `https://schema.org/${p.in_stock ? "InStock" : "OutOfStock"}` },
    });
    const relacionados = S.products.filter((x) => x.id !== p.id && x.category.slug === p.category.slug);
    const outros = relacionados.length >= 4 ? relacionados : [...relacionados, ...S.products.filter((x) => x.id !== p.id && x.category.slug !== p.category.slug && x.in_stock)];
    $("#app").innerHTML = `
    <div class="container pagina-cab">${migalhas([["Produtos", "#/produtos"], [p.category.name, `#/produtos?cat=${p.category.slug}`], [p.name]])}</div>
    <article class="container produto">
      <div class="produto__foto" id="foto-zoom"><img src="${esc(p.image)}" alt="${esc(p.name)}" width="720" height="900"></div>
      <div class="produto__info">
        ${blocoCompra(p, "pagina")}
        <div class="sanfona">
          <details open><summary>Descrição</summary><div><p>${esc(p.description)}</p></div></details>
          <details><summary>Entrega e pagamento</summary><div><p>Ao finalizar, você escolhe entre retirar com a loja ou receber em casa, e indica sua forma de pagamento preferida. A loja confirma o valor do frete (se houver) e combina os detalhes com você pelo WhatsApp ou telefone.</p></div></details>
          <details><summary>Para presente</summary><div><p>No carrinho, marque “É para presente” e escreva a mensagem do cartão. Ela vai junto com o seu pedido.</p></div></details>
        </div>
      </div>
    </article>
    ${outros.length ? `<section class="secao container" aria-labelledby="t-rel">
      <div class="secao__cab"><div><span class="sobretitulo">Combina com você</span><h2 id="t-rel">Você também pode gostar</h2></div></div>
      <div class="grade grade--4">${outros.slice(0, 4).map(cartao).join("")}</div></section>` : ""}`;
    ligarCompra($("#app"), p);

    // zoom ao passar o mouse
    const foto = $("#foto-zoom");
    if (matchMedia("(hover: hover)").matches) {
      const img = foto.querySelector("img");
      foto.addEventListener("mousemove", (e) => {
        const b = foto.getBoundingClientRect();
        img.style.transformOrigin = `${((e.clientX - b.left) / b.width) * 100}% ${((e.clientY - b.top) / b.height) * 100}%`;
      });
      foto.addEventListener("mouseenter", () => foto.classList.add("zoom"));
      foto.addEventListener("mouseleave", () => foto.classList.remove("zoom"));
    }
  }

  function espiar(id) {
    const p = byId(id);
    if (!p) return;
    const m = $("#modal-espiar");
    m.innerHTML = `<div class="espiar">
      <div class="espiar__foto"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div>
      <div class="espiar__info"><button class="icone-btn fechar" type="button" data-fechar-modal aria-label="Fechar">✕</button>${blocoCompra(p, "modal")}</div></div>`;
    m.setAttribute("aria-labelledby", "espiar-titulo");
    ligarCompra(m, p);
    m.showModal();
  }

  /* ------------------------------------------------------------------ favoritos */
  function paginaFavoritos() {
    meta("Favoritos");
    const lista = S.favs.map(byId).filter(Boolean);
    $("#app").innerHTML = `
    <div class="container pagina-cab">${migalhas([["Favoritos"]])}<h1>Meus favoritos</h1>
      <p>Os produtos que você salvou ficam guardados neste aparelho.</p></div>
    <div class="container secao--sem-topo secao"><div class="grade">${lista.length ? lista.map(cartao).join("")
      : vazio("♡", "Nenhum favorito ainda", "Toque no coração dos produtos para guardá-los aqui.", '<a class="btn" href="#/produtos">Explorar produtos</a>')}</div>
      ${lista.some((p) => p.in_stock) ? '<p class="centro"><button class="btn btn--rosa" type="button" id="favs-carrinho">Adicionar todos ao carrinho</button></p>' : ""}</div>`;
    $("#favs-carrinho")?.addEventListener("click", () => {
      const n = lista.filter((p) => p.in_stock).reduce((s, p) => s + cart.add(p.id, 1), 0);
      if (n) { toast(`${plural(n, "produto adicionado", "produtos adicionados")} ao carrinho.`, "ok", { acao: { label: "Ver carrinho", fn: () => abrirPainel("gaveta") } }); }
      else toast("Esses produtos já estão no carrinho.", "erro");
    });
  }

  /* ------------------------------------------------------------------ carrinho e finalização */
  function paginaCarrinho() {
    meta("Carrinho");
    if (!cart.count()) {
      const sugestoes = S.products.filter((p) => p.featured && p.in_stock).slice(0, 4);
      $("#app").innerHTML = `<div class="container pagina-cab">${migalhas([["Carrinho"]])}<h1>Seu carrinho</h1></div>
        <div class="container">${vazio("🛍", "Seu carrinho está vazio", "Que tal conhecer nossas Bíblias, devocionais e presentes?", '<a class="btn" href="#/produtos">Ver produtos</a>')}</div>
        ${sugestoes.length ? `<section class="secao container"><div class="secao__cab"><h2>Sugestões para você</h2></div><div class="grade grade--4">${sugestoes.map(cartao).join("")}</div></section>` : ""}`;
      return;
    }
    $("#app").innerHTML = `
    <div class="container pagina-cab">${migalhas([["Carrinho"]])}<h1>Finalizar compra</h1></div>
    <form class="container checkout" id="checkout" novalidate>
      <div>
        <section class="bloco" aria-labelledby="t-itens"><h2 id="t-itens"><span class="num">1</span> Seus itens</h2><div id="itens-carrinho"></div></section>
        <section class="bloco" aria-labelledby="t-dados"><h2 id="t-dados"><span class="num">2</span> Seus dados</h2>
          <div class="grade-campos">
            <div class="campo c-3"><label for="c-nome">Nome completo</label><input id="c-nome" name="nome" autocomplete="name" maxlength="80" required><span class="erro" data-erro="nome"></span></div>
            <div class="campo c-3"><label for="c-tel">WhatsApp / telefone</label><input id="c-tel" name="tel" type="tel" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000" maxlength="16" required><span class="erro" data-erro="tel"></span></div>
          </div>
        </section>
        <section class="bloco" aria-labelledby="t-entrega"><h2 id="t-entrega"><span class="num">3</span> Entrega</h2>
          <div class="escolhas" role="radiogroup" aria-label="Forma de entrega">
            <label class="escolha"><input type="radio" name="entrega" value="retirar" checked><span>🏪 Retirar com a loja<small>Combine o local e o horário</small></span></label>
            <label class="escolha"><input type="radio" name="entrega" value="entregar"><span>🚚 Receber em casa<small>Frete combinado com a loja</small></span></label>
          </div>
          <div class="grade-campos mt" id="endereco" hidden>
            <div class="campo c-2"><label for="c-cep">CEP</label><input id="c-cep" name="cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9"><span class="dica" id="cep-dica"></span><span class="erro" data-erro="cep"></span></div>
            <div class="campo c-4"><label for="c-rua">Rua</label><input id="c-rua" name="rua" autocomplete="address-line1" maxlength="120"><span class="erro" data-erro="rua"></span></div>
            <div class="campo c-2"><label for="c-num">Número</label><input id="c-num" name="numero" maxlength="12"><span class="erro" data-erro="numero"></span></div>
            <div class="campo c-2"><label for="c-comp">Complemento</label><input id="c-comp" name="complemento" maxlength="60"></div>
            <div class="campo c-2"><label for="c-bairro">Bairro</label><input id="c-bairro" name="bairro" maxlength="60"><span class="erro" data-erro="bairro"></span></div>
            <div class="campo c-6"><label for="c-cidade">Cidade / UF</label><input id="c-cidade" name="cidade" autocomplete="address-level2" maxlength="80"><span class="erro" data-erro="cidade"></span></div>
          </div>
        </section>
        <section class="bloco" aria-labelledby="t-pag"><h2 id="t-pag"><span class="num">4</span> Pagamento preferido</h2>
          <div class="escolhas" role="radiogroup" aria-label="Forma de pagamento">
            <label class="escolha"><input type="radio" name="pagamento" value="Pix" checked><span>⚡ Pix</span></label>
            <label class="escolha"><input type="radio" name="pagamento" value="Cartão"><span>💳 Cartão</span></label>
            <label class="escolha"><input type="radio" name="pagamento" value="Dinheiro"><span>💵 Dinheiro</span></label>
          </div>
          <p class="dica mt">O pagamento é combinado e confirmado diretamente com a loja.</p>
        </section>
        <section class="bloco" aria-labelledby="t-extra"><h2 id="t-extra"><span class="num">5</span> Detalhes</h2>
          <label class="check"><input type="checkbox" name="presente" id="c-presente"> 🎁 É para presente</label>
          <div class="campo mt" id="msg-presente" hidden><label for="c-msg">Mensagem do cartão</label><textarea id="c-msg" name="mensagem" maxlength="200" placeholder="Ex.: Que esta Palavra ilumine seus dias. Com carinho, Ana."></textarea><span class="dica"><span id="msg-cont">0</span>/200</span></div>
          <div class="campo mt"><label for="c-obs">Observações <span class="dica">(opcional)</span></label><textarea id="c-obs" name="obs" maxlength="200" placeholder="Algo que a loja precise saber?"></textarea></div>
        </section>
      </div>
      <aside class="resumo" aria-labelledby="t-resumo">
        <h2 id="t-resumo">Resumo</h2>
        <div id="resumo-linhas"></div>
        <span class="erro" data-erro="itens" role="alert"></span>
        <button class="btn btn--verde btn--bloco mt" type="submit" id="finalizar">${ICON.whats} Finalizar pedido</button>
        <p class="seguro">🔒 Você confirma tudo com a loja antes de pagar.</p>
      </aside>
    </form>`;

    renderCarrinhoItens();
    const form = $("#checkout");
    const el = form.elements;
    el.tel.addEventListener("input", () => { el.tel.value = mascaraFone(el.tel.value); });
    el.cep.addEventListener("input", () => {
      const d = digits(el.cep.value).slice(0, 8);
      el.cep.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
      if (d.length === 8) buscarCep(d, el);
    });
    form.addEventListener("change", (e) => {
      if (e.target.name === "entrega") $("#endereco").hidden = el.entrega.value !== "entregar";
      if (e.target.name === "presente") $("#msg-presente").hidden = !e.target.checked;
    });
    el.mensagem.addEventListener("input", () => { $("#msg-cont").textContent = el.mensagem.value.length; });
    form.addEventListener("submit", (e) => { e.preventDefault(); finalizar(form); });
  }

  let ultimoTotal = null;
  function renderCarrinhoItens() {
    const box = $("#itens-carrinho");
    if (!box) return;
    if (!cart.count()) { paginaCarrinho(); return; }
    box.innerHTML = cart.itens().map(({ p, qty }) => `
      <div class="item-carrinho">
        <a href="#/produto/${encodeURIComponent(p.slug)}" tabindex="-1" aria-hidden="true"><img src="${esc(p.image)}" alt=""></a>
        <div><h3><a href="#/produto/${encodeURIComponent(p.slug)}">${esc(p.name)}</a></h3>
          <span class="dica">${money(p.final_cents)} cada${p.on_sale ? ` · <s>${money(p.price_cents)}</s>` : ""}</span>
          ${qty >= Math.min(p.stock, 99) ? `<br><span class="estoque estoque--baixo">Máximo disponível: ${Math.min(p.stock, 99)}</span>` : ""}</div>
        <div class="item-carrinho__dir">
          <div class="qtd qtd--sm" role="group" aria-label="Quantidade de ${esc(p.name)}">
            <button type="button" data-qtd-menos="${p.id}" aria-label="Diminuir">−</button><output>${qty}</output>
            <button type="button" data-qtd-mais="${p.id}" aria-label="Aumentar"${qty >= Math.min(p.stock, 99) ? " disabled" : ""}>+</button></div>
          <span class="item-carrinho__sub">${money(p.final_cents * qty)}</span>
          <button class="link-remover" type="button" data-remover="${p.id}">Remover</button>
        </div>
      </div>`).join("");
    const cheio = cart.cheio();
    const total = cart.total();
    $("#resumo-linhas").innerHTML = `
      <div class="resumo__linha"><span>${plural(cart.count(), "item", "itens")}</span><span>${money(cheio)}</span></div>
      ${cheio > total ? `<div class="resumo__linha resumo__linha--ok"><span>Descontos</span><span>− ${money(cheio - total)}</span></div>` : ""}
      <div class="resumo__linha"><span>Frete</span><span>a combinar</span></div>
      <div class="resumo__total"><span>Total</span><strong id="total" data-valor="${ultimoTotal ?? total}">${money(ultimoTotal ?? total)}</strong></div>`;
    animarValor($("#total"), total);
    ultimoTotal = total;
  }

  function mascaraFone(v) {
    const d = digits(v).slice(0, 11);
    if (d.length <= 2) return d ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  async function buscarCep(cep, el) {
    const dica = $("#cep-dica");
    dica.textContent = "Buscando endereço…";
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: ctrl.signal });
      const d = await r.json();
      if (d.erro) { dica.textContent = "CEP não encontrado. Preencha o endereço."; return; }
      if (!el.rua.value) el.rua.value = d.logradouro || "";
      if (!el.bairro.value) el.bairro.value = d.bairro || "";
      if (!el.cidade.value) el.cidade.value = [d.localidade, d.uf].filter(Boolean).join(" / ");
      dica.textContent = "Endereço encontrado ✓";
      el.numero.focus();
    } catch {
      dica.textContent = "Preencha o endereço manualmente.";
    }
  }

  function mostrarErros(form, erros) {
    $$("[aria-invalid]", form).forEach((x) => x.removeAttribute("aria-invalid"));
    $$("[data-erro]", form).forEach((x) => (x.textContent = ""));
    let primeiro = null;
    for (const [k, msg] of Object.entries(erros)) {
      const campo = form.elements[k];
      if (campo?.setAttribute) { campo.setAttribute("aria-invalid", "true"); primeiro ??= campo; }
      const caixa = form.querySelector(`[data-erro="${k}"]`);
      if (caixa) caixa.textContent = msg;
    }
    primeiro?.focus();
    return !Object.keys(erros).length;
  }

  function codigoPedido() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const rnd = (crypto?.getRandomValues ? [...crypto.getRandomValues(new Uint8Array(2))] : [Math.random() * 255, Math.random() * 255])
      .map((n) => Math.floor(n).toString(16).padStart(2, "0")).join("").toUpperCase();
    return `PC${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${rnd}`;
  }

  async function finalizar(form) {
    const el = form.elements;
    const dados = {
      nome: el.nome.value.trim(), tel: digits(el.tel.value), entrega: el.entrega.value, pagamento: el.pagamento.value,
      cep: el.cep.value.trim(), rua: el.rua.value.trim(), numero: el.numero.value.trim(), complemento: el.complemento.value.trim(),
      bairro: el.bairro.value.trim(), cidade: el.cidade.value.trim(), presente: el.presente.checked, mensagem: el.mensagem.value.trim(), obs: el.obs.value.trim(),
    };
    const erros = {};
    if (dados.nome.length < 2) erros.nome = "Informe seu nome.";
    if (dados.tel.length < 10 || dados.tel.length > 11) erros.tel = "Informe um telefone com DDD.";
    if (dados.entrega === "entregar") {
      if (digits(dados.cep).length !== 8) erros.cep = "CEP inválido.";
      if (!dados.rua) erros.rua = "Informe a rua.";
      if (!dados.numero) erros.numero = "Informe o número.";
      if (!dados.bairro) erros.bairro = "Informe o bairro.";
      if (!dados.cidade) erros.cidade = "Informe a cidade.";
    }
    if (!cart.count()) erros.itens = "Seu carrinho está vazio.";
    if (!mostrarErros(form, erros)) return;

    const itens = cart.itens();
    const linhasExtra = [
      dados.entrega === "entregar"
        ? `Entrega: ${dados.rua}, ${dados.numero}${dados.complemento ? ` (${dados.complemento})` : ""} — ${dados.bairro}, ${dados.cidade} — CEP ${dados.cep}`
        : "Entrega: retirar com a loja",
      `Pagamento preferido: ${dados.pagamento}`,
      dados.presente ? `Para presente${dados.mensagem ? ` — mensagem: "${dados.mensagem}"` : ""}` : "",
      dados.obs ? `Obs.: ${dados.obs}` : "",
    ].filter(Boolean);

    const botao = $("#finalizar");
    const original = botao.innerHTML;
    botao.disabled = true;
    botao.innerHTML = '<span class="spinner" aria-hidden="true"></span> Enviando pedido…';
    let pedido;
    try {
      if (S.live) {
        const r = await api("/orders", { method: "POST", body: {
          customer_name: dados.nome, customer_phone: dados.tel, notes: linhasExtra.join("\n"),
          items: itens.map((i) => ({ product_id: i.p.id, quantity: i.qty })),
        } });
        pedido = { code: r.code, total: r.total_cents, itens: r.items.map((i) => ({ nome: i.product_name, qty: i.quantity, valor: i.unit_cents * i.quantity })) };
      } else {
        pedido = { code: codigoPedido(), total: cart.total(), itens: itens.map((i) => ({ nome: i.p.name, qty: i.qty, valor: i.p.final_cents * i.qty })) };
      }
    } catch (e) {
      botao.disabled = false;
      botao.innerHTML = original;
      mostrarErros(form, { itens: e.fields?.items || e.message });
      toast(e.message, "erro");
      if (e.status === 400 && S.live) { try { S.products = await api("/products?limit=200"); cart.salvar(); } catch { /* mantém */ } }
      return;
    }

    const mensagem = [
      `Olá, ${S.settings.store_name || "Papelaria Cristã"}! Gostaria de fazer o pedido *${pedido.code}*:`, "",
      ...pedido.itens.map((i) => `• ${i.qty}x ${i.nome} — ${money(i.valor)}`), "",
      `*Total dos produtos: ${money(pedido.total)}*`, `Nome: ${dados.nome}`, `Telefone: ${mascaraFone(dados.tel)}`, ...linhasExtra,
    ].join("\n");
    const wa = linkWhats(mensagem);
    meta("Pedido registrado");
    $("#app").innerHTML = `
    <section class="container"><div class="sucesso" id="tela-sucesso">
      <svg class="check-anima" viewBox="0 0 90 90" aria-hidden="true"><circle cx="45" cy="45" r="40"/><circle class="circulo" cx="45" cy="45" r="40"/><path d="M28 46l12 12 23-25"/></svg>
      <h1>Pedido ${esc(pedido.code)} ${S.live ? "registrado" : "pronto"}!</h1>
      <p>Total dos produtos: <strong>${money(pedido.total)}</strong>${dados.entrega === "entregar" ? " + frete a combinar" : ""}</p>
      ${wa ? `<p>Agora é só enviar para a loja pelo WhatsApp. Lá vocês combinam ${dados.entrega === "entregar" ? "o frete, " : ""}o pagamento e a entrega.</p>`
        : S.live ? `<p>A loja recebeu seu pedido e vai entrar em contato pelo telefone informado.</p>`
        : `<p>Copie o resumo abaixo e envie para a loja pelo canal de sua preferência.</p>`}
      <div class="botoes">
        ${wa ? `<a class="btn btn--verde" id="enviar-whats" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">${ICON.whats} Enviar pelo WhatsApp</a>` : ""}
        <button class="btn btn--claro" type="button" id="copiar-pedido">${ICON.copy} Copiar resumo</button>
      </div>
      <details><summary class="dica">Ver resumo do pedido</summary><pre id="resumo-pedido">${esc(mensagem.replaceAll("*", ""))}</pre></details>
      <p class="mt"><a href="#/produtos">Continuar comprando</a></p>
    </div></section>`;
    cart.limpar(); // depois de mostrar a tela de sucesso
    $("#copiar-pedido").addEventListener("click", () => copiar(mensagem.replaceAll("*", ""), "Resumo do pedido copiado!"));
    window.scrollTo({ top: 0 });
    setTimeout(confete, 350);
  }

  async function copiar(texto, ok) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const t = document.createElement("textarea");
      t.value = texto; t.setAttribute("readonly", ""); t.className = "sr-only";
      document.body.append(t); t.select();
      try { document.execCommand("copy"); } catch { /* sem suporte */ }
      t.remove();
    }
    toast(ok, "ok");
  }

  /* ------------------------------------------------------------------ institucionais */
  function paginaSobre() {
    meta("Sobre nós", "Conheça a Papelaria Cristã: produtos escolhidos com carinho para acompanhar sua fé.");
    const fotos = ["pao-diario-diario-de-oracao", "biblia-harpa-deus-e-bom", "kit-oi-deus-sou-eu-de-novo", "biblia-nvi-ele-vive"].map(bySlug).filter(Boolean);
    $("#app").innerHTML = `
    <div class="container pagina-cab">${migalhas([["Sobre nós"]])}</div>
    <section class="container sobre" aria-labelledby="t-sobre">
      <div class="revela">
        <span class="sobretitulo">Nossa essência</span>
        <h1 id="t-sobre">Uma papelaria com <em>propósito</em></h1>
        <p class="produto__desc">A Papelaria Cristã reúne Bíblias, devocionais, livros cristãos, kits de presente e materiais de papelaria em um só lugar, tudo escolhido com carinho para acompanhar sua fé no dia a dia.</p>
        <p>Acreditamos que um diário de oração, uma Bíblia com letra confortável ou um presente bem embalado podem aproximar pessoas de Deus e umas das outras. Por isso, cuidamos de cada produto como quem prepara um presente.</p>
        <p>O atendimento é próximo: você monta o carrinho aqui e conversa diretamente com a loja para combinar entrega e pagamento.</p>
        <div class="slide__acoes"><a class="btn" href="#/produtos">Conhecer os produtos</a><a class="btn btn--claro" href="#/contato">Fale conosco</a></div>
      </div>
      <div class="mosaico">${fotos.map((p) => `<a href="#/produto/${p.slug}"><img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"></a>`).join("")}</div>
    </section>
    <section class="secao container" aria-labelledby="t-valores">
      <div class="centro"><div class="secao__cab"><span class="sobretitulo">No que acreditamos</span><h2 id="t-valores">Nossos valores</h2></div></div>
      <div class="valores">
        <div class="valor revela"><div class="valor__icone" aria-hidden="true">✝</div><h3>Fé</h3><p>Tudo o que fazemos aponta para Cristo e para a Palavra.</p></div>
        <div class="valor revela"><div class="valor__icone" aria-hidden="true">💗</div><h3>Amor</h3><p>Atendimento acolhedor, com atenção a cada detalhe.</p></div>
        <div class="valor revela"><div class="valor__icone" aria-hidden="true">🕊</div><h3>Paz</h3><p>Uma compra simples, transparente e sem complicação.</p></div>
        <div class="valor revela"><div class="valor__icone" aria-hidden="true">✿</div><h3>Delicadeza</h3><p>Produtos bonitos, escolhidos para inspirar e presentear.</p></div>
      </div>
    </section>`;
  }

  function paginaContato() {
    meta("Contato", "Fale com a Papelaria Cristã.");
    const cs = contatos();
    const s = S.settings;
    $("#app").innerHTML = `
    <div class="container pagina-cab">${migalhas([["Contato"]])}<h1>Fale conosco</h1>
      <p>Tire dúvidas, peça indicações de presentes ou acompanhe seu pedido. Será uma alegria atender você.</p></div>
    <div class="container contato">
      <section aria-labelledby="t-canais"><h2 id="t-canais" class="sr-only">Canais</h2>
        <div class="canais">${cs.length ? cs.map((c) => {
          const dentro = `<span class="canal__icone" aria-hidden="true">${c.i}</span><span><small>${esc(c.l)}</small>${esc(c.v)}</span>`;
          return c.h ? `<a class="canal revela" href="${esc(c.h)}"${externo(c.h)}>${dentro}</a>` : `<div class="canal revela">${dentro}</div>`;
        }).join("") : vazio("✿", "Canais em configuração", "Os contatos da loja estão sendo cadastrados. Volte em breve!")}</div>
      </section>
      ${s.whatsapp || s.email ? `
      <section class="bloco" aria-labelledby="t-msg"><h2 id="t-msg">Envie uma mensagem</h2>
        <form id="form-contato" novalidate>
          <div class="campo"><label for="m-nome">Nome</label><input id="m-nome" name="nome" autocomplete="name" maxlength="80"><span class="erro" data-erro="nome"></span></div>
          <div class="campo"><label for="m-assunto">Assunto</label><select id="m-assunto" name="assunto"><option>Dúvida sobre produto</option><option>Acompanhar pedido</option><option>Indicação de presente</option><option>Outro assunto</option></select></div>
          <div class="campo"><label for="m-msg">Mensagem</label><textarea id="m-msg" name="mensagem" maxlength="1000"></textarea><span class="erro" data-erro="mensagem"></span></div>
          <button class="btn btn--bloco" type="submit">${s.whatsapp ? `${ICON.whats} Preparar mensagem` : "Preparar e-mail"}</button>
        </form>
        <div id="contato-pronto" class="mt" hidden></div>
      </section>` : ""}
    </div>`;
    $("#form-contato")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      const nome = f.elements.nome.value.trim();
      const msg = f.elements.mensagem.value.trim();
      const erros = {};
      if (nome.length < 2) erros.nome = "Informe seu nome.";
      if (msg.length < 5) erros.mensagem = "Escreva sua mensagem (mínimo de 5 caracteres).";
      if (!mostrarErros(f, erros)) return;
      const texto = `Olá! Meu nome é ${nome}.\nAssunto: ${f.elements.assunto.value}\n\n${msg}`;
      const wa = linkWhats(texto);
      const url = wa || `mailto:${s.email}?subject=${encodeURIComponent(f.elements.assunto.value)}&body=${encodeURIComponent(texto)}`;
      const pronto = $("#contato-pronto");
      pronto.innerHTML = `<p class="dica">Mensagem pronta! Toque no botão para abrir ${wa ? "o WhatsApp" : "seu e-mail"} e enviar.</p>
        <a class="btn btn--verde btn--bloco" id="contato-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${wa ? `${ICON.whats} Abrir no WhatsApp` : "Abrir e-mail"}</a>
        ${wa ? "" : `<p class="dica mt">Se o e-mail não abrir, escreva para <strong>${esc(s.email)}</strong>.</p>`}`;
      pronto.hidden = false;
      $("#contato-link").focus();
    });
  }

  function pagina404(r, titulo = "Página não encontrada", texto = "O endereço pode estar incorreto ou a página foi removida.") {
    meta(titulo);
    $("#app").innerHTML = `<div class="container secao">${vazio("🕊", titulo, texto, '<div class="slide__acoes slide__acoes--centro"><a class="btn" href="#/">Voltar ao início</a><a class="btn btn--claro" href="#/produtos">Ver produtos</a></div>')}</div>`;
  }

  /* ------------------------------------------------------------------ revelar ao rolar */
  let observador = null;
  function revelar(agora) {
    $$(".secao__cab:not(.anima)").forEach((c) => c.classList.add("anima", "revela"));
    const els = $$(".revela:not(.visivel)");
    if (reduzMovimento || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("visivel")); return; }
    observador ??= new IntersectionObserver((entradas) => entradas.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("visivel"); observador.unobserve(en.target); }
    }), { rootMargin: "0px 0px -6% 0px", threshold: .05 });
    els.forEach((e, i) => {
      e.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
      if (agora) { const b = e.getBoundingClientRect(); if (b.top < innerHeight) { e.classList.add("visivel"); return; } }
      observador.observe(e);
    });
  }

  /* ------------------------------------------------------------------ eventos globais */
  function eventosGlobais() {
    document.addEventListener("click", (e) => {
      const t = e.target;
      const add = t.closest("[data-add]");
      if (add) return void adicionar(Number(add.dataset.add), 1, add);
      const fav = t.closest("[data-fav]");
      if (fav) return void alternarFavorito(Number(fav.dataset.fav), fav);
      const esp = t.closest("[data-espiar]");
      if (esp) return void espiar(Number(esp.dataset.espiar));
      const mais = t.closest("[data-qtd-mais]");
      if (mais) { const id = Number(mais.dataset.qtdMais); return void cart.set(id, cart.qtd(id) + 1); }
      const menos = t.closest("[data-qtd-menos]");
      if (menos) { const id = Number(menos.dataset.qtdMenos); return void cart.set(id, cart.qtd(id) - 1); }
      const rem = t.closest("[data-remover]");
      if (rem) {
        const id = Number(rem.dataset.remover);
        const qty = cart.qtd(id);
        cart.remover(id);
        return void toast("Produto removido do carrinho.", "", { acao: { label: "Desfazer", fn: () => cart.add(id, qty) } });
      }
      const comp = t.closest("[data-compartilhar]");
      if (comp) {
        const p = byId(Number(comp.dataset.compartilhar));
        const url = location.href.split("#")[0] + `#/produto/${p.slug}`;
        if (navigator.share) {
          navigator.share({ title: p.name, text: `${p.name} — ${money(p.final_cents)}`, url })
            .catch((err) => { if (err.name !== "AbortError") copiar(url, "Link do produto copiado!"); });
        } else copiar(url, "Link do produto copiado!");
        return;
      }
      if (t.closest("[data-fechar-modal]")) return void $("#modal-espiar").close();
      if (t.closest("[data-fechar-painel]")) fecharPaineis();
    });
    $("#modal-espiar").addEventListener("click", (e) => { if (e.target.id === "modal-espiar") e.target.close(); });
    $("#modal-espiar").addEventListener("close", () => { $("#modal-espiar").innerHTML = ""; });
    $("#abrir-carrinho").addEventListener("click", () => abrirPainel("gaveta"));
    $("#abrir-menu").addEventListener("click", () => abrirPainel("menu-lateral"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { fecharPaineis(); $(".filtros.aberto")?.classList.remove("aberto"); document.body.classList.remove("travado"); }
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); $("#busca-campo").focus(); }
    });
    document.addEventListener("pointerdown", (e) => {
      const btn = e.target.closest(".btn");
      if (!btn || !anima || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const d = Math.max(r.width, r.height);
      const o = document.createElement("span");
      o.className = "ondulacao";
      Object.assign(o.style, { width: `${d}px`, height: `${d}px`, left: `${e.clientX - r.left - d / 2}px`, top: `${e.clientY - r.top - d / 2}px` });
      btn.append(o);
      setTimeout(() => o.remove(), 650);
    });
    const cab = $("#cabecalho");
    const topo = $("#topo-btn");
    const barra = $("#progresso");
    let pedido = false;
    addEventListener("scroll", () => {
      if (pedido) return;
      pedido = true;
      requestAnimationFrame(() => {
        pedido = false;
        cab.classList.toggle("rolou", scrollY > 10);
        topo.classList.toggle("mostra", scrollY > 900);
        const max = document.documentElement.scrollHeight - innerHeight;
        barra.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
      });
    }, { passive: true });
    topo.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduzMovimento ? "auto" : "smooth" }));
    addEventListener("hashchange", route);
    addEventListener("storage", (e) => {
      if (e.key === "pc_cart_v1") { S.cart = store.get("pc_cart_v1", []); atualizarContadores(); }
      if (e.key === "pc_favs_v1") { S.favs = store.get("pc_favs_v1", []); atualizarContadores(); }
    });
  }

  /* ------------------------------------------------------------------ início */
  async function iniciar() {
    await carregarDados();
    if (!S.categories.length) S.categories = [];
    montarEstrutura();
    montarBusca();
    eventosGlobais();
    cart.salvar(); // descarta itens que não existem mais / ajusta ao estoque
    route();
    document.documentElement.dataset.modo = S.live ? "servidor" : "independente";
  }
  iniciar();
})();
