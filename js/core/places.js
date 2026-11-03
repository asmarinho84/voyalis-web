// Aeroportos e cidades: sugestões ao digitar, reconhecimento de "cidade ou código" e dados de localização.
import { AIRPORTS, METRO, NEARBY } from "../data/airports.js";
import { AIRPORT_DB } from "../data/airports-world.js";
import { COUNTRIES } from "../data/geo.js";
import { norm } from "./util.js";

export { AIRPORTS, METRO, NEARBY };
/** Lista curada (nomes em português, aeroportos mais usados no Brasil). */
export const AIRPORT = Object.fromEntries(AIRPORTS.map(([code, city, name, country]) => [code, { code, city, name, country }]));
/** Nome do país em português a partir do código ISO de 2 letras. */
export const COUNTRY_NAME = Object.fromEntries(Object.values(COUNTRIES).filter((c) => c.a2).map((c) => [c.a2, c.name]));

const known = (c) => !!(AIRPORT[c] || AIRPORT_DB[c] || METRO[c]);

/** Dados de um código IATA (ou metrópole SAO/RIO): cidade, país, coordenadas. */
export function airportInfo(code) {
  code = String(code || "").toUpperCase();
  const ref = METRO[code]?.[0] ?? code;
  const cur = AIRPORT[code] || AIRPORT[ref], db = AIRPORT_DB[ref];
  if (!cur && !db) return null;
  const a2 = cur?.country || db?.[2] || null;
  return {
    code, city: cur?.city || db?.[0] || code, region: db?.[1] || "", a2,
    country: COUNTRY_NAME[a2] || a2 || "", lat: db?.[3] ?? null, lng: db?.[4] ?? null,
    name: cur?.name || null,
  };
}
export const cityOf = (code) => airportInfo(code)?.city ?? code;

/** Sugestões para o campo de origem/destino: primeiro a lista curada, depois os ~7.900 aeroportos do mundo. */
export function suggestPlaces(q, limit = 12) {
  const nq = norm(q), up = String(q || "").trim().toUpperCase();
  if (nq.length < 2) return [];
  const out = [], seen = new Set();
  const push = (code, label) => { if (!seen.has(code) && out.length < limit) { seen.add(code); out.push({ code, label }); } };
  for (const [code, city, name, c] of AIRPORTS)
    if (code.startsWith(up) || norm(city).startsWith(nq) || norm(name).includes(nq)) push(code, `${city}, ${name}${c !== "BR" ? ", " + (COUNTRY_NAME[c] || c) : ""}`);
  if (up.length === 3 && AIRPORT_DB[up]) push(up, placeLabel(up));
  for (const [code, [city]] of Object.entries(AIRPORT_DB)) {
    if (out.length >= limit) break;
    if (norm(city).startsWith(nq)) push(code, placeLabel(code));
  }
  return out;
}
function placeLabel(code) {
  const [city, region, a2] = AIRPORT_DB[code];
  return [city, region && region !== city ? region : "", COUNTRY_NAME[a2] || a2].filter(Boolean).join(", ");
}

/** "NVT", "nvt", "NVT — Navegantes…" ou "Navegantes" → "NVT". null se não reconhecer. */
export function resolvePlace(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  const m = s.toUpperCase().match(/^([A-Z]{3})(?![A-Z])/);
  if (m && known(m[1]) && (s.length === 3 || /^[A-Za-z]{3}\s*[—·\-(]/.test(s))) return m[1];
  const q = norm(s.replace(/\(.*\)$/, ""));
  const cur = AIRPORTS.find((a) => norm(a[1]) === q);
  if (cur) return cur[0];
  for (const [code, [city]] of Object.entries(AIRPORT_DB)) if (norm(city) === q) return code;
  return null;
}

/** Aeroporto para um destino do Explorar que veio sem código: mesma cidade/país; senão o mais próximo (até 80 km). */
export function airportFor(name, a2, lat, lng) {
  const q = norm(name);
  const d2 = (x, y) => (lat == null ? 0 : ((x - lat) * 111) ** 2 + ((y - lng) * 111 * Math.cos((lat * Math.PI) / 180)) ** 2);
  let best = null, bd = Infinity;
  for (const [code, [city, , c, y, x]] of Object.entries(AIRPORT_DB)) {
    if (a2 && c !== a2) continue;
    const d = d2(y, x);
    if (norm(city) === q && d < bd) { best = code; bd = d; }
  }
  if (best || lat == null) return best;
  bd = 80 * 80;
  for (const [code] of AIRPORTS) {
    const r = AIRPORT_DB[code];
    if (r && d2(r[3], r[4]) < bd) { best = code; bd = d2(r[3], r[4]); }
  }
  return best;
}
