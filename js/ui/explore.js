// Resultado de "Descobrir destinos": lista com filtros em cascata, mapa do Brasil (estados → cidades) e mapa-múndi.
import * as C from "../core/index.js";
import { brl, dur, esc, fdate, icon, plural, safeUrl, stopsTxt, thumb } from "./kit.js";

export const newScanState = () => ({ tab: "list", view: null, sel: null, zoom: { world: 1, brazil: 1 }, f: { country: "", uf: "", city: "", stops: "any", maxPrice: 0, q: "", desc: false, limit: 40 } });

const pax = (r) => r.req.adults + r.req.children;
const period = (r) => `Saindo de ${esc(r.req.origin.replace(/,/g, ", "))}, ${fdate(r.req.depart_date)} a ${fdate(r.req.return_date)}, ${plural(pax(r), "pessoa", "pessoas")}.`;
const legend = (sc, none = true) => `<div class="legend">${sc.bands.map((b) => `<span class="lg"><i style="background:${b.color}"></i>${esc(b.label)}</span>`).join("")}${none ? '<span class="lg"><i style="background:var(--none)"></i>Sem destino</span>' : ""}</div>`;
const mapCache = {};

export function scanTabs(r) {
  return [["list", "Lista", r.dests.length], ["brazil", "Brasil", r.dests.filter((d) => d.uf).length || ""], ["world", "Mundo", ""]];
}

export function scanHead(r) {
  const d = r.dests, byC = C.groupMin(d, (x) => x.country_a2), byU = C.groupMin(d, (x) => x.uf);
  const best = d[0], cC = [...byC.values()].sort((a, b) => a.min - b.min)[0], cU = [...byU.values()].sort((a, b) => a.min - b.min)[0];
  const kpi = (a, b, c) => `<div class="card kpi"><small>${a}</small><b>${b}</b><span>${c}</span></div>`;
  return `<div class="kpis">${kpi("Destino mais barato", brl(best?.price_pp), best ? esc(best.name) : "nenhum")}
    ${kpi("Destinos encontrados", d.length, `${plural(byC.size, "país", "países")}${r.cached ? ", resultado recente" : ""}`)}
    ${kpi("País mais barato", brl(cC?.min), cC ? esc(cC.cheapest.country_name) : "—")}
    ${kpi("Estado mais barato", brl(cU?.min), cU ? esc(cU.cheapest.uf_name) : "sem destino no Brasil")}</div>`;
}

export function scanPanel(r, st) {
  if (st.tab === "list") return listHTML(r, st);
  if (st.tab === "brazil" && st.view) return stateHTML(r, st.view);
  return mapHTML(r, st, st.tab);
}

export function destRow(d, rank, r) {
  const where = [d.uf_name, d.country_name].filter((x) => x && x !== d.name).join(", ");
  const meta = [stopsTxt(d.stops), dur(d.duration_min), d.airline].filter(Boolean).map(esc).join(", ");
  return `<div class="card dest" data-dest="${esc(d.id)}" role="button" tabindex="0">${thumb(d.thumbnail, icon.pin)}
    <div style="min-width:0"><div class="nm"><span class="rank">${rank}</span>${esc(d.name)}</div><div class="muted small">${esc(where)}</div><div class="muted tiny">${meta}</div></div>
    <div class="pr"><b>${brl(d.price_pp)}</b><span class="muted tiny">por pessoa</span>${pax(r) > 1 ? `<div class="muted tiny">${brl(d.price_pp * pax(r))} para ${pax(r)}</div>` : ""}</div></div>`;
}

function listHTML(r, st) {
  const f = st.f, o = C.filterOptions(r.dests, f), L = C.filterDestinations(r.dests, f);
  const sel = (a, b) => (a === b ? "selected" : "");
  const opts = (arr, cur, all) => `<option value="">${all}</option>` + arr.map(([k, n]) => `<option value="${esc(k)}" ${sel(cur, k)}>${esc(n)}</option>`).join("");
  const active = f.country || f.uf || f.city || f.q || f.maxPrice || f.stops !== "any";
  let h = `<p class="muted small">${period(r)} Preços por pessoa, ida e volta.</p><div class="filters">
    <div><label for="fQ">Procurar</label><input type="text" id="fQ" value="${esc(f.q)}" placeholder="Cidade, estado ou país"></div>
    <div><label for="fCountry">País</label><select id="fCountry">${opts(o.countries, f.country, "Todos")}</select></div>
    <div><label for="fUf">Estado</label><select id="fUf" ${o.ufs.length ? "" : "disabled"}>${opts(o.ufs, f.uf, "Todos")}</select></div>
    <div><label for="fCity">Cidade</label><select id="fCity"><option value="">Todas</option>${o.cities.map((c) => `<option ${sel(f.city, c)}>${esc(c)}</option>`).join("")}</select></div>
    <div><label for="fStops">Paradas</label><select id="fStops"><option value="any">Qualquer</option><option value="0" ${sel(f.stops, "0")}>Só direto</option><option value="1" ${sel(f.stops, "1")}>Até 1</option><option value="2" ${sel(f.stops, "2")}>Até 2</option></select></div>
    <div><label for="fMax">Até (R$ por pessoa)</label><input type="number" id="fMax" min="0" step="100" value="${f.maxPrice || ""}" placeholder="Sem limite" inputmode="numeric"></div>
    <div><label for="fOrder">Ordem</label><select id="fOrder"><option value="asc">Mais barato primeiro</option><option value="desc" ${f.desc ? "selected" : ""}>Mais caro primeiro</option></select></div></div>
    <p class="muted small">${plural(L.length, "destino", "destinos")}${active ? " com esses filtros" : ""}. Toque num destino para ver detalhes e montar a viagem completa.</p>`;
  if (!L.length) return h + `<div class="card empty">Nenhum destino com esses filtros.</div>`;
  h += L.slice(0, f.limit).map((d, i) => destRow(d, f.desc ? L.length - i : i + 1, r)).join("");
  if (L.length > f.limit) h += `<button class="btn ghost block" id="more" type="button">Mostrar mais ${L.length - f.limit}</button>`;
  return h;
}

function mapHTML(r, st, kind) {
  mapCache[kind] ??= C.mapPaths(kind);
  const m = mapCache[kind];
  const keyOf = kind === "world" ? (d) => d.country_key : (d) => d.uf;
  const nameOf = kind === "world" ? (k) => C.COUNTRIES[k]?.name || k : (k) => C.BR_STATES[k] || k;
  const groups = C.groupMin(r.dests, keyOf), sc = C.colorScale([...groups.values()].map((g) => g.min));
  const sel = kind === "world" ? st.sel : null;
  const paths = m.paths.map((p) => {
    const g = groups.get(p.id);
    return `<path d="${p.d}" data-k="${esc(p.id)}" class="${g ? "" : "none"} ${sel === p.id ? "sel" : ""}" ${g ? `style="fill:${sc.color(g.min)}"` : ""}><title>${esc(nameOf(p.id))}${g ? `: a partir de ${brl(g.min)}` : ": sem destino"}</title></path>`;
  }).join("");
  const z = st.zoom[kind];
  let h = `<p class="muted small">${period(r)} Cada ${kind === "world" ? "país" : "estado"} tem a cor do seu destino mais barato. ${kind === "brazil" ? "Toque num estado para ver as cidades." : "Toque num país para ver os destinos."}</p>
    ${legend(sc)}<div class="zoom"><button class="btn ghost sm" data-zoom="-1" type="button" ${z <= 1 ? "disabled" : ""}>Menos zoom</button><button class="btn ghost sm" data-zoom="1" type="button" ${z >= 5 ? "disabled" : ""}>Mais zoom</button></div>
    <div class="mapbox ${kind === "brazil" ? "br" : ""}"><svg viewBox="${m.viewBox}" style="width:${z * 100}%" role="img" aria-label="Mapa de preços por ${kind === "world" ? "país" : "estado"}">${paths}</svg></div>`;
  if (!groups.size) return h + `<div class="card empty">Nenhum destino ${kind === "brazil" ? "no Brasil nesta pesquisa. Marque a região Brasil em Mais opções." : "localizado no mapa."}</div>`;
  if (sel && groups.get(sel)) {
    const g = groups.get(sel), L = r.dests.filter((d) => String(keyOf(d)) === String(sel)).sort((a, b) => a.price_pp - b.price_pp);
    return h + `<h3>${esc(nameOf(sel))}: a partir de ${brl(g.min)} <span class="muted small">(${plural(g.count, "destino", "destinos")})</span></h3>` +
      L.slice(0, 30).map((d, i) => destRow(d, i + 1, r)).join("") + `<button class="btn ghost sm" id="filterHere" type="button">Ver ${esc(nameOf(sel))} na lista</button>`;
  }
  const top = [...groups.values()].sort((a, b) => a.min - b.min).slice(0, 12);
  return h + `<h3>${kind === "world" ? "Países" : "Estados"} mais baratos</h3><div class="chips">` +
    top.map((g, i) => `<button class="chip" type="button" data-pick="${esc(g.key)}"><span class="rank">${i + 1}</span>${esc(nameOf(g.key))}, ${brl(g.min)}</button>`).join("") + "</div>";
}

function stateHTML(r, uf) {
  mapCache.brazil ??= C.mapPaths("brazil");
  const v = C.stateView(uf, r.dests), name = C.BR_STATES[uf] || uf;
  const L = r.dests.filter((d) => d.uf === uf).sort((a, b) => a.price_pp - b.price_pp);
  const sc = C.colorScale(L.map((d) => d.price_pp));
  let h = `<button class="btn ghost sm" id="backStates" type="button">Voltar aos estados</button>
    <h3>${esc(name)}: ${plural(L.length, "destino", "destinos")}, a partir de ${brl(L[0]?.price_pp)}</h3>
    <p class="muted small">Cada círculo é uma cidade, com a cor do preço por pessoa. Toque numa cidade para ver detalhes.</p>${legend(sc, false)}`;
  if (v) {
    const [vx, , vw] = v.viewBox.split(" ").map(Number);
    const base = mapCache.brazil.paths.map((p) => `<path d="${p.d}" class="none ${p.id === uf ? "cur" : ""}"></path>`).join("");
    const labelled = new Set(L.slice(0, 12).map((d) => d.id));
    const dots = v.cities.map((c) => {
      const right = c.x > vx + vw * 0.6; // perto da borda direita: nome à esquerda do ponto
      return `<circle cx="${c.x}" cy="${c.y}" r="${v.r}" data-city="${esc(c.id)}" style="fill:${sc.color(c.price)}" class="city"><title>${esc(c.name)}: ${brl(c.price)}</title></circle>` +
        (labelled.has(c.id) ? `<text x="${right ? c.x - v.r * 1.4 : c.x + v.r * 1.4}" y="${c.y + v.r * 0.45}" font-size="${v.r * 1.5}" text-anchor="${right ? "end" : "start"}" class="clabel">${esc(c.name)}</text>` : "");
    }).join("");
    h += `<div class="mapbox br"><svg viewBox="${v.viewBox}" style="width:100%" role="img" aria-label="Mapa de ${esc(name)}">${base}${dots}</svg></div>`;
    if (v.outside) h += `<p class="muted small">${plural(v.outside, "destino fica", "destinos ficam")} fora do contorno do mapa (ilhas): veja na lista abaixo.</p>`;
  }
  h += L.length ? L.map((d, i) => destRow(d, i + 1, r)).join("") : `<div class="card empty">Nenhum destino neste estado.</div>`;
  return h + `<button class="btn ghost sm" id="filterHere" type="button">Ver ${esc(name)} na lista</button>`;
}

/** Conteúdo da folha de um destino: preço, voo, hospedagem de referência e o botão para montar a viagem completa. */
export function destSheetHTML(d, r, estimate) {
  const where = [d.uf_name, d.country_name].filter((x) => x && x !== d.name).join(", ");
  return `${safeUrl(d.thumbnail) ? thumb(d.thumbnail, "", "thumb hero") : ""}
    <p class="muted" style="margin-top:0">${esc(where)}${d.airport ? `. Aeroporto ${esc(d.airport)}` : ""}</p>
    <div class="stat"><span>Passagem por pessoa, ida e volta</span><span class="num" style="font-size:26px">${brl(d.price_pp)}</span></div>
    ${pax(r) > 1 ? `<div class="stat"><span>Para ${pax(r)} pessoas (estimativa)</span><span><b>${brl(d.price_pp * pax(r))}</b></span></div>` : ""}
    <div class="stat"><span>Voo</span><span>${[stopsTxt(d.stops), dur(d.duration_min), d.airline].filter(Boolean).map(esc).join(", ") || "—"}</span></div>
    <div class="stat"><span>Datas</span><span>${fdate(d.start_date || r.req.depart_date)} a ${fdate(d.end_date || r.req.return_date)}</span></div>
    ${d.hotel_night ? `<div class="stat"><span>Hotel de referência do Google</span><span>${brl(d.hotel_night)} por noite</span></div>` : ""}
    <div id="sheetInd" class="muted small" style="margin:10px 0">Carregando segurança e custo de vida…</div>
    <button class="btn block" id="buildTrip" type="button" style="margin-top:8px">${icon.search} Montar viagem completa</button>
    <p class="hint" style="margin:8px 0 0;text-align:center">${estimate}</p>`;
}
