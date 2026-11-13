// Painel administrativo: produtos, estoque, pedidos e configurações.
import { adminToken, api, ApiError } from "../core/api.js";
import { mountLayout, toast } from "../core/layout.js";
import { $, $$, debounce, esc, money, onlyDigits, setLoading, showFieldErrors } from "../core/utils.js";

mountLayout();

const STATUS = {
  pendente: "Pendente", confirmado: "Confirmado", enviado: "Enviado", concluido: "Concluído", cancelado: "Cancelado",
};
// Espelha as transições permitidas no servidor (services.ORDER_TRANSITIONS)
const NEXT = {
  pendente: [["confirmado", "Confirmar (baixa estoque)"], ["cancelado", "Cancelar"]],
  confirmado: [["enviado", "Marcar como enviado"], ["concluido", "Concluir"], ["cancelado", "Cancelar"]],
  enviado: [["concluido", "Concluir"], ["cancelado", "Cancelar"]],
  concluido: [],
  cancelado: [],
};

const state = { products: [], categories: [], editing: null, stockProduct: null };
const adm = (path, opts = {}) => api(path, { ...opts, admin: true });

// ------------------------------------------------------------ sessão
function showLogin() {
  $("#painel").hidden = true;
  $("#login-view").hidden = false;
  $("#senha").focus();
}

async function handle(promise, button, label) {
  if (button) setLoading(button, true, label);
  try {
    return await promise;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      toast("Sua sessão expirou. Entre novamente.", "erro");
      showLogin();
    }
    throw err;
  } finally {
    if (button) setLoading(button, false);
  }
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const password = form.elements.password.value;
  if (!password) return showFieldErrors(form, { password: "Digite a senha." });
  const button = form.querySelector("button");
  setLoading(button, true, "Entrando…");
  try {
    const { token } = await api("/admin/login", { method: "POST", body: { password } });
    adminToken.set(token);
    form.reset();
    showFieldErrors(form, {});
    await openPanel();
  } catch (err) {
    showFieldErrors(form, { password: err.message });
  } finally {
    setLoading(button, false);
  }
});

$("#sair").addEventListener("click", async () => {
  try { await adm("/admin/logout", { method: "POST" }); } catch { /* sessão já encerrada */ }
  adminToken.clear();
  toast("Você saiu do painel.");
  showLogin();
});

async function openPanel() {
  state.categories = await adm("/categories");
  $("#p-cat").innerHTML = state.categories.map((c) => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join("");
  $("#login-view").hidden = true;
  $("#painel").hidden = false;
  await selectTab("resumo");
}

// ------------------------------------------------------------ abas
const loaders = {
  resumo: loadSummary,
  produtos: loadProducts,
  estoque: loadMovements,
  pedidos: loadOrders,
  config: loadSettings,
};

async function selectTab(name) {
  $$(".aba").forEach((tab) => {
    const active = tab.id === `tab-${name}`;
    tab.setAttribute("aria-selected", active);
    tab.tabIndex = active ? 0 : -1;
    $(`#${tab.getAttribute("aria-controls")}`).hidden = !active;
  });
  try {
    await loaders[name]();
  } catch (err) {
    if (err.status !== 401) toast(err.message, "erro");
  }
}

$(".abas").addEventListener("click", (e) => {
  const tab = e.target.closest(".aba");
  if (tab) selectTab(tab.id.replace("tab-", ""));
});
$(".abas").addEventListener("keydown", (e) => {
  if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
  const tabs = $$(".aba");
  const i = tabs.indexOf(document.activeElement);
  const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
  next.focus();
  selectTab(next.id.replace("tab-", ""));
});

// ------------------------------------------------------------ visão geral
async function loadSummary() {
  const s = await handle(adm("/admin/summary"));
  const notices = [];
  if (!s.whatsapp_configured) {
    notices.push(`<div class="alerta alerta--aviso"><strong>Configure o WhatsApp da loja</strong> para que os clientes possam enviar
      os pedidos por lá. <a href="#" data-ir="config">Abrir configurações</a></div>`);
  }
  if (!localStorage.getItem("pc_aviso_precos_ok")) {
    notices.push(`<div class="alerta alerta--info" id="aviso-precos"><strong>Revise preços e estoques.</strong>
      Os produtos iniciais foram cadastrados com valores de referência. Confira cada um antes de divulgar a loja.
      <button class="btn btn--sm btn--claro" type="button" id="ok-precos">Já revisei</button></div>`);
  }
  $("#avisos-admin").innerHTML = notices.join("");
  $("#metricas").innerHTML = [
    ["Produtos ativos", s.products_active],
    ["Pedidos pendentes", s.orders_pending],
    ["Estoque baixo", s.low_stock],
    ["Esgotados", s.out_of_stock],
    ["Vendas confirmadas", money(s.revenue_cents)],
  ].map(([l, v]) => `<div class="metrica"><small>${l}</small><strong data-alvo="${typeof v === "number" ? v : ""}">${typeof v === "number" ? 0 : v}</strong></div>`).join("");
  contarMetricas();
}

function contarMetricas() {
  const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
  $$("#metricas [data-alvo]").forEach((el) => {
    const alvo = Number(el.dataset.alvo);
    if (el.dataset.alvo === "" ) return;
    if (reduz || alvo === 0) { el.textContent = alvo; return; }
    const t0 = performance.now();
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / 700);
      el.textContent = Math.round(alvo * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}

$("#avisos-admin").addEventListener("click", (e) => {
  if (e.target.id === "ok-precos") {
    localStorage.setItem("pc_aviso_precos_ok", "1");
    $("#aviso-precos").remove();
  }
  const go = e.target.closest("[data-ir]");
  if (go) { e.preventDefault(); selectTab(go.dataset.ir); }
});

// ------------------------------------------------------------ produtos
async function loadProducts() {
  state.products = await handle(adm("/admin/products?limit=200"));
  renderProducts();
}

function renderProducts() {
  const term = $("#busca-admin").value.trim().toLowerCase();
  const low = $("#so-baixo").checked;
  const rows = state.products.filter((p) =>
    (!term || p.name.toLowerCase().includes(term)) && (!low || p.stock <= 2));
  $("#tabela-produtos").innerHTML = rows.length ? rows.map((p) => `
    <tr data-id="${p.id}">
      <td><img src="${esc(p.image || "img/sem-foto.svg")}" alt=""></td>
      <td><a href="produto.html?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">${esc(p.name)}</a>
        ${p.featured ? '<br><span class="etiqueta etiqueta--destaque">Destaque</span>' : ""}</td>
      <td>${esc(p.category.name)}</td>
      <td>${money(p.price_cents)}</td>
      <td>${p.promo_cents !== null ? money(p.promo_cents) : "—"}</td>
      <td><strong class="estoque ${p.stock === 0 ? "estoque--zero" : p.stock <= 2 ? "estoque--baixo" : "estoque--ok"}">${p.stock}</strong></td>
      <td>${p.active ? '<span class="etiqueta etiqueta--neutra">Visível</span>' : '<span class="etiqueta etiqueta--esgotado">Oculto</span>'}</td>
      <td><div class="acoes">
        <button class="btn btn--sm btn--claro" type="button" data-acao="editar">Editar</button>
        <button class="btn btn--sm btn--azul" type="button" data-acao="estoque">Estoque</button>
        <button class="btn btn--sm btn--perigo" type="button" data-acao="excluir">Excluir</button>
      </div></td>
    </tr>`).join("") : `<tr><td colspan="8">Nenhum produto encontrado.</td></tr>`;
}

$("#busca-admin").addEventListener("input", debounce(renderProducts, 200));
$("#so-baixo").addEventListener("change", renderProducts);
$("#novo-produto").addEventListener("click", () => openProductDialog(null));

$("#tabela-produtos").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-acao]");
  if (!btn) return;
  const product = state.products.find((p) => p.id === Number(btn.closest("tr").dataset.id));
  if (btn.dataset.acao === "editar") openProductDialog(product);
  if (btn.dataset.acao === "estoque") openStockDialog(product);
  if (btn.dataset.acao === "excluir") {
    confirmAction(`Excluir “${product.name}”? Esta ação não pode ser desfeita. Pedidos antigos continuam com o nome do produto.`,
      async () => {
        await handle(adm(`/admin/products/${product.id}`, { method: "DELETE" }));
        toast("Produto excluído.", "sucesso");
        await loadProducts();
      });
  }
});

const toInput = (cents) => (cents === null || cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ","));

function openProductDialog(product) {
  state.editing = product;
  const form = $("#form-produto");
  form.reset();
  showFieldErrors(form, {});
  $("#dlg-produto-titulo").textContent = product ? "Editar produto" : "Novo produto";
  const f = form.elements;
  f.name.value = product?.name || "";
  f.category.value = product?.category.slug || state.categories[0]?.slug || "";
  f.stock.value = product?.stock ?? 0;
  f.price.value = toInput(product?.price_cents);
  f.promo_price.value = toInput(product?.promo_cents);
  f.description.value = product?.description || "";
  f.image.value = product?.image || "";
  f.featured.checked = !!product?.featured;
  f.active.checked = product ? product.active : true;
  $("#p-preview").src = product?.image || "img/sem-foto.svg";
  $("#dlg-produto").showModal();
}

$("#p-foto").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const form = $("#form-produto");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    showFieldErrors(form, { image: "Use uma imagem JPG, PNG ou WEBP." });
    e.target.value = "";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showFieldErrors(form, { image: "A imagem deve ter no máximo 5 MB." });
    e.target.value = "";
    return;
  }
  const data = new FormData();
  data.append("image", file);
  const save = $("#salvar-produto");
  try {
    const { path } = await handle(adm("/admin/upload", { method: "POST", form: data }), save, "Enviando foto…");
    form.elements.image.value = path;
    $("#p-preview").src = path;
    showFieldErrors(form, {});
  } catch (err) {
    showFieldErrors(form, { image: err.fields.image || err.message });
  }
});

function validateProduct(f) {
  const errors = {};
  const num = (v) => {
    const t = String(v).replace("R$", "").trim();
    return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  };
  if (f.name.value.trim().length < 3) errors.name = "Informe o nome (mínimo de 3 caracteres).";
  const price = num(f.price.value);
  if (!f.price.value.trim() || Number.isNaN(price) || price <= 0) errors.price = "Informe um preço maior que zero.";
  if (f.promo_price.value.trim()) {
    const promo = num(f.promo_price.value);
    if (Number.isNaN(promo) || promo < 0) errors.promo_price = "Valor inválido.";
    else if (!errors.price && promo >= price) errors.promo_price = "Deve ser menor que o preço normal.";
  }
  if (f.stock.value === "" || !Number.isInteger(Number(f.stock.value)) || Number(f.stock.value) < 0) {
    errors.stock = "Informe um número inteiro igual ou maior que zero.";
  }
  return errors;
}

$("#form-produto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const f = form.elements;
  if (!showFieldErrors(form, validateProduct(f))) return;
  const body = {
    name: f.name.value.trim(),
    category: f.category.value,
    price: f.price.value.trim(),
    promo_price: f.promo_price.value.trim(),
    stock: Number(f.stock.value),
    description: f.description.value.trim(),
    image: f.image.value,
    featured: f.featured.checked,
    active: f.active.checked,
  };
  const editing = state.editing;
  try {
    await handle(editing
      ? adm(`/admin/products/${editing.id}`, { method: "PUT", body })
      : adm("/admin/products", { method: "POST", body }), $("#salvar-produto"), "Salvando…");
    $("#dlg-produto").close();
    toast(editing ? "Produto atualizado." : "Produto cadastrado.", "sucesso");
    await loadProducts();
  } catch (err) {
    showFieldErrors(form, Object.keys(err.fields).length ? err.fields : { name: err.message });
  }
});

// ------------------------------------------------------------ estoque
function openStockDialog(product) {
  state.stockProduct = product;
  const form = $("#form-estoque");
  form.reset();
  showFieldErrors(form, {});
  $("#estoque-info").innerHTML = `<strong>${esc(product.name)}</strong><br>Estoque atual: <strong>${product.stock}</strong>`;
  $("#dlg-estoque").showModal();
}

$("#form-estoque").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const f = form.elements;
  const qty = Number(f.delta.value);
  if (!Number.isInteger(qty) || qty < 1) return showFieldErrors(form, { delta: "Informe uma quantidade inteira maior que zero." });
  const delta = qty * Number(f.tipo.value);
  if (state.stockProduct.stock + delta < 0) {
    return showFieldErrors(form, { delta: `Estoque insuficiente. Disponível: ${state.stockProduct.stock}.` });
  }
  try {
    await handle(adm(`/admin/products/${state.stockProduct.id}/stock`, {
      method: "POST", body: { delta, reason: f.reason.value.trim() || "Ajuste manual" },
    }), form.querySelector('[type="submit"]'), "Salvando…");
    $("#dlg-estoque").close();
    toast("Estoque atualizado.", "sucesso");
    await loadProducts();
  } catch (err) {
    showFieldErrors(form, Object.keys(err.fields).length ? err.fields : { delta: err.message });
  }
});

async function loadMovements() {
  const rows = await handle(adm("/admin/stock/movements"));
  $("#tabela-movimentos").innerHTML = rows.length ? rows.map((m) => `
    <tr><td>${esc(formatDate(m.created_at))}</td><td>${esc(m.product_name)}</td>
      <td><strong class="estoque ${m.delta < 0 ? "estoque--zero" : "estoque--ok"}">${m.delta > 0 ? "+" : ""}${m.delta}</strong></td>
      <td>${m.stock_after}</td><td>${esc(m.reason)}</td></tr>`).join("")
    : '<tr><td colspan="5">Nenhuma movimentação registrada.</td></tr>';
}

// ------------------------------------------------------------ pedidos
async function loadOrders() {
  const status = $("#filtro-status").value;
  const orders = await handle(adm(`/admin/orders${status ? `?status=${status}` : ""}`));
  $("#lista-pedidos").innerHTML = orders.length ? orders.map((o) => {
    const phone = onlyDigits(o.customer_phone);
    const wa = `https://wa.me/${phone.length <= 11 ? `55${phone}` : phone}`;
    return `
    <article class="pedido" data-id="${o.id}">
      <div class="pedido__topo">
        <div><strong>${esc(o.code)}</strong> · ${esc(formatDate(o.created_at))}</div>
        <span class="status status--${o.status}">${STATUS[o.status]}</span>
      </div>
      <p>${esc(o.customer_name)} · <a href="${wa}" target="_blank" rel="noopener noreferrer">${esc(o.customer_phone)}</a></p>
      <ul>${o.items.map((i) => `<li>${i.quantity}× ${esc(i.product_name)} — ${money(i.unit_cents * i.quantity)}</li>`).join("")}</ul>
      ${o.notes ? `<p><em>Obs.: ${esc(o.notes)}</em></p>` : ""}
      <p><strong>Total: ${money(o.total_cents)}</strong></p>
      <div class="acoes hero__acoes">${NEXT[o.status].map(([s, label]) =>
        `<button class="btn btn--sm ${s === "cancelado" ? "btn--perigo" : ""}" type="button" data-status="${s}">${label}</button>`).join("")}</div>
    </article>`;
  }).join("") : '<div class="vazio"><p>Nenhum pedido encontrado.</p></div>';
}

$("#filtro-status").addEventListener("change", () => loadOrders().catch((e) => toast(e.message, "erro")));
$("#lista-pedidos").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-status]");
  if (!btn) return;
  const id = btn.closest(".pedido").dataset.id;
  const status = btn.dataset.status;
  const run = async () => {
    await handle(adm(`/admin/orders/${id}`, { method: "PATCH", body: { status } }), btn, "Salvando…");
    toast(`Pedido marcado como ${STATUS[status].toLowerCase()}.`, "sucesso");
    await loadOrders();
  };
  if (status === "cancelado") confirmAction("Cancelar este pedido? Se o estoque já tiver sido baixado, ele será devolvido.", run);
  else run().catch((err) => toast(err.message, "erro"));
});

// ------------------------------------------------------------ configurações
async function loadSettings() {
  const form = $("#form-config");
  form.inert = true; // evita editar antes de carregar os dados atuais
  const s = await handle(adm("/admin/settings")).finally(() => { form.inert = false; });
  for (const [k, v] of Object.entries(s)) if (form.elements[k]) form.elements[k].value = v;
}

$("#form-config").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const body = Object.fromEntries(new FormData(form));
  if (!body.store_name.trim()) return showFieldErrors(form, { store_name: "Informe o nome da loja." });
  try {
    await handle(adm("/admin/settings", { method: "PUT", body }), form.querySelector('[type="submit"]'), "Salvando…");
    showFieldErrors(form, {});
    toast("Configurações salvas.", "sucesso");
  } catch (err) {
    showFieldErrors(form, err.fields);
    toast(err.message, "erro");
  }
});

// ------------------------------------------------------------ diálogos
let confirmCallback = null;
function confirmAction(text, callback) {
  $("#confirmar-texto").textContent = text;
  confirmCallback = callback;
  $("#dlg-confirmar").showModal();
}
$("#confirmar-sim").addEventListener("click", async (e) => {
  try {
    await handle(confirmCallback(), e.currentTarget, "Aguarde…");
    $("#dlg-confirmar").close();
  } catch (err) {
    $("#dlg-confirmar").close();
    toast(err.message, "erro");
  }
});
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-fechar]")) e.target.closest("dialog").close();
});

function formatDate(iso) {
  const d = new Date(`${iso.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// ------------------------------------------------------------ início
if (adminToken.get()) {
  openPanel().catch(() => showLogin());
} else {
  showLogin();
}
