// Carrinho de compras (persistido no navegador).
// Guardamos um "retrato" do produto para exibição rápida; preços e estoque
// são sempre revalidados com a API na página do carrinho e no servidor ao
// criar o pedido — o valor cobrado nunca vem do navegador.
const KEY = "pc_cart_v1";
const MAX_QTY = 99;

function read() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(data) ? data.filter((i) => Number.isInteger(i.id) && i.qty > 0) : [];
  } catch {
    return [];
  }
}

let items = read();

function save() {
  localStorage.setItem(KEY, JSON.stringify(items));
  document.dispatchEvent(new CustomEvent("cart:change", { detail: { count: count() } }));
}

const snapshot = (p) => ({
  id: p.id, slug: p.slug, name: p.name, image: p.image,
  final_cents: p.final_cents, price_cents: p.price_cents, stock: p.stock,
});

export const getItems = () => items.map((i) => ({ ...i }));
export const count = () => items.reduce((s, i) => s + i.qty, 0);
export const total = () => items.reduce((s, i) => s + i.qty * i.final_cents, 0);
export const quantityOf = (id) => items.find((i) => i.id === id)?.qty || 0;

/** Adiciona ao carrinho respeitando o estoque. Retorna a quantidade efetivamente adicionada. */
export function add(product, qty = 1) {
  const limit = Math.min(product.stock, MAX_QTY);
  const existing = items.find((i) => i.id === product.id);
  const current = existing?.qty || 0;
  const added = Math.max(0, Math.min(qty, limit - current));
  if (!added) return 0;
  if (existing) Object.assign(existing, snapshot(product), { qty: current + added });
  else items.push({ ...snapshot(product), qty: added });
  save();
  return added;
}

export function setQty(id, qty) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  const limit = Math.min(item.stock, MAX_QTY);
  if (qty <= 0) return remove(id);
  item.qty = Math.min(qty, limit);
  save();
}

export function remove(id) {
  items = items.filter((i) => i.id !== id);
  save();
}

export function clear() {
  items = [];
  save();
}

/**
 * Atualiza o carrinho com os dados atuais da API.
 * Retorna avisos para o usuário (produto indisponível, preço alterado...).
 */
export function sync(products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const notices = [];
  items = items.flatMap((item) => {
    const p = byId.get(item.id);
    if (!p || !p.in_stock) {
      notices.push(`“${item.name}” não está mais disponível e foi removido do carrinho.`);
      return [];
    }
    if (p.final_cents !== item.final_cents) notices.push(`O preço de “${p.name}” foi atualizado.`);
    let qty = item.qty;
    if (qty > p.stock) {
      qty = p.stock;
      notices.push(`“${p.name}”: quantidade ajustada para ${p.stock} (estoque disponível).`);
    }
    return [{ ...snapshot(p), qty }];
  });
  save();
  return notices;
}

// Mantém abas diferentes sincronizadas
window.addEventListener("storage", (e) => {
  if (e.key === KEY) {
    items = read();
    document.dispatchEvent(new CustomEvent("cart:change", { detail: { count: count() } }));
  }
});
