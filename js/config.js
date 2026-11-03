// Configuração do site e da receita. É o único arquivo que você precisa editar para ganhar com o Voyalis.
// Veja docs/GANHOS.md para saber onde conseguir cada código.

// As 5 linhas abaixo são preenchidas pelo publicar.sh (não precisa editar à mão).
export const SITE_URL = "https://asmarinho84.github.io/voyalis-web"; // endereço público do site, sem barra no final
export const API_URL = ""; // intermediário de preços (Cloudflare Worker). Vazio: usa /api/ do próprio domínio; no GitHub Pages, fica sem preços
export const GOATCOUNTER_CODE = ""; // código do painel GoatCounter (a parte antes de .goatcounter.com). Vazio: sem contador
export const CONTACT_EMAIL = ""; // e-mail de contato para privacidade (LGPD) e segurança
export const OWNER_NAME = ""; // nome do responsável pelo site (aparece em Privacidade e Termos)

export const SITE = { name: "Voyalis", url: SITE_URL, contact: CONTACT_EMAIL };

/**
 * Programas de afiliados: quando um visitante abre um site parceiro pelo Voyalis e reserva, você recebe comissão.
 * Para ativar, preencha os parâmetros que o programa te der. Links com afiliado recebem rel="sponsored".
 * Formato: domínio → parâmetros acrescentados ao endereço (ou `wrap`: um endereço de redirecionamento com {url}).
 */
export const AFFILIATES = {
  "booking.com": { params: { aid: "" } }, // Booking.com Affiliate Partner Program: seu "aid"
  "getyourguide.com.br": { params: { partner_id: "" } }, // GetYourGuide Partner: seu "partner_id"
  "viator.com": { params: { pid: "", mcid: "", medium: "link" } }, // Viator Partner: pid e mcid
  "civitatis.com": { params: { aid: "" } }, // Civitatis afiliados: seu "aid"
  "airbnb.com.br": { params: {} },
  "skyscanner.com.br": { wrap: "" }, // ex.: link de redirecionamento do programa (Impact/Travelpayouts) com {url}
  "decolar.com": { wrap: "" },
  "kayak.com.br": { wrap: "" },
};

/** Apoio voluntário (opcional): aparece no rodapé quando preenchido. */
export const SUPPORT = {
  url: "", // ex.: sua página de apoio (Apoia.se, Ko-fi, link de pagamento)
  label: "Apoie o Voyalis",
};
