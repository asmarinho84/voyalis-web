// Utilitários puros: datas (AAAA-MM-DD, aritmética em UTC), dinheiro, texto e links diretos para os sites de reserva.

const pad = (n) => String(n).padStart(2, "0");
export const todayISO = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const toUTC = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export function addDays(s, n) {
  const d = new Date(toUTC(s) + n * 864e5);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export const diffDays = (a, b) => Math.round((toUTC(a) - toUTC(b)) / 864e5);
export const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && addDays(s, 0) === s;

export const money = (v) => "R$ " + Math.round(v).toLocaleString("pt-BR");
export const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const minBy = (arr, f) => arr.reduce((best, x) => (best === undefined || f(x) < f(best) ? x : best), undefined);
export const median = (a) => {
  const v = [...a].sort((x, y) => x - y), m = v.length >> 1;
  return v.length ? (v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2) : null;
};
export const pct = (a, b) => Math.round(((a - b) / b) * 100);
export const clampInt = (v, lo, hi, def) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
};
export const CABINS = ["economy", "premium", "business", "first"];

/* ---------- links diretos (funcionam sem chave nenhuma) ---------- */
const qp = (s) => encodeURIComponent(s).replace(/%20/g, "+");

export function flightLinks(o, d, dep, ret, adults, children) {
  const gq = `Flights from ${o} to ${d} on ${dep}` + (ret ? ` through ${ret}` : "");
  const yy = (s) => s.slice(2, 4) + s.slice(5, 7) + s.slice(8, 10);
  const dd = ret ? `${dep}/${ret}` : dep;
  return {
    "Google Flights": `https://www.google.com/travel/flights?hl=pt-BR&curr=BRL&q=${qp(gq)}`,
    Skyscanner: `https://www.skyscanner.com.br/transporte/passagens-aereas/${o.toLowerCase()}/${d.toLowerCase()}/${yy(dep)}/${ret ? yy(ret) + "/" : ""}?adultsv2=${adults}&currency=BRL&rtn=${ret ? 1 : 0}`,
    Decolar: `https://www.decolar.com/shop/flights/results/${ret ? "roundtrip" : "oneway"}/${o}/${d}/${dd}/${adults}/${children}/0`,
    Kayak: `https://www.kayak.com.br/flights/${o}-${d}/${dd}/${adults}adults?sort=price_a`,
  };
}

export function hotelLinks(city, checkin, checkout, adults, children, rooms = 1, name = null) {
  return {
    Booking: `https://www.booking.com/searchresults.pt-br.html?ss=${qp(name ? `${name} ${city}` : city)}&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&group_children=${children}&no_rooms=${rooms}&selected_currency=BRL&order=price`,
    "Google Hotéis": `https://www.google.com/travel/search?q=${qp("hotéis em " + city)}&hl=pt-BR&curr=BRL`,
    Airbnb: `https://www.airbnb.com.br/s/${encodeURIComponent(city)}/homes?checkin=${checkin}&checkout=${checkout}&adults=${adults}&children=${children}`,
  };
}

export function tourLinks(city, dep, ret) {
  return {
    GetYourGuide: `https://www.getyourguide.com.br/s/?q=${qp(city)}&date_from=${dep}&date_to=${ret || dep}`,
    Viator: `https://www.viator.com/pt-BR/searchResults/all?text=${qp(city)}`,
    Civitatis: `https://www.civitatis.com/br/busca/?q=${qp(city)}`,
    Google: `https://www.google.com/search?q=${qp("pontos turísticos em " + city)}`,
  };
}

export const safetyLink = (place) => `https://www.google.com/search?q=${qp("segurança para turistas em " + place)}`;
export const costLink = (place) => `https://www.google.com/search?q=${qp("custo de vida e preços para turistas em " + place)}`;
export const mapLink = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
