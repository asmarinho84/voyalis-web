// Páginas de Privacidade e Termos: o texto acompanha a configuração real do site (contador, intermediário, contato),
// para nunca afirmar algo que não é verdade.
import { API_URL, CONTACT_EMAIL, GOATCOUNTER_CODE, OWNER_NAME } from "./config.js";
import { analyticsOn } from "./analytics.js";

const gc = /^[a-z0-9][a-z0-9-]{1,48}$/.test(GOATCOUNTER_CODE);
const api = /^https:\/\//.test(API_URL) || !/\.github\.io$/i.test(location.hostname);
const gh = /\.github\.io$/i.test(location.hostname);
const show = { gh, nogh: !gh, gc, nogc: !gc, api, noapi: !api, contact: !!CONTACT_EMAIL, nocontact: !CONTACT_EMAIL, owner: !!OWNER_NAME };
for (const el of document.querySelectorAll("[data-show]")) el.hidden = !show[el.dataset.show];
for (const el of document.querySelectorAll("[data-owner]")) el.textContent = OWNER_NAME || "o responsável pelo Voyalis";
for (const el of document.querySelectorAll("[data-contact]")) {
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(CONTACT_EMAIL)) continue;
  const a = document.createElement("a");
  a.href = "mailto:" + CONTACT_EMAIL;
  a.textContent = CONTACT_EMAIL;
  el.replaceChildren(a);
}
const st = document.querySelector("[data-gc-status]");
if (st) st.textContent = gc ? (analyticsOn() ? "ligado neste navegador" : "desligado neste navegador (você pediu para não ser rastreado, ou o site não está publicado)") : "desligado";
