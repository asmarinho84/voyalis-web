// Indicadores do país de destino (Banco Mundial) e orçamento estimado da viagem.

export const INDICATORS = {
  homicide: { code: "VC.IHR.PSRC.P5", label: "Homicídios por 100 mil habitantes" },
  price_level: { code: "PA.NUS.PPPC.RF", label: "Nível geral de preços (PPC ÷ câmbio; EUA = 1)" },
  gdp_pc: { code: "NY.GDP.PCAP.CD", label: "PIB per capita (US$)" },
};
/** Faixas de referência (escolha deste app, não oficial): só ajudam a ler o número. */
export function safetyBand(h) {
  if (h == null) return null;
  return h < 2 ? { label: "baixo", level: "good" } : h < 6 ? { label: "moderado", level: "ok" } : h < 15 ? { label: "alto", level: "warn" } : { label: "muito alto", level: "bad" };
}
/** Compara o nível de preços do destino com o do Brasil: +20 = 20% mais caro que o Brasil. */
export function costVsBrazil(dest, br) {
  if (!(dest > 0) || !(br > 0)) return null;
  return Math.round((dest / br - 1) * 100);
}
export function buildIndicators(a2, tables) {
  const g = (k) => tables[k]?.[a2] ?? null;
  const h = g("homicide"), p = g("price_level"), pb = tables.price_level?.BR ?? null, gdp = g("gdp_pc");
  return {
    a2, homicide: h, safety: safetyBand(h?.value), price_level: p, cost_vs_brazil: costVsBrazil(p?.value, pb?.value), gdp_pc: gdp,
  };
}

/** Orçamento estimado: passagem (grupo) + hospedagem (noites x diária). Valores nulos ficam de fora e são sinalizados. */
export function tripBudget({ flight_pp = null, pax = 1, hotel_night = null, nights = 0, rooms = 1 }) {
  const flight = flight_pp != null ? flight_pp * pax : null;
  const hotel = hotel_night != null && nights > 0 ? hotel_night * nights * rooms : null;
  const total = (flight ?? 0) + (hotel ?? 0);
  return { flight, hotel, total: flight == null && hotel == null ? null : total, per_person: flight == null && hotel == null ? null : Math.round(total / pax), complete: flight != null && hotel != null };
}
