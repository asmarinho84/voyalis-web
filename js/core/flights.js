// Viagem com destino definido: validação do pedido, plano de consultas (datas flexíveis e aeroportos próximos)
// e análise das ofertas (menor preço, mais rápido, equilíbrio, ofertas escondidas, bilhetes separados, vendedores).
import { METRO, NEARBY } from "./places.js";
import { CABINS, addDays, clampInt, diffDays, flightLinks, isValidDate, median, minBy, money, pct, todayISO } from "./util.js";

/** Valida e normaliza o pedido de uma viagem. Lança Error com mensagem pronta para o usuário. */
export function parseTrip(data, today = todayISO()) {
  const code = (v, field) => {
    v = String(v || "").trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(v)) throw new Error(`${field}: escolha uma cidade da lista ou digite o código do aeroporto (ex.: GRU)`);
    return v;
  };
  const req = {
    origin: code(data.origin, "Origem"),
    destination: code(data.destination, "Destino"),
    depart_date: data.depart_date || "",
    return_date: data.return_date || null,
    adults: clampInt(data.adults, 1, 9, 1),
    children: clampInt(data.children, 0, 8, 0),
    cabin: CABINS.includes(data.cabin) ? data.cabin : "economy",
    flex: clampInt(data.flex, 0, 3, 0),
    nearby: !!data.nearby,
    hotels: data.hotels !== false,
    tours: data.tours !== false,
    hotel_km: clampInt(data.hotel_km, 0, 100, 0),
    tour_km: clampInt(data.tour_km, 0, 100, 0),
    hotel_area: String(data.hotel_area || "").replace(/\s+/g, " ").trim().slice(0, 80),
  };
  const ages = String(data.children_ages ?? "").replace(/;/g, ",").split(",").map((a) => a.trim())
    .filter((a) => /^\d+$/.test(a) && +a <= 17).map(Number);
  req.children_ages = [...ages, ...Array(req.children).fill(8)].slice(0, req.children);
  const same = (a, b) => a === b || (METRO[a] || []).includes(b) || (METRO[b] || []).includes(a);
  if (same(req.origin, req.destination)) throw new Error("Origem e destino não podem ser iguais");
  if (!isValidDate(req.depart_date) || (req.return_date && !isValidDate(req.return_date))) throw new Error("Informe datas válidas");
  if (req.depart_date < today) throw new Error("A data de ida já passou");
  if (req.return_date && req.return_date <= req.depart_date) throw new Error("A volta precisa ser depois da ida");
  if (diffDays(req.depart_date, today) > 330) throw new Error("O Google só tem preços até cerca de 11 meses à frente");
  return req;
}

/* ---------- plano de consultas ---------- */
export function expand(code, nearby) {
  if (METRO[code]) return [...METRO[code]];
  return nearby ? [code, ...(NEARBY[code] || [])] : [code];
}
export function dateRange(center, flex, today) {
  const out = [];
  for (let k = -flex; k <= flex; k++) {
    const d = addDays(center, k);
    if (d >= today) out.push(d);
  }
  return out;
}
/** [origem, destino, ida, volta], das combinações mais próximas do pedido para as mais distantes. */
export function planQueries(req, today = todayISO()) {
  const origins = expand(req.origin, req.nearby), dests = expand(req.destination, req.nearby);
  const [mainO, mainD] = [origins[0], dests[0]];
  const deps = dateRange(req.depart_date, req.flex, today);
  const rets = req.return_date ? dateRange(req.return_date, req.flex, today) : [null];
  const qs = [];
  for (const o of origins)
    for (const d of dests) {
      if (o === d) continue;
      for (const dep of deps)
        for (const ret of rets) {
          if (ret && ret <= dep) continue;
          const dd = Math.abs(diffDays(dep, req.depart_date)), rd = ret ? Math.abs(diffDays(ret, req.return_date)) : 0;
          qs.push([dd + rd + (o === mainO && d === mainD ? 0 : 5), o, d, dep, ret]);
        }
    }
  qs.sort((a, b) => a[0] - b[0]);
  return qs.map((q) => q.slice(1));
}

/* ---------- análise das ofertas ---------- */
export function analyzeFlights(offers, req) {
  if (!offers.length) return [];
  const seen = new Set();
  offers = offers.filter((o) => {
    const k = [o.airline, o.origin, o.destination, o.depart_date, o.return_date, o.outbound.dep_time, o.price_pp, o.kind].join("|");
    return seen.has(k) ? false : (seen.add(k), true);
  });
  const primO = new Set(METRO[req.origin] || [req.origin]), primD = new Set(METRO[req.destination] || [req.destination]);
  const isExact = (o) => o.depart_date === req.depart_date && o.return_date === req.return_date && primO.has(o.origin) && primD.has(o.destination) && o.kind !== "split";
  const ex = offers.filter(isExact).map((o) => o.price_pp);
  const bestExact = ex.length ? Math.min(...ex) : null;
  for (const o of offers) {
    o.tags ??= [];
    o.exact = isExact(o);
    if (o.kind === "split" || o.exact) continue;
    if (o.depart_date !== req.depart_date || o.return_date !== req.return_date) o.tags.push("Outras datas");
    if (!primO.has(o.origin) || !primD.has(o.destination)) o.tags.push("Aeroporto alternativo");
  }
  for (const o of offers) {
    if (bestExact && !o.exact && o.kind !== "split" && o.price_pp <= bestExact * 0.95) {
      o.tags.push("Escondida");
      o.saving_vs_exact = Math.trunc(bestExact - o.price_pp);
    }
    if (o.kind === "split" && bestExact && o.price_pp < bestExact) o.saving_vs_exact = Math.trunc(bestExact - o.price_pp);
  }
  const totalDur = (o) => (o.outbound.duration_min || 0) + (o.inbound?.duration_min || 0);
  const prices = offers.map((o) => o.price_pp), durs = offers.map(totalDur);
  const [pmin, pmax, dmin, dmax] = [Math.min(...prices), Math.max(...prices), Math.min(...durs), Math.max(...durs)];
  const score = (o) => {
    const stops = (o.outbound.stops || 0) + (o.inbound?.stops || 0);
    return ((o.price_pp - pmin) / (pmax - pmin || 1)) * 0.6 + ((totalDur(o) - dmin) / (dmax - dmin || 1)) * 0.3 + (Math.min(stops, 4) / 4) * 0.1;
  };
  const cheapest = minBy(offers, (o) => o.price_pp);
  const near = offers.filter((o) => o.price_pp <= pmin * 1.5);
  const fastest = minBy(near.length ? near : offers, totalDur);
  const balanced = minBy(offers, score);
  cheapest.tags.unshift("Menor preço");
  if (fastest !== cheapest) fastest.tags.unshift("Mais rápido");
  if (balanced !== cheapest && balanced !== fastest) balanced.tags.unshift("Melhor equilíbrio");
  for (const o of offers) {
    o.total_duration_min = totalDur(o);
    o.links = flightLinks(o.origin, o.destination, o.depart_date, o.return_date, req.adults, req.children);
  }
  return offers.sort((a, b) => a.price_pp - b.price_pp);
}

/** Ida mais barata de uma companhia + volta mais barata de outra (2 bilhetes), só se sair mais barato. */
export function splitOffers(outs, backs, req, bestRt) {
  const cheap = (l) => [...l].sort((a, b) => a.price_pp - b.price_pp).slice(0, 4);
  const pax = req.adults + req.children;
  const res = [];
  for (const a of cheap(outs))
    for (const b of cheap(backs)) {
      if (a.airline === b.airline) continue;
      const pp = a.price_pp + b.price_pp;
      if (bestRt != null && pp >= bestRt) continue;
      res.push({
        provider: a.provider, kind: "split", airline: `${a.airline} + ${b.airline}`,
        origin: a.origin, destination: a.destination, depart_date: req.depart_date, return_date: req.return_date,
        outbound: { ...a.outbound, airline: a.airline }, inbound: { ...b.outbound, airline: b.airline },
        currency: "BRL", price_pp: pp, price_total: pp * pax, id: `split-${a.id}-${b.id}`,
        tags: ["Escondida", "2 bilhetes separados"],
        warning: "Dois bilhetes separados: bagagem e conexões não são integradas. Confira as regras de cada companhia.",
      });
    }
  return res.sort((a, b) => a.price_pp - b.price_pp).slice(0, 3);
}

/** Calendário: menor preço por par (ida, volta). */
export function buildMatrix(offers) {
  const cells = {}, deps = new Set(), rets = new Set();
  for (const o of offers) {
    if (o.kind !== "roundtrip" || !o.return_date) continue;
    const k = `${o.depart_date}|${o.return_date}`;
    if (!(k in cells) || o.price_pp < cells[k]) cells[k] = o.price_pp;
    deps.add(o.depart_date);
    rets.add(o.return_date);
  }
  return { dep_dates: [...deps].sort(), ret_dates: [...rets].sort(), cells };
}

/** Compara os vendedores de uma passagem (companhia x agências). Sinais de alerta, não prova de fraude. */
export function analyzeSellers(options, headline = null) {
  const items = options.filter((o) => o.price > 0).map((o) => ({ ...o, flags: [] })).sort((a, b) => a.price - b.price);
  if (!items.length) return { items: [], official: null, min: null, notes: [] };
  const min = items[0].price, official = items.find((o) => o.airline) || null, med = median(items.map((o) => o.price));
  const notes = [];
  for (const o of items) {
    o.diff_min = o.price - min;
    if (official) o.vs_official_pct = pct(o.price, official.price);
    if (official && !o.airline && o.vs_official_pct <= -15)
      o.flags.push({ level: "alert", text: `${Math.abs(o.vs_official_pct)}% abaixo do preço da própria companhia: confira a reputação do vendedor e o valor final no pagamento` });
    else if (!official && items.length >= 3 && o.price <= med * 0.7)
      o.flags.push({ level: "alert", text: "muito abaixo das outras fontes: confira a reputação do vendedor e o valor final no pagamento" });
    if (official && !o.airline && o.vs_official_pct >= 10) o.flags.push({ level: "info", text: `${o.vs_official_pct}% mais caro que comprar direto na companhia` });
  }
  if (official && headline && Math.abs(pct(official.price, headline)) >= 3)
    notes.push(`O preço da companhia (${money(official.price)}) difere do preço da lista (${money(headline)}): o Google atualiza os preços o tempo todo.`);
  if (!official) notes.push("O Google não listou a venda direta pela companhia para esta oferta: confira também no site dela.");
  return { items, official, min, notes };
}
