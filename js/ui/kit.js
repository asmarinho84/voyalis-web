// Peças de interface compartilhadas: ícones (SVG próprios), formatação em pt-BR, links externos seguros
// (só http/https, sem referrer, com afiliado quando configurado) e pequenos componentes.
import { AFFILIATES } from "../config.js";

const svg = (body, extra = "") => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;
export const icon = {
  logo: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#F2A900"/><path d="M7 22c4-9 11-13 19-13" fill="none" stroke="#0B4F6C" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="1 4.2"/><path d="M21.5 6.5l5 2.8-3.4 4.4z" fill="#0B4F6C"/><circle cx="7" cy="22" r="2.6" fill="#0B4F6C"/></svg>`,
  plane: svg('<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>'), // Lucide (ISC)
  bed: svg('<path d="M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="10.5" r="1.8"/>'),
  pin: svg('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  shield: svg('<path d="M12 3 5 6v5c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10V6z"/><path d="m9 12 2 2 4-4"/>'),
  calendar: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  bell: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  list: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
  globe: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 3.8 5.5 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.5-3.8-9S9.4 5.5 12 3z"/>'),
  map: svg('<path d="m9 4-5.5 2v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>'),
  ticket: svg('<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h14a1.5 1.5 0 0 1 1.5 1.5V10a2 2 0 0 0 0 4v2.5A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5V14a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2.5"/>'),
  star: svg('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
  tag: svg('<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9z"/><circle cx="8" cy="8" r="1.5"/>'),
  cart: svg('<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3.5h3l2.5 12h11l2-8H7"/>'),
  coins: svg('<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7"/><path d="M9.5 16.4c.8.4 2 .6 3.5.6 3 0 5.5-1.1 5.5-2.5V10.6"/><path d="M14.5 11.6c2.3.2 4 .9 4 1.9"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.7"/><path d="M12 17.3v.2"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  swap: svg('<path d="M7 4 3.5 7.5 7 11M3.5 7.5h13M17 13l3.5 3.5L17 20M20.5 16.5h-13"/>'),
  out: svg('<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  key: svg('<circle cx="8" cy="15" r="4.5"/><path d="m11.3 11.7 8.2-8.2M16.5 6.5l2.5 2.5M14 9l2 2"/>'),
  share: svg('<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1"/>'),
  paste: svg('<rect x="7" y="4" width="10" height="4" rx="1.2"/><path d="M7 6H5.5A1.5 1.5 0 0 0 4 7.5v12A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-12A1.5 1.5 0 0 0 18.5 6H17"/>'),
  compass: svg('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'),
};

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const brl = (v) => (v == null ? "—" : "R$ " + Math.round(v).toLocaleString("pt-BR"));
export const num = (v, d = 1) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: d }));
export const fdate = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "");
export const fdow = (s) => ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][new Date(s + "T12:00:00").getDay()];
export const fdateLong = (s) => (s ? `${fdow(s)}, ${fdate(s)}` : "");
export const dur = (m) => (m ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : "");
export const stopsTxt = (n) => (n == null ? "" : n === 0 ? "Direto" : n === 1 ? "1 parada" : `${n} paradas`);
export const rating = (r) => (r ? String(r).replace(".", ",") : "");
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const CABIN_TXT = { economy: "Econômica", premium: "Econômica premium", business: "Executiva", first: "Primeira classe" };

/** Só endereços http(s) válidos; qualquer outra coisa (javascript:, data:…) vira null. */
export function safeUrl(u) {
  try {
    const x = new URL(String(u || ""));
    return x.protocol === "https:" || x.protocol === "http:" ? x.href : null;
  } catch { return null; }
}
/** Aplica o código de afiliado do domínio (config.js), se houver. Devolve { href, sponsored }. */
export function affiliate(u, table = AFFILIATES) {
  const href = safeUrl(u);
  if (!href) return { href: null, sponsored: false };
  const host = new URL(href).hostname.replace(/^www\./, "");
  const rule = Object.entries(table).find(([d]) => host === d || host.endsWith("." + d))?.[1];
  if (!rule) return { href, sponsored: false };
  if (rule.wrap && rule.wrap.includes("{url}")) {
    const w = safeUrl(rule.wrap.replace("{url}", encodeURIComponent(href)));
    if (w) return { href: w, sponsored: true };
  }
  const params = Object.entries(rule.params || {}).filter(([, v]) => v);
  if (!params.length) return { href, sponsored: false };
  const x = new URL(href);
  for (const [k, v] of params) x.searchParams.set(k, v);
  return { href: x.href, sponsored: true };
}
/** Link externo seguro: nova aba, sem acesso à página de origem, sem enviar o endereço do Voyalis. */
export function extLink(u, label, cls = "") {
  const a = affiliate(u);
  if (!a.href) return "";
  return `<a href="${esc(a.href)}" target="_blank" rel="noopener noreferrer${a.sponsored ? " sponsored" : ""}"${cls ? ` class="${cls}"` : ""}>${label}</a>`;
}
export const linkRow = (obj) => `<div class="linkgrid">${Object.entries(obj || {}).map(([k, u]) => extLink(u, `${esc(k)} ${icon.out}`)).join("")}</div>`;
export const tagsHTML = (tags, cls = (t) => "") => (tags || []).map((t) => `<span class="tag ${cls(t)}">${esc(t)}</span>`).join("");
export const flagsHTML = (fl) => (fl || []).map((f) => `<div class="${f.level === "alert" ? "warnbox" : "muted small"}" style="margin-top:4px">${f.level === "alert" ? "Atenção: " : ""}${esc(f.text)}</div>`).join("");
export const thumb = (url, ic, cls = "thumb") => {
  const u = safeUrl(url);
  return u ? `<div class="${cls}"><img src="${esc(u)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></div>` : `<div class="${cls}">${ic}</div>`;
};

/** Aviso rápido no rodapé da tela (substitui alert()). */
export function toast(msg, kind = "info") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("out"), 4200);
  setTimeout(() => el.remove(), 4700);
}

/** Folha deslizante (bottom sheet) acessível. Fecha no X, no fundo escuro e no botão voltar/Esc. */
export function openSheet(title, html, { onClose, wide } = {}) {
  const layer = document.getElementById("layer");
  const el = document.createElement("div");
  el.className = "scrim";
  el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}" ${wide ? 'style="max-width:860px"' : ""}><div class="grab"></div>
    <div class="hd"><h2>${esc(title)}</h2><button class="x" type="button" aria-label="Fechar">${icon.close}</button></div><div class="bd">${html}</div></div>`;
  const close = () => { el.remove(); document.removeEventListener("keydown", onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  el.addEventListener("click", (e) => { if (e.target === el) close(); });
  el.querySelector(".x").onclick = close;
  document.addEventListener("keydown", onKey);
  layer.appendChild(el);
  el.querySelector(".x").focus();
  return { el, body: el.querySelector(".bd"), close };
}
