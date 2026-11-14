/* Policy workspace: ranked issues, alerts and a source watchlist for a chosen jurisdiction.
   Rules-based and traceable (scripts/build_policy.py). Uses app.js globals: T, S, districts,
   suspects, map, select, bounds, sourcePopup, esc, signed, pq, tonnes, TYPE_COLOR, paintDistricts. */
(function () {
  const $p = (s) => document.querySelector(s);
  let P = null, mode = 'detect', scope = null; // scope: { kind: 'state'|'district', name, ids:Set }
  let ver = 'v1', ai = { text: '', meta: '', busy: false, answer: '', q: '' };
  try { ver = new URLSearchParams(location.search).get('policy') || localStorage.getItem('earthsignal-policy') || 'v1'; } catch (e) { /* storage blocked */ }
  if (ver !== 'v2') ver = 'v1';
  const setVer = (v) => {
    ver = v; ai = { text: '', meta: '', busy: false, answer: '', q: '' };
    try { localStorage.setItem('earthsignal-policy', v); } catch (e) { /* ignore */ }
    document.querySelectorAll('#pVersion button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.ver === v));
    render();
  };
  document.querySelectorAll('#pVersion button').forEach((b) => { b.setAttribute('aria-pressed', b.dataset.ver === ver); b.onclick = () => setVer(b.dataset.ver); });
  const VIOLET = '#f2c14e';

  const km = (a, b) => { const r = Math.PI / 180, x = (b[0] - a[0]) * r * Math.cos(((a[1] + b[1]) / 2) * r), y = (b[1] - a[1]) * r; return 6371 * Math.hypot(x, y); };
  const centre = (f) => [f.properties.lon, f.properties.lat];
  const byId = () => Object.fromEntries(districts.features.map((f) => [f.properties.id, f]));
  const lab = (p) => T.period_labels[p];

  // ---------- tab switching ----------
  document.querySelectorAll('#modeTabs button').forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });
  async function setMode(m) {
    if (!window.__ready) return;
    mode = m;
    document.querySelectorAll('#modeTabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.mode === m));
    document.body.classList.toggle('policy-mode', m === 'policy');
    $p('#controls').hidden = m === 'policy';
    $p('#policy').hidden = m !== 'policy';
    if (m === 'policy') {
      if (!P) P = await fetch('data/policy.json').then((r) => r.json());
      if (!scope) setScope('state', 'Delhi');
      else render();
    } else {
      for (const l of ['p-scope', 'p-air']) if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', 'none');
      map.setPaintProperty('d-fill', 'fill-color', ['get', 'c']);
      paintDistricts();
    }
  }
  try { if (new URLSearchParams(location.search).get('tab') === 'policy') { const w = setInterval(() => { if (window.__ready) { clearInterval(w); setMode('policy'); } }, 200); } } catch (e) { /* ignore */ }

  // ---------- jurisdiction picker ----------
  const input = $p('#pScope'), list = $p('#pResults');
  input.oninput = () => {
    const q = input.value.trim().toLowerCase();
    list.innerHTML = '';
    if (q.length < 2) { list.hidden = true; return; }
    const states = [...new Set(districts.features.map((f) => f.properties.state))].map((s) => ({ kind: 'state', name: s, sub: 'state' }));
    const ds = districts.features.map((f) => ({ kind: 'district', name: f.properties.label, sub: f.properties.state, id: f.properties.id }));
    const hits = [...states, ...ds].filter((x) => x.name.toLowerCase().includes(q)).sort((a, b) => a.name.toLowerCase().indexOf(q) - b.name.toLowerCase().indexOf(q)).slice(0, 10);
    for (const h of hits) {
      const li = document.createElement('li');
      li.innerHTML = `${esc(h.name)}<small>${esc(h.sub)}</small>`;
      li.onclick = () => { list.hidden = true; setScope(h.kind, h.name, h.id); };
      list.append(li);
    }
    list.hidden = !hits.length;
  };
  input.onkeydown = (e) => { if (e.key === 'Enter' && list.firstChild) list.firstChild.click(); if (e.key === 'Escape') list.hidden = true; };
  $p('#pAirshed').onchange = $p('#pRadius').onchange = $p('#pModel').onchange = () => render();

  function setScope(kind, name, id) {
    const ids = new Set(districts.features.filter((f) => (kind === 'state' ? f.properties.state === name : f.properties.id === id)).map((f) => f.properties.id));
    scope = { kind, name, ids };
    ai = { text: '', meta: '', busy: false, answer: '', q: '' };
    input.value = name;
    render(true);
  }

  // ---------- compute ----------
  function compute() {
    const D = byId(), inScope = [...scope.ids].map((id) => D[id]);
    const R = +$p('#pRadius').value, air = new Set();
    if ($p('#pAirshed').checked) {
      for (const f of districts.features) {
        if (scope.ids.has(f.properties.id)) continue;
        if (inScope.some((g) => km(centre(f), centre(g)) <= R)) air.add(f.properties.id);
      }
    }
    const all = [...scope.ids, ...air], model = $p('#pModel').checked;
    const issues = [];
    for (const id of all) {
      for (const r of P.issues[id] || []) {
        const h = P.harm[r[0]];
        if (!h || (h.status !== 'validated' && !model)) continue;
        issues.push({ id, v: r[0], p: r[1], score: r[2], slope: r[3], q: r[4], rel: r[5], lo: r[6], hi: r[7], inside: scope.ids.has(id) });
      }
    }
    issues.sort((a, b) => b.score - a.score);
    const alerts = [];
    for (const id of all) {
      const a = P.anomalies[id] || {};
      if (a.FIRE && a.FIRE.relative >= 2 && a.FIRE.now >= 20) alerts.push({ id, kind: 'FIRE', a: a.FIRE, key: a.FIRE.relative });
      for (const v of ['SO2', 'NO2']) if (a[v] && a[v].z !== null && a[v].z >= 2) alerts.push({ id, kind: v, a: a[v], key: a[v].z });
    }
    alerts.sort((x, y) => y.key - x.key);
    const allSet = new Set(all);
    const sources = suspects.features.filter((f) => allSet.has(districtOf(f)))
      .map((f) => ({ f, t: P.source_tags[f.properties.id] || {}, inside: scope.ids.has(districtOf(f)) }))
      .sort((a, b) => (b.f.properties.co2e_t || 0) - (a.f.properties.co2e_t || 0));
    return { D, all, air, issues, alerts, sources };
  }
  const nameToId = {};
  function districtOf(f) {
    const k = f.properties.district + '|' + f.properties.state;
    if (!(k in nameToId)) { const g = districts.features.find((x) => x.properties.label === f.properties.district && x.properties.state === f.properties.state); nameToId[k] = g ? g.properties.id : null; }
    return nameToId[k];
  }

  // ---------- render ----------
  let last = null;
  function render(fly) {
    if (!scope || !P) return;
    const c = (last = compute()), D = c.D;
    const nIn = scope.ids.size, nAir = c.air.size, hot = c.sources.filter((s) => s.t.so2_hot).length;
    const dname = (id) => esc(D[id].properties.label) + (scope.ids.has(id) ? '' : ' <span class="tag air">airshed</span>');

    let h = `<div class="pstat"><div><b>${nIn}</b><span>district${nIn > 1 ? 's' : ''}</span></div><div><b>${nAir}</b><span>airshed</span></div>
      <div><b>${c.issues.length}</b><span>issues</span></div><div><b>${c.sources.length}</b><span>sources</span></div></div>`;

    if (ver === 'v2') h += aiBlock();
    h += `<h3>Issues <span class="hint">worsening and significant, ranked</span></h3>`;
    h += c.issues.length ? '<ol class="issues">' + c.issues.slice(0, 15).map((x) => {
      const m = T.vars[x.v];
      return `<li id="fact-I${c.issues.indexOf(x) + 1}"><button type="button" data-id="${x.id}" data-v="${x.v}" data-p="${x.p}">
        <span class="sc" style="--w:${x.score}%">${Math.round(x.score)}</span>
        <span class="tx">${ver === 'v2' ? `<span class="fid">I${c.issues.indexOf(x) + 1}</span> ` : ''}<b>${esc(m.short)}</b> ${x.slope * P.harm[x.v].sign > 0 ? (P.harm[x.v].sign > 0 ? 'rising' : 'falling') : ''} in ${dname(x.id)}
        <small>${esc(String(lab(x.p)))} · ${signed(x.slope)}${m.unit ? ' ' + esc(m.unit) : ''}/decade${x.rel !== null ? ` (${signed(x.rel)}%)` : ''}${x.lo != null ? ` · 95% CI ${signed(x.lo)} to ${signed(x.hi)}` : ''} · q ${pq(x.q)} · ${m.years.join('–')}</small></span></button></li>`;
    }).join('') + '</ol>' : '<p class="empty">No significant worsening trend in this area.</p>';

    h += `<h3>Alerts <span class="hint">now vs normal</span></h3>`;
    const fa = (x) => (ver === 'v2' ? `<span class="fid">A${c.alerts.indexOf(x) + 1}</span> ` : '');
    h += c.alerts.length ? c.alerts.slice(0, 8).map((x) => x.kind === 'FIRE'
      ? `<div class="alert">${fa(x)}<b>Fires</b> in ${dname(x.id)}: ${x.a.now} detections, ${x.a.relative}× more unusual than India overall<small>${esc(x.a.window)} · NASA FIRMS VIIRS vs MODIS same-month normal</small></div>`
      : `<div class="alert">${fa(x)}<b>${esc(T.vars[x.kind].short)}</b> in ${dname(x.id)}: ${x.a.z.toFixed(1)} standard deviations above normal<small>${esc(x.a.window)} · ${esc(T.vars[x.kind].source)}</small></div>`).join('')
      : '<p class="empty">No district in this area is far above its normal right now.</p>';

    h += `<h3>Watchlist <span class="hint">largest sources in the area</span></h3>`;
    h += c.sources.length ? c.sources.slice(0, 10).map((s, si) => {
      const p = s.f.properties, tags = [];
      if (s.t.so2_hot) tags.push(`<span class="tag so2">SO₂ hotspot · top ${Math.max(1, Math.round(100 - s.t.so2_pct))}%</span>`);
      if (s.t.no2_sig && s.t.no2_slope > 0) tags.push('<span class="tag no2">NO₂ rising here</span>');
      if (!s.inside) tags.push('<span class="tag air">airshed</span>');
      return `<button type="button" class="src" data-sid="${esc(p.id)}"><span class="dot" style="background:${TYPE_COLOR[p.type]}"></span>
        <span>${ver === 'v2' ? `<span class="fid">S${si + 1}</span> ` : ''}<b>${esc(p.name)}</b> ${tags.join(' ')}<small>${esc(p.type)}${p.fuel ? ' · ' + esc(p.fuel) : ''} · ${tonnes(p.co2e_t)} CO₂e/yr · ${esc(p.district || '')}</small></span></button>`;
    }).join('') : '<p class="empty">No mapped industrial source in this area.</p>';
    if (hot) h += `<p class="note">${hot} source${hot > 1 ? 's' : ''} in this area sit in India's top 5% of SO₂ cells (OMI, 2019–2025).</p>`;

    h += `<div class="pbtns"><button type="button" id="pBrief">Download policy brief</button><button type="button" id="pPrint">Print</button></div>`;
    h += `<div class="caveat">${P.notes.map(esc).join('<br>')}</div>`;
    $p('#pBody').innerHTML = h;

    $p('#pBody').querySelectorAll('.issues button').forEach((b) => { b.onclick = () => openIssue(b.dataset.id, b.dataset.v, b.dataset.p); });
    $p('#pBody').querySelectorAll('.src').forEach((b) => { b.onclick = () => { const f = suspects.features.find((x) => x.properties.id == b.dataset.sid); if (f) { map.flyTo({ center: f.geometry.coordinates, zoom: 9 }); sourcePopup(f); } }; });
    $p('#pBrief').onclick = () => download(ver === 'v2' && ai.text ? aiDoc(c) : brief(c));
    if (ver === 'v2') wireAI(c);
    $p('#pPrint').onclick = () => { const w = window.open('', '_blank'); if (w) { w.document.write(`<pre style="font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap;padding:24px">${esc(brief(c))}</pre>`); w.document.close(); w.print(); } };
    paintScope(c, fly);
  }

  function openIssue(id, v, p) {
    const i = Object.keys(T.vars).indexOf(v);
    if (i >= 0) window.pickVar(v);
    window.pickSeason(p);
    paintScope(last, false);
    select(id, true);
  }

  // ---------- map ----------
  function paintScope(c, fly) {
    const best = {};
    for (const x of c.issues) best[x.id] = Math.max(best[x.id] || 0, x.score);
    const inArea = new Set(c.all);
    for (const f of districts.features) {
      const id = f.properties.id, s = best[id] || 0;
      f.properties.pc = s ? `rgb(${mix([213, 217, 222], [242, 142, 43], Math.min(1, s / 100)).join(',')})` : '#3a4653';
      f.properties.o = inArea.has(id) ? (s ? 0.25 + 0.6 * (s / 100) : 0.18) : 0.04;
      f.properties.h = 0;
    }
    map.getSource('districts').setData(districts);
    map.setPaintProperty('d-fill', 'fill-color', ['get', 'pc']);
    map.setPaintProperty('d-fill', 'fill-opacity', ['get', 'o']);
    if (map.getLayer('px')) map.setLayoutProperty('px', 'visibility', 'none');
    const scopeFilter = ['in', ['get', 'id'], ['literal', [...scope.ids]]], airFilter = ['in', ['get', 'id'], ['literal', [...c.air]]];
    if (!map.getLayer('p-scope')) {
      map.addLayer({ id: 'p-air', type: 'line', source: 'districts', filter: airFilter, paint: { 'line-color': VIOLET, 'line-width': 0.8, 'line-dasharray': [2, 2], 'line-opacity': 0.6 } }, 'd-sel');
      map.addLayer({ id: 'p-scope', type: 'line', source: 'districts', filter: scopeFilter, paint: { 'line-color': VIOLET, 'line-width': 2 } }, 'd-sel');
    }
    map.setFilter('p-scope', scopeFilter); map.setFilter('p-air', airFilter);
    for (const l of ['p-scope', 'p-air']) map.setLayoutProperty(l, 'visibility', 'visible');
    if (fly) map.fitBounds(bounds(districts.features.filter((f) => inArea.has(f.properties.id))), { padding: { top: 70, bottom: 50, left: 400, right: 60 }, maxZoom: 8, duration: 1200 });
  }

  // ---------- v2: AI-assisted brief ----------
  function facts(c) {
    const D = c.D, m = (v) => T.vars[v], R = +$p('#pRadius').value;
    return {
      jurisdiction: { name: scope.name, kind: scope.kind, districts: scope.ids.size, airshed_districts: c.air.size, airshed_radius_km: $p('#pAirshed').checked ? R : 0 },
      method: 'Mann-Kendall trend test (seasonal for whole year; Hamed-Rao corrected for seasons), Sen slope per decade with 95% confidence interval, Benjamini-Hochberg false discovery rate across 735 districts, significant if q < 0.05. NASA satellite records 2001/2005-2025.',
      issues: c.issues.slice(0, 15).map((x, i) => ({
        id: `I${i + 1}`, district: D[x.id].properties.label, state: D[x.id].properties.state, in_jurisdiction: scope.ids.has(x.id),
        variable: m(x.v).label, unit: m(x.v).unit || 'unitless', season: String(lab(x.p)), change_per_decade: x.slope,
        ci95_per_decade: x.lo != null ? [x.lo, x.hi] : null, change_percent_of_average_per_decade: x.rel, q_value: x.q,
        record: m(x.v).years.join('-'), source: m(x.v).source, resolution: m(x.v).res, score_0_100: x.score })),
      alerts: c.alerts.slice(0, 8).map((x, i) => x.kind === 'FIRE'
        ? { id: `A${i + 1}`, type: 'active fires', district: D[x.id].properties.label, detections: x.a.now, window: x.a.window, times_more_unusual_than_india: x.a.relative, basis: x.a.basis }
        : { id: `A${i + 1}`, type: m(x.kind).label, district: D[x.id].properties.label, standard_deviations_above_normal: x.a.z, window: x.a.window, now: x.a.now, normal: x.a.normal, unit: m(x.kind).unit }),
      sources: c.sources.slice(0, 10).map((s, i) => ({
        id: `S${i + 1}`, name: s.f.properties.name, type: s.f.properties.type, fuel: s.f.properties.fuel || null, district: s.f.properties.district,
        in_jurisdiction: s.inside, estimated_co2e_tonnes_2024: s.f.properties.co2e_t,
        so2_hotspot: !!s.t.so2_hot, so2_cell_percentile_india: s.t.so2_pct ?? null, no2_trend_at_location_per_decade: s.t.no2_slope ?? null, no2_trend_significant: !!s.t.no2_sig })),
      caveats: P.notes,
    };
  }
  function aiBlock() {
    const out = ai.busy ? '<p class="empty">Claude is reading the evidence…</p>' : ai.text ? `<div class="aitext">${md(ai.text)}</div>${checkNumbers(ai.text)}<p class="note">${esc(ai.meta)}</p>` : '<p class="note">Claude drafts a brief from the issues, alerts and sources below, citing each by ID. Every number is checked against the data.</p>';
    return `<div class="aibox"><h3>AI brief <span class="hint">Claude, grounded in this page</span></h3>${out}
      <div class="pbtns"><button type="button" id="aiGo" ${ai.busy ? 'disabled' : ''}>${ai.text ? 'Regenerate brief' : 'Generate AI brief'}</button></div>
      <div class="ask"><input id="aiQ" type="search" placeholder="Ask about this area, e.g. which issue is most certain?" value="${esc(ai.q)}" aria-label="Ask about this area"><button type="button" id="aiAsk">Ask</button></div>
      ${ai.answer ? `<div class="aitext answer">${md(ai.answer)}</div>${checkNumbers(ai.answer)}` : ''}</div>`;
  }
  async function callAI(c, mode, question) {
    const r = await fetch('api/brief', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode, question, facts: facts(c) }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || `Request failed (${r.status})`);
    return j;
  }
  function wireAI(c) {
    const go = $p('#aiGo'), ask = $p('#aiAsk'), q = $p('#aiQ');
    if (go) go.onclick = async () => {
      ai.busy = true; render();
      try { const j = await callAI(c, 'brief'); ai.text = j.text; ai.meta = `Drafted by ${j.model}. Check the cited facts before use.`; }
      catch (e) { ai.text = ''; ai.meta = ''; alertBox(e.message); return; }
      finally { ai.busy = false; }
      render();
    };
    const doAsk = async () => {
      ai.q = q.value.trim(); if (!ai.q) return;
      ask.disabled = true; ask.textContent = '…';
      try { const j = await callAI(c, 'ask', ai.q); ai.answer = j.text; } catch (e) { ai.answer = `**Could not answer:** ${e.message}`; }
      render();
    };
    if (ask) ask.onclick = doAsk;
    if (q) q.onkeydown = (e) => { if (e.key === 'Enter') doAsk(); };
    $p('#pBody').querySelectorAll('.cite').forEach((b) => { b.onclick = () => cite(c, b.dataset.f); });
  }
  function alertBox(msg) { ai.busy = false; render(); const box = document.createElement('div'); box.className = 'alert'; box.innerHTML = `<b>AI unavailable.</b> ${esc(msg)}<small>The rules-based brief still works: use Download policy brief.</small>`; $p('.aibox').insertBefore(box, $p('.aibox .pbtns')); }
  function cite(c, f) {
    const k = f[0], i = +f.slice(1) - 1;
    if (k === 'I' && c.issues[i]) openIssue(c.issues[i].id, c.issues[i].v, c.issues[i].p);
    else if (k === 'S' && c.sources[i]) { const s = c.sources[i].f; map.flyTo({ center: s.geometry.coordinates, zoom: 9 }); sourcePopup(s); }
    else if (k === 'A' && c.alerts[i]) select(c.alerts[i].id, true);
  }
  function md(t) { // tiny, safe markdown: escape first, then ##, -, **, [I1]
    const lines = esc(t).split('\n'); let html = '', inList = false;
    for (let l of lines) {
      l = l.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[([IAS]\d{1,2})\]/g, '<button type="button" class="cite" data-f="$1">$1</button>');
      if (/^#{1,4} /.test(l)) { if (inList) { html += '</ul>'; inList = false; } html += `<h4>${l.replace(/^#{1,4} /, '')}</h4>`; }
      else if (/^\s*[-*] /.test(l)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${l.replace(/^\s*[-*] /, '')}</li>`; }
      else if (l.trim()) { if (inList) { html += '</ul>'; inList = false; } html += `<p>${l}</p>`; }
    }
    return html + (inList ? '</ul>' : '');
  }
  function checkNumbers(text) { // every number in the AI text should exist in the facts (allowing rounding)
    if (!last) return '';
    const known = [];
    JSON.stringify(facts(last), (k, v) => { if (typeof v === 'number') known.push(Math.abs(v)); if (typeof v === 'string') (v.match(/\d+(?:\.\d+)?/g) || []).forEach((n) => known.push(+n)); return v; });
    const body = text.replace(/\[[IAS]\d{1,2}\]/g, '');
    const nums = [...new Set(body.match(/\d[\d,]*(?:\.\d+)?/g) || [])].map((s) => s.replace(/,/g, ''));
    const bad = nums.filter((s) => {
      const x = +s, dec = (s.split('.')[1] || '').length;
      if (!dec && x < 10) return false; // small counts ("3 districts")
      return !known.some((k) => Math.abs(k - x) <= 0.5 * 10 ** -dec + 1e-9 || Math.abs(k * 100 - x) <= 0.5 * 10 ** -dec);
    });
    return bad.length ? `<p class="numcheck bad">⚠ ${bad.length} number${bad.length > 1 ? 's' : ''} not found in the data: ${bad.slice(0, 8).map(esc).join(', ')}. Check before use.</p>`
      : `<p class="numcheck ok">✓ Every number matches the data on this page (${nums.length} checked).</p>`;
  }
  function aiDoc(c) {
    return [`# AI-assisted evidence brief: ${scope.name}`, `Drafted with Claude from EarthSignal facts (${new Date().toISOString().slice(0, 10)}). Fact IDs refer to the tables below.`, '', ai.text, '', '---', '', brief(c)].join('\n');
  }

  // ---------- brief ----------
  function brief(c) {
    const D = c.D, today = new Date().toISOString().slice(0, 10), m = (v) => T.vars[v];
    const lines = [
      `# Environmental evidence brief: ${scope.name}`,
      `Prepared ${today} with EarthSignal (Team Friday, NASA Space Apps 2026). Data: NASA satellites and models; method: Mann-Kendall test, Sen's slope, Benjamini-Hochberg false-discovery-rate correction (q < 0.05).`,
      '',
      `Scope: ${scope.ids.size} district(s) in ${scope.name}` + (c.air.size ? ` plus ${c.air.size} airshed district(s) within ${$p('#pRadius').value} km.` : '.'),
      '',
      '## Worsening, statistically significant trends',
      '| # | District | Variable | Season | Change per decade | 95% CI | q | Record |',
      '|---|---|---|---|---|---|---|---|',
      ...c.issues.slice(0, 15).map((x, i) => `| ${i + 1} | ${D[x.id].properties.label}${scope.ids.has(x.id) ? '' : ' (airshed)'} | ${m(x.v).short} | ${lab(x.p)} | ${signed(x.slope)} ${m(x.v).unit}${x.rel !== null ? ` (${signed(x.rel)}%)` : ''} | ${x.lo != null ? `${signed(x.lo)} to ${signed(x.hi)}` : 'n/a'} | ${pq(x.q)} | ${m(x.v).years.join('-')} |`),
      '',
      '## Current alerts (now vs normal)',
      ...(c.alerts.length ? c.alerts.slice(0, 8).map((x) => x.kind === 'FIRE'
        ? `- Fires in ${D[x.id].properties.label}: ${x.a.now} detections (${x.a.window}), ${x.a.relative}x more unusual than India overall.`
        : `- ${m(x.kind).short} in ${D[x.id].properties.label}: ${x.a.z.toFixed(1)} SD above normal (${x.a.window}).`) : ['- None.']),
      '',
      '## Largest emission sources in the area (Climate TRACE 2024 estimates)',
      ...c.sources.slice(0, 10).map((s) => `- ${s.f.properties.name} (${s.f.properties.type}${s.f.properties.fuel ? ', ' + s.f.properties.fuel : ''}), ${tonnes(s.f.properties.co2e_t)} CO2e/yr, ${s.f.properties.district}` +
        (s.t.so2_hot ? `; in India's top ${Math.max(1, Math.round(100 - s.t.so2_pct))}% of SO2 cells` : '') + (s.t.no2_sig && s.t.no2_slope > 0 ? '; NO2 rising significantly at this location' : '')),
      '',
      '## How to read this',
      ...P.notes.map((n) => `- ${n}`),
      '- Trends show change over the record, not current concentrations or health thresholds.',
      '- Satellite cells are 25-100 km; neighbouring districts can share a cell.',
      '',
      'Sources: NASA Aura OMI (NO2, SO2), Terra/Aqua MODIS, NASA FIRMS, NASA POWER (MERRA-2, CERES), Climate TRACE (CC BY 4.0), geoBoundaries (ODbL).',
    ];
    return lines.join('\n');
  }
  function download(text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    a.download = `EarthSignal-brief-${scope.name.replace(/\W+/g, '-')}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
})();
