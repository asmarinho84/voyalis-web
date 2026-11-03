// Voyalis: ponto de entrada da interface. Liga o formulário, as pesquisas com progresso, as abas de resultado,
// a tela de boas-vindas, a ajuda e as configurações.
import * as C from "./core/index.js";
import { Engine } from "./engine.js";
import { Store } from "./store.js";
import { VERSION } from "./version.js";
import { API_URL, SITE, SUPPORT } from "./config.js";
import { count } from "./analytics.js";
import { esc, extLink, icon, linkRow, openSheet, plural, toast } from "./ui/kit.js";
import { openKeyGuide } from "./ui/keyguide.js";
import { helpHTML } from "./ui/help.js";
import { alertsHTML, indicatorsHTML, newTripState, tripPanel, tripTabs } from "./ui/trip.js";
import { destSheetHTML, newScanState, scanHead, scanPanel, scanTabs } from "./ui/explore.js";

// Onde ficam os preços:
//  - app Android (Capacitor): consulta a SerpApi direto;
//  - site com API_URL (GitHub Pages + Cloudflare Worker): pelo intermediário configurado;
//  - site no Cloudflare Pages ou no servidor local: pelo intermediário /api/ do próprio domínio;
//  - GitHub Pages sem intermediário: sem preços (links prontos e destino continuam funcionando).
const NATIVE = !!globalThis.Capacitor?.isNativePlatform?.();
const API = NATIVE ? null : /^https:\/\/[a-z0-9.-]+(\/[\w.-]*)*$/i.test(API_URL) ? API_URL.replace(/\/*$/, "/") : /\.github\.io$/i.test(location.hostname) ? null : "/api/";
const PRICES = NATIVE || !!API;
let sessionStorageSafe = null;
try { sessionStorageSafe = globalThis.sessionStorage; } catch { /* navegação privada restrita */ }
const store = new Store();
const engine = new Engine(store, NATIVE ? {} : { apiBase: API || "/api/", session: new Store(sessionStorageSafe || undefined, "vys:") });
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const state = {
  mode: "trip",
  trip: { res: null, ui: newTripState() },
  scan: { res: null, ui: newScanState() },
  running: false,
};

/* =============== início =============== */
function init() {
  // Contra "clickjacking" onde a hospedagem não permite o cabeçalho (GitHub Pages): o site não roda dentro de outro.
  if (window.top !== window.self) { document.body.textContent = "Abra o Voyalis no endereço oficial."; try { window.top.location.href = location.href; } catch { /* bloqueado */ } return; }
  $("#brand").innerHTML = `${icon.logo}<span>Voyalis</span>`;
  $("#helpBtn").innerHTML = icon.help;
  $("#keyBtn").innerHTML = icon.key;
  $("#keyBtn").onclick = () => keyGuide();
  if (!PRICES) { $("#keyBtn").classList.add("hide"); $("#credits").classList.add("hide"); }
  ["f1", "f2", "f3", "f4"].forEach((id, i) => { const el = $("#" + id); if (el) el.innerHTML = [icon.tag, icon.map, icon.cart, icon.shield][i]; });
  $("#footHelp").onclick = (e) => { e.preventDefault(); openHelp(); };
  if (SUPPORT.url) $("#support").innerHTML = extLink(SUPPORT.url, esc(SUPPORT.label));
  $("#cfgBtn").innerHTML = icon.gear;
  $("#swap").innerHTML = icon.swap;
  $("#modeTrip").innerHTML = `${icon.plane} Planejar viagem`;
  $("#modeExplore").innerHTML = `${icon.compass} Descobrir destinos`;
  $("#version").textContent = `Voyalis ${VERSION}.`;
  $("#helpBtn").onclick = openHelp;
  $("#cfgBtn").onclick = openSettings;
  $("#credits").onclick = () => keyGuide();
  $("#modeTrip").onclick = () => setMode("trip");
  $("#modeExplore").onclick = () => setMode("explore");
  $("#swap").onclick = () => { const o = $("#origin").value; $("#origin").value = $("#dest").value; $("#dest").value = o; onFormChange(); };
  $("#alertPill").onclick = showAlerts;

  const kmOpts = [0, 1, 2, 3, 5, 10, 20, 30].map((k) => `<option value="${k}">${k ? k + " km" : "Qualquer distância"}</option>`).join("");
  $("#hotelKm").innerHTML = kmOpts;
  $("#tourKm").innerHTML = kmOpts;
  $("#regions").innerHTML = C.REGIONS.map((r) => `<label class="chip"><input type="checkbox" value="${r.id}" checked> ${esc(r.label)}</label>`).join("");
  $("#regAll").onclick = () => { $$("#regions input").forEach((i) => { i.checked = true; }); onFormChange(); };
  $("#regNone").onclick = () => { $$("#regions input").forEach((i) => { i.checked = false; }); onFormChange(); };

  for (const [id, list] of [["origin", "sugO"], ["dest", "sugD"]])
    $("#" + id).addEventListener("input", (e) => {
      $("#" + list).innerHTML = C.suggestPlaces(e.target.value).map((s) => `<option value="${esc(s.code)} — ${esc(s.label)}"></option>`).join("");
    });
  $("#form").addEventListener("input", onFormChange);
  $("#form").addEventListener("change", onFormChange);
  $("#form").addEventListener("submit", onSubmit);

  restoreForm();
  const shared = applyShareParams();
  state.trip.res = engine.lastTrip();
  state.scan.res = engine.lastScan()?.result || null;
  setMode(store.get("mode", "trip"));
  refreshCredits();
  refreshAlerts();
  if (store.get("welcome", true) && !shared) showWelcome();
  if (shared) toast("Pesquisa compartilhada carregada. Toque em pesquisar para ver os preços de agora.");
  if (!NATIVE && "serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
  count("", { once: true }); // página inicial

  // alertas de preço: ao abrir e a cada minuto com o app aberto
  const tick = () => engine.checkDue().then(refreshAlerts).catch(() => {});
  setTimeout(tick, 4000);
  setInterval(tick, 60000);
}

/* =============== boas-vindas =============== */
function showWelcome() {
  const el = document.createElement("div");
  el.className = "welcome";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Boas-vindas");
  el.innerHTML = `<button class="close" type="button" aria-label="Fechar">${icon.close}</button>
    <div class="art" aria-hidden="true"><svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid meet">
      <g fill="none" stroke="rgba(255,255,255,.10)" stroke-width="1.2"><ellipse cx="200" cy="150" rx="190" ry="70"/><ellipse cx="200" cy="150" rx="120" ry="44"/><path d="M10 150h380M200 80v140"/></g>
      <path class="trail" d="M48 205 C 120 40, 280 30, 352 112" fill="none" stroke="#F2A900" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="48" cy="205" r="7" fill="#F2A900"/><circle cx="48" cy="205" r="14" fill="none" stroke="#F2A900" stroke-opacity=".35" stroke-width="2"/>
      <g transform="translate(340 100) rotate(40)"><path d="M0-14 4-4 16 2v4L4 3v8l4 4v3L0 16l-8 2v-3l4-4V3l-12 3V2L-4-4z" fill="#fff"/></g></svg></div>
    <div class="copy"><h1>Tem um lugar incrível esperando por você.<span>E ele pode custar menos do que você imagina.</span></h1>
      <p>Diga de onde você sai e quando pode viajar. O Voyalis compara passagens, hospedagem e destinos com preços reais e entrega tudo pronto para você decidir.</p>
      <button class="btn" type="button" id="wGo">Começar a explorar</button>
      <label class="chk"><input type="checkbox" id="wHide"> Não mostrar esta tela de novo</label></div>`;
  const close = () => {
    if ($("#wHide", el).checked) store.set("welcome", false);
    el.remove();
    document.removeEventListener("keydown", onKey);
    $("#origin").focus({ preventScroll: true });
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  $(".close", el).onclick = close;
  $("#wGo", el).onclick = close;
  document.addEventListener("keydown", onKey);
  document.body.appendChild(el);
  $("#wGo", el).focus({ focusVisible: false });
}

/* =============== ajuda e configurações =============== */
function openHelp() { openSheet("Ajuda", helpHTML(VERSION), { wide: true }); }

function openSettings() {
  const s = engine.settings();
  const sh = openSheet("Configurações", `
    <h3 style="margin-top:4px">Chave de pesquisa</h3>
    <p class="muted small">${engine.config().configured ? "Sua chave está conectada" + (engine.settings().remember || NATIVE ? " neste aparelho." : " só nesta sessão do navegador.") : "Nenhuma chave conectada: sem ela o Voyalis mostra só os links e o destino, sem preços."}</p>
    <button class="btn line sm" id="cfgKeyBtn" type="button">${icon.key} ${engine.config().configured ? "Trocar ou remover a chave" : "Conectar minha chave grátis"}</button>
    <h3>Pesquisa completa</h3>
    <label for="cfgMax">Combinações de datas e aeroportos por pesquisa</label>
    <input type="number" id="cfgMax" min="1" max="60" inputmode="numeric">
    <p class="muted small" style="margin-top:6px">Cada combinação usa 1 busca. Com datas flexíveis, mais combinações acham mais ofertas escondidas.</p>
    <label class="chk"><input type="checkbox" id="cfgAuto"> Confirmar a volta e comparar onde comprar a melhor oferta automaticamente (até 2 buscas)</label>
    <h3>Alertas de preço</h3>
    <label for="cfgMon">Combinações por checagem de alerta</label>
    <input type="number" id="cfgMon" min="1" max="30" inputmode="numeric">
    <h3>Geral</h3>
    <label class="chk"><input type="checkbox" id="cfgWelcome"> Mostrar a tela de boas-vindas ao abrir</label>
    <div class="go"><button class="btn" id="cfgSave" type="button">Salvar</button><button class="btn danger sm" id="cfgWipe" type="button">Apagar pesquisas e alertas</button></div>
    <p class="muted tiny" style="margin-top:14px">Voyalis ${esc(VERSION)}</p>`);
  const b = sh.body;
  $("#cfgKeyBtn", b).onclick = () => { sh.close(); keyGuide(); };
  $("#cfgMax", b).value = s.max_calls;
  $("#cfgMon", b).value = s.max_calls_monitor;
  $("#cfgAuto", b).checked = s.auto_details;
  $("#cfgWelcome", b).checked = store.get("welcome", true);
  const err = (m) => toast(m, "error");
  $("#cfgSave", b).onclick = () => {
    try {
      engine.saveSettings({ max_calls: $("#cfgMax", b).value, max_calls_monitor: $("#cfgMon", b).value, auto_details: $("#cfgAuto", b).checked });
      store.set("welcome", $("#cfgWelcome", b).checked);
      sh.close();
      toast("Configurações salvas.");
      refreshCredits(true);
      updateEstimate();
    } catch (x) { err(x.message); }
  };
  $("#cfgWipe", b).onclick = () => {
    if (!confirm("Apagar as pesquisas salvas, os alertas e o histórico de preços? A chave e as configurações continuam.")) return;
    store.clear(["settings", "welcome", "form", "mode"]);
    state.trip.res = null; state.scan.res = null;
    sh.close();
    showResults();
    refreshAlerts();
    updateEstimate();
  };
}

async function refreshCredits(force = false) {
  if (!PRICES) return;
  const el = $("#credits");
  const on = engine.config().configured;
  el.classList.toggle("hide", !on);
  $("#keyBtn").classList.toggle("attn", !on);
  if (!on) return;
  const c = await engine.credits(force).catch(() => null);
  el.textContent = c == null ? "Preços reais" : plural(c, "busca", "buscas");
}

function refreshAlerts() {
  const n = engine.alerts().filter((a) => !a.seen).length, p = $("#alertPill");
  p.classList.toggle("hide", !n);
  p.innerHTML = `${icon.bell} ${n}`;
  p.setAttribute("aria-label", `${plural(n, "aviso de preço novo", "avisos de preço novos")}`);
  if (state.mode === "trip" && state.trip.res && state.trip.ui.tab === "alerts") renderPanel();
  else if (state.mode === "trip" && state.trip.res) renderTabs();
}
function showAlerts() {
  if (state.trip.res) { setMode("trip"); go("alerts"); $("#results").scrollIntoView({ behavior: "smooth" }); return; }
  const sh = openSheet("Alertas de preço", alertsHTML(null, alertCtx()));
  bindAlerts(sh.body, () => { sh.body.innerHTML = alertsHTML(null, alertCtx()); bindAlerts(sh.body); });
}
const alertCtx = () => ({ watches: engine.watches(), alerts: engine.alerts(), monitorCalls: engine.settings().max_calls_monitor });

/* =============== modo e formulário =============== */
function setMode(mode) {
  state.mode = mode === "explore" ? "explore" : "trip";
  store.set("mode", state.mode);
  const trip = state.mode === "trip";
  $("#modeTrip").setAttribute("aria-pressed", String(trip));
  $("#modeExplore").setAttribute("aria-pressed", String(!trip));
  $$(".tripOnly").forEach((e) => e.classList.toggle("hide", !trip));
  $$(".exploreOnly").forEach((e) => e.classList.toggle("hide", trip));
  $(".route-in").style.gridTemplateColumns = trip ? "" : "1fr";
  $("#lead").textContent = trip
    ? "Diga para onde vai e quando. Você recebe voos, hospedagem, atrações, segurança do destino e o custo estimado da viagem."
    : "Diga de onde sai e quando pode viajar. Mostramos para onde está mais barato voar nessas datas, no Brasil e no mundo.";
  $("#go").innerHTML = trip ? `${icon.search} Pesquisar viagem` : `${icon.compass} Descobrir destinos`;
  $("#err").style.display = "none";
  updateEstimate();
  showResults();
}

function formBody() {
  const origin = C.resolvePlace($("#origin").value), dest = C.resolvePlace($("#dest").value);
  return {
    origin, destination: dest, origin_text: $("#origin").value, dest_text: $("#dest").value,
    depart_date: $("#dep").value, return_date: $("#ret").value || null,
    adults: +$("#adults").value || 1, children: +$("#children").value || 0, children_ages: $("#ages").value,
    cabin: $("#cabin").value, flex: +$("#flex").value, nearby: $("#nearby").checked,
    hotel_area: $("#area").value, hotel_km: +$("#hotelKm").value, tour_km: +$("#tourKm").value,
    stops: +$("#stops").value, max_price: +$("#maxPrice").value || 0,
    regions: $$("#regions input:checked").map((i) => i.value),
  };
}
function restoreForm() {
  const t = C.todayISO(), f = store.get("form", null) || {};
  $("#dep").min = $("#ret").min = t;
  $("#origin").value = f.origin_text || "SAO — São Paulo, todos os aeroportos";
  $("#dest").value = f.dest_text || "";
  $("#dep").value = f.depart_date && f.depart_date >= t ? f.depart_date : C.addDays(t, 45);
  $("#ret").value = f.return_date && f.return_date > $("#dep").value ? f.return_date : C.addDays($("#dep").value, 7);
  $("#adults").value = f.adults || 2;
  $("#children").value = f.children || 0;
  $("#ages").value = f.children_ages || "";
  $("#cabin").value = f.cabin || "economy";
  $("#flex").value = f.flex ?? 1;
  $("#nearby").checked = f.nearby ?? true;
  $("#area").value = f.hotel_area || "";
  $("#hotelKm").value = f.hotel_km || 0;
  $("#tourKm").value = f.tour_km || 0;
  $("#stops").value = f.stops || 0;
  $("#maxPrice").value = f.max_price || "";
  if (Array.isArray(f.regions)) $$("#regions input").forEach((i) => { i.checked = f.regions.includes(i.value); });
  $("#agesBox").classList.toggle("hide", !(+$("#children").value > 0));
}
let estT;
function onFormChange() {
  $("#agesBox").classList.toggle("hide", !(+$("#children").value > 0));
  if ($("#dep").value && $("#ret").value && $("#ret").value <= $("#dep").value) $("#ret").value = C.addDays($("#dep").value, 7);
  $$("#regions .chip").forEach((c) => c.classList.toggle("on", $("input", c).checked));
  store.set("form", formBody());
  clearTimeout(estT);
  estT = setTimeout(updateEstimate, 250);
}
function updateEstimate() {
  const h = $("#hint");
  if (!PRICES) { h.textContent = state.mode === "trip" ? "Mostra os links prontos para comparar os preços nos sites." : "A descoberta de destinos ainda não está ligada neste site."; return; }
  if (!engine.config().configured) { h.textContent = state.mode === "trip" ? "Sem chave: mostra links e o destino. Conecte a chave grátis para ver preços." : "Conecte a chave grátis para descobrir destinos."; return; }
  const b = formBody();
  try {
    if (state.mode === "trip") {
      if (!b.origin || !b.destination) { h.textContent = "Escolha a origem e o destino na lista de sugestões."; return; }
      const e = engine.estimateTrip(b);
      h.textContent = `Usa até ${plural(e.searches, "busca", "buscas")}`;
    } else {
      if (!b.origin) { h.textContent = "Escolha a cidade de origem na lista de sugestões."; return; }
      const e = engine.estimateScan(scanBody(b));
      h.textContent = e.cached && !$("#fresh").checked ? "Resultado recente: não gasta buscas" : `Usa ${plural(e.searches, "busca", "buscas")}`;
    }
  } catch (x) { h.textContent = x.message; }
}
const scanBody = (b) => ({ ...b, stops: b.stops });
const showErr = (m) => { const e = $("#err"); e.textContent = m; e.style.display = "block"; };

/* =============== pesquisa com progresso =============== */
function onSubmit(e) {
  e.preventDefault();
  $("#err").style.display = "none";
  if (state.running) return;
  const b = formBody();
  if (!PRICES && state.mode === "explore") return showErr("A descoberta de destinos precisa do serviço de preços, que ainda não está ligado neste site. Use Planejar viagem.");
  if (!engine.config().configured && state.mode === "explore") return keyGuide("Para descobrir os destinos mais baratos, o Voyalis precisa da sua chave grátis.");
  if (!b.origin) return showErr("Não reconheci a origem. Digite a cidade e escolha uma opção da lista, ou use o código do aeroporto (ex.: GRU).");
  if (state.mode === "trip" && !b.destination) return showErr("Não reconheci o destino. Digite a cidade e escolha uma opção da lista, ou use o código do aeroporto (ex.: NVT).");
  setShareUrl(b);
  count(state.mode === "trip" ? "pesquisa-viagem" : "pesquisa-destinos", { event: true });
  if (!PRICES || !engine.config().configured) {
    engine.quickTrip(b, { indicators: PRICES }).then((r) => { r.noPrices = !PRICES; state.trip.res = r; state.trip.ui = newTripState(); showResults(); $("#results").scrollIntoView({ behavior: "smooth" }); })
      .catch((x) => showErr(x.message));
    return;
  }
  let id;
  try { id = state.mode === "trip" ? engine.startTrip(b) : engine.startScan(scanBody(b), { fresh: $("#fresh").checked }); }
  catch (x) { return showErr(x.message); }
  state.running = true;
  $("#go").disabled = true;
  $("#results").classList.add("hide");
  $("#progress").classList.remove("hide");
  $("#pTitle").textContent = state.mode === "trip" ? "Montando sua viagem…" : "Procurando os destinos mais baratos…";
  $("#progress").scrollIntoView({ behavior: "smooth", block: "center" });
  poll(id);
}
function poll(id) {
  const j = engine.getJob(id);
  $("#pFill").style.width = Math.min(100, Math.round((100 * j.done) / (j.total || 1))) + "%";
  $("#pCount").textContent = j.kind === "trip" ? (j.best ? `menor voo até agora: R$ ${Math.round(j.best).toLocaleString("pt-BR")}` : "") : `${j.done} de ${j.total} regiões`;
  const lg = $("#log");
  lg.textContent = j.log.join("\n");
  lg.scrollTop = lg.scrollHeight;
  if (j.status === "running") return setTimeout(() => poll(id), 350);
  state.running = false;
  $("#go").disabled = false;
  $("#progress").classList.add("hide");
  if (j.status === "error") { showErr("A pesquisa não terminou: " + j.error); return; }
  if (j.kind === "trip") { state.trip.res = j.result; state.trip.ui = newTripState(); }
  else { state.scan.res = j.result; state.scan.ui = newScanState(); }
  showResults();
  $("#results").scrollIntoView({ behavior: "smooth" });
  refreshCredits(true);
  updateEstimate();
}

/* =============== resultados =============== */
const cur = () => (state.mode === "trip" ? state.trip : state.scan);
function showResults() {
  const c = cur(), box = $("#results");
  $("#landing").classList.toggle("hide", !!c.res);
  if (!c.res) { box.classList.add("hide"); return; }
  box.classList.remove("hide");
  $("#head").innerHTML = `<div class="share"><button class="btn ghost sm" type="button" id="shareBtn">${icon.share} Compartilhar esta pesquisa</button></div>` + (state.mode === "trip" ? tripHead(c.res) : scanHead(c.res));
  $("#shareBtn").onclick = () => share(c.res.req);
  count(`${state.mode === "trip" ? "viagem" : "descobrir"}/${c.ui.tab}`);
  renderTabs();
  renderPanel();
}
function tripHead(r) {
  if (r.quick) return "";
  const age = Math.round((Date.now() - (r.ts || Date.now())) / 60000);
  return age > 5 ? `<div class="note">Pesquisa feita ${age < 60 ? `há ${plural(age, "minuto", "minutos")}` : age < 1440 ? `há ${plural(Math.round(age / 60), "hora", "horas")}` : `em ${new Date(r.ts).toLocaleDateString("pt-BR")}`}. Os preços podem ter mudado: pesquise de novo antes de comprar.</div>` : "";
}
function renderTabs() {
  const c = cur();
  if (!c.res) return;
  const unseen = engine.alerts().filter((a) => !a.seen).length;
  const T = state.mode === "trip" ? tripTabs(c.res, unseen) : scanTabs(c.res);
  if (!T.some(([k]) => k === c.ui.tab)) c.ui.tab = T[0][0];
  $("#tabs").innerHTML = T.map(([k, l, n]) => `<button class="tab ${c.ui.tab === k ? "on" : ""}" data-t="${k}" type="button" ${c.ui.tab === k ? 'aria-current="page"' : ""}>${l}${n !== "" ? `<em>${n}</em>` : ""}</button>`).join("");
  $$("#tabs .tab").forEach((b) => { b.onclick = () => go(b.dataset.t); });
}
function go(tab) {
  cur().ui.tab = tab;
  count(`${state.mode === "trip" ? "viagem" : "descobrir"}/${tab}`);
  renderTabs();
  renderPanel();
  const top = $("#results").offsetTop + $("#head").offsetHeight - 64;
  if (window.scrollY > top) window.scrollTo({ top });
}
function renderPanel() {
  const c = cur(), p = $("#panel");
  if (state.mode === "trip") {
    p.innerHTML = tripPanel(c.res, c.ui, alertCtx());
    bindTrip(p);
  } else {
    p.innerHTML = scanPanel(c.res, c.ui) + ((c.res.errors || []).length ? `<div class="warnbox" style="margin-top:12px">Algumas regiões não responderam: ${c.res.errors.map(esc).join("; ")}.</div>` : "");
    bindScan(p);
  }
}

/* ---------- eventos: viagem ---------- */
function bindTrip(p) {
  const r = state.trip.res, st = state.trip.ui, f = st.fl;
  const on = (sel, ev, fn) => { const e = $(sel, p); if (e) e[ev] = fn; };
  const find = (id) => r.flights.find((x) => x.id === id);
  const save = () => store.set("trip:last", r);
  $$("[data-go]", p).forEach((b) => { b.onclick = () => go(b.dataset.go); });
  $$("[data-key]", p).forEach((b) => { b.onclick = () => keyGuide(); });
  on("#fSort", "onchange", (e) => { f.sort = e.target.value; renderPanel(); });
  on("#fStops", "onchange", (e) => { f.stops = e.target.value; renderPanel(); });
  on("#fAir", "onchange", (e) => { f.airline = e.target.value; renderPanel(); });
  on("#fHid", "onchange", (e) => { f.hidden = e.target.checked; renderPanel(); });
  on("#fClr", "onclick", () => { f.dates = null; renderPanel(); });
  on("#fMore", "onclick", () => { st.flimit += 30; renderPanel(); });
  on("#hSort", "onchange", (e) => { st.hsort = e.target.value; renderPanel(); });
  $$(".heat td[data-d]", p).forEach((td) => { td.onclick = () => { f.dates = [td.dataset.d, td.dataset.r]; go("flights"); }; });
  const action = (sel, attr, busy, idle, fn) => $$(sel, p).forEach((b) => {
    b.onclick = async () => {
      b.disabled = true; b.textContent = busy;
      try { await fn(b.dataset[attr]); save(); renderPanel(); refreshCredits(true); }
      catch (e) { b.disabled = false; b.textContent = idle; toast(e.message || String(e), "error"); }
    };
  });
  action("[data-detail]", "detail", "Buscando a volta…", "Ver volta e confirmar preço (1 busca)", async (id) => { const o = find(id); Object.assign(o, await engine.detailOffer(o, r.req)); });
  action("[data-sellers]", "sellers", "Comparando vendedores…", "Comparar onde comprar (1 busca)", async (id) => { const o = find(id); Object.assign(o, await engine.sellers(o, r.req)); });
  action("[data-hotel]", "hotel", "Buscando endereço…", "Ver endereço (1 busca)", async (id) => { const h = r.hotels.find((x) => x.id === id); Object.assign(h, await engine.hotelDetail(h, r.req, r.stay)); });
  $$("[data-buy]", p).forEach((b) => {
    b.onclick = () => {
      const [id, i] = b.dataset.buy.split(":"), rq = find(id)?.sellers?.[+i]?.request;
      let host = "";
      try { host = new URL(rq?.url).hostname; } catch { /* inválido */ }
      if (!rq || !/(^|\.)google\.com$/.test(host) || !rq.url.startsWith("https://")) return toast("Não foi possível abrir este vendedor. Use o link do Google Flights.", "error");
      const fm = document.createElement("form");
      fm.method = "POST"; fm.action = rq.url; fm.target = "_blank";
      for (const [k, v] of new URLSearchParams(rq.post_data)) { const inp = document.createElement("input"); inp.type = "hidden"; inp.name = k; inp.value = v; fm.appendChild(inp); }
      document.body.appendChild(fm); fm.submit(); fm.remove();
    };
  });
  on("#wAdd", "onclick", () => {
    try {
      engine.createWatch({ ...r.req, target_price: +$("#wTarget", p).value || null, drop_pct: +$("#wDrop", p).value || 5, interval_min: +$("#wInt", p).value });
      renderPanel();
      setTimeout(() => { refreshAlerts(); if (st.tab === "alerts") renderPanel(); }, 3000);
    } catch (e) { toast(e.message, "error"); }
  });
  bindAlerts(p, renderPanel);
}
function bindAlerts(p, rerender = renderPanel) {
  const s = $("#seen", p);
  if (s) s.onclick = () => { engine.markAlertsSeen(); refreshAlerts(); rerender(); };
  $$("[data-w]", p).forEach((b) => {
    b.onclick = async () => {
      const id = +b.dataset.id, a = b.dataset.w;
      if (a === "del") { if (!confirm("Excluir este alerta?")) return; engine.deleteWatch(id); }
      else if (a === "toggle") engine.toggleWatch(id);
      else { b.disabled = true; b.textContent = "Checando…"; await engine.checkWatch(id); refreshCredits(true); }
      refreshAlerts();
      rerender();
    };
  });
}

/* ---------- eventos: descobrir ---------- */
function bindScan(p) {
  const r = state.scan.res, st = state.scan.ui, f = st.f;
  const on = (sel, ev, fn) => { const e = $(sel, p); if (e) e[ev] = fn; };
  on("#fQ", "onchange", (e) => { f.q = e.target.value; f.limit = 40; renderPanel(); });
  on("#fCountry", "onchange", (e) => { f.country = e.target.value; f.uf = ""; f.city = ""; f.limit = 40; renderPanel(); });
  on("#fUf", "onchange", (e) => { f.uf = e.target.value; f.city = ""; f.limit = 40; renderPanel(); });
  on("#fCity", "onchange", (e) => { f.city = e.target.value; renderPanel(); });
  on("#fStops", "onchange", (e) => { f.stops = e.target.value; renderPanel(); });
  on("#fMax", "onchange", (e) => { f.maxPrice = +e.target.value || 0; renderPanel(); });
  on("#fOrder", "onchange", (e) => { f.desc = e.target.value === "desc"; renderPanel(); });
  on("#more", "onclick", () => { f.limit += 40; renderPanel(); });
  $$("[data-dest]", p).forEach((el) => {
    el.onclick = () => openDest(el.dataset.dest);
    el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDest(el.dataset.dest); } };
  });
  $$("circle[data-city]", p).forEach((el) => { el.onclick = () => openDest(el.dataset.city); });
  const pick = (k) => { if (st.tab === "brazil") st.view = k; else st.sel = k; renderPanel(); };
  $$("svg path[data-k]", p).forEach((el) => { el.onclick = () => { if (!el.classList.contains("none")) pick(el.dataset.k); }; });
  $$("[data-pick]", p).forEach((el) => { el.onclick = () => pick(el.dataset.pick); });
  $$("[data-zoom]", p).forEach((el) => { el.onclick = () => { st.zoom[st.tab] = Math.max(1, Math.min(5, st.zoom[st.tab] + +el.dataset.zoom)); renderPanel(); }; });
  on("#backStates", "onclick", () => { st.view = null; renderPanel(); });
  on("#filterHere", "onclick", () => {
    if (st.tab === "brazil") Object.assign(f, { country: "BR", uf: st.view, city: "" });
    else Object.assign(f, { country: C.COUNTRIES[st.sel]?.a2 || "", uf: "", city: "" });
    f.limit = 40;
    go("list");
  });
}

function openDest(id) {
  const r = state.scan.res, d = r.dests.find((x) => x.id === id);
  if (!d) return;
  const code = d.airport || C.airportFor(d.name, d.country_a2, d.lat, d.lng);
  const origin = C.resolvePlace($("#origin").value) || r.req.origin.split(",")[0];
  const body = { ...formBody(), origin, destination: code, depart_date: r.req.depart_date, return_date: r.req.return_date, adults: r.req.adults, children: r.req.children, cabin: r.req.cabin };
  let est = "", ok = !!code;
  try { if (code) est = `Pesquisa voos${body.flex ? " com datas flexíveis" : ""}, hospedagem e atrações em ${d.name}: usa até ${plural(engine.estimateTrip(body).searches, "busca", "buscas")}.`; }
  catch (x) { est = x.message; ok = false; }
  if (!code) est = "Não encontrei o aeroporto deste destino. Use Planejar viagem e digite a cidade.";
  const sh = openSheet(d.name, destSheetHTML(d, r, esc(est)));
  if (!ok) $("#buildTrip", sh.body).disabled = true;
  $("#buildTrip", sh.body).onclick = () => {
    sh.close();
    const info = C.airportInfo(code);
    setMode("trip");
    $("#dest").value = `${code} — ${d.name}${info?.country && info.a2 !== "BR" ? ", " + info.country : ""}`;
    $("#dep").value = r.req.depart_date;
    $("#ret").value = r.req.return_date;
    $("#adults").value = r.req.adults;
    $("#children").value = r.req.children;
    $("#cabin").value = r.req.cabin;
    onFormChange();
    $("#form").requestSubmit();
  };
  if (d.country_a2) {
    const place = `${d.name}, ${d.country_name}`;
    engine.indicators(d.country_a2)
      .then((i) => { const el = $("#sheetInd", sh.body); if (el) { el.className = ""; el.innerHTML = `<h3>${icon.shield} Segurança e custo de vida</h3>${indicatorsHTML(i, d.country_name, { [`Segurança em ${d.name}`]: C.safetyLink(place), [`Custo de vida em ${d.name}`]: C.costLink(place) })}`; } })
      .catch(() => { const el = $("#sheetInd", sh.body); if (el) el.innerHTML = `Indicadores indisponíveis agora.${linkRow({ [`Segurança em ${d.name}`]: C.safetyLink(place) })}`; });
  } else $("#sheetInd", sh.body).textContent = "";
}

/* =============== chave, compartilhar e links de pesquisa =============== */
function keyGuide(reason = "") {
  if (!PRICES) return;
  count("guia-da-chave", { event: true, once: true });
  openKeyGuide(engine, { web: !NATIVE, reason, onSaved: () => { count("chave-conectada", { event: true }); refreshCredits(true); updateEstimate(); } });
}

const SHARE_KEYS = { modo: "mode", de: "origin", para: "destination", ida: "depart_date", volta: "return_date", adultos: "adults", criancas: "children" };
/** Endereço desta pesquisa (sem nenhum dado pessoal e sem a chave), para salvar ou mandar a alguém. */
function shareUrl(q) {
  const u = new URL(location.href.split("?")[0].split("#")[0]);
  u.searchParams.set("modo", state.mode === "explore" ? "descobrir" : "viagem");
  const origin = String(q.origin || "").split(",")[0];
  if (origin) u.searchParams.set("de", origin);
  if (state.mode === "trip" && q.destination) u.searchParams.set("para", q.destination);
  if (q.depart_date) u.searchParams.set("ida", q.depart_date);
  if (q.return_date) u.searchParams.set("volta", q.return_date);
  u.searchParams.set("adultos", q.adults || 1);
  if (q.children) u.searchParams.set("criancas", q.children);
  return u.href;
}
function setShareUrl(b) {
  if (NATIVE || !b.origin) return;
  try { history.replaceState(null, "", shareUrl(b)); } catch { /* ignorado */ }
}
async function share(q) {
  count("compartilhar", { event: true });
  const url = NATIVE ? shareUrl(q).replace(location.origin + location.pathname, SITE.url + "/") : shareUrl(q);
  const title = "Voyalis: " + (state.mode === "trip" ? `${q.origin} → ${q.destination}` : `destinos saindo de ${String(q.origin).split(",")[0]}`);
  try {
    if (navigator.share) await navigator.share({ title, url });
    else { await navigator.clipboard.writeText(url); toast("Link copiado. É só colar onde quiser."); }
  } catch (e) { if (e?.name !== "AbortError") toast("Não foi possível compartilhar. Copie o endereço da página.", "error"); }
}
/** Preenche o formulário com os parâmetros de um link compartilhado (validados; nunca pesquisa sozinho). */
function applyShareParams() {
  let p;
  try { p = new URL(location.href).searchParams; } catch { return false; }
  if (![...p.keys()].some((k) => k in SHARE_KEYS)) return false;
  const code = (v) => (/^[A-Za-z]{3}$/.test(v || "") ? v.toUpperCase() : null);
  const date = (v) => (C.isValidDate(v) && v >= C.todayISO() ? v : null);
  const o = code(p.get("de")), d = code(p.get("para"));
  const label = (c) => { const i = C.airportInfo(c); return i ? `${c} — ${i.city}${i.a2 !== "BR" && i.country ? ", " + i.country : ""}` : c; };
  if (o) $("#origin").value = label(o);
  if (d) $("#dest").value = label(d);
  if (date(p.get("ida"))) $("#dep").value = p.get("ida");
  if (date(p.get("volta")) && p.get("volta") > $("#dep").value) $("#ret").value = p.get("volta");
  const n = (v, lo, hi) => { const x = Number.parseInt(v, 10); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : null; };
  if (n(p.get("adultos"), 1, 9)) $("#adults").value = n(p.get("adultos"), 1, 9);
  if (n(p.get("criancas"), 0, 8) != null) $("#children").value = n(p.get("criancas"), 0, 8);
  store.set("mode", p.get("modo") === "descobrir" ? "explore" : "trip");
  onFormChange();
  return true;
}

init();
