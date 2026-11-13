import { api, cached } from "../core/api.js";
import { emptyState, mountLayout, productCard } from "../core/layout.js";
import { $, esc } from "../core/utils.js";

mountLayout();

async function load() {
  const [products, categories] = await Promise.all([api("/products?limit=200"), cached("/categories")]);

  // galeria do banner: produtos em destaque com foto
  const gallery = products.filter((p) => p.featured && p.image).slice(0, 3);
  $("#hero-galeria").innerHTML = gallery.map((p) =>
    `<a href="produto.html?p=${encodeURIComponent(p.slug)}"><img src="${esc(p.image)}" alt="${esc(p.name)}" width="360" height="450"></a>`).join("");

  // faixa de promoção com dados reais (maior desconto vigente)
  const sale = products.filter((p) => p.on_sale && p.in_stock);
  if (sale.length) {
    const max = Math.max(...sale.map((p) => p.discount_percent));
    const box = $("#faixa-promo");
    box.innerHTML = `<div class="faixa">
      <div><h2>Até ${max}% de desconto ✿</h2>
      <p>${sale.length} ${sale.length === 1 ? "produto selecionado" : "produtos selecionados"} com preço especial.</p></div>
      <a class="btn btn--rosa" href="ofertas.html">Aproveitar ofertas</a></div>`;
    box.hidden = false;
  }

  $("#categorias").innerHTML = categories.map((c) => `
    <a class="categoria" href="produtos.html?categoria=${esc(c.slug)}">
      <span class="categoria__icone" aria-hidden="true">${esc(c.icon)}</span>
      <strong>${esc(c.name)}</strong>
      <small>${c.product_count ? `${c.product_count} ${c.product_count === 1 ? "produto" : "produtos"}` : "Em breve"}</small>
    </a>`).join("");

  const featured = products.filter((p) => p.featured).slice(0, 8);
  $("#destaques").innerHTML = featured.length
    ? featured.map(productCard).join("")
    : emptyState("✿", "Em breve", "Novos destaques estão chegando.");

  const offers = sale.slice(0, 4);
  if (offers.length) $("#ofertas").innerHTML = offers.map(productCard).join("");
  else $("#secao-ofertas").hidden = true;
}

load().catch((err) => {
  $("#destaques").innerHTML = emptyState("⚠", "Não foi possível carregar os produtos", err.message,
    '<button class="btn" type="button" data-recarregar>Tentar novamente</button>');
  $("#secao-ofertas").hidden = true;
  document.querySelector("[data-recarregar]")?.addEventListener("click", () => location.reload());
});
