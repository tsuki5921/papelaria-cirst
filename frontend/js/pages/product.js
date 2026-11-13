// Página individual do produto.
import { api, cached } from "../core/api.js";
import * as cart from "../core/cart.js";
import { addToCart, emptyState, icons, mountLayout, productCard, setMeta } from "../core/layout.js";
import { $, esc, money, params, whatsappLink } from "../core/utils.js";

mountLayout();

const slug = params().get("p");
const box = $("#produto");

function stockLabel(p) {
  if (!p.in_stock) return '<span class="estoque estoque--zero">Esgotado</span>';
  if (p.stock <= 2) return `<span class="estoque estoque--baixo">Últimas ${p.stock === 1 ? "unidade" : `${p.stock} unidades`}</span>`;
  return '<span class="estoque estoque--ok">Disponível em estoque</span>';
}

function addStructuredData(p) {
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: new URL(p.image, location.href).href,
    category: p.category.name,
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: (p.final_cents / 100).toFixed(2),
      availability: p.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  });
  document.head.append(script);
}

function render(p, settings) {
  setMeta(p.name, p.description.slice(0, 155));
  document.querySelector('meta[property="og:image"]')?.setAttribute("content", p.image);
  addStructuredData(p);
  $("#migalhas").insertAdjacentHTML("beforeend",
    `<li><a href="produtos.html?categoria=${esc(p.category.slug)}">${esc(p.category.name)}</a></li>
     <li aria-current="page">${esc(p.name)}</li>`);

  const wa = whatsappLink(settings.whatsapp,
    `Olá! Tenho interesse no produto “${p.name}” (${money(p.final_cents)}). Está disponível?`);

  box.innerHTML = `
  <article class="detalhe">
    <div class="detalhe__img"><img src="${esc(p.image || "img/sem-foto.svg")}" alt="${esc(p.name)}" width="720" height="900"></div>
    <div>
      <span class="produto__cat">${esc(p.category.name)}</span>
      <h1>${esc(p.name)}</h1>
      <div class="preco">
        <span class="preco__atual">${money(p.final_cents)}</span>
        ${p.on_sale ? `<span class="preco__antigo"><span class="sr-only">De </span>${money(p.price_cents)}</span>
          <span class="etiqueta etiqueta--oferta">-${p.discount_percent}%</span>` : ""}
      </div>
      <p>${stockLabel(p)}</p>
      <p class="detalhe__desc">${esc(p.description)}</p>
      ${p.in_stock ? `
      <div class="comprar">
        <div class="qtd" role="group" aria-label="Quantidade">
          <button type="button" data-qtd="-1" aria-label="Diminuir quantidade">−</button>
          <output id="qtd" aria-live="polite">1</output>
          <button type="button" data-qtd="1" aria-label="Aumentar quantidade">+</button>
        </div>
        <button class="btn" type="button" id="adicionar">${icons.bag} Adicionar ao carrinho</button>
      </div>` : ""}
      ${wa ? `<a class="btn btn--whats" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">${icons.whats} Tirar dúvidas pelo WhatsApp</a>` : ""}
      <ul class="garantias">
        <li><span aria-hidden="true">🛍</span> Adicione ao carrinho e finalize seu pedido em poucos passos.</li>
        <li><span aria-hidden="true">🔒</span> O valor do pedido é conferido pela loja antes da confirmação.</li>
        <li><span aria-hidden="true">🎁</span> Uma ótima opção para presentear quem você ama.</li>
      </ul>
    </div>
  </article>`;

  if (!p.in_stock) return;
  let qty = 1;
  const available = () => Math.max(0, p.stock - cart.quantityOf(p.id));
  const out = $("#qtd");
  const minus = box.querySelector('[data-qtd="-1"]');
  const plus = box.querySelector('[data-qtd="1"]');
  const addBtn = $("#adicionar");
  const refresh = () => {
    const max = available();
    qty = Math.max(1, Math.min(qty, max || 1));
    out.textContent = qty;
    minus.disabled = qty <= 1;
    plus.disabled = qty >= max;
    addBtn.disabled = max === 0;
    addBtn.innerHTML = max === 0 ? "Todas as unidades já estão no carrinho" : `${icons.bag} Adicionar ao carrinho`;
  };
  box.querySelectorAll("[data-qtd]").forEach((b) =>
    b.addEventListener("click", () => { qty += Number(b.dataset.qtd); refresh(); }));
  addBtn.addEventListener("click", () => { addToCart(p, qty); qty = 1; refresh(); });
  document.addEventListener("cart:change", refresh);
  refresh();
}

async function load() {
  if (!slug) throw Object.assign(new Error("Produto não informado."), { status: 404 });
  const [p, settings] = await Promise.all([api(`/products/${encodeURIComponent(slug)}`), cached("/settings")]);
  render(p, settings);
  const related = (await api(`/products?category=${encodeURIComponent(p.category.slug)}&limit=5`))
    .filter((r) => r.id !== p.id).slice(0, 4);
  if (related.length) {
    $("#lista-relacionados").innerHTML = related.map(productCard).join("");
    $("#relacionados").hidden = false;
  }
}

load().catch((err) => {
  const notFound = err.status === 404;
  setMeta(notFound ? "Produto não encontrado" : "Erro");
  box.innerHTML = emptyState(notFound ? "🔍" : "⚠",
    notFound ? "Produto não encontrado" : "Não foi possível carregar o produto",
    notFound ? "Ele pode ter sido removido ou o endereço está incorreto." : err.message,
    '<a class="btn" href="produtos.html">Ver todos os produtos</a>');
});
