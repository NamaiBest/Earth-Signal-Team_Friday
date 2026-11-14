/* Experimental "observatory console" interface, switched from the top-right toggle.
   Uses the same data and state as app.js (T, S, districts, map, select). Classic UI is untouched. */
(function () {
  const KEY = 'earthsignal-ui';
  const q = (s) => document.querySelector(s);
  const make = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
  let on = false, built = false, show3d = true, manual = false;
  const TILT_FROM = 4.6, TILT_FULL = 6.5, TILT_MAX = 58;

  try { on = new URLSearchParams(location.search).get('ui') === 'exp' || localStorage.getItem(KEY) === 'exp'; } catch (e) { /* storage blocked */ }
  if (new URLSearchParams(location.search).get('ui') === 'classic') on = false;

  const toggle = q('#uiToggle');
  toggle.onclick = () => { on = !on; try { localStorage.setItem(KEY, on ? 'exp' : 'classic'); } catch (e) { /* ignore */ } apply(); };

  const wait = setInterval(() => { if (window.__ready) { clearInterval(wait); apply(); } }, 150);

  function apply() {
    if (!window.__ready) return;
    if (on && !built) build();
    document.body.classList.toggle('exp', on);
    toggle.setAttribute('aria-pressed', on);
    toggle.querySelector('.lbl').textContent = on ? 'EXPERIMENTAL · ON' : 'Experimental UI';
    if (built) {
      map.setLayoutProperty('d-ext', 'visibility', on && show3d && S.view !== 'pixels' ? 'visible' : 'none');
      map.setLayoutProperty('grat', 'visibility', on ? 'visible' : 'none');
      manual = false; autoTilt();
      if (on) refresh();
    }
    setTimeout(() => map.resize(), 50);
  }

  function build() {
    built = true;
    // --- bars ---
    document.body.append(
      make('div', { id: 'topbar', className: 'exp-only' }, `
        <span class="brand">EARTH<i>SIGNAL</i> · TREND DETECTIVE</span>
        <span class="ro">LAT<b id="roLat">--</b></span><span class="ro">LON<b id="roLon">--</b></span>
        <span class="ro">ZOOM<b id="roZoom">--</b></span><span class="ro wide">DISTRICT<b id="roDist">--</b></span>
        <span class="grow"></span><span class="ro">UTC<b id="roUtc">--</b></span>`),
      make('div', { id: 'botbar', className: 'exp-only' }, `
        <span class="ro keep wide" id="bbVar"></span><span class="ro" id="bbTally"></span><span class="grow"></span>
        <span class="ro">N<b>735 DISTRICTS</b></span><span class="ro">WINDOW<b>2001–2025</b></span>
        <span class="ro">TEST<b>MANN-KENDALL + SEN</b></span><span class="ro">FDR<b>BH, q &lt; 0.05</b></span><span class="ro">TILT<b>SHIFT + SCROLL</b></span>`),
      make('div', { id: 'reticle', className: 'exp-only' }));

    // --- left rail: signal board, distribution, top movers ---
    const detect = q('#vars').closest('section');
    const board = make('div', { id: 'board', className: 'exp-only' });
    q('#vars').after(board);
    const sboard = make('div', { id: 'sboard', className: 'exp-only' });
    q('#types').after(sboard);
    const movers = make('section', { className: 'exp-only' }, '<details><summary>Top movers</summary><div class="movers" id="movers"></div></details>');
    q('#controls').append(movers);
    suspectBoard();

    // --- map layers ---
    const lines = [];
    for (let lon = -180; lon < 180; lon += 10) lines.push(Array.from({ length: 35 }, (_, i) => [lon, -85 + i * 5]));
    for (let lat = -80; lat <= 80; lat += 10) lines.push(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]));
    map.addSource('grat', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: lines } } });
    map.addLayer({ id: 'grat', type: 'line', source: 'grat', paint: { 'line-color': '#7fe3d4', 'line-opacity': 0.16, 'line-width': 0.6 } }, 'd-fill');
    map.addLayer({ id: 'd-ext', type: 'fill-extrusion', source: 'districts', filter: ['>', ['get', 'h'], 0],
      minzoom: TILT_FROM - 0.4,
      paint: { 'fill-extrusion-color': ['get', 'c'], 'fill-extrusion-opacity': 0.88, 'fill-extrusion-base': 0,
        'fill-extrusion-height': ['interpolate', ['exponential', 2], ['zoom'], 3, ['*', ['get', 'h'], 160000], 6, ['*', ['get', 'h'], 40000], 9, ['*', ['get', 'h'], 5000]] } }, 's-line');
    map.on('click', 'd-ext', (e) => { if (!e.defaultPrevented) { e.preventDefault(); select(e.features[0].properties.id, false); } });

    // --- 2D when zoomed out, 3D when zoomed in; Shift + scroll tilts by hand ---
    map.on('zoomend', autoTilt);
    map.getCanvasContainer().addEventListener('wheel', (e) => {
      if (!on || !e.shiftKey) return;
      e.preventDefault(); e.stopPropagation();
      manual = true;
      map.setPitch(Math.max(0, Math.min(75, map.getPitch() - (e.deltaY || e.deltaX) * 0.15)));
    }, { capture: true, passive: false });

    // --- live readouts ---
    const fmt = (v, pos, neg) => `${Math.abs(v).toFixed(3)}°${v >= 0 ? pos : neg}`;
    map.on('mousemove', (e) => {
      q('#roLat').textContent = fmt(e.lngLat.lat, 'N', 'S');
      q('#roLon').textContent = fmt(e.lngLat.lng, 'E', 'W');
      const r = q('#reticle'); r.style.transform = `translate(${e.originalEvent.clientX}px, ${e.originalEvent.clientY}px)`;
      const f = map.queryRenderedFeatures(e.point, { layers: ['d-fill'] })[0];
      q('#roDist').textContent = f ? f.properties.label.toUpperCase().slice(0, 22) : '--';
    });
    const zoom = () => { q('#roZoom').textContent = map.getZoom().toFixed(2); };
    map.on('zoom', zoom); zoom();
    const tick = () => { q('#roUtc').textContent = new Date().toISOString().slice(11, 19); };
    setInterval(tick, 1000); tick();
  }

  function autoTilt() {
    if (!built) return;
    const z = map.getZoom();
    if (!on) { if (map.getPitch()) map.easeTo({ pitch: 0, bearing: 0, duration: 600 }); return; }
    if (z < TILT_FROM) manual = false; // zooming back out returns to the flat view
    if (manual) return;
    const t = Math.max(0, Math.min(1, (z - TILT_FROM) / (TILT_FULL - TILT_FROM))), target = Math.round(t * TILT_MAX);
    if (Math.abs(map.getPitch() - target) > 2) map.easeTo({ pitch: target, duration: 700 });
  }

  function suspectBoard() {
    const tot = {}, cnt = {};
    for (const f of suspects.features) { const t = f.properties.type; cnt[t] = (cnt[t] || 0) + 1; tot[t] = (tot[t] || 0) + (f.properties.co2e_t || 0); }
    const types = Object.keys(TYPE_COLOR), mx = Math.max(...types.map((t) => tot[t] || 0));
    const host = q('#sboard'); host.innerHTML = '';
    types.forEach((t, i) => {
      const row = make('button', { type: 'button', className: 'sig-row' }, `
        <span><span class="dot" style="background:${TYPE_COLOR[t]}"></span>${t}</span><span class="pct">${cnt[t] || 0}</span>
        <span class="track"><span style="width:${((tot[t] || 0) / mx) * 100}%;background:${TYPE_COLOR[t]}"></span></span>
        <small>${tonnes(tot[t] || 0)} CO₂e/yr estimated</small>`);
      row.setAttribute('aria-pressed', S.types.has(t));
      row.title = 'Show or hide this source type on the map';
      row.onclick = () => { q('#types').children[i].click(); row.setAttribute('aria-pressed', S.types.has(t)); };
      host.append(row);
    });
  }

  // Called by app.js after every repaint (variable or season change).
  window.expRefresh = (stats) => { if (on && built) refresh(stats); };

  function refresh(stats) {
    const p = T.periods.indexOf(S.p), ids = Object.keys(T.d);
    // signal board
    const board = q('#board'); board.innerHTML = '';
    Object.entries(T.vars).forEach(([k, m], i) => {
      let up = 0, down = 0, n = 0;
      for (const id of ids) { const r = T.d[id][k] && T.d[id][k][p]; if (!r || r[0] === null) continue; n++; if (r[2] !== null && r[2] < T.alpha) (r[0] > 0 ? up++ : down++); }
      const row = make('button', { type: 'button', className: 'sig-row' }, `
        <span>${m.short}</span><span class="pct">${Math.round(((up + down) / n) * 100)}%</span>
        <span class="track"><span style="width:${(down / n) * 100}%;background:var(--down)"></span><span style="width:${(up / n) * 100}%;background:var(--up)"></span></span>
        <small>${up} rising · ${down} falling · ${m.res} ${m.kind}</small>`);
      row.setAttribute('aria-pressed', k === S.v);
      row.title = `${m.label}: share of districts with a significant trend`;
      row.onclick = () => q('#vars').children[i].click();
      board.append(row);
    });

    // distribution of district slopes for the selected variable
    const rows = ids.map((id) => ({ id, r: T.d[id][S.v] && T.d[id][S.v][p] })).filter((x) => x.r && x.r[0] !== null);
    // top movers
    const sigRows = rows.filter((x) => x.r[2] !== null && x.r[2] < T.alpha).sort((a, b) => b.r[0] - a.r[0]);
    const name = Object.fromEntries(districts.features.map((f) => [f.properties.id, f.properties.label]));
    const list = (arr, title) => `<div><h4>${title}</h4>${arr.map((x) => `<button type="button" class="mover" data-id="${x.id}"><span>${esc(name[x.id])}</span><span class="${x.r[0] > 0 ? 'up' : 'down'}">${signed(x.r[0])}</span></button>`).join('') || '<p class="empty">none</p>'}</div>`;
    q('#movers').innerHTML = list(sigRows.filter((x) => x.r[0] > 0).slice(0, 5), 'RISING FASTEST') + list(sigRows.filter((x) => x.r[0] < 0).reverse().slice(0, 5), 'FALLING FASTEST');
    q('#movers').querySelectorAll('.mover').forEach((b) => { b.onclick = () => select(b.dataset.id, true); });

    // bottom bar
    const m = T.vars[S.v];
    q('#bbVar').innerHTML = `SIGNAL<b>${m.short.toUpperCase()} · ${String(T.period_labels[S.p]).toUpperCase()}</b>`;
    const st = stats || { nSig: sigRows.length, n: rows.length, nAlibi: 0 };
    q('#bbTally').innerHTML = `SIGNIFICANT<b>${st.nSig} / ${st.n}</b>` + (st.nAlibi ? ` REJECTED BY FDR<b>${st.nAlibi}</b>` : '');
  }
})();
