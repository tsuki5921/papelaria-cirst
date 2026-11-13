// Componentes compartilhados: cabeçalho, rodapé, toasts e cartão de produto.
// Ficam num só lugar para não duplicar HTML em todas as páginas.
import { cached } from "./api.js";
import * as cart from "./cart.js";
import { $, $$, esc, money, onlyDigits } from "./utils.js";

export const icons = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  whats: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.2-.2-.4-.3z"/></svg>',
};

let logoCount = 0;
export function logo() {
  const id = `lg${++logoCount}`;
  return `<svg viewBox="0 0 48 48" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f9dbe4"/><stop offset="1" stop-color="#dccdf0"/></linearGradient></defs>
    <circle cx="24" cy="24" r="23" fill="url(#${id})"/>
    <path d="M24 9v29M16.5 17.5h15" stroke="#4f3477" stroke-width="3" stroke-linecap="round"/>
    <path d="M10.5 35c4.5-.6 7.6-3.6 8.4-8.2-4.5.6-7.6 3.6-8.4 8.2z" fill="#c95f80"/>
    <path d="M37.5 35c-4.5-.6-7.6-3.6-8.4-8.2 4.5.6 7.6 3.6 8.4 8.2z" fill="#3c6fae"/>
  </svg>`;
}

const NAV = [
  ["index.html", "Início", "inicio"],
  ["produtos.html", "Produtos", "produtos"],
  ["ofertas.html", "Ofertas", "ofertas"],
  ["sobre.html", "Sobre nós", "sobre"],
  ["contato.html", "Contato", "contato"],
];

function headerHtml(page) {
  const link = ([href, label, key]) =>
    `<li><a class="nav__link" href="${href}"${key === page ? ' aria-current="page"' : ""}>${label}</a></li>`;
  return `
  <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
  <div class="topbar"><p>✝ Bíblias, devocionais, livros e presentes que inspiram fé</p></div>
  <header class="header">
    <div class="container header__inner">
      <a class="logo" href="index.html" aria-label="Papelaria Cristã — página inicial">
        ${logo()}<span class="logo__nome">Papelaria Cristã<small>papelaria com propósito</small></span>
      </a>
      <nav class="nav" id="menu" aria-label="Menu principal">
        <ul class="nav__lista">
          ${NAV.slice(0, 2).map(link).join("")}
          <li><details class="nav__cats"><summary>Categorias</summary>
            <ul class="dropdown" id="menu-categorias"><li><a href="produtos.html">Carregando…</a></li></ul>
          </details></li>
          ${NAV.slice(2).map(link).join("")}
        </ul>
      </nav>
      <form class="busca-topo" role="search" action="produtos.html">
        <label class="sr-only" for="busca-topo">Buscar produtos</label>
        <input id="busca-topo" name="q" type="search" placeholder="Buscar produtos…" maxlength="80" autocomplete="off">
        <button type="submit" aria-label="Buscar">${icons.search}</button>
      </form>
      <a class="icon-btn carrinho-link" href="carrinho.html" aria-label="Carrinho de compras">
        ${icons.bag}<span class="carrinho-badge" id="cart-badge" hidden>0</span>
      </a>
      <button class="icon-btn menu-toggle" type="button" aria-controls="menu" aria-expanded="false" aria-label="Abrir menu">${icons.menu}</button>
    </div>
  </header>`;
}

function footerHtml() {
  return `
  <footer class="rodape">
    <div class="container rodape__grid">
      <div>
        <a class="logo" href="index.html">${logo()}<span class="logo__nome">Papelaria Cristã<small>papelaria com propósito</small></span></a>
        <p>Produtos escolhidos com carinho para acompanhar sua fé, seus estudos e seus momentos com Deus.</p>
      </div>
      <div>
        <h2>Navegue</h2>
        <ul>${NAV.map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join("")}<li><a href="carrinho.html">Carrinho</a></li></ul>
      </div>
      <div>
        <h2>Categorias</h2>
        <ul id="rodape-categorias"></ul>
      </div>
      <div>
        <h2>Atendimento</h2>
        <ul id="rodape-contato"><li><a href="contato.html">Fale conosco</a></li></ul>
      </div>
    </div>
    <div class="container rodape__base">
      <span>© ${new Date().getFullYear()} Papelaria Cristã. Todos os direitos reservados.</span>
      <span>“Tudo o que fizerem, façam de todo o coração.” — Colossenses 3:23</span>
    </div>
  </footer>
  <div class="toasts" id="toasts" role="status" aria-live="polite"></div>`;
}

/** Itens de contato configurados pela loja (somente os preenchidos). */
export function contactItems(s) {
  const out = [];
  if (s.whatsapp) out.push({ icon: "💬", label: "WhatsApp", value: formatPhone(s.whatsapp), href: `https://wa.me/${onlyDigits(s.whatsapp)}` });
  if (s.phone) out.push({ icon: "📞", label: "Telefone", value: s.phone, href: `tel:${onlyDigits(s.phone)}` });
  if (s.email) out.push({ icon: "✉️", label: "E-mail", value: s.email, href: `mailto:${s.email}` });
  if (s.address) out.push({ icon: "📍", label: "Endereço", value: s.address, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}` });
  if (s.hours) out.push({ icon: "🕐", label: "Horário", value: s.hours });
  if (s.instagram) out.push({ icon: "📷", label: "Instagram", value: s.instagram.replace(/^https:\/\/(www\.)?/, ""), href: s.instagram });
  if (s.facebook) out.push({ icon: "👍", label: "Facebook", value: s.facebook.replace(/^https:\/\/(www\.)?/, ""), href: s.facebook });
  return out;
}

function formatPhone(digits) {
  const d = onlyDigits(digits).replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}

const external = (href) => /^https?:/.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";

// ------------------------------------------------------------------ toasts
export function toast(message, type = "info", { link } = {}) {
  const box = $("#toasts");
  if (!box) return;
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span aria-hidden="true">${type === "sucesso" ? "✓" : type === "erro" ? "!" : "✦"}</span>
    <div>${esc(message)}${link ? ` <a href="${esc(link.href)}">${esc(link.label)}</a>` : ""}</div>`;
  box.append(el);
  setTimeout(() => {
    el.classList.add("saindo");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 3800);
}

// ------------------------------------------------------------------ cartão de produto
const registry = new Map(); // id -> produto (usado pelos botões "Adicionar")

export function productCard(p) {
  registry.set(p.id, p);
  const url = `produto.html?p=${encodeURIComponent(p.slug)}`;
  const badges = [
    !p.in_stock ? '<span class="etiqueta etiqueta--esgotado">Esgotado</span>' : "",
    p.on_sale ? `<span class="etiqueta etiqueta--oferta">-${p.discount_percent}%</span>` : "",
    p.featured && !p.on_sale ? '<span class="etiqueta etiqueta--destaque">Destaque</span>' : "",
  ].join("");
  return `
  <article class="produto${p.in_stock ? "" : " produto--esgotado"}">
    <a class="produto__img" href="${url}" tabindex="-1" aria-hidden="true">
      <img src="${esc(p.image || "img/sem-foto.svg")}" alt="" loading="lazy" width="400" height="500">
      <span class="produto__selos">${badges}</span>
    </a>
    <div class="produto__corpo">
      <span class="produto__cat">${esc(p.category.name)}</span>
      <h3 class="produto__nome"><a href="${url}">${esc(p.name)}</a></h3>
      <div class="preco">
        <span class="preco__atual">${money(p.final_cents)}</span>
        ${p.on_sale ? `<span class="preco__antigo"><span class="sr-only">De </span>${money(p.price_cents)}</span>` : ""}
      </div>
      <div class="produto__acoes">
        ${p.in_stock
          ? `<button class="btn btn--bloco btn--sm" type="button" data-add-cart="${p.id}">${icons.bag} Adicionar</button>`
          : `<a class="btn btn--claro btn--bloco btn--sm" href="${url}">Ver detalhes</a>`}
      </div>
    </div>
  </article>`;
}

export function addToCart(product, qty = 1) {
  const added = cart.add(product, qty);
  if (added) {
    toast(`${added > 1 ? `${added} unidades de ` : ""}“${product.name}” adicionado ao carrinho.`, "sucesso",
      { link: { href: "carrinho.html", label: "Ver carrinho" } });
  } else {
    toast(`Você já tem todas as unidades disponíveis de “${product.name}” no carrinho.`, "erro");
  }
  return added;
}

// ------------------------------------------------------------------ montagem
function updateBadge(animate) {
  const badge = $("#cart-badge");
  if (!badge) return;
  const n = cart.count();
  badge.textContent = n > 99 ? "99+" : n;
  badge.hidden = n === 0;
  $(".carrinho-link")?.setAttribute("aria-label", `Carrinho de compras: ${n} ${n === 1 ? "item" : "itens"}`);
  if (animate) {
    badge.classList.remove("pulsar");
    void badge.offsetWidth;
    badge.classList.add("pulsar");
  }
}

async function fillDynamic() {
  try {
    const cats = await cached("/categories");
    const items = cats.map((c) =>
      `<li><a href="produtos.html?categoria=${esc(c.slug)}"><span>${esc(c.icon)} ${esc(c.name)}</span><small>${c.product_count}</small></a></li>`);
    $("#menu-categorias").innerHTML = `<li><a href="produtos.html"><span>Todas as categorias</span></a></li>${items.join("")}`;
    $("#rodape-categorias").innerHTML = cats.filter((c) => c.product_count > 0)
      .map((c) => `<li><a href="produtos.html?categoria=${esc(c.slug)}">${esc(c.name)}</a></li>`).join("");
  } catch {
    $("#menu-categorias").innerHTML = '<li><a href="produtos.html">Ver todos os produtos</a></li>';
  }
  try {
    const s = await cached("/settings");
    const extra = contactItems(s).map((c) =>
      `<li>${c.href ? `<a href="${esc(c.href)}"${external(c.href)}>${c.icon} ${esc(c.value)}</a>` : `${c.icon} ${esc(c.value)}`}</li>`);
    $("#rodape-contato").innerHTML = `<li><a href="contato.html">Fale conosco</a></li>${extra.join("")}`;
  } catch { /* rodapé mantém o link de contato */ }
}

export function mountLayout() {
  const page = document.body.dataset.page;
  document.body.insertAdjacentHTML("afterbegin", headerHtml(page));
  document.body.insertAdjacentHTML("beforeend", footerHtml());

  const q = new URLSearchParams(location.search).get("q");
  if (q) $("#busca-topo").value = q;

  // menu mobile
  const toggle = $(".menu-toggle");
  toggle.addEventListener("click", () => {
    const open = $("#menu").classList.toggle("aberto");
    toggle.setAttribute("aria-expanded", open);
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    toggle.innerHTML = open ? icons.close : icons.menu;
  });
  // fecha o dropdown de categorias ao clicar fora / Esc
  document.addEventListener("click", (e) => {
    const d = $(".nav__cats");
    if (d?.open && !d.contains(e.target)) d.open = false;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { const d = $(".nav__cats"); if (d) d.open = false; }
  });
  // busca vazia não navega
  $(".busca-topo").addEventListener("submit", (e) => {
    if (!$("#busca-topo").value.trim()) { e.preventDefault(); $("#busca-topo").focus(); }
  });
  // botões "Adicionar" de qualquer cartão
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add-cart]");
    if (!btn) return;
    const product = registry.get(Number(btn.dataset.addCart));
    if (product) addToCart(product);
  });

  updateBadge(false);
  document.addEventListener("cart:change", () => updateBadge(true));
  fillDynamic();
}

export function setMeta(title, description) {
  document.title = `${title} | Papelaria Cristã`;
  if (description) $('meta[name="description"]')?.setAttribute("content", description);
  $('meta[property="og:title"]')?.setAttribute("content", document.title);
  if (description) $('meta[property="og:description"]')?.setAttribute("content", description);
}

export function emptyState(icon, title, text, action = "") {
  return `<div class="vazio"><div class="vazio__icone" aria-hidden="true">${icon}</div>
    <h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
}

export { $$ };
