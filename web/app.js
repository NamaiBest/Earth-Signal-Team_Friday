/* EarthSignal: district trend detective. Plain JS + MapLibre GL, no build step. */
const UP = [242, 142, 43], DOWN = [78, 159, 214], MID = [213, 217, 222];
const TYPE_COLOR = {
  'Power plant': '#f2c14e', 'Steel & metals': '#e15759', 'Cement': '#b0a8a0', 'Oil & gas': '#b07aa1',
  'Mining': '#9c755f', 'Landfill & waste': '#59a14f', 'Other industry': '#76b7b2',
};
const GIBS = [
  { id: '', label: 'Off' },
  { id: 'MODIS_Terra_CorrectedReflectance_TrueColor', label: 'True colour (MODIS Terra)', set: 'GoogleMapsCompatible_Level9', ext: 'jpg', z: 9 },
  { id: 'TROPOMI_L2_Nitrogen_Dioxide_Tropospheric_Column', label: 'Nitrogen dioxide (TROPOMI)', set: 'GoogleMapsCompatible_Level6', ext: 'png', z: 6 },
  { id: 'MODIS_Terra_Aerosol', label: 'Aerosol / haze (MODIS Terra)', set: 'GoogleMapsCompatible_Level6', ext: 'png', z: 6 },
  { id: 'TROPOMI_L2_Sulfur_Dioxide_Total_Vertical_Column', label: 'Sulphur dioxide (TROPOMI)', set: 'GoogleMapsCompatible_Level6', ext: 'png', z: 6 },
  { id: 'MODIS_Terra_Land_Surface_Temp_Day', label: 'Land surface temperature (MODIS)', set: 'GoogleMapsCompatible_Level7', ext: 'png', z: 7 },
];
const SEASONS = ['year', 'winter', 'premonsoon', 'monsoon', 'postmonsoon'];
const SEASON_MONTHS = { year: [1,2,3,4,5,6,7,8,9,10,11,12], winter: [1,2], premonsoon: [3,4,5], monsoon: [6,7,8,9], postmonsoon: [10,11,12] };
const MON = ['J','F','M','A','M','J','J','A','S','O','N','D'];

const S = { v: 'NO2', view: 'districts', p: 'year', types: new Set(Object.keys(TYPE_COLOR)), sel: null };
let T, districts, suspects, map, scale = 1;
const $ = (q) => document.querySelector(q);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- formatting ---------- */
const sig = (x, n = 2) => (x === null || x === undefined ? 'n/a' : Number(x.toPrecision(n)).toString());
const signed = (x, n = 2) => (x > 0 ? '+' : x < 0 ? '−' : '') + sig(Math.abs(x), n);
const pq = (x) => (x === null ? 'n/a' : x < 0.001 ? '<0.001' : x.toFixed(3));
const tonnes = (t) => (t == null ? 'n/a' : t >= 1e6 ? (t / 1e6).toFixed(1) + ' Mt' : t >= 1e3 ? Math.round(t / 1e3) + ' kt' : Math.round(t) + ' t');
function change(vkey, r) { // "+0.045 per decade (+7% of its average)"
  const m = T.vars[vkey], unit = m.unit ? ' ' + m.unit : '';
  let s = `${signed(r[0])}${unit} per decade`;
  if (m.rel && r[3]) s += ` (${signed((r[0] / r[3]) * 100)}% of its average)`;
  return s;
}
const mix = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t));
function colour(slope) {
  const t = Math.max(-1, Math.min(1, slope / scale));
  return `rgb(${mix(MID, t > 0 ? UP : DOWN, Math.abs(t)).join(',')})`;
}
const pIndex = () => T.periods.indexOf(S.p);
const rec = (id, v = S.v, p = pIndex()) => (T.d[id] && T.d[id][v] ? T.d[id][v][p] : null);
const isSig = (r) => r && r[2] !== null && r[2] < T.alpha;

/* ---------- boot ---------- */
(async function boot() {
  const j = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
  let states;
  [T, districts, states, suspects] = await Promise.all(
    ['data/trends.json', 'data/districts.geojson', 'data/states.geojson', 'data/suspects.geojson'].map(j));

  map = new maplibregl.Map({
    container: 'map', style: 'https://tiles.openfreemap.org/styles/dark', center: [80, 22.5], zoom: 3.7,
    attributionControl: { compact: true, customAttribution: 'NASA POWER · NASA GIBS · Climate TRACE · geoBoundaries' },
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  map.on('style.load', () => { try { map.setProjection({ type: 'globe' }); } catch (e) { /* flat map fallback */ } });
  map.on('load', () => {
    paintDistricts();
    map.addSource('districts', { type: 'geojson', data: districts, promoteId: 'id' });
    map.addSource('states', { type: 'geojson', data: states });
    map.addLayer({ id: 'd-fill', type: 'fill', source: 'districts', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': ['get', 'o'] } });
    map.addLayer({ id: 'd-line', type: 'line', source: 'districts', minzoom: 4.5, paint: { 'line-color': '#0b0f14', 'line-width': 0.4, 'line-opacity': 0.6 } });
    map.addLayer({ id: 's-line', type: 'line', source: 'states', paint: { 'line-color': '#e6ebf1', 'line-width': 0.7, 'line-opacity': 0.55 } });
    map.addLayer({ id: 'd-sel', type: 'line', source: 'districts', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': '#f2c14e', 'line-width': 2.5 } });

    map.addSource('suspects', { type: 'geojson', data: suspects, cluster: true, clusterRadius: 38, clusterMaxZoom: 6 });
    map.addLayer({ id: 'sus-cluster', type: 'circle', source: 'suspects', filter: ['has', 'point_count'],
      paint: { 'circle-color': '#0b0f14', 'circle-stroke-color': '#e6ebf1', 'circle-stroke-width': 1.2, 'circle-opacity': 0.85,
        'circle-radius': ['step', ['get', 'point_count'], 9, 25, 12, 100, 16, 400, 20] } });
    map.addLayer({ id: 'sus-count', type: 'symbol', source: 'suspects', filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 10, 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': '#e6ebf1' } });
    map.addLayer({ id: 'sus-pt', type: 'circle', source: 'suspects', filter: ['!', ['has', 'point_count']],
      paint: { 'circle-color': ['match', ['get', 'type'], ...Object.entries(TYPE_COLOR).flat(), '#ccc'],
        'circle-stroke-color': '#0b0f14', 'circle-stroke-width': 1,
        'circle-radius': ['interpolate', ['linear'], ['sqrt', ['coalesce', ['get', 'co2e_t'], 0]], 0, 3, 1000, 5, 3000, 9, 6000, 15] } });

    map.on('click', 'sus-pt', (e) => { e.preventDefault(); sourcePopup(e.features[0]); });
    map.on('click', 'sus-cluster', (e) => { e.preventDefault(); map.easeTo({ center: e.features[0].geometry.coordinates, zoom: map.getZoom() + 1.6 }); });
    map.on('click', 'd-fill', (e) => { if (!e.defaultPrevented) select(e.features[0].properties.id, false); });
    for (const l of ['d-fill', 'sus-pt', 'sus-cluster']) {
      map.on('mouseenter', l, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; });
    }
    window.__ready = true;
  });
  buildControls();
})().catch((e) => { document.body.insertAdjacentHTML('beforeend', `<p style="position:fixed;top:40%;left:0;right:0;text-align:center">Could not load data: ${esc(e.message)}</p>`); });

/* ---------- Detect layer ---------- */
function paintDistricts() {
  const p = pIndex();
  const slopes = districts.features.map((f) => rec(f.properties.id, S.v, p)).filter((r) => r && r[0] !== null).map((r) => Math.abs(r[0])).sort((a, b) => a - b);
  scale = slopes[Math.floor(slopes.length * 0.95)] || 1; // 95th percentile, so one outlier doesn't flatten the map
  let nSig = 0, nAlibi = 0, n = 0;
  for (const f of districts.features) {
    const r = rec(f.properties.id, S.v, p);
    if (!r || r[0] === null) { f.properties.c = '#333'; f.properties.o = 0.05; f.properties.h = 0; continue; }
    n++;
    const s = isSig(r);
    if (s) nSig++; else if (r[1] !== null && r[1] < T.alpha) nAlibi++;
    f.properties.c = colour(r[0]);
    f.properties.o = s ? 0.72 : 0.12; // significance = opacity
    f.properties.h = s ? Math.min(1, Math.abs(r[0]) / scale) : 0; // experimental UI: column height
  }
  if (map && map.getSource('districts')) map.getSource('districts').setData(districts);
  const m = T.vars[S.v];
  $('#legend').innerHTML = `<div class="bar"></div>
    <div class="ticks"><span>−${sig(scale)}</span><span>0</span><span>+${sig(scale)} ${esc(m.unit)}/decade</span></div>
    <div class="key"><span class="sw"></span>significant <span class="sw faint"></span>not significant (faded)</div>
    <div class="key">${esc(m.label)}, ${m.years.join('–')}. ${esc(m.source)}, ${esc(m.res)} grid.${m.note ? ' ' + esc(m.note) : ''}</div>`;
  pixels();
  $('#tally').innerHTML = `${nSig} of ${n} districts changed significantly.` +
    (nAlibi ? `<br>${nAlibi} more looked significant alone but fail the correction for chance.` : '');
  if (window.expRefresh) window.expRefresh({ nSig, nAlibi, n });
}

/* ---------- controls ---------- */
function buildControls() {
  const chip = (host, label, on, fn) => { const b = el('button', { type: 'button' }, label); b.setAttribute('aria-pressed', on); b.onclick = () => fn(b); host.append(b); return b; };
  const one = (host) => (b) => { host.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); };
  for (const [k, m] of Object.entries(T.vars)) chip($('#vars'), esc(m.short), k === S.v, (b) => { S.v = k; one($('#vars'))(b); paintDistricts(); if (S.sel) caseFile(S.sel); });
  for (const k of SEASONS) chip($('#periods'), esc(String(T.period_labels[k]).replace(/ \(.*/, '')), k === S.p, (b) => { S.p = k; one($('#periods'))(b); paintDistricts(); if (S.sel) caseFile(S.sel); });
  for (const [t, c] of Object.entries(TYPE_COLOR)) chip($('#types'), `<span class="dot" style="background:${c}"></span>${esc(t)}`, true, (b) => {
    S.types.has(t) ? S.types.delete(t) : S.types.add(t); b.setAttribute('aria-pressed', S.types.has(t)); filterSuspects();
  });
  $('#suspectsOn').onchange = filterSuspects;
  $('#firesOn').onchange = (e) => liveFires(e.target.checked);
  document.querySelectorAll('#viewSel button').forEach((b) => { b.onclick = () => { document.querySelectorAll('#viewSel button').forEach((x) => x.setAttribute('aria-pressed', x === b)); setView(b.dataset.v); }; });

  const g = $('#gibs');
  for (const l of GIBS) g.append(el('option', { value: l.id, textContent: l.label }));
  const d = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10); // two days back: tiles are complete
  $('#gibsDate').value = d; $('#gibsDate').max = new Date().toISOString().slice(0, 10);
  g.onchange = $('#gibsDate').onchange = setGibs;

  const input = $('#search'), list = $('#results');
  const items = districts.features.map((f) => ({ id: f.properties.id, name: f.properties.label, state: f.properties.state }));
  const states = [...new Set(items.map((i) => i.state))].map((s) => ({ state: s, name: s, isState: true }));
  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    list.innerHTML = '';
    if (q.length < 2) { list.hidden = true; return; }
    const hits = [...states, ...items].filter((i) => i.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.toLowerCase().indexOf(q) - b.name.toLowerCase().indexOf(q)).slice(0, 12);
    for (const h of hits) {
      const li = el('li', {}, `${esc(h.name)}<small>${h.isState ? 'state' : esc(h.state)}</small>`);
      li.onclick = () => { list.hidden = true; input.value = h.name; h.isState ? flyState(h.state) : select(h.id, true); };
      list.append(li);
    }
    list.hidden = !hits.length;
  };
  input.onkeydown = (e) => { if (e.key === 'Enter' && list.firstChild) list.firstChild.click(); if (e.key === 'Escape') list.hidden = true; };
  $('#close').onclick = () => { $('#casefile').hidden = true; S.sel = null; map.setFilter('d-sel', ['==', ['get', 'id'], '']); };
}
function filterSuspects() {
  const on = $('#suspectsOn').checked;
  const keep = suspects.features.filter((f) => S.types.has(f.properties.type));
  map.getSource('suspects').setData({ type: 'FeatureCollection', features: on ? keep : [] });
}
function setGibs() {
  if (map.getLayer('gibs')) map.removeLayer('gibs');
  if (map.getSource('gibs')) map.removeSource('gibs');
  const l = GIBS.find((x) => x.id === $('#gibs').value);
  if (!l || !l.id) return;
  map.addSource('gibs', { type: 'raster', tileSize: 256, maxzoom: l.z, attribution: 'NASA GIBS',
    tiles: [`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${l.id}/default/${$('#gibsDate').value}/${l.set}/{z}/{y}/{x}.${l.ext}`] });
  map.addLayer({ id: 'gibs', type: 'raster', source: 'gibs', paint: { 'raster-opacity': 0.85 } }, 'd-fill');
}
function bounds(features) {
  const b = new maplibregl.LngLatBounds();
  const walk = (c) => (typeof c[0] === 'number' ? b.extend(c) : c.forEach(walk));
  features.forEach((f) => walk(f.geometry.coordinates));
  return b;
}
function flyState(state) { map.fitBounds(bounds(districts.features.filter((f) => f.properties.state === state)), { padding: 60, duration: 1200 }); }
function sourcePopup(f) {
  const p = f.properties;
  new maplibregl.Popup({ maxWidth: '280px' }).setLngLat(f.geometry.coordinates).setHTML(
    `<b>${esc(p.name)}</b><br>${esc(p.type)}${p.fuel ? ' · ' + esc(p.fuel) : ''}<br>
     <span class="stat">${tonnes(p.co2e_t)} CO₂e in 2024 (estimate)${p.ch4_t ? ' · methane ' + tonnes(p.ch4_t) : ''}<br>
     ${p.district ? esc(p.district) + ', ' + esc(p.state) : ''} · rank ${p.rank} of ${suspects.features.length} in India<br>Source: Climate TRACE</span>`).addTo(map);
}

/* ---------- case file ---------- */
async function select(id, fly) {
  const f = districts.features.find((x) => x.properties.id === id);
  if (!f) return;
  S.sel = id;
  map.setFilter('d-sel', ['==', ['get', 'id'], id]);
  if (fly) map.fitBounds(bounds([f]), { padding: { top: 80, bottom: 80, left: 380, right: 440 }, maxZoom: 7.6, duration: 1200 });
  $('#casefile').hidden = false;
  await caseFile(id);
}
const seriesCache = {};
async function caseFile(id) {
  const f = districts.features.find((x) => x.properties.id === id), P = f.properties, d = T.d[id] || {};
  const ser = seriesCache[id] || (seriesCache[id] = await fetch(`data/series/${id}.json`).then((r) => r.json()).catch(() => null));
  if (S.sel !== id) return;
  const vars = Object.keys(T.vars).filter((v) => d[v]);

  // Clues: significant in the whole year or in any season. Pattern: the season changing fastest.
  const clues = [], quiet = [], alibis = [];
  for (const v of vars) {
    const rows = SEASONS.map((s) => ({ s, r: d[v][T.periods.indexOf(s)] }));
    const hit = rows.filter((x) => isSig(x.r));
    for (const x of rows) if (!isSig(x.r) && x.r[1] !== null && x.r[1] < T.alpha) alibis.push({ v, ...x });
    if (!hit.length) { quiet.push(v); continue; }
    const seas = hit.filter((x) => x.s !== 'year').sort((a, b) => Math.abs(b.r[0]) - Math.abs(a.r[0]))[0];
    const main = hit.find((x) => x.s === 'year') || seas;
    clues.push({ v, main, seas, q: Math.min(...hit.map((x) => x.r[2])) });
  }
  clues.sort((a, b) => a.q - b.q);
  const dir = (x) => (x > 0 ? '<span class="up">rising</span>' : '<span class="down">falling</span>');
  const lab = (s) => T.period_labels[s];

  // Suspects: sources inside the district, then within 50 km of its centre.
  const km = (a, b) => { const R = 6371, r = Math.PI / 180, x = (b[0] - a[0]) * r * Math.cos(((a[1] + b[1]) / 2) * r), y = (b[1] - a[1]) * r; return R * Math.hypot(x, y); };
  const inside = suspects.features.filter((s) => s.properties.district === P.label && s.properties.state === P.state)
    .sort((a, b) => (b.properties.co2e_t || 0) - (a.properties.co2e_t || 0));
  const near = suspects.features.filter((s) => !(s.properties.district === P.label && s.properties.state === P.state) && km([P.lon, P.lat], s.geometry.coordinates) <= 50)
    .sort((a, b) => (b.properties.co2e_t || 0) - (a.properties.co2e_t || 0));
  const total = inside.reduce((t, s) => t + (s.properties.co2e_t || 0), 0);
  const srcRow = (s, extra = '') => `<div class="item"><span class="dot" style="background:${TYPE_COLOR[s.properties.type]}"></span><b>${esc(s.properties.name)}</b>
    <span class="stat">${esc(s.properties.type)}${s.properties.fuel ? ' · ' + esc(s.properties.fuel) : ''} · ${tonnes(s.properties.co2e_t)} CO₂e/yr${extra}</span></div>`;

  let h = `<p class="cf-title">${esc(P.name)}</p><p class="cf-meta">${esc(P.state)} · ${Number(P.area_km2).toLocaleString('en-IN')} km² · case file</p>
    <div class="verdict"><b>${clues.length} of ${vars.length}</b> variables show a significant change over their NASA record.
    ${alibis.length ? `<b>${alibis.length}</b> apparent change${alibis.length > 1 ? 's' : ''} did not survive the test.` : ''}</div>`;

  h += '<h3>Clues</h3>' + (clues.length ? clues.map((c) => `<div class="item"><b>${esc(T.vars[c.v].short)}</b> is ${dir(c.main.r[0])}: ${change(c.v, c.main.r)}
      <span class="stat">${T.vars[c.v].years.join('–')} · ${esc(lab(c.main.s))} · p ${pq(c.main.r[1])} · q ${pq(c.main.r[2])} · ${esc(T.vars[c.v].res)} ${T.vars[c.v].kind}</span></div>`).join('')
    : '<p class="empty">No variable passes the significance test here.</p>');

  const pat = clues.filter((c) => c.seas);
  h += '<h3>Pattern</h3>' + (pat.length ? pat.map((c) => `<div class="item"><b>${esc(T.vars[c.v].short)}</b> changes fastest in <b>${esc(lab(c.seas.s))}</b>: ${change(c.v, c.seas.r)}
      <span class="stat">q ${pq(c.seas.r[2])}</span></div>`).join('') : '<p class="empty">No single season stands out.</p>');
  h += calendar(d, vars);

  h += '<h3>Alibis</h3>' + (alibis.length || quiet.length ? alibis.slice(0, 6).map((a) => `<div class="item"><b>${esc(T.vars[a.v].short)}</b>, ${esc(lab(a.s))}: looks like a change (${change(a.v, a.r)}) but is not significant
      <span class="stat">p ${pq(a.r[1])} alone, q ${pq(a.r[2])} after correcting for 735 districts</span></div>`).join('') +
      (quiet.length ? `<div class="item">No evidence of change: ${quiet.map((v) => esc(T.vars[v].short)).join(', ')}</div>` : '')
    : '<p class="empty">Nothing here looked like a change and then failed the test.</p>');

  h += `<h3>Suspects</h3>` + (inside.length ? `<p class="cf-meta">${inside.length} mapped source${inside.length > 1 ? 's' : ''} in this district, ${tonnes(total)} CO₂e/yr estimated.</p>` +
      inside.slice(0, 5).map((s) => srcRow(s)).join('') : '<p class="empty">No mapped industrial source inside this district.</p>') +
    (near.length ? `<p class="cf-meta" style="margin-top:8px">Within 50 km of the district centre:</p>` + near.slice(0, 3).map((s) => srcRow(s, ` · ${Math.round(km([P.lon, P.lat], s.geometry.coordinates))} km away`)).join('') : '') +
    `<p class="caveat">Nearby, not responsible. A satellite cell mixes many sources and wind moves pollution, so this list is an association, not proof.</p>`;

  if (ser && ser.vars && ser.vars[S.v]) {
    h += '<h3>Associations</h3>' + associations(ser, vars);
    h += `<h3>Evidence: ${esc(T.vars[S.v].short)}, ${esc(String(lab(S.p)))}</h3>` + chart(ser, id);
  }
  if (vars.some((v) => T.vars[v].kind === 'model')) h += `<p class="caveat">Temperature, rainfall and soil moisture come from NASA's MERRA-2 model reanalysis. Its long-term trends can carry artefacts from changes in the observations fed to the model. Check against station records before using them for policy.</p>`;
  $('#cf').innerHTML = h;
  $('#casefile').scrollTop = 0;
}

function calendar(d, vars) { // months x variables; colour = direction, opacity = significance
  let h = '<div class="cal" role="img" aria-label="Trend by calendar month for each variable"><span></span>' + MON.map((m) => `<span class="h">${m}</span>`).join('');
  for (const v of vars) {
    const rows = d[v].slice(5, 17), mx = Math.max(...rows.map((r) => Math.abs(r[0] || 0))) || 1;
    h += `<span class="l">${esc(T.vars[v].short)}</span>` + rows.map((r, i) => {
      if (r[0] === null) return '<span class="c"></span>';
      const t = Math.min(1, Math.abs(r[0]) / mx), c = mix(MID, r[0] > 0 ? UP : DOWN, t).join(',');
      return `<span class="c" style="background:rgb(${c});opacity:${isSig(r) ? 0.95 : 0.16}" title="${esc(T.vars[v].short)} ${MON[i]}: ${signed(r[0])} per decade, q ${pq(r[2])}"></span>`;
    }).join('');
  }
  return h + '</div><p class="note">Each square is one calendar month. Orange rising, blue falling, faded not significant.</p>';
}

function yearly(ser, v, period) { // one value per year for a period: { y0, vals }
  const x = ser.vars[v].v, ms = SEASON_MONTHS[period], vals = [];
  for (let y = 0; y < x.length / 12; y++) {
    const got = ms.map((m) => x[y * 12 + m - 1]).filter((z) => z !== null);
    vals.push(got.length === ms.length || (period === 'year' && got.length >= 9) ? got.reduce((a, b) => a + b, 0) / got.length : null);
  }
  return { y0: Math.floor(ser.vars[v].start / 100), vals };
}
function spearman(a, b) {
  const rank = (x) => { const o = x.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = []; o.forEach(([, i], k) => { r[i] = k; }); return r; };
  const ra = rank(a), rb = rank(b), n = a.length, m = (n - 1) / 2;
  let s = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { s += (ra[i] - m) * (rb[i] - m); sa += (ra[i] - m) ** 2; sb += (rb[i] - m) ** 2; }
  return s / Math.sqrt(sa * sb);
}
function associations(ser, vars) { // year-to-year changes, so a shared long-term trend cannot fake a link
  const yv = Object.fromEntries(vars.map((v) => [v, yearly(ser, v, 'year')]));
  const out = [], linked = [['T2M', 'T2M_MAX'], ['T2M', 'LST'], ['T2M_MAX', 'LST'], ['PRECTOTCORR', 'GWETROOT'], ['AOD_55', 'ALLSKY_SFC_SW_DWN']];
  for (let i = 0; i < vars.length; i++) for (let j = i + 1; j < vars.length; j++) {
    if (linked.some((p) => p.includes(vars[i]) && p.includes(vars[j]))) continue; // physically obvious pairs
    const A = yv[vars[i]], B = yv[vars[j]], y0 = Math.max(A.y0, B.y0), y1 = Math.min(A.y0 + A.vals.length, B.y0 + B.vals.length) - 1;
    const a = [], b = [];
    for (let y = y0 + 1; y <= y1; y++) { // year-to-year changes on the shared years
      const a0 = A.vals[y - 1 - A.y0], a1 = A.vals[y - A.y0], b0 = B.vals[y - 1 - B.y0], b1 = B.vals[y - B.y0];
      if ([a0, a1, b0, b1].every((z) => z !== null)) { a.push(a1 - a0); b.push(b1 - b0); }
    }
    if (a.length < 12) continue;
    const r = spearman(a, b);
    if (Math.abs(r) >= 0.5) out.push({ a: vars[i], b: vars[j], r, n: a.length, y0, y1 });
  }
  out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  return (out.length ? out.slice(0, 4).map((o) => `<div class="item"><b>${esc(T.vars[o.a].short)}</b> and <b>${esc(T.vars[o.b].short)}</b> move ${o.r > 0 ? 'together' : 'in opposite directions'} from year to year
      <span class="stat">Spearman ρ ${o.r.toFixed(2)} on year-to-year changes, ${o.y0} to ${o.y1}</span></div>`).join('') : '<p class="empty">No strong year-to-year link between variables.</p>') +
    '<p class="note">Moving together is not cause and effect.</p>';
}
function chart(ser, id) {
  const Yd = yearly(ser, S.v, S.p), y = Yd.vals, r = rec(id), n = y.length, W = 360, H = 150, L = 38, R = 8, Tp = 8, B = 20;
  const ok = y.filter((v) => v !== null), lo = Math.min(...ok), hi = Math.max(...ok), pad = (hi - lo) * 0.12 || 1;
  const X = (i) => L + (i / (n - 1)) * (W - L - R), Y = (v) => Tp + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - Tp - B);
  const pts = y.map((v, i) => (v === null ? null : `${X(i).toFixed(1)},${Y(v).toFixed(1)}`)).filter(Boolean).join(' ');
  let line = '';
  if (r && r[0] !== null) { // Sen's line: slope from the test, intercept = median residual
    const b = r[0] / 10, res = y.map((v, i) => (v === null ? null : v - b * i)).filter((v) => v !== null).sort((p, q) => p - q), a = res[Math.floor(res.length / 2)];
    line = `<line x1="${X(0)}" y1="${Y(a)}" x2="${X(n - 1)}" y2="${Y(a + b * (n - 1))}" stroke="${r[0] > 0 ? 'var(--up)' : 'var(--down)'}" stroke-width="2" ${isSig(r) ? '' : 'stroke-dasharray="4 4" opacity=".6"'}/>`;
  }
  const yr = (i) => Yd.y0 + i;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Yearly values with trend line">
    <line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="#232c38"/>
    <text x="${L - 4}" y="${Y(hi) + 3}" text-anchor="end">${sig(hi, 3)}</text><text x="${L - 4}" y="${Y(lo) + 3}" text-anchor="end">${sig(lo, 3)}</text>
    ${[0, Math.floor((n - 1) / 2), n - 1].map((i) => `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${yr(i)}</text>`).join('')}
    <polyline points="${pts}" fill="none" stroke="#e6ebf1" stroke-width="1.3"/>${line}</svg>
    <p class="note">${r ? `Sen's slope ${change(S.v, r)}; p ${pq(r[1])}, q ${pq(r[2])}. ${isSig(r) ? 'Significant.' : 'Dashed line: not significant.'}` : ''}
    ${esc(T.vars[S.v].source)}, ${esc(T.vars[S.v].res)}${T.vars[S.v].unit ? ', ' + esc(T.vars[S.v].unit) : ''}.</p>`;
}

/* ---------- per-pixel trend view ---------- */
const gridCache = {};
async function pixels() {
  if (!map || !map.getLayer('d-fill')) return;
  const on = S.view === 'pixels';
  map.setPaintProperty('d-fill', 'fill-opacity', on ? 0 : ['get', 'o']);
  if (map.getLayer('d-ext')) map.setLayoutProperty('d-ext', 'visibility', on ? 'none' : (document.body.classList.contains('exp') ? 'visible' : 'none'));
  if (!on) { if (map.getLayer('px')) map.setLayoutProperty('px', 'visibility', 'none'); return; }
  const v = S.v, p = S.p;
  const g = gridCache[v] || (gridCache[v] = await fetch(`data/grid/${v}.json`).then((r) => r.json()).catch(() => null));
  if (!g || S.v !== v || S.view !== 'pixels') return;
  // Draw in Web Mercator rows so cells line up with the map.
  const lat0 = g.lat0 - g.dlat / 2, lat1 = g.lat0 + (g.nlat - 0.5) * g.dlat, lon0 = g.lon0 - g.dlon / 2, lon1 = g.lon0 + (g.nlon - 0.5) * g.dlon;
  const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const W = g.nlon * 4, H = Math.round(W * (merc(lat1) - merc(lat0)) / ((lon1 - lon0) * Math.PI / 180));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
  const sl = g.slope.filter((x) => x !== null).map(Math.abs).sort((a, b) => a - b), sc = sl[Math.floor(sl.length * 0.95)] || 1;
  for (let yy = 0; yy < H; yy++) {
    const m = merc(lat1) - ((yy + 0.5) / H) * (merc(lat1) - merc(lat0));
    const lat = (Math.atan(Math.exp(m)) * 360) / Math.PI - 90, i = Math.floor((lat - lat0) / g.dlat);
    for (let xx = 0; xx < W; xx++) {
      const j = Math.floor((xx / W) * g.nlon), k = i * g.nlon + j, b = g.slope[k], q = g.q[k], o = (yy * W + xx) * 4;
      if (b === null || i < 0 || i >= g.nlat) continue;
      const t = Math.max(-1, Math.min(1, b / sc)), col = mix(MID, t > 0 ? UP : DOWN, Math.abs(t));
      img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = q !== null && q < T.alpha ? 215 : 34;
    }
  }
  ctx.putImageData(img, 0, 0);
  const coords = [[lon0, lat1], [lon1, lat1], [lon1, lat0], [lon0, lat0]];
  if (map.getSource('px')) map.getSource('px').updateImage({ url: c.toDataURL(), coordinates: coords });
  else {
    map.addSource('px', { type: 'image', url: c.toDataURL(), coordinates: coords });
    map.addLayer({ id: 'px', type: 'raster', source: 'px', paint: { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } }, 'd-line');
  }
  map.setLayoutProperty('px', 'visibility', 'visible');
  const nSig = g.q.filter((x) => x !== null && x < T.alpha).length, n = g.q.filter((x) => x !== null).length;
  $('#tally').innerHTML = `Pixel view (whole year): ${nSig} of ${n} grid cells changed significantly.` + (p !== 'year' ? '<br>Pixels show the whole-year trend only.' : '');
}
window.setView = (v) => { S.view = v; paintDistricts(); };

/* ---------- live fires (FIRMS snapshot) ---------- */
async function liveFires(on) {
  if (!map.getSource('fires')) {
    const d = await fetch('data/fires_live.geojson').then((r) => r.json()).catch(() => null);
    if (!d) return;
    map.addSource('fires', { type: 'geojson', data: d });
    map.addLayer({ id: 'fires', type: 'circle', source: 'fires', paint: {
      'circle-color': '#ff5a36', 'circle-opacity': 0.85, 'circle-blur': 0.3,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 7, 3, 10, 5] } }, 'sus-cluster');
    map.on('click', 'fires', (e) => { e.preventDefault(); const p = e.features[0].properties;
      new maplibregl.Popup().setLngLat(e.features[0].geometry.coordinates).setHTML(`<b>Active fire</b><br><span class="stat">${esc(p.date)} ${esc(p.time)} UTC · ${esc(p.sat)}<br>Fire radiative power ${p.frp} MW · confidence ${esc(p.conf)}<br>NASA FIRMS (VIIRS 375 m)</span>`).addTo(map); });
    const n = d.features.length;
    $('#firesNote').textContent = `${n.toLocaleString('en-IN')} fire detections, ${d.from} to ${d.to} (snapshot taken ${d.made}).`;
  }
  map.setLayoutProperty('fires', 'visibility', on ? 'visible' : 'none');
}
