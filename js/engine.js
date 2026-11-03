// Motor do Voyalis: configurações, saldo, pesquisa completa de viagem, descoberta de destinos,
// detalhes sob demanda (volta, vendedores, endereço) e alertas de preço. Roda inteiro no aparelho.
import * as C from "./core/index.js";
import { SerpApi, WorldBank } from "./providers.js";

const SCAN_CACHE_H = 12; // repetir a mesma descoberta dentro de 12 h não gasta buscas
const IND_DAYS = 30; // indicadores do Banco Mundial mudam 1 vez por ano
const KEY_RE = /^[A-Za-z0-9_-]{20,}$/;
const nowISO = () => new Date().toISOString().slice(0, 19);
const newId = () => Math.random().toString(36).slice(2, 12);

async function pool(items, limit, fn) {
  let i = 0;
  const run = async () => { while (i < items.length) await fn(items[i++]); };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

export class Engine {
  /**
   * @param store  armazenamento permanente (localStorage)
   * @param opts   { fetchFn, sleepFn } nos testes; { apiBase: "/api/" } no site; { session } = armazenamento da sessão,
   *               onde fica a chave quando o visitante não pede para lembrá-la neste aparelho
   */
  constructor(store, opts = {}) {
    this.store = store;
    this.session = opts.session || null;
    this.opts = opts;
    this.jobs = new Map();
    this._credits = { t: 0, v: null };
  }

  /* ---------- configurações ---------- */
  settings() {
    const s = this.store.get("settings", {}) || {};
    return {
      serpapi_key: String(s.serpapi_key || this.session?.get("key", "") || "").trim(),
      remember: s.remember !== false,
      max_calls: C.clampInt(s.max_calls, 1, 60, 10),
      auto_details: s.auto_details !== false,
      max_calls_monitor: C.clampInt(s.max_calls_monitor, 1, 30, 4),
    };
  }
  saveSettings(patch) {
    const next = { ...this.settings(), ...patch };
    const key = String(next.serpapi_key || "").trim();
    if (key && !KEY_RE.test(key)) throw new Error("A chave parece inválida: cole a API Key completa (letras e números, sem espaços).");
    const remember = next.remember !== false || !this.session;
    this.store.set("settings", {
      serpapi_key: remember ? key : "", remember, max_calls: C.clampInt(next.max_calls, 1, 60, 10), auto_details: next.auto_details !== false,
      max_calls_monitor: C.clampInt(next.max_calls_monitor, 1, 30, 4),
    });
    if (this.session) remember ? this.session.del("key") : this.session.set("key", key);
    this._credits = { t: 0, v: null };
    return this.settings();
  }
  serp() {
    const k = this.settings().serpapi_key;
    return k ? new SerpApi(k, this.opts) : null;
  }
  _needSerp() {
    const s = this.serp();
    if (!s) throw new Error("Configure sua chave da SerpApi em ⚙ Configurações.");
    return s;
  }
  config() {
    return { configured: !!this.settings().serpapi_key, today: C.todayISO() };
  }
  async testKey(key) {
    if (!KEY_RE.test(String(key || "").trim())) return { valid: false, reason: "formato" };
    return new SerpApi(String(key).trim(), this.opts).account();
  }
  /** Saldo de buscas (consulta gratuita, cache de 5 min). null se não souber. */
  async credits(force = false) {
    const serp = this.serp();
    if (!serp) return null;
    if (!force && Date.now() - this._credits.t < 300000) return this._credits.v;
    let v = null;
    try { const a = await serp.account(); v = a.valid ? a.left : null; } catch { /* sem rede */ }
    this._credits = { t: Date.now(), v };
    return v;
  }
  _spent() { this._credits = { t: 0, v: null }; }

  /* ---------- jobs com progresso ---------- */
  _job(kind, req, total) {
    const id = newId();
    const job = { id, kind, status: "running", done: 0, total, best: null, log: [], result: null, error: null, req };
    this.jobs.set(id, job);
    if (this.jobs.size > 20) this.jobs.delete(this.jobs.keys().next().value);
    return job;
  }
  getJob(id) { return this.jobs.get(id) || null; }

  /* ================= PLANEJAR VIAGEM (pesquisa completa) ================= */
  _tripPlan(req) {
    const s = this.settings(), planned = C.planQueries(req).length, run = Math.min(planned, s.max_calls);
    const split = req.return_date ? 2 : 0;
    const details = s.auto_details ? (req.return_date ? 2 : 1) : 0;
    const km = (req.hotels && req.hotel_km) || (req.tours && req.tour_km) ? 1 : 0;
    return { planned, run, split, details, km, hotels: req.hotels ? 1 : 0, tours: req.tours ? 1 : 0 };
  }
  estimateTrip(body) {
    const req = C.parseTrip(body);
    const p = this._tripPlan(req);
    return { ...p, searches: p.run + p.split + p.details + p.km + p.hotels + p.tours };
  }

  startTrip(body) {
    if (!this.config().configured) throw new Error("Falta a chave da SerpApi. Abra ⚙ Configurações e cole sua chave.");
    const req = C.parseTrip(body);
    const p = this._tripPlan(req);
    const job = this._job("trip", req, p.run + p.split + p.details + p.km + p.hotels + p.tours + 1);
    this._runTrip(job, req, p);
    return job.id;
  }

  async _scanFlights(serp, req, maxCalls, onStep) {
    const queries = C.planQueries(req).slice(0, maxCalls);
    const [mainO, mainD] = [C.expand(req.origin, req.nearby)[0], C.expand(req.destination, req.nearby)[0]];
    const offers = [], errors = [];
    let insights = null, insightsAlt = null;
    await pool(queries, 5, async (q) => {
      const [o, d, dep, ret] = q;
      let n = 0;
      try {
        const r = await serp.flights(o, d, dep, ret, req.adults, req.children, req.cabin);
        offers.push(...r.offers);
        n = r.offers.length;
        if (r.insights) {
          if (dep === req.depart_date && ret === req.return_date && o === mainO && d === mainD) insights = r.insights;
          else insightsAlt ??= r.insights;
        }
      } catch (e) { errors.push(`voos ${o}→${d} ${dep}: ${e.message}`); }
      onStep?.(q, n, offers.length ? Math.min(...offers.map((x) => x.price_pp)) : null);
    });
    return { offers, errors, insights: insights || insightsAlt, queries: queries.length };
  }

  async _splitTickets(serp, req, bestRt) {
    if (!req.return_date) return { offers: [], errors: [] };
    const o = C.METRO[req.origin]?.[0] ?? req.origin, d = C.METRO[req.destination]?.[0] ?? req.destination;
    try {
      const outs = (await serp.flights(o, d, req.depart_date, null, req.adults, req.children, req.cabin)).offers;
      const backs = (await serp.flights(d, o, req.return_date, null, req.adults, req.children, req.cabin)).offers;
      return { offers: C.splitOffers(outs, backs, req, bestRt), errors: [] };
    } catch (e) { return { offers: [], errors: [`bilhetes separados: ${e.message}`] }; }
  }

  async _runTrip(job, req, plan) {
    const log = (m) => { job.log.push(m); if (job.log.length > 80) job.log.splice(0, job.log.length - 80); };
    const step = (m) => { job.done = Math.min(job.total - 1, job.done + 1); if (m) log(m); };
    try {
      const serp = this.serp();
      const dest = C.airportInfo(req.destination) || { code: req.destination, city: req.destination, a2: null, country: "" };
      const orig = C.airportInfo(req.origin) || { code: req.origin, city: req.origin };
      log(`Pesquisando ${orig.city} → ${dest.city}: ${plan.run} combinação(ões) de datas e aeroportos` + (plan.planned > plan.run ? ` (de ${plan.planned} possíveis, limitado para poupar buscas)` : ""));
      const indP = dest.a2 ? this.indicators(dest.a2).catch((e) => ({ error: e.message })) : Promise.resolve(null);

      // 1. voos
      const scan = await this._scanFlights(serp, req, plan.run, ([o, d, dep, ret], n, best) => {
        job.best = best;
        step(`${o}→${d} ${dep.slice(8)}/${dep.slice(5, 7)}${ret ? ` ⇄ ${ret.slice(8)}/${ret.slice(5, 7)}` : ""}: ${n} voo(s)${best ? ` · menor até agora ${C.money(best)}` : ""}`);
      });
      const errors = [...scan.errors];
      const ex = scan.offers.filter((o) => o.depart_date === req.depart_date && o.return_date === req.return_date).map((o) => o.price_pp);
      const split = await this._splitTickets(serp, req, ex.length ? Math.min(...ex) : null);
      errors.push(...split.errors);
      if (plan.split) step(`Bilhetes separados: ${split.offers.length} combinação(ões) mais barata(s)`);
      const flights = C.analyzeFlights([...scan.offers, ...split.offers], req);
      log(`${flights.length} ofertas de voo analisadas`);

      // 2. melhor oferta: volta confirmada e onde comprar
      if (plan.details && flights.length) {
        const best = flights.find((o) => o.kind !== "split" && (o.token || o.booking_token)); // a mais barata que o Google deixa detalhar
        if (best && best.return_date && best.token) {
          try { Object.assign(best, await this.detailOffer(best, req)); step("Volta da melhor oferta confirmada"); }
          catch (e) { errors.push(`volta da melhor oferta: ${e.message}`); step(); }
        }
        if (best && best.booking_token) {
          try { Object.assign(best, await this.sellers(best, req)); step("Vendedores da melhor oferta comparados"); }
          catch (e) { errors.push(`onde comprar: ${e.message}`); step(); }
        }
        flights.sort((a, b) => a.price_pp - b.price_pp);
      }

      // 3. hospedagem e pontos turísticos
      const city = dest.city, place = dest.country && dest.a2 !== "BR" ? `${city}, ${dest.country}` : city;
      const where = req.hotel_area ? `${req.hotel_area}, ${place}` : place;
      const stay = { checkin: req.depart_date, checkout: req.return_date || C.addDays(req.depart_date, 3) };
      stay.nights = Math.max(1, C.diffDays(stay.checkout, stay.checkin));
      let center = null;
      if (plan.km) {
        try {
          center = await serp.geocode(where);
          step(center ? `Ponto inicial "${where}" localizado` : "");
          if (!center) errors.push(`não localizei "${where}" no mapa: o raio em km foi ignorado`);
        } catch (e) { errors.push(`ponto inicial: ${e.message}`); step(); }
      }
      const radius = (list, km, what) => {
        if (!center || !km) return list;
        const r = C.withinRadius(list, center, km);
        if (r.unknown) errors.push(`${what}: ${r.unknown} sem coordenadas ficaram de fora do raio`);
        return r.items;
      };
      let hotels = [], tours = [];
      if (req.hotels) {
        try {
          hotels = C.analyzeHotels(radius(await serp.hotels(place, stay.checkin, stay.checkout, req.adults, req.children, req.children_ages, req.hotel_area), req.hotel_km, "hotéis"));
          step(`Hospedagem em ${where}: ${hotels.length} opção(ões)`);
        } catch (e) { errors.push(`hotéis: ${e.message}`); step(); }
      }
      if (req.tours) {
        try {
          tours = C.analyzeTours(radius(await serp.tours(place, req.depart_date, req.return_date, req.hotel_area, center, req.tour_km), req.tour_km, "pontos turísticos"));
          step(`Pontos turísticos em ${where}: ${tours.length}`);
        } catch (e) { errors.push(`pontos turísticos: ${e.message}`); step(); }
      }

      // 4. destino: segurança e custo de vida (gratuito)
      const ind = await indP;
      if (ind?.error) errors.push(`indicadores do país: ${ind.error}`);
      log("Indicadores do destino carregados");

      const pax = req.adults + req.children, rooms = Math.max(1, Math.ceil(req.adults / 2));
      const bestFlight = flights[0] || null;
      const cheapHotel = hotels[0] || null;
      const valueHotel = hotels.find((h) => (h.tags || []).includes("Melhor custo-benefício")) || cheapHotel;
      const result = {
        req, origin: orig, dest, stay, center, flights, matrix: C.buildMatrix(flights), insights: scan.insights,
        hotels, tours, indicators: ind && !ind.error ? ind : null,
        budget: {
          cheapest: C.tripBudget({ flight_pp: bestFlight?.price_pp ?? null, pax, hotel_night: cheapHotel?.price_night ?? null, nights: stay.nights }),
          value: C.tripBudget({ flight_pp: bestFlight?.price_pp ?? null, pax, hotel_night: valueHotel?.price_night ?? null, nights: stay.nights }),
          value_hotel: valueHotel?.name ?? null,
        },
        links: {
          flights: C.flightLinks(req.origin, req.destination, req.depart_date, req.return_date, req.adults, req.children),
          hotels: C.hotelLinks(where, stay.checkin, stay.checkout, req.adults, req.children, rooms),
          tours: C.tourLinks(where, req.depart_date, req.return_date),
          safety: C.safetyLink(place), cost: C.costLink(place),
        },
        errors: [...new Set(errors)].slice(0, 10), stats: { queries: scan.queries, planned: plan.planned }, ts: Date.now(),
      };
      this.store.set("trip:last", result);
      this._spent();
      job.result = result;
      job.done = job.total;
      job.status = "done";
    } catch (e) {
      job.status = "error";
      job.error = e.message;
    }
  }
  lastTrip() { return this.store.get("trip:last", null); }

  /**
   * Viagem sem chave (grátis, sem gastar buscas): rota, links prontos para comparar nos sites e o destino
   * (segurança e custo de vida). Os preços aparecem depois que o visitante conecta a chave.
   */
  async quickTrip(body, { indicators: withIndicators = true } = {}) {
    const req = C.parseTrip(body);
    const dest = C.airportInfo(req.destination) || { code: req.destination, city: req.destination, a2: null, country: "" };
    const orig = C.airportInfo(req.origin) || { code: req.origin, city: req.origin };
    const place = dest.country && dest.a2 !== "BR" ? `${dest.city}, ${dest.country}` : dest.city;
    const where = req.hotel_area ? `${req.hotel_area}, ${place}` : place;
    const stay = { checkin: req.depart_date, checkout: req.return_date || C.addDays(req.depart_date, 3) };
    stay.nights = Math.max(1, C.diffDays(stay.checkout, stay.checkin));
    let indicators = null;
    const errors = [];
    if (dest.a2 && withIndicators) try { indicators = await this.indicators(dest.a2); } catch (e) { errors.push(`indicadores do país: ${e.message}`); }
    const rooms = Math.max(1, Math.ceil(req.adults / 2));
    return {
      quick: true, req, origin: orig, dest, stay, center: null, flights: [], matrix: { dep_dates: [], ret_dates: [], cells: {} }, insights: null,
      hotels: [], tours: [], indicators, budget: { cheapest: C.tripBudget({}), value: C.tripBudget({}), value_hotel: null },
      links: {
        flights: C.flightLinks(req.origin, req.destination, req.depart_date, req.return_date, req.adults, req.children),
        hotels: C.hotelLinks(where, stay.checkin, stay.checkout, req.adults, req.children, rooms),
        tours: C.tourLinks(where, req.depart_date, req.return_date),
        safety: C.safetyLink(place), cost: C.costLink(place),
      },
      errors, stats: { queries: 0, planned: 0 }, ts: Date.now(),
    };
  }

  /** Volta de uma oferta (1 busca): confirma o preço do ida-e-volta e libera o "onde comprar". */
  async detailOffer(offer, req) {
    const serp = this._needSerp();
    if (!offer.token || !offer.return_date) throw new Error("Esta oferta não tem detalhe de volta disponível.");
    const opts = await serp.returnLegs(offer.origin, offer.destination, offer.depart_date, offer.return_date, offer.token, req.cabin);
    this._spent();
    if (!opts.length) throw new Error("O Google não devolveu voos de volta para essa ida.");
    const best = opts[0], pax = req.adults + req.children;
    return {
      inbound: best.leg, price_pp: best.price_pp, price_total: best.price_pp * pax, confirmed: true, booking_token: best.booking_token,
      return_options: opts.slice(0, 5).map((x) => ({ ...x.leg, price_pp: x.price_pp })),
    };
  }
  /** Preço por vendedor (companhia x agências) de uma oferta (1 busca). */
  async sellers(offer, req) {
    const serp = this._needSerp();
    if (!offer.booking_token) throw new Error("O Google não liberou as opções de compra desta oferta. Use o link do Google Flights.");
    const r = await serp.bookingOptions(offer.origin, offer.destination, offer.depart_date, offer.return_date, offer.booking_token, req.cabin);
    this._spent();
    if (!r.options.length) throw new Error("O Google não listou vendedores para esta oferta. Use o link do Google Flights.");
    const a = C.analyzeSellers(r.options, offer.price_pp);
    return { sellers: a.items, seller_notes: a.notes, seller_official: a.official ? a.official.price : null, seller_separate: r.separate, baggage: r.baggage };
  }
  /** Endereço, telefone e rota de um hotel (1 busca). */
  async hotelDetail(hotel, req, stay) {
    const serp = this._needSerp();
    if (!hotel.token) throw new Error("Este hotel não tem detalhe disponível.");
    const d = await serp.hotelDetails(hotel.token, stay.checkin, stay.checkout, req.adults, req.children, req.children_ages || []);
    this._spent();
    if (!d.address && !d.phone) throw new Error("O Google não informou o endereço deste hotel.");
    return d;
  }

  /* ================= DESCOBRIR DESTINOS ================= */
  estimateScan(body) {
    const req = C.parseScan(body);
    return { searches: req.regions.length, cached: !!this._cachedScan(req) };
  }
  _cachedScan(req) {
    const c = this.store.get("scan:" + C.scanKey(req), null);
    return c && Date.now() - c.ts < SCAN_CACHE_H * 3600e3 ? c : null;
  }
  lastScan() { return this.store.get("scan:last", null); }

  startScan(body, { fresh = false } = {}) {
    if (!this.config().configured) throw new Error("Falta a chave da SerpApi. Abra ⚙ Configurações e cole sua chave.");
    const req = C.parseScan(body);
    const job = this._job("scan", req, req.regions.length);
    const cached = fresh ? null : this._cachedScan(req);
    if (cached) {
      job.result = { ...cached.result, cached: true };
      job.done = job.total;
      job.status = "done";
      job.log.push("Resultado recente reaproveitado (sem gastar buscas)");
      this.store.set("scan:last", { ts: cached.ts, result: job.result });
    } else this._runScan(job, req);
    return job.id;
  }
  async _runScan(job, req) {
    try {
      const serp = this.serp();
      const regions = C.REGIONS.filter((r) => req.regions.includes(r.id));
      const lists = [], errors = [], areas = [];
      await pool(regions, 3, async (r) => {
        try {
          const l = await serp.explore({ origin: req.origin, dep: req.depart_date, ret: req.return_date, area: r.area, cabin: req.cabin, stops: req.stops, maxPrice: req.max_price });
          lists.push(l);
          areas.push({ id: r.id, label: r.label, count: l.length, ok: true });
          job.log.push(`${r.label}: ${l.length} destino(s)`);
        } catch (e) {
          errors.push(`${r.label}: ${e.message}`);
          areas.push({ id: r.id, label: r.label, count: 0, ok: false });
          job.log.push(`${r.label}: erro`);
        }
        job.done++;
      });
      if (!lists.length) throw new Error(errors[0] || "Nenhuma região respondeu");
      const dests = C.locateDestinations(C.mergeDestinations(lists)).sort((a, b) => a.price_pp - b.price_pp);
      const result = { req, dests, errors, areas, total: dests.length, ts: Date.now() };
      this.store.set("scan:" + C.scanKey(req), { ts: result.ts, result });
      this.store.set("scan:last", { ts: result.ts, result });
      this._spent();
      job.result = result;
      job.status = "done";
    } catch (e) {
      job.status = "error";
      job.error = e.message;
    }
  }

  /* ================= SEGURANÇA E CUSTO DE VIDA (Banco Mundial, grátis) ================= */
  async indicators(a2) {
    if (!a2) throw new Error("Não identifiquei o país deste destino.");
    let cache = this.store.get("ind:v1", null);
    if (!cache || Date.now() - cache.ts > IND_DAYS * 864e5) {
      const wb = new WorldBank(this.opts);
      const tables = {}, errors = [];
      for (const [k, v] of Object.entries(C.INDICATORS)) {
        try { tables[k] = await wb.all(v.code); } catch (e) { errors.push(`${v.label}: ${e.message}`); }
      }
      if (!Object.keys(tables).length) throw new Error(errors[0] || "Banco Mundial indisponível");
      cache = { ts: Date.now(), tables, errors };
      this.store.set("ind:v1", cache);
    }
    return { ...C.buildIndicators(a2, cache.tables), errors: cache.errors || [] };
  }

  /* ================= ALERTAS DE PREÇO (checados com o app aberto) ================= */
  watches() { return this.store.get("watches", []) || []; }
  alerts() { return this.store.get("alerts", []) || []; }
  createWatch(body) {
    if (!this.config().configured) throw new Error("Configure sua chave da SerpApi primeiro.");
    const req = C.parseTrip({ ...body, hotels: false, tours: false });
    const target = Number(body.target_price);
    const w = {
      id: this.store.nextId(), origin: req.origin, destination: req.destination, depart_date: req.depart_date, return_date: req.return_date,
      adults: req.adults, children: req.children, cabin: req.cabin, flex: req.flex, nearby: req.nearby,
      target_price: target > 0 ? target : null, drop_pct: Number(body.drop_pct) || 5,
      interval_min: Math.max(60, Number.parseInt(body.interval_min, 10) || 1440), active: true,
      created_at: nowISO(), last_checked: null, best_price: null, last_alert_price: null, last_error: null, history: [],
    };
    this.store.set("watches", [w, ...this.watches()]);
    this.checkWatch(w.id);
    return w.id;
  }
  _patchWatch(id, fn) { this.store.set("watches", this.watches().map((w) => (w.id === id ? fn(w) : w))); }
  toggleWatch(id) { this._patchWatch(id, (w) => ({ ...w, active: !w.active })); }
  deleteWatch(id) {
    this.store.set("watches", this.watches().filter((w) => w.id !== id));
    this.store.set("alerts", this.alerts().filter((a) => a.watch_id !== id));
  }
  markAlertsSeen() { this.store.set("alerts", this.alerts().map((a) => ({ ...a, seen: true }))); }

  async checkWatch(id) {
    const w = this.watches().find((x) => x.id === id);
    if (!w) return;
    const now = nowISO();
    if (w.depart_date < C.todayISO()) { this._patchWatch(id, (x) => ({ ...x, active: false, last_error: "A data de ida já passou" })); return; }
    try {
      const serp = this._needSerp();
      const req = C.parseTrip({ ...w, hotels: false, tours: false }, w.depart_date); // a data já foi conferida acima
      const res = await this._scanFlights(serp, req, this.settings().max_calls_monitor);
      this._spent();
      const offers = C.analyzeFlights(res.offers, req);
      if (!offers.length) throw new Error(res.errors.join("; ") || "Nenhuma oferta encontrada");
      const best = offers[0], price = best.price_pp;
      const hist = w.history.map((h) => h.best_price), histMin = hist.length ? Math.min(...hist) : null;
      const route = `${w.origin}→${w.destination}`, what = `${best.airline} ${best.depart_date}` + (best.return_date ? ` ⇄ ${best.return_date}` : "");
      const la = w.last_alert_price, fresh = la == null || price < la;
      let msg = null;
      if (w.target_price && price <= w.target_price && fresh) msg = `🎯 ${route}: ${C.money(price)} por pessoa, abaixo do seu alvo de ${C.money(w.target_price)} (${what})`;
      else if (w.best_price && price <= w.best_price * (1 - (w.drop_pct || 5) / 100) && fresh) msg = `📉 ${route}: caiu de ${C.money(w.best_price)} para ${C.money(price)} por pessoa (${what})`;
      else if (histMin != null && price < histMin && fresh) msg = `⭐ ${route}: menor preço já visto, ${C.money(price)} por pessoa (${what})`;
      if (msg) this.store.set("alerts", [{ id: this.store.nextId(), watch_id: id, ts: now, message: msg, price, seen: false }, ...this.alerts()].slice(0, 50));
      this._patchWatch(id, (x) => ({
        ...x, last_checked: now, best_price: price, last_error: null, last_alert_price: msg ? price : x.last_alert_price,
        history: [...x.history, { ts: now, best_price: price }].slice(-60),
      }));
    } catch (e) {
      this._patchWatch(id, (x) => ({ ...x, last_checked: now, last_error: String(e.message).slice(0, 300) }));
    }
  }
  /** Checa os alertas vencidos. Chamado ao abrir o app e a cada minuto enquanto ele está aberto. */
  async checkDue() {
    if (!this.config().configured) return;
    for (const w of this.watches()) {
      if (!w.active) continue;
      const due = !w.last_checked || (Date.now() - new Date(w.last_checked + "Z").getTime()) / 60000 >= w.interval_min;
      if (due) await this.checkWatch(w.id);
    }
  }
}
