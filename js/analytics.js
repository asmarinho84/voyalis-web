// Contador de acessos anônimo (GoatCounter), sem cookies e sem nenhum script de terceiros:
// o próprio Voyalis envia um pedido de imagem para https://CODIGO.goatcounter.com/count.
// Só liga quando: há código configurado, o site está publicado (https), não é o app Android
// e o navegador não pede para não ser rastreado (Do Not Track / Global Privacy Control).
// Conta a página inicial, cada aba aberta como uma página e eventos sem dados pessoais (ex.: "pesquisa-viagem").
import { GOATCOUNTER_CODE } from "./config.js";

const CODE_RE = /^[a-z0-9][a-z0-9-]{1,48}$/;

export function analyticsOn(g = globalThis) {
  if (!CODE_RE.test(GOATCOUNTER_CODE)) return false;
  if (g.Capacitor?.isNativePlatform?.()) return false;
  if (g.location?.protocol !== "https:") return false;
  const n = g.navigator || {};
  if (n.globalPrivacyControl === true || n.doNotTrack === "1" || n.doNotTrack === "yes" || g.doNotTrack === "1") return false;
  return true;
}

/** Monta o endereço de contagem (exportado para os testes). `path` é relativo à pasta do site, ex.: "viagem/voos". */
export function countUrl(path, { event = false, title = "", base = "/", referrer = "", screen = null } = {}) {
  const clean = String(path || "").toLowerCase().replace(/[^a-z0-9/_-]/g, "").slice(0, 80);
  const q = new URLSearchParams();
  q.set("p", event ? clean : (base.replace(/\/?$/, "/") + clean.replace(/^\/+/, "")).replace(/\/{2,}/g, "/"));
  if (title) q.set("t", String(title).slice(0, 120));
  if (event) q.set("e", "true");
  q.set("r", event ? "" : referrer);
  if (screen) q.set("s", screen);
  q.set("rnd", Math.random().toString(36).slice(2, 10));
  return `https://${GOATCOUNTER_CODE}.goatcounter.com/count?${q}`;
}

const sent = new Set();
/** Conta uma página (ou um evento). Silencioso: nunca atrapalha o site se o contador estiver fora do ar ou bloqueado. */
export function count(path, opts = {}) {
  try {
    if (!analyticsOn()) return;
    const key = (opts.event ? "e:" : "p:") + path;
    if (opts.once && sent.has(key)) return;
    sent.add(key);
    let referrer = "";
    if (!opts.event && document.referrer) {
      const r = new URL(document.referrer);
      if (r.origin !== location.origin) referrer = r.origin; // só o site de origem, nunca o endereço completo
    }
    const s = [screen.width, screen.height, Math.round((devicePixelRatio || 1) * 100) / 100].join(",");
    const img = new Image();
    img.referrerPolicy = "strict-origin"; // o GoatCounter vê só o domínio do site, nunca a pesquisa
    img.src = countUrl(path, { ...opts, base: location.pathname.replace(/[^/]*$/, ""), referrer, screen: s, title: opts.title || (opts.event ? path : document.title) });
  } catch { /* contador nunca quebra o site */ }
}
