// Página de contato: canais configurados pela loja + formulário de mensagem.
import { cached } from "../core/api.js";
import { contactItems, emptyState, mountLayout, toast } from "../core/layout.js";
import { $, esc, showFieldErrors, whatsappLink } from "../core/utils.js";

mountLayout();

const form = $("#form-contato");
let settings = {};

function render() {
  const items = contactItems(settings);
  $("#canais").innerHTML = items.length
    ? items.map((c) => {
        const inner = `<span class="contato-card__icone" aria-hidden="true">${c.icon}</span>
          <span><small>${esc(c.label)}</small>${esc(c.value)}</span>`;
        if (!c.href) return `<div class="contato-card">${inner}</div>`;
        const ext = /^https?:/.test(c.href) ? ' target="_blank" rel="noopener noreferrer"' : "";
        return `<a class="contato-card" href="${esc(c.href)}"${ext}>${inner}</a>`;
      }).join("")
    : emptyState("✿", "Canais em configuração",
        "Os dados de contato da loja ainda estão sendo cadastrados. Volte em breve!");

  // O formulário só aparece se houver para onde enviar (WhatsApp ou e-mail).
  if (settings.whatsapp || settings.email) {
    $("#bloco-form").hidden = false;
    $("#ct-dica").textContent = settings.whatsapp
      ? "Sua mensagem será aberta no WhatsApp, pronta para enviar."
      : "Sua mensagem será aberta no seu aplicativo de e-mail.";
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const nome = form.elements.nome.value.trim();
  const mensagem = form.elements.mensagem.value.trim();
  const errors = {};
  if (nome.length < 2) errors.nome = "Informe seu nome.";
  if (mensagem.length < 5) errors.mensagem = "Escreva sua mensagem (mínimo de 5 caracteres).";
  if (!showFieldErrors(form, errors)) return;

  const assunto = form.elements.assunto.value;
  const text = `Olá! Meu nome é ${nome}.\nAssunto: ${assunto}\n\n${mensagem}`;
  const url = whatsappLink(settings.whatsapp, text)
    || `mailto:${settings.email}?subject=${encodeURIComponent(`${assunto} — ${nome}`)}&body=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
  toast("Mensagem preparada! Confirme o envio na janela aberta.", "sucesso");
  form.reset();
});

cached("/settings")
  .then((s) => { settings = s; render(); })
  .catch((err) => {
    $("#canais").innerHTML = emptyState("⚠", "Não foi possível carregar os contatos", err.message);
  });
