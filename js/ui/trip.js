// Resultado de "Planejar viagem": resumo (cartão de embarque), voos, calendário, hospedagem, atrações, destino e alertas.
import * as C from "../core/index.js";
import { CABIN_TXT, brl, dur, esc, extLink, fdate, fdateLong, flagsHTML, icon, linkRow, num, plural, rating, stopsTxt, tagsHTML, thumb } from "./kit.js";

export const newTripState = () => ({ tab: "summary", fl: { sort: "price", stops: "any", airline: "", hidden: false, dates: null }, hsort: "price", flimit: 30 });

const pax = (r) => r.req.adults + r.req.children;
const paxTxt = (q) => [plural(q.adults, "adulto", "adultos"), q.children ? plural(q.children, "criança", "crianças") : ""].filter(Boolean).join(", ");
const kindTxt = (o) => (o.kind === "oneway" ? "só ida" : o.kind === "split" ? "2 bilhetes" : "ida e volta");
const hasMatrix = (r) => Object.keys(r.matrix.cells).length > 1;
const errBox = (r) => (r.errors || []).length ? `<div class="warnbox" style="margin:12px 0">Algumas partes da pesquisa não responderam: ${r.errors.map(esc).join("; ")}.</div>` : "";

export function tripTabs(r, alerts = 0) {
  if (r.quick) return [["summary", "Resumo", ""], ["dest", "Destino", ""]];
  return [
    ["summary", "Resumo", ""], ["flights", "Voos", r.flights.length],
    ...(hasMatrix(r) ? [["matrix", "Calendário", ""]] : []),
    ["hotels", "Hospedagem", r.hotels.length], ["tours", "Atrações", r.tours.length],
    ["dest", "Destino", ""], ["alerts", "Alertas", alerts || ""],
  ];
}

export function tripPanel(r, st, ctx) {
  switch (st.tab) {
    case "flights": return flightsHTML(r, st);
    case "matrix": return matrixHTML(r);
    case "hotels": return hotelsHTML(r, st);
    case "tours": return toursHTML(r);
    case "dest": return destHTML(r);
    case "alerts": return alertsHTML(r, ctx);
    default: return summaryHTML(r);
  }
}

/* ---------- resumo ---------- */
function passHTML(r) {
  const q = r.req, b = r.budget.cheapest, n = pax(r);
  const total = r.quick && r.noPrices
    ? `<div class="total"><div><small>Compare os preços desta viagem</small><b style="font-size:20px">Abra os sites abaixo: a rota, as datas e os passageiros já vão preenchidos</b></div></div>`
    : r.quick
    ? `<div class="total"><div><small>Preços reais desta viagem</small><b style="font-size:20px">Conecte sua chave grátis para ver voos, hotéis e o custo total</b></div></div>
       <button class="btn" type="button" data-key style="margin-top:12px">${icon.key} Conectar chave (2 minutos)</button>`
    : b.total != null
    ? `<div class="total"><div><small>Viagem estimada para ${plural(n, "pessoa", "pessoas")}</small><span class="num">${brl(b.total)}</span></div>
       <div style="text-align:right"><small>por pessoa</small><b class="num" style="font-size:26px">${brl(b.per_person)}</b></div></div>
       <p class="tiny muted" style="margin:8px 0 0">${[b.flight != null ? `Passagens ${brl(b.flight)}` : "Passagens: sem preço nesta pesquisa", b.hotel != null ? `${plural(r.stay.nights, "noite", "noites")} no hotel mais barato ${brl(b.hotel)}` : "hospedagem: sem preço nesta pesquisa"].join(" + ")}. Bagagem, alimentação e passeios não estão incluídos.</p>`
    : `<div class="total"><div><small>Viagem estimada</small><span class="num">—</span></div></div><p class="tiny muted" style="margin:8px 0 0">Sem preços de voo e hospedagem nesta pesquisa.</p>`;
  return `<div class="card pass"><div class="main">
    <div class="codes"><div><div class="code">${esc(q.origin)}</div><div class="city">${esc(r.origin.city)}</div></div>
      <div class="flight">${icon.plane}</div>
      <div><div class="code">${esc(q.destination)}</div><div class="city">${esc(r.dest.city)}${r.dest.a2 && r.dest.a2 !== "BR" ? ", " + esc(r.dest.country) : ""}</div></div></div>
    <div class="meta"><div><small>Ida</small><b>${fdateLong(q.depart_date)}</b></div><div><small>Volta</small><b>${q.return_date ? fdateLong(q.return_date) : "Só ida"}</b></div>
      <div><small>Passageiros</small><b>${paxTxt(q)}</b></div><div><small>Classe</small><b>${CABIN_TXT[q.cabin]}</b></div></div>
  </div><div class="stub">${total}</div></div>`;
}

const fact = (ic, t, v, d, tab) => `<div class="fact"><div class="ic">${ic}</div><div><div class="t">${t}</div><div class="v">${v}</div>${d ? `<div class="d">${d}</div>` : ""}</div>${tab ? `<button class="go-tab" data-go="${tab}">Ver</button>` : "<span></span>"}</div>`;

function quickHTML(r) {
  const i = r.indicators, d = r.dest;
  return passHTML(r) + `<div class="card sec" style="margin-top:14px"><h3>${icon.plane} Compare as passagens nos sites</h3>
    <p class="muted small">Links já preenchidos com a sua rota, datas e passageiros.</p>${linkRow(r.links.flights)}</div>
    <div class="card sec"><h3>${icon.bed} Hospedagem em ${esc(d.city)}</h3>${linkRow(r.links.hotels)}</div>
    <div class="card sec"><h3>${icon.pin} Passeios e atrações</h3>${linkRow(r.links.tours)}</div>
    ${i ? `<div class="card facts">${fact(icon.shield, `Destino: ${esc(d.country || d.city)}`, i.safety ? `Violência ${i.safety.label}` : "Segurança sem dado",
      i.cost_vs_brazil == null ? "" : i.a2 === "BR" ? "custo de vida do Brasil" : `custo de vida ${Math.abs(i.cost_vs_brazil)}% ${i.cost_vs_brazil > 0 ? "maior" : "menor"} que no Brasil`, "dest")}</div>` : ""}` + errBox(r);
}

function summaryHTML(r) {
  if (r.quick) return quickHTML(r);
  const q = r.req, best = r.flights[0];
  const facts = [];
  if (best) {
    const other = best.depart_date !== q.depart_date || best.return_date !== q.return_date;
    facts.push(fact(icon.plane, "Melhor voo", `${brl(best.price_pp)} por pessoa`,
      [esc(best.airline), stopsTxt(best.outbound.stops), dur(best.total_duration_min), other ? `datas ${fdate(best.depart_date)}${best.return_date ? " e " + fdate(best.return_date) : ""}` : "", best.confirmed ? "volta confirmada" : "", best.kind === "split" ? "2 bilhetes separados" : ""].filter(Boolean).join(", "), "flights"));
    const hidden = r.flights.filter((o) => o.saving_vs_exact).sort((a, b) => b.saving_vs_exact - a.saving_vs_exact)[0];
    facts.push(fact(icon.tag, "Oferta escondida", hidden ? `Economia de até ${brl(hidden.saving_vs_exact)} por pessoa` : "Suas datas já têm o menor preço",
      hidden ? (hidden.kind === "split" ? "comprando ida e volta em bilhetes separados" : `viajando ${fdate(hidden.depart_date)}${hidden.return_date ? " a " + fdate(hidden.return_date) : ""}${hidden.tags.includes("Aeroporto alternativo") ? ` por ${hidden.origin}→${hidden.destination}` : ""}`) : (q.flex ? "nenhuma data vizinha saiu mais barata" : "ative as datas flexíveis em Mais opções para procurar"), hidden ? "flights" : null));
  } else facts.push(fact(icon.plane, "Voos", "Nenhuma oferta encontrada", "Tente outras datas ou ative as datas flexíveis e os aeroportos próximos.", null));
  if (r.insights?.level) {
    const lv = { low: "Preço baixo para a rota", typical: "Preço típico para a rota", high: "Preço alto para a rota" }[r.insights.level] || r.insights.level;
    facts.push(fact(icon.star, "Avaliação do Google", lv, r.insights.typical_low ? `faixa comum: ${brl(r.insights.typical_low)} a ${brl(r.insights.typical_high)} por pessoa` : "", null));
  }
  const sold = r.flights.find((o) => o.sellers?.length);
  if (sold) {
    const s0 = sold.sellers[0], alerts = sold.sellers.filter((x) => x.flags.some((f) => f.level === "alert")).length;
    facts.push(fact(icon.cart, "Onde comprar", `${esc(s0.seller)}, ${brl(s0.price)} por pessoa`,
      [`voo ${esc(sold.airline)} de ${brl(sold.price_pp)}`, sold.seller_official ? `na companhia: ${brl(sold.seller_official)}` : "companhia não listada", alerts ? plural(alerts, "vendedor com aviso", "vendedores com aviso") : ""].filter(Boolean).join(", "), "flights"));
  }
  if (r.hotels.length) {
    const h = r.hotels[0], v = r.hotels.find((x) => x.tags?.includes("Melhor custo-benefício"));
    facts.push(fact(icon.bed, "Hospedagem", `A partir de ${brl(h.price_night)} por noite`, `${esc(h.name)}${v && v !== h ? `; melhor custo-benefício: ${esc(v.name)}, ${brl(v.price_night)}${v.rating ? ", nota " + rating(v.rating) : ""}` : ""}`, "hotels"));
  } else if (r.req.hotels) facts.push(fact(icon.bed, "Hospedagem", "Sem hotéis nesta pesquisa", "", null));
  if (r.tours.length) facts.push(fact(icon.pin, "Atrações", plural(r.tours.length, "lugar para visitar", "lugares para visitar"), r.tours.slice(0, 3).map((t) => esc(t.name)).join(", "), "tours"));
  const i = r.indicators;
  if (i) facts.push(fact(icon.shield, `Destino: ${esc(r.dest.country || r.dest.city)}`, i.safety ? `Violência ${i.safety.label}` : "Segurança sem dado",
    i.cost_vs_brazil == null ? "" : i.a2 === "BR" ? "custo de vida do Brasil" : `custo de vida ${Math.abs(i.cost_vs_brazil)}% ${i.cost_vs_brazil > 0 ? "maior" : "menor"} que no Brasil`, "dest"));

  const intl = r.dest.a2 && r.dest.a2 !== "BR";
  const tips = [
    "Confira o valor final no pagamento: taxas, bagagem despachada e assento podem mudar o total.",
    best?.seller_official ? "Se a diferença for pequena, prefira comprar direto na companhia: alterações e reembolsos ficam mais simples." : "Compare o preço na companhia aérea antes de comprar numa agência.",
    r.flights.some((o) => o.kind === "split") ? "Bilhetes separados não protegem a conexão: deixe folga entre os voos." : "",
    intl ? `Viagem internacional: confira passaporte, visto, vacinas e seguro viagem exigidos por ${esc(r.dest.country)}.` : "",
    "Os preços mudam rápido. Se não for comprar agora, crie um alerta na aba Alertas.",
  ].filter(Boolean);
  return passHTML(r) + `<div class="card facts">${facts.join("")}</div>` +
    `<div class="card sec" style="margin-top:14px"><h3>${icon.ticket} Antes de comprar</h3><ul class="checklist">${tips.map((t) => `<li>${t}</li>`).join("")}</ul></div>` + errBox(r);
}

/* ---------- voos ---------- */
function legHTML(leg, from, to, label, date) {
  if (!leg) return `<div class="leg"><div class="lbl">${label}<br><span style="font-weight:500">${fdateLong(date)}</span></div><div class="m">Horário da volta: toque em “Ver volta e confirmar preço”.</div><div></div></div>`;
  const route = leg.dep_time
    ? `<div class="route"><div><div class="t">${esc(leg.dep_time)}</div><div class="m">${esc(from)}</div></div><div class="line"></div><div style="text-align:right"><div class="t">${esc(leg.arr_time)}${leg.arr_day_offset ? `<sup>+${leg.arr_day_offset}</sup>` : ""}</div><div class="m">${esc(to)}</div></div></div>`
    : `<div class="route"><div class="t">${esc(from)}</div><div class="line"></div><div class="t">${esc(to)}</div></div>`;
  return `<div class="leg"><div class="lbl">${label}<br><span style="font-weight:500">${fdateLong(date)}</span></div>${route}
    <div class="info">${dur(leg.duration_min)}<br>${stopsTxt(leg.stops)}${leg.via ? ` (${esc(leg.via)})` : ""}${leg.airline ? "<br>" + esc(leg.airline) : ""}</div></div>`;
}
function sellersHTML(o) {
  if (!o.sellers) return "";
  const rows = o.sellers.map((x, i) => `<tr><td><b>${esc(x.seller)}</b>${x.airline ? ' <span class="tag good">Companhia</span>' : ""}
      <div class="muted tiny">${[x.fare, ...(x.conditions || [])].filter(Boolean).map(esc).join(", ")}</div>
      ${(x.baggage || []).length ? `<div class="muted tiny">Bagagem: ${x.baggage.map(esc).join(", ")}</div>` : ""}${flagsHTML(x.flags)}</td>
      <td><b>${brl(x.price)}</b><div class="muted tiny">${i === 0 ? "menor preço" : "+" + brl(x.diff_min)}${x.vs_official_pct != null && !x.airline ? `, ${x.vs_official_pct > 0 ? "+" : ""}${x.vs_official_pct}% vs. companhia` : ""}</div>
      ${x.request ? `<button class="btn line sm" style="margin-top:6px" data-buy="${esc(o.id)}:${i}">Abrir ${icon.out}</button>` : ""}</td></tr>`).join("");
  return `<div class="sellers full"><b>Onde comprar</b> <span class="muted small">(preço por pessoa, ida e volta)</span><table>${rows}</table>
    ${(o.seller_notes || []).map((n) => `<div class="muted tiny" style="margin-top:6px">${esc(n)}</div>`).join("")}
    ${o.seller_separate ? `<div class="muted tiny">${plural(o.seller_separate, "opção", "opções")} com bilhetes separados não exibida(s).</div>` : ""}
    <div class="muted tiny" style="margin-top:8px">Os avisos comparam preços; não provam nem descartam fraude. Prefira vendedores que você conhece e confira o valor final no pagamento.</div></div>`;
}
const tagCls = (t) => (t === "Menor preço" || t === "Escondida" ? "sun" : t === "Volta confirmada" || t === "Mais rápido" || t === "Melhor equilíbrio" ? "good" : /separados|alternativo|Outras datas/.test(t) ? "warn" : "");
function offerHTML(o, r) {
  const n = pax(r);
  return `<div class="card offer"><div>
    <div class="tags">${tagsHTML([...o.tags, ...(o.confirmed ? ["Volta confirmada"] : [])], tagCls)}</div>
    <div class="air">${esc(o.airline)} <span class="muted small">${esc(o.outbound.flight_no || "")}</span></div>
    ${legHTML(o.outbound, o.origin, o.destination, "Ida", o.depart_date)}
    ${o.return_date ? legHTML(o.inbound, o.destination, o.origin, "Volta", o.return_date) : ""}
    ${o.warning ? `<div class="warnbox" style="margin-top:8px">${esc(o.warning)}</div>` : ""}</div>
    <div class="price"><span class="big">${brl(o.price_pp)}</span><small>por pessoa, ${kindTxt(o)}${n > 1 ? `; ${brl(o.price_total)} para ${n}` : ""}</small>
      ${o.saving_vs_exact ? `<span class="save">${brl(o.saving_vs_exact)} a menos que nas suas datas</span>` : ""}
      <small style="margin-top:6px">Fonte: Google Flights${o.sellers?.[0] ? `; menor preço em ${esc(o.sellers[0].seller)}` : ""}.</small>
      <div class="acts">${o.token && !o.inbound && o.return_date ? `<button class="btn sm" data-detail="${esc(o.id)}">Ver volta e confirmar preço (1 busca)</button>` : ""}
      ${o.booking_token && !o.sellers ? `<button class="btn sm" data-sellers="${esc(o.id)}">Comparar onde comprar (1 busca)</button>` : ""}</div>
      ${linkRow(o.links)}</div>${sellersHTML(o)}</div>`;
}
export function filteredFlights(r, f) {
  let L = r.flights.slice();
  if (f.dates) L = L.filter((o) => o.depart_date === f.dates[0] && o.return_date === f.dates[1]);
  if (f.stops === "direct") L = L.filter((o) => o.outbound.stops === 0 && (!o.inbound || o.inbound.stops === 0));
  if (f.stops === "1") L = L.filter((o) => o.outbound.stops <= 1 && (!o.inbound || o.inbound.stops <= 1));
  if (f.airline) L = L.filter((o) => o.airline.includes(f.airline));
  if (f.hidden) L = L.filter((o) => o.tags.includes("Escondida"));
  if (f.sort === "dur") L.sort((a, b) => a.total_duration_min - b.total_duration_min);
  else if (f.sort === "dep") L.sort((a, b) => (a.outbound.dep_time || "").localeCompare(b.outbound.dep_time || ""));
  else L.sort((a, b) => a.price_pp - b.price_pp);
  return L;
}
function flightsHTML(r, st) {
  const f = st.fl, airlines = [...new Set(r.flights.flatMap((o) => o.airline.split(/ \/ | \+ /)))].sort();
  const L = filteredFlights(r, f), sel = (v, o) => (v === o ? "selected" : "");
  let h = `<div class="filters">
    <div><label for="fSort">Ordenar</label><select id="fSort"><option value="price" ${sel(f.sort, "price")}>Menor preço</option><option value="dur" ${sel(f.sort, "dur")}>Menor duração</option><option value="dep" ${sel(f.sort, "dep")}>Horário de partida</option></select></div>
    <div><label for="fStops">Paradas</label><select id="fStops"><option value="any">Qualquer</option><option value="direct" ${sel(f.stops, "direct")}>Só direto</option><option value="1" ${sel(f.stops, "1")}>Até 1 parada</option></select></div>
    <div><label for="fAir">Companhia</label><select id="fAir"><option value="">Todas</option>${airlines.map((a) => `<option ${sel(f.airline, a)}>${esc(a)}</option>`).join("")}</select></div></div>
    <div class="filters"><label class="chk"><input type="checkbox" id="fHid" ${f.hidden ? "checked" : ""}> Só ofertas escondidas</label>
    ${f.dates ? `<button class="btn ghost sm" id="fClr">Datas ${fdate(f.dates[0])} e ${fdate(f.dates[1])}: mostrar todas</button>` : ""}</div>
    <p class="muted small">${plural(L.length, "oferta", "ofertas")}. Abrir esta pesquisa nos sites:</p>${linkRow(r.links.flights)}`;
  if (!L.length) return h + `<div class="card empty">Nenhuma oferta com esses filtros.</div>` + errBox(r);
  h += L.slice(0, st.flimit).map((o) => offerHTML(o, r)).join("");
  if (L.length > st.flimit) h += `<button class="btn ghost block" id="fMore">Mostrar mais ${L.length - st.flimit}</button>`;
  return h + errBox(r);
}

/* ---------- calendário ---------- */
function matrixHTML(r) {
  const m = r.matrix, vals = Object.values(m.cells), lo = Math.min(...vals);
  let h = `<p class="muted small">Menor preço por pessoa para cada combinação de ida (linhas) e volta (colunas). Toque num preço para ver os voos.</p><div class="card heatwrap"><table class="heat"><tr><th>Ida \\ Volta</th>${m.ret_dates.map((x) => `<th>${fdateLong(x)}</th>`).join("")}</tr>`;
  for (const d of m.dep_dates) {
    h += `<tr><th>${fdateLong(d)}</th>`;
    for (const x of m.ret_dates) {
      const v = m.cells[d + "|" + x];
      if (v == null) { h += `<td class="none">—</td>`; continue; }
      h += `<td class="${[d === r.req.depart_date && x === r.req.return_date ? "req" : "", v === lo ? "min" : ""].join(" ")}" data-d="${d}" data-r="${x}">${brl(v)}</td>`;
    }
    h += "</tr>";
  }
  return h + `</table></div><p class="muted small">Em destaque: o menor preço. Com contorno: as datas que você escolheu.</p>`;
}

/* ---------- hospedagem ---------- */
function sourcesHTML(x) {
  const a = C.analyzeSources(x.sources);
  if (!a.items.length) return `<div class="muted tiny" style="margin-top:6px">Fonte: Google Hotéis.</div>`;
  const rows = a.items.map((y, i) => `<tr><td><b>${esc(y.source)}</b>${y.official ? ' <span class="tag good">Site oficial</span>' : ""}${flagsHTML(y.flags)}</td>
    <td><b>${brl(y.night)}</b><div class="muted tiny">${i === 0 ? "menor preço" : "+" + brl(y.diff_min)}${y.vs_official_pct != null && !y.official ? `, ${y.vs_official_pct > 0 ? "+" : ""}${y.vs_official_pct}% vs. oficial` : ""}</div></td></tr>`).join("");
  return `<div class="muted tiny" style="margin-top:6px">Menor preço em <b>${esc(a.items[0].source)}</b>${a.official ? "" : "; site oficial não listado"}.</div>
    <details class="src"><summary>Comparar ${plural(a.items.length, "site", "sites")} (por noite)</summary><table>${rows}</table>
    <div class="muted tiny" style="margin-top:6px">Os avisos comparam preços; não provam fraude. Confira as taxas no pagamento.</div></details>`;
}
function hotelHTML(x, r) {
  const where = x.address ? esc(x.address) : `${esc(r.dest.city)}${x.token ? ` <span class="muted">(toque em Ver endereço)</span>` : ""}`;
  const extra = [x.nearby?.length ? "Perto de " + x.nearby.map(esc).join(", ") : "", x.location_rating ? `localização ${rating(x.location_rating)}/5` : "", x.phone ? esc(x.phone) : ""].filter(Boolean).join("; ");
  const maps = x.directions || (x.lat != null ? C.mapLink(x.lat, x.lng) : "");
  return `<div class="card place">${thumb(x.thumbnail, icon.bed)}<div>
    <div class="tags">${tagsHTML(x.tags, (t) => (t === "Menor preço" ? "sun" : "good"))}</div>
    <div class="nm">${esc(x.name)}</div>
    <div class="small">${x.stars ? `<span class="stars" aria-label="${x.stars} estrelas">${"★".repeat(x.stars)}</span> ` : ""}${x.rating ? `<span class="rate">${rating(x.rating)}/5</span> <span class="muted">${x.reviews ? x.reviews.toLocaleString("pt-BR") + " avaliações" : ""}</span>` : ""}</div>
    <div class="small" style="margin-top:4px">${icon.pin} ${where}${x.dist_km != null ? ` <b>a ${num(x.dist_km)} km</b>` : ""}</div>
    ${extra ? `<div class="muted tiny" style="margin-top:2px">${extra}</div>` : ""}${sourcesHTML(x)}</div>
    <div class="side"><div class="price"><span class="big" style="font-size:28px">${brl(x.price_night)}</span><small>por noite; ${brl(x.price_total)} por ${plural(x.nights || r.stay.nights, "noite", "noites")}</small></div>
      <div style="display:grid;gap:8px">${x.token && !x.address ? `<button class="btn line sm" data-hotel="${esc(x.id)}">Ver endereço (1 busca)</button>` : ""}
      <div class="links">${maps ? extLink(maps, "Mapa") : ""}${extLink(x.link, "Ver oferta")}</div></div></div></div>`;
}
function hotelsHTML(r, st) {
  if (!r.req.hotels) return `<div class="card empty">A hospedagem não foi incluída nesta pesquisa.</div>`;
  const L = r.hotels.slice(), s = st.hsort;
  if (s === "rating") L.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (s === "value") L.sort((a, b) => (b.rating || 3) ** 3 / b.price_night - (a.rating || 3) ** 3 / a.price_night);
  else if (s === "dist") L.sort((a, b) => (a.dist_km ?? 1e9) - (b.dist_km ?? 1e9));
  else L.sort((a, b) => a.price_night - b.price_night);
  const sel = (v) => (s === v ? "selected" : "");
  return `<p class="muted small">${fdateLong(r.stay.checkin)} a ${fdateLong(r.stay.checkout)}, ${plural(r.stay.nights, "noite", "noites")}, ${paxTxt(r.req)}${r.req.hotel_area ? `, perto de ${esc(r.req.hotel_area)}` : ""}${r.req.hotel_km && r.center ? `, até ${r.req.hotel_km} km` : ""}.</p>
    <div class="filters"><div><label for="hSort">Ordenar</label><select id="hSort"><option value="price" ${sel("price")}>Menor preço</option><option value="rating" ${sel("rating")}>Melhor avaliação</option><option value="value" ${sel("value")}>Custo-benefício</option>${r.center ? `<option value="dist" ${sel("dist")}>Mais perto</option>` : ""}</select></div></div>
    ${linkRow(r.links.hotels)}${L.length ? L.map((x) => hotelHTML(x, r)).join("") : `<div class="card empty">Nenhum hotel com preço nesta pesquisa. Use os links acima.</div>`}`;
}

/* ---------- atrações ---------- */
function toursHTML(r) {
  if (!r.req.tours) return `<div class="card empty">As atrações não foram incluídas nesta pesquisa.</div>`;
  const card = (t) => `<div class="card place">${thumb(t.thumbnail, icon.pin)}<div>
    <div class="tags">${tagsHTML(t.tags, () => "good")}</div><div class="nm">${esc(t.name)}</div>
    <div class="small">${t.rating ? `<span class="rate">${rating(t.rating)}/5</span> ` : ""}<span class="muted">${t.reviews ? t.reviews.toLocaleString("pt-BR") + " avaliações" : ""}</span></div>
    ${t.address ? `<div class="small" style="margin-top:4px">${icon.pin} ${esc(t.address)}${t.dist_km != null ? ` <b>a ${num(t.dist_km)} km</b>` : ""}</div>` : ""}
    <div class="muted tiny" style="margin-top:2px">${[t.kind, t.description].filter(Boolean).map(esc).join("; ")}</div></div>
    <div class="side"><span class="muted tiny">Horários e ingressos no mapa</span><div class="links">${extLink(t.link, "Ver no mapa")}</div></div></div>`;
  return `<p class="muted small">Lugares e atrações de ${esc(r.dest.city)}. Agências e lojas de turismo ficam de fora. Passeios guiados com preço:</p>${linkRow(r.links.tours)}
    ${r.tours.length ? r.tours.map(card).join("") : `<div class="card empty">Nenhuma atração encontrada. Use os links acima.</div>`}`;
}

/* ---------- destino ---------- */
export function indicatorsHTML(i, place, links) {
  const row = (k, v) => `<div class="stat"><span>${k}</span><span>${v}</span></div>`;
  const none = '<span class="muted">sem dado</span>';
  if (!i) return `<p class="muted small">Indicadores indisponíveis agora. Use os links abaixo.</p>${linkRow(links)}`;
  return row("Homicídios por 100 mil habitantes", i.homicide ? `<b>${num(i.homicide.value)}</b> <span class="muted tiny">(${esc(i.homicide.year)})</span> ${i.safety ? `<span class="band ${i.safety.level}">${i.safety.label}</span>` : ""}` : none)
    + row("Custo de vida comparado ao Brasil", i.cost_vs_brazil == null ? none : i.a2 === "BR" ? '<span class="muted">é o Brasil</span>' : `<b>${Math.abs(i.cost_vs_brazil)}% ${i.cost_vs_brazil > 0 ? "mais caro" : "mais barato"}</b>`)
    + row("Nível geral de preços", i.price_level ? `${num(i.price_level.value, 2)} <span class="muted tiny">(EUA = 1; ${esc(i.price_level.year)})</span>` : none)
    + row("PIB por habitante", i.gdp_pc ? `US$ ${num(i.gdp_pc.value, 0)} <span class="muted tiny">(${esc(i.gdp_pc.year)})</span>` : none)
    + `<p class="muted tiny" style="margin-top:8px">Dados do país (${esc(place)}), Banco Mundial. A violência e o custo variam muito entre cidades e bairros: consulte também as informações locais.</p>${linkRow(links)}`;
}
function destHTML(r) {
  const d = r.dest, links = { [`Segurança em ${d.city}`]: r.links.safety, [`Custo de vida em ${d.city}`]: r.links.cost, ...(d.lat != null ? { "Ver no mapa": C.mapLink(d.lat, d.lng) } : {}) };
  return `<div class="card sec"><h3>${icon.pin} ${esc(d.city)}${d.region && d.region !== d.city ? ", " + esc(d.region) : ""}</h3>
    <p class="muted small">${esc(d.country)}. ${C.METRO[r.req.destination] ? `Aeroportos ${C.METRO[r.req.destination].join(", ")}` : `Aeroporto ${esc(r.req.destination)}${d.name ? ` (${esc(d.name)})` : ""}`}.</p></div>
    <div class="card sec"><h3>${icon.shield} Segurança e custo de vida</h3>${indicatorsHTML(r.indicators, d.country || d.city, links)}</div>`;
}

/* ---------- alertas ---------- */
function spark(h) {
  if (!h || h.length < 2) return '<span class="muted tiny">O gráfico aparece depois da 2ª checagem.</span>';
  const v = h.map((x) => x.best_price), lo = Math.min(...v), hi = Math.max(...v), W = 180, H = 40;
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * W},${H - 4 - (hi === lo ? 0.5 : (y - lo) / (hi - lo)) * (H - 8)}`).join(" ");
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-label="Histórico de preço"><polyline fill="none" stroke="var(--brand)" stroke-width="2" points="${pts}"/></svg>`;
}
export function alertsHTML(r, ctx) {
  let h = "";
  if (r) {
    const q = r.req;
    h += `<div class="card sec"><h3>${icon.bell} Acompanhar ${esc(q.origin)} → ${esc(q.destination)}</h3>
      <p class="muted small">${fdate(q.depart_date)}${q.return_date ? " a " + fdate(q.return_date) : ""}, ${paxTxt(q)}${q.flex ? `, datas ±${q.flex} dia(s)` : ""}. Preço atual: ${brl(r.flights[0]?.price_pp)} por pessoa.</p>
      <div class="grid"><div class="c4"><label for="wTarget">Avisar abaixo de (R$ por pessoa)</label><input type="number" id="wTarget" min="0" inputmode="numeric" placeholder="${r.flights[0] ? Math.round(r.flights[0].price_pp * 0.9) : ""}"></div>
      <div class="c4"><label for="wDrop">Ou se cair (%)</label><input type="number" id="wDrop" min="1" max="90" value="5" inputmode="numeric"></div>
      <div class="c4"><label for="wInt">Checar a cada</label><select id="wInt"><option value="180">3 horas</option><option value="360">6 horas</option><option value="720">12 horas</option><option value="1440" selected>24 horas</option></select></div></div>
      <div class="go"><button class="btn" id="wAdd" type="button">Criar alerta</button><span class="hint">Cada checagem usa até ${ctx.monitorCalls} buscas.</span></div></div>`;
  }
  h += `<p class="muted small">O Android não deixa o app consultar preços fechado: os alertas são checados enquanto ele está aberto e sempre que você o abre.</p>`;
  if (ctx.alerts.length) h += `<h3>Avisos</h3>` + ctx.alerts.slice(0, 15).map((a) => `<div class="alertrow">${esc(a.message)}<small>${esc(a.ts.replace("T", " ").slice(0, 16))}</small></div>`).join("") + `<button class="btn ghost sm" id="seen" type="button">Marcar como vistos</button>`;
  h += `<h3>Meus alertas</h3>`;
  if (!ctx.watches.length) return h + `<div class="card empty">Nenhum alerta criado. Pesquise uma viagem e crie o primeiro.</div>`;
  return h + ctx.watches.map((w) => `<div class="card watch"><div><b>${esc(w.origin)} → ${esc(w.destination)}</b> <span class="muted small">${fdate(w.depart_date)}${w.return_date ? " a " + fdate(w.return_date) : ""}${w.active ? "" : ", pausado"}</span>
      <div style="margin:6px 0"><span class="num" style="font-size:26px">${w.best_price ? brl(w.best_price) : "…"}</span> <span class="muted small">menor preço atual por pessoa${w.target_price ? `; alvo ${brl(w.target_price)}` : ""}; queda de ${w.drop_pct}%</span></div>
      ${spark(w.history)}<div class="muted tiny">${w.last_checked ? "Última checagem: " + esc(w.last_checked.replace("T", " ").slice(0, 16)) : "Aguardando a 1ª checagem…"}${w.last_error ? ` <span style="color:var(--bad)">${esc(w.last_error)}</span>` : ""}</div></div>
      <div class="acts"><button class="btn ghost sm" data-w="check" data-id="${w.id}" type="button">Checar agora</button><button class="btn ghost sm" data-w="toggle" data-id="${w.id}" type="button">${w.active ? "Pausar" : "Retomar"}</button><button class="btn danger sm" data-w="del" data-id="${w.id}" type="button">Excluir</button></div></div>`).join("");
}
