// Funções utilitárias compartilhadas.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (cents) => brl.format((cents || 0) / 100);

/** Escapa texto para inserção segura em HTML (evita XSS). */
export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const params = () => new URLSearchParams(location.search);

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export const onlyDigits = (v) => String(v || "").replace(/\D/g, "");

/** Máscara de telefone brasileiro: (11) 98765-4321 */
export function maskPhone(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Link do WhatsApp (retorna null se o número da loja não foi configurado). */
export function whatsappLink(number, message) {
  const n = onlyDigits(number);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : null;
}

/** Mostra erros de validação vindos do servidor ou do front-end nos campos do formulário. */
export function showFieldErrors(form, fields = {}) {
  $$("[aria-invalid]", form).forEach((el) => el.removeAttribute("aria-invalid"));
  $$(".erro", form).forEach((el) => (el.textContent = ""));
  let first = null;
  for (const [name, message] of Object.entries(fields)) {
    const input = form.elements[name];
    const box = form.querySelector(`[data-erro="${name}"]`);
    if (input && input.setAttribute) {
      input.setAttribute("aria-invalid", "true");
      first ??= input;
    }
    if (box) box.textContent = message;
  }
  first?.focus();
  return Object.keys(fields).length === 0;
}

export function setLoading(button, loading, label) {
  if (loading) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span> ${esc(label || "Aguarde...")}`;
  } else {
    button.disabled = false;
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}
