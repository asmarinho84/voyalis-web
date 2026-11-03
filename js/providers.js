// Fontes de dados reais. Campos conferidos na documentação oficial da SerpApi (google_flights, google_travel_explore,
// google_hotels, google_maps) e da API do Banco Mundial. No Android o fetch é o nativo (CapacitorHttp): sem bloqueio de CORS.
// A chave nunca aparece em mensagens de erro (redact).
import { diffDays, hotelLinks, tourLinks } from "./core/index.js";

export class ProviderError extends Error {}

/** Remove chaves/tokens de mensagens (nunca mostrar a chave na tela). */
export const redact = (msg, ...secrets) => {
  let m = String(msg);
  for (const s of secrets) if (s) m = m.split(s).join("***");
  return m;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms) => {
  let t;
  const timer = new Promise((_, rej) => { t = setTimeout(() => rej(new Error("timeout")), ms); });
  return Promise.race([p, timer]).finally(() => clearTimeout(t));
};

/** Empresas de turismo (agências, operadoras): ficam de fora; queremos os pontos turísticos em si. */
const AGENCY = /ag[eê]ncia|operadora|tour (agency|operator|guide)|travel agen|guia de turismo|excurs|receptivo|viagens e turismo/i;
export const isAgency = (r) => [r.type, ...(r.types || [])].some((t) => AGENCY.test(String(t || "")));

const hhmm = (s) => (s ? s.slice(-5) : "");

/** Monta um trecho (ida ou volta) a partir de um grupo de voos do Google. */
function legOf(grp, refDate) {
  const segs = grp.flights || [];
  const first = segs[0], last = segs[segs.length - 1];
  const arrRaw = last.arrival_airport?.time || "";
  const dayOff = /^\d{4}-\d{2}-\d{2}/.test(arrRaw) && refDate ? Math.max(0, diffDays(arrRaw.slice(0, 10), refDate)) : 0;
  return {
    first, last,
    leg: {
      dep_time: hhmm(first.departure_airport?.time), arr_time: hhmm(arrRaw), arr_day_offset: dayOff,
      duration_min: grp.total_duration || segs.reduce((s, x) => s + (x.duration || 0), 0),
      stops: segs.length - 1,
      via: (grp.layovers || []).map((l) => l.id).filter(Boolean).join(", "),
      flight_no: segs.map((x) => x.flight_number || "").join(" + "),
    },
    airline: [...new Set(segs.map((x) => x.airline).filter(Boolean))].join(" / ") || "—",
  };
}

export class SerpApi {
  name = "serpapi";
  /**
   * `apiBase` (site): as consultas passam pelo intermediário do próprio site (ex.: "/api/"), porque a SerpApi
   * não aceita chamadas diretas do navegador. A chave vai num cabeçalho, nunca no endereço.
   * Sem `apiBase` (app Android): consulta a SerpApi diretamente.
   */
  constructor(key, { fetchFn, sleepFn, timeoutMs, apiBase = null } = {}) {
    this.key = key;
    this._fetch = fetchFn || ((...a) => globalThis.fetch(...a));
    this._sleep = sleepFn || sleep;
    this._timeout = timeoutMs ?? 60000;
    this._base = apiBase;
  }

  async _request(path, params) {
    const viaSite = !!this._base;
    const url = viaSite ? `${this._base}serp/${path}?` + new URLSearchParams(params) : `https://serpapi.com/${path}?` + new URLSearchParams({ ...params, api_key: this.key });
    const init = viaSite ? { headers: { "X-Serp-Key": this.key, "X-Requested-With": "voyalis" }, credentials: "omit", cache: "no-store" } : undefined;
    let r;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        r = await withTimeout(this._fetch(url, init), this._timeout);
      } catch {
        throw new ProviderError("Sem conexão com o serviço de preços. Verifique sua internet e tente de novo.");
      }
      if (r.status !== 429) break;
      await this._sleep(4000); // limite de requisições: espera e tenta mais uma vez
    }
    if (r.status === 429) throw new ProviderError("SerpApi: limite de requisições por hora atingido; aguarde e tente de novo");
    let data;
    try {
      data = await r.json();
    } catch {
      throw new ProviderError(`SerpApi respondeu HTTP ${r.status} sem JSON`);
    }
    return { status: r.status, data: data ?? {} };
  }

  async _get(params) {
    const { status, data } = await this._request("search.json", params);
    const err = data.error;
    if (err && String(err).includes("returned any results")) return {}; // consulta válida, sem resultados
    if (status !== 200 || err) throw new ProviderError("SerpApi: " + redact(err || `HTTP ${status}`, this.key));
    return data;
  }

  /** Consulta gratuita (não gasta busca): valida a chave e informa o saldo. */
  async account() {
    const { status, data } = await this._request("account.json", {});
    if (status === 401 || status === 403 || (data.error && /invalid/i.test(String(data.error))))
      return { valid: false, left: null, plan: null };
    return { valid: true, left: data.total_searches_left ?? data.plan_searches_left ?? null, plan: data.plan_name ?? null };
  }

  // Voos. A doc não diz se "price" é por pessoa ou total; por isso consultamos sempre 1 adulto
  // (preço inequívoco) e o app multiplica para estimar o grupo.
  async flights(o, d, dep, ret, adults, children, cabin = "economy") {
    const data = await this._get({
      engine: "google_flights", departure_id: o, arrival_id: d, outbound_date: dep, currency: "BRL",
      hl: "pt-BR", gl: "br", adults: 1,
      travel_class: { economy: 1, premium: 2, business: 3, first: 4 }[cabin] ?? 1,
      type: ret ? 1 : 2, ...(ret ? { return_date: ret } : {}),
    });
    const pax = adults + children;
    const raw = [...(data.best_flights || []), ...(data.other_flights || [])];
    const offers = [];
    for (const grp of raw) {
      const segs = grp.flights || [];
      if (!segs.length || !grp.price) continue;
      const { first, last, leg, airline } = legOf(grp, dep);
      offers.push({
        provider: "serpapi", kind: ret ? "roundtrip" : "oneway", airline,
        origin: first.departure_airport?.id || o, destination: last.arrival_airport?.id || d,
        depart_date: dep, return_date: ret || null, outbound: leg,
        // a volta só vem numa 2ª consulta (departure_token): botão "Ver volta" no app
        inbound: null, token: grp.departure_token || null, booking_token: grp.booking_token || null, currency: "BRL",
        price_pp: Math.round(grp.price), price_total: Math.round(grp.price) * pax,
        id: `serp-${o}${d}-${dep}-${ret}-${leg.flight_no}-${grp.price}`,
      });
    }
    if (raw.length && !offers.length)
      throw new ProviderError(`SerpApi devolveu ${raw.length} voos em formato não reconhecido (campos: ${Object.keys(raw[0]).sort().slice(0, 8)})`);
    return { offers, insights: parseInsights(data) };
  }

  /** Onde comprar: preço por vendedor (companhia e agências) para um itinerário (1 busca). */
  async bookingOptions(o, d, dep, ret, token, cabin = "economy") {
    const data = await this._get({
      engine: "google_flights", booking_token: token, departure_id: o, arrival_id: d, outbound_date: dep, currency: "BRL",
      hl: "pt-BR", gl: "br", adults: 1, type: ret ? 1 : 2, ...(ret ? { return_date: ret } : {}),
      travel_class: { economy: 1, premium: 2, business: 3, first: 4 }[cabin] ?? 1,
    });
    const raw = data.booking_options || [];
    const options = [];
    let separate = 0;
    for (const e of raw) {
      const t = e.together;
      if (!t) { separate++; continue; } // vendas com bilhetes separados (ida e volta em vendedores distintos): não exibidas
      if (!t.book_with || !(t.price > 0)) continue;
      options.push({
        seller: t.book_with, airline: !!t.airline, price: Math.round(t.price), fare: t.option_title || null,
        conditions: (t.extensions || []).slice(0, 4), baggage: (t.baggage_prices || []).slice(0, 3),
        flights: (t.marketed_as || []).join(", "),
        request: t.booking_request?.url ? { url: t.booking_request.url, post_data: t.booking_request.post_data || "" } : null,
      });
    }
    if (raw.length && !options.length && !separate)
      throw new ProviderError(`SerpApi devolveu ${raw.length} opções de compra em formato não reconhecido (campos: ${Object.keys(raw[0]).sort().slice(0, 8)})`);
    return { options, separate, baggage: data.baggage_prices?.together || [] };
  }

  /** Voos de VOLTA para uma ida escolhida (1 busca). Cada opção traz o preço do ida-e-volta completo. */
  async returnLegs(o, d, dep, ret, token, cabin = "economy") {
    const data = await this._get({
      engine: "google_flights", departure_id: o, arrival_id: d, outbound_date: dep, return_date: ret, currency: "BRL",
      hl: "pt-BR", gl: "br", adults: 1, type: 1, departure_token: token,
      travel_class: { economy: 1, premium: 2, business: 3, first: 4 }[cabin] ?? 1,
    });
    const raw = [...(data.best_flights || []), ...(data.other_flights || [])];
    const out = [];
    for (const grp of raw) {
      if (!(grp.flights || []).length || !grp.price) continue;
      const { leg, airline } = legOf(grp, ret);
      out.push({ leg: { ...leg, airline }, price_pp: Math.round(grp.price), booking_token: grp.booking_token || null });
    }
    if (raw.length && !out.length)
      throw new ProviderError(`SerpApi devolveu ${raw.length} voos de volta em formato não reconhecido (campos: ${Object.keys(raw[0]).sort().slice(0, 8)})`);
    return out.sort((a, b) => a.price_pp - b.price_pp);
  }

  /**
   * Google Travel Explore: destinos com o menor preço a partir da origem, para as datas dadas.
   * Consulta sempre 1 adulto (preço inequívoco); o app multiplica para estimar o grupo.
   * `area` = região/país como kgmid (ex.: "/m/015fr" = Brasil). Sem `area`, vêm os destinos "populares".
   */
  async explore({ origin, dep, ret, area = null, cabin = "economy", stops = 0, maxPrice = 0 }) {
    const data = await this._get({
      engine: "google_travel_explore", departure_id: origin, outbound_date: dep, return_date: ret, type: 1,
      currency: "BRL", hl: "pt-BR", gl: "br", adults: 1, travel_mode: 1,
      travel_class: { economy: 1, premium: 2, business: 3, first: 4 }[cabin] ?? 1,
      ...(stops ? { stops } : {}), ...(maxPrice ? { max_price: maxPrice } : {}), ...(area ? { arrival_area_id: area } : {}),
    });
    const raw = data.destinations || [];
    const out = [];
    for (const d of raw) {
      if (!d || !(d.flight_price > 0) || !d.name) continue;
      out.push({
        id: d.destination_id || `${d.name}|${d.country || ""}`, name: d.name, country: d.country || "",
        lat: d.gps_coordinates?.latitude ?? null, lng: d.gps_coordinates?.longitude ?? null,
        airport: d.destination_airport?.code || null, airport_name: d.destination_airport?.name || null,
        price_pp: Math.round(d.flight_price), hotel_night: d.hotel_price > 0 ? Math.round(d.hotel_price) : null,
        duration_min: d.flight_duration ?? null, stops: d.number_of_stops ?? null,
        airline: d.airline || null, thumbnail: d.thumbnail || null,
        start_date: d.start_date || dep, end_date: d.end_date || ret, link: d.link || null,
      });
    }
    if (raw.length && !out.length)
      throw new ProviderError(`SerpApi devolveu ${raw.length} destinos em formato não reconhecido (campos: ${Object.keys(raw[0] || {}).sort().slice(0, 8)})`);
    return out;
  }

  async hotels(city, checkin, checkout, adults, children, childrenAges = [], area = "") {
    const params = {
      engine: "google_hotels", q: `hotéis em ${area ? area + ", " : ""}${city}`, check_in_date: checkin, check_out_date: checkout,
      adults, currency: "BRL", hl: "pt-BR", gl: "br",
    };
    if (children) {
      const ages = [...childrenAges.slice(0, children)];
      while (ages.length < children) ages.push(8);
      params.children = children;
      params.children_ages = ages.join(",");
    }
    const data = await this._get(params);
    const nights = Math.max(1, diffDays(checkout, checkin));
    const props = data.properties || [];
    const out = [];
    for (const p of props) {
      let night = p.rate_per_night?.extracted_lowest;
      const total = p.total_rate?.extracted_lowest;
      if (!night && !total) continue;
      night = night || Math.trunc(total / nights);
      const name = p.name || "Hotel";
      out.push({
        provider: "serpapi", id: `serp-h-${p.property_token || name}`, name, stars: p.extracted_hotel_class || 0,
        rating: p.overall_rating ?? null, rating_scale: 5, // nota do Google, de 0 a 5
        reviews: p.reviews ?? null, distance_center_km: null,
        price_night: Math.round(night), price_total: Math.round(total || night * nights), nights, currency: "BRL",
        free_cancel: null, breakfast: null, amenities: (p.amenities || []).slice(0, 3),
        thumbnail: p.images?.[0]?.thumbnail || null,
        token: p.property_token || null,
        lat: p.gps_coordinates?.latitude ?? null, lng: p.gps_coordinates?.longitude ?? null,
        location_rating: Number.isFinite(p.location_rating) ? p.location_rating : null,
        nearby: (p.nearby_places || []).map((n) => n.name).filter(Boolean).slice(0, 3),
        sources: (p.prices || []).map((x) => ({
          source: x.source, official: /oficial|official/i.test(String(x.source || "")),
          night: x.rate_per_night?.extracted_lowest ?? x.rate_per_night?.extracted_display_price ?? null,
          before_taxes: x.rate_per_night?.extracted_before_taxes_fees ?? null, after_taxes: x.rate_per_night?.extracted_after_taxes_fees ?? null,
        })).filter((x) => x.source && x.night),
        address: p.address || null, // a listagem não traz endereço; vem em hotelDetails()
        link: p.link || hotelLinks(city, checkin, checkout, adults, children, 1, name).Booking,
      });
    }
    if (props.length && !out.length)
      throw new ProviderError(`SerpApi devolveu ${props.length} hotéis sem preço reconhecido (campos: ${Object.keys(props[0]).sort().slice(0, 8)})`);
    return out;
  }

  /** Endereço, telefone e rota de UM hotel (1 busca). */
  async hotelDetails(token, checkin, checkout, adults, children, childrenAges = []) {
    const params = { engine: "google_hotels", property_token: token, check_in_date: checkin, check_out_date: checkout, adults, currency: "BRL", hl: "pt-BR", gl: "br" };
    if (children) {
      const ages = [...childrenAges.slice(0, children)];
      while (ages.length < children) ages.push(8);
      params.children = children; params.children_ages = ages.join(",");
    }
    const d = await this._get(params);
    return { address: d.address || null, phone: d.phone || null, directions: d.directions || null };
  }

  /** Coordenadas do "ponto inicial" (cidade, bairro ou endereço) pelo Google Maps (1 busca). */
  async geocode(place) {
    const d = await this._get({ engine: "google_maps", q: place, type: "search", hl: "pt-BR", gl: "br" });
    const g = d.place_results?.gps_coordinates || d.local_results?.find((r) => r.gps_coordinates)?.gps_coordinates;
    if (!g || !Number.isFinite(g.latitude) || !Number.isFinite(g.longitude)) return null;
    return { lat: g.latitude, lng: g.longitude };
  }

  async tours(city, dep, ret, area = "", center = null, km = 0) {
    const where = area ? `${area}, ${city}` : city;
    const zoom = !km ? 12 : km <= 2 ? 15 : km <= 5 ? 14 : km <= 12 ? 13 : km <= 30 ? 11 : 10;
    const data = await this._get({
      engine: "google_maps", q: `pontos turísticos em ${where}`, type: "search", hl: "pt-BR", gl: "br",
      ...(center ? { ll: `@${center.lat},${center.lng},${zoom}z` } : {}),
    });
    return (data.local_results || [])
      .filter((r) => !isAgency(r))
      .map((r) => ({
        provider: "serpapi", id: `serp-t-${r.place_id || r.title}`, name: r.title || "Ponto turístico", duration_h: null,
        rating: r.rating ?? null, rating_scale: 5, reviews: r.reviews ?? null, price_pp: null, price_total: null,
        currency: "BRL", free_cancel: null, languages: [], thumbnail: r.thumbnail || null, kind: r.type || null,
        address: r.address || null, description: r.description || null,
        lat: r.gps_coordinates?.latitude ?? null, lng: r.gps_coordinates?.longitude ?? null,
        link: r.place_id ? `https://www.google.com/maps/place/?q=place_id:${r.place_id}` : tourLinks(where, dep, ret).Google,
      }));
  }
}

/** Indicador do próprio Google ("preço baixo/típico/alto"). Só existe se vier na resposta. */
export function parseInsights(data) {
  const pi = data?.price_insights;
  if (!pi || typeof pi !== "object") return null;
  const level = typeof pi.price_level === "string" ? pi.price_level : null;
  const r = pi.typical_price_range;
  const range = Array.isArray(r) && r.length === 2 && r.every(Number.isFinite) ? r : null;
  const lowest = Number.isFinite(pi.lowest_price) ? pi.lowest_price : null;
  if (!level && !range && lowest == null) return null;
  return { level, typical_low: range?.[0] ?? null, typical_high: range?.[1] ?? null, lowest };
}

/** Indicadores públicos do Banco Mundial (gratuito, sem chave): um pedido traz todos os países. */
export class WorldBank {
  constructor({ fetchFn, timeoutMs, apiBase = null } = {}) {
    this._fetch = fetchFn || ((...a) => globalThis.fetch(...a));
    this._timeout = timeoutMs ?? 30000;
    this._base = apiBase;
  }
  /** @returns {Promise<Record<string,{value:number,year:string}>>} por código ISO2 do país */
  async all(code) {
    if (!/^[A-Z0-9.]{3,40}$/.test(code)) throw new ProviderError("Indicador inválido");
    const url = this._base ? `${this._base}wb/${code}` : `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&mrnev=1&per_page=400`;
    let body;
    try {
      const r = await withTimeout(this._fetch(url, this._base ? { headers: { "X-Requested-With": "voyalis" }, credentials: "omit" } : undefined), this._timeout);
      body = await r.json();
    } catch {
      throw new ProviderError("Banco Mundial inacessível: sem conexão");
    }
    const rows = Array.isArray(body) ? body[1] : null;
    if (!Array.isArray(rows)) throw new ProviderError("Banco Mundial: resposta inesperada");
    const out = {};
    for (const x of rows) {
      const a2 = x?.country?.id;
      if (a2 && /^[A-Z]{2}$/.test(a2) && Number.isFinite(x.value)) out[a2] = { value: x.value, year: String(x.date || "") };
    }
    return out;
  }
}
