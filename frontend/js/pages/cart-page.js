// Página do carrinho: quantidades, total e finalização do pedido.
import { api } from "../core/api.js";
import * as cart from "../core/cart.js";
import { emptyState, icons, mountLayout, toast } from "../core/layout.js";
import { $, esc, maskPhone, money, onlyDigits, setLoading, showFieldErrors } from "../core/utils.js";

mountLayout();

const list = $("#itens");
const summary = $("#resumo");
const form = $("#checkout");

function render() {
  const items = cart.getItems();
  if (!items.length) {
    list.innerHTML = `<li>${emptyState("🛍", "Seu carrinho está vazio",
      "Que tal conhecer nossas Bíblias, devocionais e presentes?",
      '<a class="btn" href="produtos.html">Ver produtos</a>')}</li>`;
    summary.hidden = true;
    return;
  }
  list.innerHTML = items.map((i) => {
    const url = `produto.html?p=${encodeURIComponent(i.slug)}`;
    const max = Math.min(i.stock, 99);
    return `
    <li class="cart-item" data-id="${i.id}">
      <a href="${url}" tabindex="-1" aria-hidden="true"><img src="${esc(i.image || "img/sem-foto.svg")}" alt="" width="96" height="116"></a>
      <div>
        <h3><a href="${url}">${esc(i.name)}</a></h3>
        <div class="cart-item__unit">${money(i.final_cents)} cada</div>
        ${i.qty >= max ? `<small class="estoque estoque--baixo">Máximo disponível: ${max}</small>` : ""}
      </div>
      <div class="cart-item__lado">
        <div class="qtd" role="group" aria-label="Quantidade de ${esc(i.name)}">
          <button type="button" data-acao="menos" aria-label="Diminuir quantidade">−</button>
          <output aria-live="polite">${i.qty}</output>
          <button type="button" data-acao="mais" aria-label="Aumentar quantidade"${i.qty >= max ? " disabled" : ""}>+</button>
        </div>
        <span class="cart-item__sub">${money(i.final_cents * i.qty)}</span>
        <button class="remover" type="button" data-acao="remover">Remover</button>
      </div>
    </li>`;
  }).join("");

  const subtotalFull = items.reduce((s, i) => s + (i.price_cents ?? i.final_cents) * i.qty, 0);
  const total = cart.total();
  $("#r-itens").textContent = cart.count();
  $("#r-subtotal").textContent = money(subtotalFull);
  $("#r-economia-linha").hidden = subtotalFull <= total;
  $("#r-economia").textContent = `− ${money(subtotalFull - total)}`;
  $("#r-total").textContent = money(total);
  summary.hidden = false;
}

list.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-acao]");
  if (!btn) return;
  const id = Number(btn.closest(".cart-item").dataset.id);
  const item = cart.getItems().find((i) => i.id === id);
  if (!item) return;
  if (btn.dataset.acao === "mais") cart.setQty(id, item.qty + 1);
  if (btn.dataset.acao === "menos") cart.setQty(id, item.qty - 1);
  if (btn.dataset.acao === "remover") {
    cart.remove(id);
    toast(`“${item.name}” removido do carrinho.`);
  }
});
document.addEventListener("cart:change", render);

// ------------------------------------------------------------ finalização
const phone = form.elements.customer_phone;
phone.addEventListener("input", () => { phone.value = maskPhone(phone.value); });

function validate() {
  const errors = {};
  const name = form.elements.customer_name.value.trim();
  const digits = onlyDigits(phone.value);
  if (name.length < 2) errors.customer_name = "Informe seu nome.";
  if (digits.length < 10 || digits.length > 11) errors.customer_phone = "Informe um telefone com DDD.";
  if (!cart.count()) errors.items = "Seu carrinho está vazio.";
  return errors;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!showFieldErrors(form, validate())) return;
  const button = $("#finalizar");
  setLoading(button, true, "Enviando pedido…");
  try {
    const order = await api("/orders", {
      method: "POST",
      body: {
        customer_name: form.elements.customer_name.value.trim(),
        customer_phone: onlyDigits(phone.value),
        notes: form.elements.notes.value.trim(),
        items: cart.getItems().map((i) => ({ product_id: i.id, quantity: i.qty })),
      },
    });
    cart.clear();
    showSuccess(order);
  } catch (err) {
    showFieldErrors(form, Object.keys(err.fields).length ? err.fields : { items: err.message });
    toast(err.message, "erro");
    if (err.status === 400) await refreshFromApi(); // estoque/preço pode ter mudado
  } finally {
    setLoading(button, false);
  }
});

function showSuccess(order) {
  $("#carrinho").hidden = true;
  $("#avisos").innerHTML = "";
  const box = $("#sucesso");
  box.innerHTML = `
    <div class="centro">
      <div class="vazio__icone" aria-hidden="true">🕊</div>
      <h2>Pedido ${esc(order.code)} registrado!</h2>
      <p>Total: <strong>${money(order.total_cents)}</strong></p>
      ${order.whatsapp_url
        ? `<p>Para concluir, envie o pedido para a loja pelo WhatsApp. Lá vocês combinam entrega e pagamento.</p>
           <a class="btn btn--whats" id="enviar-whats" href="${esc(order.whatsapp_url)}" target="_blank" rel="noopener noreferrer">${icons.whats} Enviar pedido pelo WhatsApp</a>`
        : `<p>A loja recebeu seu pedido e entrará em contato pelo telefone informado para combinar entrega e pagamento.</p>`}
      <p><a href="produtos.html">Continuar comprando</a></p>
    </div>`;
  box.hidden = false;
  box.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function refreshFromApi() {
  if (!cart.count()) return render();
  try {
    const ids = cart.getItems().map((i) => i.id).join(",");
    const products = await api(`/products?ids=${ids}`);
    const notices = cart.sync(products);
    $("#avisos").innerHTML = notices.map((n) => `<div class="alerta alerta--aviso">${esc(n)}</div>`).join("");
  } catch (err) {
    $("#avisos").innerHTML = `<div class="alerta alerta--erro">${esc(err.message)}</div>`;
  }
  render();
}

render();
refreshFromApi();
