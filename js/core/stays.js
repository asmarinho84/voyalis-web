// Hospedagem e pontos turísticos: raio em km, destaques (menor preço, melhor avaliado, custo-benefício)
// e comparação das fontes de preço de cada hotel.
import { median, minBy, pct } from "./util.js";

export function distKm(lat1, lng1, lat2, lng2) {
  const r = (x) => (x * Math.PI) / 180, R = 6371;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
/** Mantém só os itens dentro de `km` do centro e anota `dist_km`. Itens sem coordenadas não dá para medir: saem e são contados. */
export function withinRadius(items, center, km) {
  const kept = [];
  let unknown = 0;
  for (const it of items) {
    if (it.lat == null || it.lng == null) { unknown++; continue; }
    const d = distKm(center.lat, center.lng, it.lat, it.lng);
    if (d <= km) kept.push({ ...it, dist_km: Math.round(d * 10) / 10 });
  }
  kept.sort((a, b) => a.dist_km - b.dist_km);
  return { items: kept, unknown, dropped: items.length - kept.length - unknown };
}
export function analyzeHotels(hotels) {
  const priced = hotels.filter((h) => h.price_night);
  if (!priced.length) return hotels;
  for (const h of hotels) h.tags ??= [];
  const cheapest = minBy(priced, (h) => h.price_night);
  cheapest.tags.push("Menor preço");
  const rated = priced.filter((h) => h.rating);
  if (rated.length) {
    const top = minBy(rated, (h) => -h.rating);
    if (top !== cheapest) top.tags.push("Melhor avaliado");
    const pool = rated.filter((h) => h.rating >= 3.75);
    const value = minBy(pool.length ? pool : rated, (h) => -(h.rating ** 3) / h.price_night);
    if (value !== cheapest && value !== top) value.tags.push("Melhor custo-benefício");
  }
  return priced.sort((a, b) => a.price_night - b.price_night);
}
export function analyzeTours(tours) {
  for (const t of tours) t.tags ??= [];
  const rated = tours.filter((t) => t.rating);
  if (rated.length) minBy(rated, (t) => -(t.rating * 1e6 + (t.reviews || 0))).tags.push("Mais bem avaliado");
  return tours;
}
/** Compara as fontes de preço de um hotel (sites de reservas x site oficial). Sinais de alerta, não prova de fraude. */
export function analyzeSources(sources) {
  const items = (sources || []).filter((x) => x.night > 0).map((x) => ({ ...x, flags: [] })).sort((a, b) => a.night - b.night);
  if (!items.length) return { items: [], min: null, official: null };
  const min = items[0].night;
  const official = items.find((x) => x.official) || null;
  const med = median(items.map((x) => x.night));
  for (const x of items) {
    x.diff_min = x.night - min;
    if (official) x.vs_official_pct = pct(x.night, official.night);
    if (official && !x.official && x.vs_official_pct <= -15)
      x.flags.push({ level: "alert", text: `${Math.abs(x.vs_official_pct)}% abaixo do site oficial do hotel: confira a reputação do site e o valor final no pagamento` });
    else if (!official && items.length >= 3 && x.night <= med * 0.7)
      x.flags.push({ level: "alert", text: "muito abaixo das outras fontes: confira a reputação do site e o valor final no pagamento" });
    if (official && !x.official && x.vs_official_pct >= 10) x.flags.push({ level: "info", text: `${x.vs_official_pct}% mais caro que o site oficial` });
  }
  return { items, min, official };
}

