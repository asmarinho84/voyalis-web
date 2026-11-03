// Descobrir destinos: regiões da varredura, pedido, geografia (mapas do mundo e do Brasil), localização
// de cada destino em país/estado, cores por faixa de preço e filtros em cascata.
import { BRAZIL_TOPO, BR_STATES, COUNTRIES, WORLD_TOPO } from "../data/geo.js";
import { METRO } from "./places.js";
import { CABINS, diffDays, isValidDate, norm, todayISO } from "./util.js";

export { BR_STATES, COUNTRIES };

/* ---------- regiões da varredura (kgmid = identificador do Google Knowledge Graph) ---------- */
// Cada região é 1 busca na SerpApi. "Sem filtro" traz os destinos populares do Google.
export const REGIONS = [
  { id: "br", label: "Brasil", area: "/m/015fr" },
  { id: "sa", label: "América do Sul", area: "/m/06n3y" },
  { id: "na", label: "América do Norte", area: "/m/059g4" },
  { id: "eu", label: "Europa", area: "/m/02j9z" },
  { id: "as", label: "Ásia", area: "/m/0j0k" },
  { id: "af", label: "África", area: "/m/0dg3n" },
  { id: "oc", label: "Oceania", area: "/m/05nrg" },
  { id: "any", label: "Populares (sem filtro de região)", area: null },
];

/* ---------- pedido da varredura ---------- */
export function parseScan(data, today = todayISO()) {
  const clamp = (v, lo, hi, def) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
  };
  const codes = String(data.origin || "")
    .toUpperCase()
    .split(/[\s,;]+/)
    .filter(Boolean)
    .flatMap((c) => METRO[c] || [c]);
  if (!codes.length || codes.length > 5 || !codes.every((c) => /^[A-Z]{3}$/.test(c)))
    throw new Error("Origem: informe 1 a 5 códigos de aeroporto de 3 letras (ex.: GRU ou SAO)");
  const known = REGIONS.map((r) => r.id);
  const regions = (Array.isArray(data.regions) && data.regions.length ? data.regions : known).filter((r) => known.includes(r));
  if (!regions.length) throw new Error("Escolha ao menos uma região para varrer");
  const req = {
    origin: [...new Set(codes)].join(","),
    depart_date: data.depart_date || "",
    return_date: data.return_date || "",
    adults: clamp(data.adults, 1, 9, 1),
    children: clamp(data.children, 0, 8, 0),
    cabin: CABINS.includes(data.cabin) ? data.cabin : "economy",
    stops: clamp(data.stops, 0, 3, 0),
    max_price: clamp(data.max_price, 0, 100000, 0),
    regions,
  };
  if (!isValidDate(req.depart_date) || !isValidDate(req.return_date)) throw new Error("Informe as datas de ida e de volta");
  if (req.depart_date < today) throw new Error("A data de ida já passou");
  if (req.return_date <= req.depart_date) throw new Error("A volta precisa ser depois da ida");
  if (diffDays(req.depart_date, today) > 330) throw new Error("O Google só tem preços até cerca de 11 meses à frente");
  return req;
}
export const scanKey = (r) => ["v1", r.origin, r.depart_date, r.return_date, r.adults, r.children, r.cabin, r.stops, r.max_price, [...r.regions].sort().join("+")].join("|");

/* ---------- geografia: topojson → polígonos, projeção, ponto-em-polígono ---------- */
function decodeTopo(topo) {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map((a) => {
    let x = 0, y = 0;
    return a.map(([dx, dy]) => [(x += dx) * sx + tx, (y += dy) * sy + ty]);
  });
  const ring = (idx) => {
    const pts = [];
    for (const i of idx) {
      const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
      for (let k = pts.length ? 1 : 0; k < a.length; k++) pts.push(a[k]);
    }
    return pts;
  };
  const obj = Object.values(topo.objects)[0];
  return obj.geometries.map((g) => {
    const polys = g.type === "Polygon" ? [g.arcs] : g.arcs;
    return { id: g.id, polys: polys.map((p) => p.map(ring)) };
  });
}
const bboxOf = (rings) => {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  for (const r of rings) for (const [x, y] of r) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
};
const inRing = (x, y, r) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
let _geo;
/** Mundo (países) e Brasil (estados), decodificados uma vez. */
export function geo() {
  if (!_geo) {
    const prep = (feats) => feats.map((f) => ({ ...f, polys: f.polys.map((p) => ({ rings: p, box: bboxOf([p[0]]) })) }));
    _geo = { world: prep(decodeTopo(WORLD_TOPO)), brazil: prep(decodeTopo(BRAZIL_TOPO)) };
  }
  return _geo;
}
export function contains(feat, lng, lat) {
  for (const p of feat.polys) {
    const [x0, y0, x1, y1] = p.box;
    if (lng < x0 || lng > x1 || lat < y0 || lat > y1) continue;
    if (inRing(lng, lat, p.rings[0]) && !p.rings.slice(1).some((h) => inRing(lng, lat, h))) return true;
  }
  return false;
}
/** id da feição que contém o ponto; senão a mais próxima (até `tolDeg` graus de distância). */
export function locate(feats, lng, lat, tolDeg = 1.5) {
  for (const f of feats) if (contains(f, lng, lat)) return f.id;
  let best = null, bd = tolDeg * tolDeg;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const f of feats) for (const p of f.polys) {
    const [x0, y0, x1, y1] = p.box;
    if (lng < x0 - tolDeg || lng > x1 + tolDeg || lat < y0 - tolDeg || lat > y1 + tolDeg) continue;
    for (const r of p.rings) for (const [x, y] of r) {
      const d = ((x - lng) * k) ** 2 + (y - lat) ** 2;
      if (d < bd) { bd = d; best = f.id; }
    }
  }
  return best;
}

// Equal Earth (Šavrič et al.): projeção de áreas iguais, boa para mapa-múndi.
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796;
export function equalEarth(lng, lat) {
  const l = (lng * Math.PI) / 180, t = Math.asin((Math.sqrt(3) / 2) * Math.sin((lat * Math.PI) / 180)), t2 = t * t, t6 = t2 ** 3;
  return [(2 * Math.sqrt(3) * l * Math.cos(t)) / (3 * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))];
}
const BR_BOX = [-75, -34, -33, 6]; // descarta ilhas oceânicas distantes (Trindade etc.) para o mapa não ficar minúsculo
const brOutside = (r) => { const [x0, y0, x1, y1] = bboxOf([r]); return x0 > BR_BOX[2] || x1 < BR_BOX[0] || y0 > BR_BOX[3] || y1 < BR_BOX[1]; };

/** Caminhos SVG prontos: { viewBox, paths:[{id,d}] }. kind = "world" | "brazil". Pontos muito próximos são descartados (mapa leve). */
export function mapPaths(kind) {
  const feats = kind === "world" ? geo().world : geo().brazil;
  const proj = kind === "world" ? (x, y) => equalEarth(x, y) : (x, y) => [x * Math.cos((-14 * Math.PI) / 180), y];
  const k = kind === "world" ? 100 : 1;
  const minD = kind === "world" ? 0.45 : 0.06, minSize = kind === "world" ? 0.7 : 0.15;
  const thin = (q) => {
    const o = [q[0]];
    for (const p of q) { const l = o[o.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) >= minD) o.push(p); }
    return o;
  };
  const raw = feats.map((f) => {
    const segs = [];
    let first = null;
    for (const p of f.polys) for (const r of p.rings) {
      if (kind === "brazil" && brOutside(r)) continue;
      const q = r.map(([x, y]) => { const [px, py] = proj(x, y); return [px * k, -py * k]; });
      first ??= q;
      const t = thin(q);
      const [x0, y0, x1, y1] = bboxOf([t]);
      if (t.length >= 3 && Math.max(x1 - x0, y1 - y0) >= minSize) segs.push(t);
    }
    if (!segs.length && first) { // país minúsculo (Singapura, Maldivas...): um marcador clicável
      const [cx, cy] = first[0], h = minSize * 1.4;
      segs.push([[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]]);
    }
    return { id: f.id, segs };
  });
  const all = raw.flatMap((f) => f.segs.flat());
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
  const f1 = (n) => Math.round(n * 10) / 10;
  return {
    viewBox: `${f1(x0)} ${f1(y0)} ${f1(w)} ${f1(h)}`, width: w, height: h,
    paths: raw.map((f) => ({ id: f.id, d: f.segs.map((s) => "M" + s.map(([x, y]) => `${f1(x)} ${f1(y)}`).join("L") + "Z").join("") })),
  };
}

/** Visão ampliada de um estado: viewBox no estado e posição de cada destino (cidade) dentro dele, mesma projeção do mapa do Brasil. */
export function stateView(uf, dests) {
  const f = geo().brazil.find((x) => x.id === uf);
  if (!f) return null;
  const cx = Math.cos((-14 * Math.PI) / 180);
  const pts = [];
  for (const p of f.polys) for (const r of p.rings) { if (brOutside(r)) continue; for (const [x, y] of r) pts.push([x * cx, -y]); }
  if (!pts.length) return null;
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const padX = (x1 - x0) * 0.06 + 0.1, padY = (y1 - y0) * 0.06 + 0.1;
  x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;
  const w = x1 - x0, h = y1 - y0, f2 = (n) => Math.round(n * 100) / 100;
  const cities = (dests || []).filter((d) => d.uf === uf && d.lat != null && d.lng != null)
    .map((d) => ({ id: d.id, name: d.name, price: d.price_pp, x: d.lng * cx, y: -d.lat }));
  const inside = cities.filter((c) => c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1);
  return { viewBox: `${f2(x0)} ${f2(y0)} ${f2(w)} ${f2(h)}`, r: Math.max(w, h) / 48, cities: inside, outside: cities.length - inside.length };
}

/* ---------- destinos: país / estado / cidade ---------- */
const COUNTRY_BY_NAME = Object.fromEntries(Object.entries(COUNTRIES).map(([k, v]) => [norm(v.name), k]));
/** Anota cada destino com country_key (feição do mundo), country_a2, country_name, uf e uf_name. */
export function locateDestinations(dests) {
  const g = geo();
  return dests.map((d) => {
    const x = { ...d };
    let key = null;
    if (d.lat != null && d.lng != null) key = locate(g.world, d.lng, d.lat, 0.01);
    if (key == null) key = COUNTRY_BY_NAME[norm(d.country)] ?? null;
    if (key == null && d.lat != null && d.lng != null) key = locate(g.world, d.lng, d.lat, 2.5);
    const c = key != null ? COUNTRIES[key] : null;
    x.country_key = key;
    x.country_a2 = c?.a2 ?? null;
    x.country_name = c?.name ?? (d.country || "—");
    x.uf = null; x.uf_name = null;
    if (c?.a2 === "BR" && d.lat != null) {
      const uf = /noronha/i.test(d.name) ? "PE" : locate(g.brazil, d.lng, d.lat, 1.5);
      if (uf) { x.uf = uf; x.uf_name = BR_STATES[uf]; }
    }
    return x;
  });
}

/** Junta listas de várias varreduras: 1 destino por id, mantendo o menor preço. */
export function mergeDestinations(lists) {
  const m = new Map();
  for (const l of lists) for (const d of l) {
    const cur = m.get(d.id);
    if (!cur || d.price_pp < cur.price_pp) m.set(d.id, d);
  }
  return [...m.values()];
}

/** Menor preço (e quantidade) por chave: país ou estado. */
export function groupMin(dests, keyOf) {
  const m = new Map();
  for (const d of dests) {
    const k = keyOf(d);
    if (k == null) continue;
    const g = m.get(k) || { key: k, min: Infinity, count: 0, cheapest: null };
    g.count++;
    if (d.price_pp < g.min) { g.min = d.price_pp; g.cheapest = d; }
    m.set(k, g);
  }
  return m;
}

export const BANDS = [
  { max: 1000, color: "#1d6fb8", label: "Até R$ 1.000" },
  { max: 2000, color: "#f2a900", label: "R$ 1.000 a R$ 2.000" },
  { max: Infinity, color: "#c2412d", label: "Acima de R$ 2.000" },
];
/** Três faixas fixas de preço por pessoa, sem degradê: azul ≤ 1000, amarelo até 2000, vermelho acima. */
export function colorScale(prices) {
  const v = [...prices].sort((a, b) => a - b);
  const n = v.length;
  const color = (p) => (!n ? "#9aa4b2" : BANDS.find((b) => p <= b.max).color);
  return { color, min: n ? v[0] : null, max: n ? v[n - 1] : null, bands: BANDS };
}

/** Filtra e ordena: do menor para o maior preço. */
export function filterDestinations(dests, f = {}) {
  const q = norm(f.q);
  let l = dests.filter(
    (d) =>
      (!f.country || d.country_a2 === f.country || d.country_name === f.country) &&
      (!f.uf || d.uf === f.uf) &&
      (!f.city || d.name === f.city) &&
      (f.stops == null || f.stops === "" || f.stops === "any" || d.stops == null || d.stops <= Number(f.stops)) &&
      (!f.maxPrice || d.price_pp <= f.maxPrice) &&
      (!q || norm(d.name + " " + d.country_name + " " + (d.uf_name || "")).includes(q)),
  );
  l = l.sort((a, b) => a.price_pp - b.price_pp || a.name.localeCompare(b.name));
  return f.desc ? l.reverse() : l;
}
/** Opções para os filtros em cascata (país → estado → cidade), sempre coerentes com o que já foi escolhido. */
export function filterOptions(dests, f = {}) {
  const countries = new Map(), ufs = new Map(), cities = new Set();
  for (const d of dests) {
    if (d.country_a2) countries.set(d.country_a2, d.country_name);
    if (f.country && d.country_a2 !== f.country) continue;
    if (d.uf) ufs.set(d.uf, d.uf_name);
    if (f.uf && d.uf !== f.uf) continue;
    cities.add(d.name);
  }
  const byName = (a, b) => a[1].localeCompare(b[1], "pt-BR");
  return { countries: [...countries].sort(byName), ufs: [...ufs].sort(byName), cities: [...cities].sort((a, b) => a.localeCompare(b, "pt-BR")) };
}

