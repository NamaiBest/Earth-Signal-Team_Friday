/* Readability: when bright, solid districts sit behind a glass panel, thicken that panel's tint.
   Runs after every map render settles ('idle'); reads the district colours/opacities the map
   already draws, so nothing else changes. Uses app.js globals: map. */
(function () {
  const PANELS = ['#controls', '#policy', '#learn', '#casefile'];
  const rgb = (c) => { const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(c || ''); return m ? [+m[1], +m[2], +m[3]] : null; };

  function brightShare(rect) {
    const feats = map.queryRenderedFeatures([[rect.left, rect.top], [rect.right, rect.bottom]], { layers: ['d-fill'] });
    if (!feats.length) return 0;
    let bright = 0;
    for (const f of feats) {
      const c = rgb(document.body.classList.contains('policy-mode') ? f.properties.pc : f.properties.c), o = +f.properties.o || 0;
      if (!c) continue;
      const lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
      if (o >= 0.45 && lum >= 0.55) bright++; // solid coral / cream districts
    }
    return bright / feats.length;
  }

  let t = null;
  function check() {
    clearTimeout(t);
    t = setTimeout(() => {
      for (const sel of PANELS) {
        const el = document.querySelector(sel);
        if (!el) continue;
        if (el.hidden) { el.classList.remove('on-bright'); continue; }
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        el.classList.toggle('on-bright', brightShare(r) >= 0.35);
      }
    }, 120);
  }
  // `map` is a top-level `let` in app.js (shared global scope, not a window property)
  const wait = setInterval(() => { if (window.__ready && typeof map !== 'undefined' && map) { clearInterval(wait); map.on('idle', check); check(); } }, 200);
  window.addEventListener('resize', check);
})();
