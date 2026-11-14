/* Evidence extras for the case file (loaded after app.js; wraps its chart()):
   - chart views: yearly (original), monthly, monthly with the seasonal cycle removed
   - second opinion: straight-line fit with a t-test, next to Mann-Kendall + Sen
   - "how many more years until significant" for trends that are not significant yet
   - download the district's monthly series as CSV
   Uses app.js globals: T, S, rec, yearly, isSig, esc, sig, signed, pq, caseFile, districts. */
(function () {
  let mode = 'year', lastSer = null, lastId = null;
  const baseChart = chart;

  // ---- Student's t two-sided p-value (regularised incomplete beta, continued fraction) ----
  function lgamma(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const k of c) s += k / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
  function betacf(a, b, x) { let c = 1, d = 1 - (a + b) * x / (a + 1); d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); let h = d; for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2)); d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; h *= d * c; aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1)); d = 1 + aa * d; d = 1 / (Math.abs(d) < 1e-30 ? 1e-30 : d); c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-9) break; } return h; }
  function ibeta(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
  const tP = (t, df) => ibeta(df / 2, 0.5, df / (df + t * t));

  function ols(vals) { // straight-line fit on (year index, value); slope per year, t, p
    const pts = vals.map((v, i) => [i, v]).filter((p) => p[1] !== null), n = pts.length;
    if (n < 8) return null;
    const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
    let sxx = 0, sxy = 0; for (const [x, y] of pts) { sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); }
    const b = sxy / sxx, a = my - b * mx;
    let sse = 0; for (const [x, y] of pts) sse += (y - a - b * x) ** 2;
    const se = Math.sqrt(sse / (n - 2) / sxx), t = se > 0 ? b / se : 0;
    return { b, t, p: se > 0 ? tP(t, n - 2) : 1, n };
  }

  function secondOpinion(ser, id) {
    const m = T.vars[S.v], r = rec(id), fit = ols(yearly(ser, S.v, S.p).vals);
    if (!fit || !r || r[0] === null) return '';
    const mk = r[1] !== null && r[1] < T.alpha, tt = fit.p < T.alpha, agree = mk === tt && (!mk || Math.sign(fit.b) === Math.sign(r[0]));
    let h = `<div class="second"><b>Second opinion: straight-line fit with a t-test.</b> ${signed(fit.b * 10)}${m.unit ? ' ' + esc(m.unit) : ''} per decade, p ${pq(fit.p)} (${fit.n} yearly values).
      <span class="${agree ? 'ok' : 'warn'}">${agree ? '✓ Agrees with Mann-Kendall' : '⚠ Disagrees with Mann-Kendall'}</span>
      <small>${agree ? 'Two different methods give the same verdict for this district alone.' : 'The t-test assumes a straight line and bell-shaped noise; Mann-Kendall does not. When they disagree, look at the chart for odd years or a bend.'} Neither p-value here includes the correction for testing 735 districts; the q-value above does.</small></div>`;
    if (!isSig(r) && Math.abs(fit.t) > 0.3) { // t grows roughly with n^1.5 if slope and noise stay the same
      const need = Math.ceil(fit.n * Math.pow(2.07 / Math.abs(fit.t), 2 / 3)), extra = need - fit.n;
      h += `<div class="second"><b>Not significant yet.</b> ${extra > 0 && extra <= 40
        ? `If this rate and the year-to-year noise stay the same, roughly <b>${extra} more year${extra > 1 ? 's' : ''}</b> of data could make it significant for this district alone.`
        : extra > 40 ? 'At this rate it would take more than 40 extra years of data to become significant: there may be no real trend.' : 'It is close: it passes alone but not after the correction for 735 districts.'}
        <small>A rough estimate. A trend can be real and still too small to prove with the years we have.</small></div>`;
    }
    return h;
  }

  function monthlyChart(ser, id, anomalies) {
    const sv = ser.vars[S.v], x = sv.v.slice(), n = x.length, y0 = Math.floor(sv.start / 100), m = T.vars[S.v];
    if (anomalies) { // subtract each calendar month's long-term average
      for (let k = 0; k < 12; k++) { let s = 0, c = 0; for (let i = k; i < n; i += 12) if (x[i] !== null) { s += x[i]; c++; } const mean = c ? s / c : 0; for (let i = k; i < n; i += 12) if (x[i] !== null) x[i] -= mean; }
    }
    const ok = x.filter((v) => v !== null), lo = Math.min(...ok), hi = Math.max(...ok), pad = (hi - lo) * 0.08 || 1;
    const W = 360, H = 150, L = 38, R = 8, Tp = 8, B = 20, X = (i) => L + (i / (n - 1)) * (W - L - R), Y = (v) => Tp + (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - Tp - B);
    let d = '', pen = false;
    x.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; pen = true; });
    let line = '';
    const r = T.d[id] && T.d[id][S.v] ? T.d[id][S.v][0] : null; // whole-year result
    if (anomalies && r && r[0] !== null) {
      const b = r[0] / 120, res = x.map((v, i) => (v === null ? null : v - b * i)).filter((v) => v !== null).sort((p, q) => p - q), a = res[Math.floor(res.length / 2)];
      line = `<line x1="${X(0)}" y1="${Y(a)}" x2="${X(n - 1)}" y2="${Y(a + b * (n - 1))}" stroke="${r[0] > 0 ? 'var(--up)' : 'var(--down)'}" stroke-width="2" ${isSig(r) ? '' : 'stroke-dasharray="4 4" opacity=".6"'}/>` +
        `<line x1="${L}" y1="${Y(0)}" x2="${W - R}" y2="${Y(0)}" stroke="rgba(244,237,224,.25)" stroke-dasharray="2 3"/>`;
    }
    const years = n / 12;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${anomalies ? 'Monthly values with the seasonal cycle removed' : 'Monthly values'}">
      <line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="rgba(244,237,224,.2)"/>
      <text x="${L - 4}" y="${Y(hi) + 3}" text-anchor="end">${sig(hi, 3)}</text><text x="${L - 4}" y="${Y(lo) + 3}" text-anchor="end">${sig(lo, 3)}</text>
      ${[0, Math.floor(years / 2), years - 1].map((k) => `<text x="${X(k * 12 + 6)}" y="${H - 6}" text-anchor="middle">${y0 + k}</text>`).join('')}
      <path d="${d}" fill="none" stroke="#F4EDE0" stroke-width="${anomalies ? 1 : 0.9}" opacity=".9"/>${line}</svg>
      <p class="note">${anomalies
        ? `Each month minus its own long-term average, so the yearly up-and-down is gone and the slow change stands out. Line: whole-year Sen's slope${r && r[0] !== null ? ` (${signed(r[0])}${m.unit ? ' ' + esc(m.unit) : ''} per decade, q ${pq(r[2])})` : ''}.`
        : 'Every month as measured. The big repeating swings are the seasons; they hide the slow trend, which is why the test compares each month only with the same month in other years.'}
      ${esc(m.source)}, ${esc(m.res)}.</p>`;
  }

  chart = function (ser, id) { // eslint-disable-line no-global-assign
    lastSer = ser; lastId = id;
    const seg = `<div class="seg seg3 evseg" role="group" aria-label="Chart view">${[['year', 'Yearly'], ['monthly', 'Monthly'], ['anom', 'Seasons removed']]
      .map(([k, l]) => `<button type="button" data-evmode="${k}" aria-pressed="${mode === k}">${l}</button>`).join('')}</div>`;
    const body = mode === 'year' ? baseChart(ser, id) : monthlyChart(ser, id, mode === 'anom');
    return `<div id="evidence">${seg}${body}${mode === 'year' ? secondOpinion(ser, id) : ''}
      <div class="pbtns"><button type="button" data-evcsv="1">Download this district's data (CSV)</button></div></div>`;
  };

  function csv() {
    if (!lastSer) return;
    const f = districts.features.find((x) => x.properties.id === lastId), vars = Object.keys(lastSer.vars);
    const ym = (start, i) => { const y = Math.floor(start / 100), m = start % 100 - 1 + i; return `${y + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`; };
    const rows = {};
    for (const v of vars) lastSer.vars[v].v.forEach((val, i) => { const k = ym(lastSer.vars[v].start, i); (rows[k] = rows[k] || {})[v] = val; });
    const head = ['month', ...vars.map((v) => `${T.vars[v].short} (${T.vars[v].unit || 'unitless'})`)];
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [head.map(q).join(','), ...Object.keys(rows).sort().map((k) => [k, ...vars.map((v) => (rows[k][v] ?? ''))].join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
    a.download = `EarthSignal_${(f ? f.properties.label : lastId).replace(/\W+/g, '_')}_monthly.csv`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-evmode], [data-evcsv]');
    if (!b) return;
    if (b.dataset.evcsv) return csv();
    mode = b.dataset.evmode;
    await caseFile(S.sel);
    const ev = document.getElementById('evidence'); if (ev) ev.scrollIntoView({ block: 'center' });
  });
})();
