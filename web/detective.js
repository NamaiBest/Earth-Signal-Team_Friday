/* Classic interface extras borrowed from the experimental one: faint latitude/longitude lines,
   a quiet readout strip (cursor position, zoom, UTC), a target cursor and a 2D / 3D switch.
   Everything here is hidden when the experimental interface is on. Uses app.js globals. */
(function () {
  const q = (s) => document.querySelector(s);
  const make = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.assign(e, attrs); if (html) e.innerHTML = html; return e; };
  const params = new URLSearchParams(location.search);
  if (params.get('clean') === '1') document.body.classList.add('clean'); // recording mode: hides the Learn and Experimental buttons
  window.c3d = false;

  const wait = setInterval(() => { if (window.__ready) { clearInterval(wait); build(); } }, 150);

  function build() {
    document.body.append(
      make('div', { id: 'cstrip', className: 'classic-only' }, `
        <span>LAT<b id="cLat">--</b></span><span>LON<b id="cLon">--</b></span>
        <span>ZOOM<b id="cZoom">--</b></span><span>UTC<b id="cUtc">--</b></span>`),
      make('div', { id: 'creticle', className: 'classic-only' }),
      make('div', { id: 'dim3', className: 'classic-only', role: 'group' }, `
        <button type="button" data-d="2" aria-pressed="true">2D</button><button type="button" data-d="3" aria-pressed="false">3D</button>`));
    q('#dim3').setAttribute('aria-label', 'Flat or 3D map');

    // hide / show the left panel for a full-screen map
    for (const sel of ['#controls > header', '#policy > header']) {
      const x = make('button', { type: 'button', className: 'phide', title: 'Hide this panel' }, '×');
      x.setAttribute('aria-label', 'Hide panel');
      x.onclick = () => { document.body.classList.add('nopanel'); q('#pshow').focus(); };
      q(sel).append(x);
    }
    const show = make('button', { id: 'pshow', type: 'button', title: 'Show the panel' }, '<span aria-hidden="true">☰</span> Show panel');
    show.onclick = () => document.body.classList.remove('nopanel');
    document.body.append(show);

    // faint graticule, every 10 degrees
    const lines = [];
    for (let lon = -180; lon < 180; lon += 10) lines.push(Array.from({ length: 35 }, (_, i) => [lon, -85 + i * 5]));
    for (let lat = -80; lat <= 80; lat += 10) lines.push(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]));
    map.addSource('c-grat', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: lines } } });
    map.addLayer({ id: 'c-grat', type: 'line', source: 'c-grat', paint: { 'line-color': '#F4EDE0', 'line-opacity': 0.1, 'line-width': 0.6 } }, 'd-fill');

    // 3D columns: height = strength of the confirmed change (Detect) or severity (Policy)
    map.addLayer({ id: 'c-ext', type: 'fill-extrusion', source: 'districts', filter: ['>', ['coalesce', ['get', 'h3'], 0], 0],
      paint: { 'fill-extrusion-color': ['case', ['boolean', ['get', 'pm'], false], ['get', 'pc'], ['get', 'c']], 'fill-extrusion-opacity': 0.86, 'fill-extrusion-base': 0,
        'fill-extrusion-height': ['interpolate', ['exponential', 2], ['zoom'], 3, ['*', ['get', 'h3'], 160000], 6, ['*', ['get', 'h3'], 40000], 9, ['*', ['get', 'h3'], 5000]] } }, 's-line');
    map.on('click', 'c-ext', (e) => { if (!e.defaultPrevented) { e.preventDefault(); select(e.features[0].properties.id, false); } });

    const repaint = () => { if (document.body.classList.contains('policy-mode') && window.policyRepaint) window.policyRepaint(); else paintDistricts(); };
    q('#dim3').querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        window.c3d = b.dataset.d === '3';
        q('#dim3').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
        repaint();
        map.easeTo({ pitch: window.c3d ? 55 : 0, bearing: window.c3d ? -15 : 0, duration: 900 });
      };
    });

    // readouts
    const fmt = (v, pos, neg) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;
    const ret = q('#creticle');
    map.on('mousemove', (e) => {
      q('#cLat').textContent = fmt(e.lngLat.lat, 'N', 'S');
      q('#cLon').textContent = fmt(e.lngLat.lng, 'E', 'W');
      ret.style.transform = `translate(${e.originalEvent.clientX}px, ${e.originalEvent.clientY}px)`;
      ret.classList.add('live');
    });
    map.on('mouseout', () => ret.classList.remove('live'));
    const zoom = () => { q('#cZoom').textContent = map.getZoom().toFixed(1); };
    map.on('zoom', zoom); zoom();
    const tick = () => { q('#cUtc').textContent = new Date().toISOString().slice(11, 19); };
    setInterval(tick, 1000); tick();

    // step aside when the experimental interface is on
    const sync = () => {
      const exp = document.body.classList.contains('exp');
      for (const l of ['c-grat', 'c-ext']) if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', exp ? 'none' : 'visible');
    };
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    sync();
  }
})();
