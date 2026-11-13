// Catálogo (produtos.html) e Ofertas (ofertas.html): busca, filtros e ordenação.
import { api, cached } from "../core/api.js";
import { emptyState, mountLayout, productCard, setMeta } from "../core/layout.js";
import { $, debounce, esc, params } from "../core/utils.js";

mountLayout();

const offersMode = document.body.dataset.modo === "ofertas";
const form = $("#filtros");
const list = $("#lista");
let categories = [];
let requestId = 0;

// ------------------------------------------------------------ estado <-> URL
function readState() {
  const p = params();
  return {
    q: (p.get("q") || "").slice(0, 80),
    categoria: p.get("categoria") || "",
    min: p.get("min") || "",
    max: p.get("max") || "",
    ofertas: p.get("ofertas") === "1",
    estoque: p.get("estoque") === "1",
    ordem: p.get("ordem") || "",
  };
}

function writeState(state) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) {
    if (v === true) p.set(k, "1");
    else if (v) p.set(k, v);
  }
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

function stateFromForm() {
  const f = form.elements;
  return {
    q: f.q.value.trim(),
    categoria: form.querySelector('input[name="categoria"]:checked')?.value || "",
    min: f.min.value,
    max: f.max.value,
    ofertas: f.ofertas ? f.ofertas.checked : false,
    estoque: f.estoque.checked,
    ordem: f.ordem.value,
  };
}

function fillForm(state) {
  const f = form.elements;
  f.q.value = state.q;
  f.min.value = state.min;
  f.max.value = state.max;
  if (f.ofertas) f.ofertas.checked = state.ofertas;
  f.estoque.checked = state.estoque;
  f.ordem.value = state.ordem;
  const radio = form.querySelector(`input[name="categoria"][value="${CSS.escape(state.categoria)}"]`);
  (radio || form.querySelector('input[name="categoria"][value=""]')).checked = true;
}

// ------------------------------------------------------------ renderização
function renderCategories() {
  $("#f-categorias").innerHTML = [{ slug: "", name: "Todas", product_count: null }, ...categories].map((c) => `
    <label class="opcao"><input type="radio" name="categoria" value="${esc(c.slug)}">
      ${esc(c.name)}${c.product_count !== null ? `<small>${c.product_count}</small>` : ""}</label>`).join("");
}

function renderChips(state) {
  const chips = [];
  const cat = categories.find((c) => c.slug === state.categoria);
  if (state.q) chips.push(["q", `Busca: “${state.q}”`]);
  if (cat) chips.push(["categoria", cat.name]);
  if (state.min) chips.push(["min", `A partir de R$ ${state.min}`]);
  if (state.max) chips.push(["max", `Até R$ ${state.max}`]);
  if (state.ofertas) chips.push(["ofertas", "Ofertas"]);
  if (state.estoque) chips.push(["estoque", "Disponíveis"]);
  $("#chips").innerHTML = chips.map(([k, label]) =>
    `<button type="button" class="chip" data-remover="${k}" aria-label="Remover filtro ${esc(label)}">${esc(label)} ✕</button>`).join("");
}

function updateHeading(state) {
  const cat = categories.find((c) => c.slug === state.categoria);
  const base = offersMode ? "Ofertas especiais" : "Nossos produtos";
  const title = state.q ? `Resultados para “${state.q}”` : cat ? `${offersMode ? "Ofertas em " : ""}${cat.name}` : base;
  $("#titulo-pagina").textContent = title;
  $("#migalha-atual").textContent = cat ? cat.name : offersMode ? "Ofertas" : "Produtos";
  setMeta(cat ? cat.name : offersMode ? "Ofertas" : "Produtos",
    cat ? `${cat.name} na Papelaria Cristã — produtos cristãos selecionados com carinho.` : null);
}

function validPrices(state) {
  const min = state.min === "" ? null : Number(state.min);
  const max = state.max === "" ? null : Number(state.max);
  const erro = $("#erro-preco");
  let msg = "";
  if ((min !== null && (Number.isNaN(min) || min < 0)) || (max !== null && (Number.isNaN(max) || max < 0))) {
    msg = "Informe valores positivos.";
  } else if (min !== null && max !== null && min > max) {
    msg = "O preço mínimo não pode ser maior que o máximo.";
  }
  erro.textContent = msg;
  form.elements.min.toggleAttribute("aria-invalid", !!msg);
  form.elements.max.toggleAttribute("aria-invalid", !!msg);
  return !msg;
}

async function search() {
  const state = stateFromForm();
  writeState(state);
  renderChips(state);
  updateHeading(state);
  if (!validPrices(state)) return;

  const query = new URLSearchParams({ limit: "200" });
  if (state.q) query.set("q", state.q);
  if (state.categoria) query.set("category", state.categoria);
  if (state.min) query.set("min_price", state.min);
  if (state.max) query.set("max_price", state.max);
  if (offersMode || state.ofertas) query.set("offer", "1");
  if (state.estoque) query.set("in_stock", "1");
  if (state.ordem) query.set("sort", state.ordem);

  const id = ++requestId;
  list.setAttribute("aria-busy", "true");
  try {
    const products = await api(`/products?${query}`);
    if (id !== requestId) return; // resposta antiga — ignora
    $("#contagem").textContent = `${products.length} ${products.length === 1 ? "produto encontrado" : "produtos encontrados"}`;
    if (products.length) {
      list.innerHTML = products.map(productCard).join("");
    } else {
      const cat = categories.find((c) => c.slug === state.categoria);
      const soon = cat && cat.product_count === 0 && !state.q;
      list.innerHTML = soon
        ? emptyState("✿", `${cat.name}: em breve`, "Estamos preparando novidades para esta categoria. Enquanto isso, conheça nossos outros produtos.",
          '<a class="btn" href="produtos.html">Ver todos os produtos</a>')
        : emptyState("🔍", "Nenhum produto encontrado", "Tente outras palavras ou remova alguns filtros.",
          '<button class="btn" type="button" data-limpar>Limpar filtros</button>');
    }
  } catch (err) {
    if (id !== requestId) return;
    $("#contagem").textContent = "";
    list.innerHTML = emptyState("⚠", "Não foi possível carregar os produtos", err.message,
      '<button class="btn" type="button" data-tentar>Tentar novamente</button>');
  } finally {
    list.removeAttribute("aria-busy");
  }
}

// ------------------------------------------------------------ eventos
function clearAll() {
  form.reset(); // dispara o evento "reset" abaixo
}

function afterReset() {
  form.querySelector('input[name="categoria"][value=""]').checked = true;
  search();
}

form.addEventListener("submit", (e) => { e.preventDefault(); search(); });
form.addEventListener("change", (e) => { if (e.target.name !== "q") search(); });
form.elements.q.addEventListener("input", debounce(search, 350));
// o navegador limpa os campos; depois marcamos "Todas" e buscamos de novo
form.addEventListener("reset", () => setTimeout(afterReset));

$("#chips").addEventListener("click", (e) => {
  const key = e.target.closest("[data-remover]")?.dataset.remover;
  if (!key) return;
  const f = form.elements;
  if (key === "categoria") form.querySelector('input[name="categoria"][value=""]').checked = true;
  else if (key === "ofertas" || key === "estoque") f[key].checked = false;
  else f[key].value = "";
  search();
});

list.addEventListener("click", (e) => {
  if (e.target.closest("[data-limpar]")) clearAll();
  if (e.target.closest("[data-tentar]")) search();
});

const toggle = $(".filtros-toggle");
toggle.addEventListener("click", () => {
  const open = form.classList.toggle("aberto");
  toggle.setAttribute("aria-expanded", open);
});

// ------------------------------------------------------------ início
(async () => {
  try {
    categories = await cached("/categories");
  } catch {
    categories = [];
  }
  renderCategories();
  fillForm(readState());
  search();
})();
