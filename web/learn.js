/* Learn: plain-language definitions and guided "data detective" cases with questions.
   A separate view opened from the top-right Learn button; Detect and Policy are untouched.
   Drives the map through app.js globals: T, S, districts, suspects, map, select, pickVar,
   pickSeason, setView, esc, signed, pq, VAL. Every number shown is read live from the data. */
(function () {
  const $l = (s) => document.querySelector(s);
  const btn = $l('#learnBtn'), panel = $l('#learn'), body = $l('#learnBody');
  let open = false, section = 'cases', run = null; // run: { key, step, score, answered }

  // ---------- plain-language definitions (challenge: "simple definitions of the variables") ----------
  const DEFS = {
    NO2: ['A brown, irritating gas made whenever fuel burns hot: power plants, vehicles, industry.',
      'It harms lungs and helps form ozone and fine particles.',
      'NASA\'s OMI instrument on the Aura satellite measures sunlight passing through the air; NO₂ absorbs certain colours, so the satellite can count how much is in the column of air below it, every day since 2004.',
      'More coal burning or traffic raises it; cleaner fuels, filters and fewer vehicles lower it.'],
    SO2: ['A sharp-smelling gas released mainly by burning coal and oil that contain sulphur, and by metal smelters and volcanoes.',
      'It irritates airways, makes acid rain and turns into fine particles.',
      'The same OMI satellite measures it by its colour signature. It is a weak signal, so it is clearest over big sources like coal power stations and smelters.',
      'New coal plants raise it; flue-gas scrubbers (FGD units) on chimneys cut it sharply.'],
    AOD_55: ['Aerosol optical depth (AOD): how hazy the air is, measured as how much sunlight is blocked by tiny particles of dust, smoke and pollution.',
      'Haze is a sign of fine particles (PM2.5) that people breathe in.',
      'Estimated from NASA satellites (MODIS, via the CERES product) that compare how bright the ground looks with how bright it should be. 0.1 is clear air; above 0.5 is very hazy.',
      'Crop burning, dust storms, industry and traffic raise it; rain washes it out.'],
    ALLSKY_SFC_SW_DWN: ['Sunlight reaching the ground: the solar energy that arrives at the surface after passing through clouds and haze.',
      'Less sunlight ("dimming") means more haze or cloud; it affects crops and solar power.',
      'Calculated by NASA\'s CERES satellite instruments. Unit: megajoules of energy per square metre per day.',
      'More haze or cloud lowers it.'],
    FIRE: ['Active fires: how many fires satellites spot burning, per 1000 km² per month.',
      'Fires release smoke and gases; crop-residue burning is a major source of winter haze in north India.',
      'NASA\'s MODIS instruments on the Terra and Aqua satellites detect the heat of fires as they pass overhead (around 10:30 and 13:30 local time).',
      'Harvest burning raises it; bans, machines that handle crop stubble, and rain lower it. Fires lit after the satellite passes are missed.'],
    NDVI: ['Greenness (NDVI): how green and leafy the land is, from 0 (bare ground) to about 0.9 (dense forest).',
      'It tracks crops, forests and land being cleared or built on.',
      'MODIS compares red light (which leaves absorb) with near-infrared light (which leaves reflect). Healthy plants show a big difference.',
      'Irrigation, more crops per year and tree planting raise it; drought, clearing and building lower it.'],
    LST: ['Land surface temperature: how hot the ground itself is in the late morning, which is hotter than the air in sunshine.',
      'Hot surfaces heat cities and stress crops.',
      'MODIS on the Terra satellite measures heat (thermal infrared) given off by the ground. We stop in 2022 because Terra started passing over earlier in the day, which looks like false cooling.',
      'Concrete and bare soil raise it; plants, water and irrigation lower it.'],
    T2M: ['Air temperature 2 metres above the ground, averaged over day and night.',
      'This is the temperature people feel and weather stations report.',
      'From NASA\'s MERRA-2 model, which blends satellite and weather observations into a complete map. Not measured directly at each place, so treat with care.',
      'Greenhouse gases warm it; haze and irrigation can cool it locally.'],
    T2M_MAX: ['Peak heat: the hottest daily air temperature in each month.',
      'Extreme heat days drive heat stress and deaths.',
      'From the MERRA-2 model (see air temperature). Not yet checked against weather stations.',
      'Same drivers as air temperature, plus dry soil, which heats faster.'],
    PRECTOTCORR: ['Rainfall: average rain and snow per day, in millimetres.',
      'Water for farms, rivers and drinking; too much brings floods.',
      'From the MERRA-2 model, corrected with rain gauges. An independent satellite (GPM) disagrees with some of its biggest trends, so use with care.',
      'Monsoon strength, warming oceans and local land changes affect it.'],
    GWETROOT: ['Soil moisture: how wet the soil is around plant roots, from 0 (dry) to 1 (soaked).',
      'Crops and forests depend on it; drying soil warns of drought.',
      'From the MERRA-2 model, which tracks rain, evaporation and drainage. Not measured directly.',
      'Rain and irrigation raise it; heat, wind and over-pumping lower it.'],
  };
  const TERMS = [
    ['Trend', 'A steady change in one direction over many years, not a one-off spike.'],
    ['Sen\'s slope', 'How fast something is changing, per decade. It is the middle value of the slopes between every pair of years, so one odd year can\'t distort it.'],
    ['95% confidence interval (CI)', 'The range the true rate of change probably lies in. If the whole range is above zero, we are confident it is rising; if it includes zero, it might not be changing at all.'],
    ['Mann-Kendall test and p-value', 'Checks whether later years are consistently higher (or lower) than earlier ones. The p-value is the chance of seeing a pattern this strong if nothing were really changing. Small p = unlikely to be luck.'],
    ['Correction for chance (q-value)', 'We test 735 districts. At p < 0.05, about 37 would look "significant" by luck alone. The q-value corrects for that; we call a trend significant only if q < 0.05.'],
    ['Seasonal cycle', 'Monsoon and winter make values swing hugely every year. We compare each month only with the same month in other years, so the seasons cancel out.'],
    ['Significant', 'Unlikely to be chance after the correction. It does NOT mean big, dangerous or important.'],
    ['Alibi', 'Something that looks like a trend for one district but fails the correction for chance, so we can\'t claim it.'],
    ['Satellite vs model', 'Satellite variables are measured from space. Model variables (MERRA-2) are computer reconstructions that blend observations; useful, but they can contain artefacts.'],
  ];

  // ---------- helpers that read the real data ----------
  const idOf = (label) => { const f = districts.features.find((x) => x.properties.label === label || x.properties.name === label); return f && f.properties.id; };
  const row = (label, v, p = 'year') => { const id = idOf(label); return id && T.d[id] && T.d[id][v] ? T.d[id][v][T.periods.indexOf(p)] : null; };
  const unit = (v) => (T.vars[v].unit ? ' ' + T.vars[v].unit : '');
  const rate = (v, r) => `${signed(r[0])}${unit(v)} per decade`;
  const ci = (r) => (r[4] != null ? `${signed(r[4])} to ${signed(r[5])}` : 'n/a');
  const val = (v, site) => (typeof VAL !== 'undefined' && VAL ? VAL.find((x) => x.variable === v && x.site.startsWith(site)) : null);
  const syncView = (v) => document.querySelectorAll('#viewSel button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === v));
  const go = (label, v, p = 'year') => { setView('districts'); syncView('districts'); pickVar(v); pickSeason(p); const id = idOf(label); if (id) select(id, true); };

  // ---------- guided cases: steps are either narration ("show") or a question ("ask") ----------
  const CASES = {
    coal: {
      title: 'The coal belt', blurb: 'Is NO₂ really rising where India burns its coal?',
      steps: () => {
        const r = row('Singrauli', 'NO2'), n = suspects.features.filter((f) => f.properties.district === 'Singrauli').length;
        return [
          { show: `We fly to <b>Singrauli</b> (Madhya Pradesh), home to some of India's biggest coal power stations. The map shows <b>NO₂</b> for the whole year.`, act: () => go('Singrauli', 'NO2') },
          { ask: 'Singrauli is filled with <b>solid</b> coral. What does the solid colour tell you?',
            opts: ['NO₂ here is at a dangerous level', 'NO₂ here has a statistically significant trend', 'The satellite had no data here'], a: 1,
            why: 'Colour shows the direction of change (coral rising, blue falling) and solid means significant. It says nothing about whether today\'s level is safe; that needs ground monitors and health limits.' },
          { ask: `The case file says NO₂ is changing by <b>${rate('NO2', r)}</b>, with a 95% confidence interval of <b>${ci(r)}</b>. What follows?`,
            opts: ['The whole range is above zero, so we are confident it is rising', 'The range includes zero, so it may not be rising', 'Confidence intervals only apply to temperature'], a: 0,
            why: `Every value in ${ci(r)} is positive. Even the cautious end of the range is a rise, so the trend is not luck (q ${pq(r[2])}).` },
          { show: `Scroll the case file to <b>Suspects</b>: ${n} mapped industrial sources sit inside Singrauli, many of them coal power plants.`, act: () => {} },
          { ask: 'Coal plants and rising NO₂ share the same district. What can a careful detective conclude?',
            opts: ['The plants caused the rise', 'They are in the same place; proving cause needs more evidence, such as stack data, ground monitors and wind patterns', 'The satellite measures each plant\'s NO₂ separately'], a: 1,
            why: 'A satellite pixel is about 25 km wide and mixes every source inside it, and wind moves pollution around. Being in the same place is a strong lead, not proof.' },
        ];
      },
    },
    opposite: {
      title: 'Same gas, opposite directions', blurb: 'Can one gas rise in one place and fall in another?',
      steps: () => {
        const a = row('Singrauli', 'NO2'), b = row('New Delhi', 'NO2');
        return [
          { show: `Now <b>New Delhi</b>, same gas, same years. NO₂ here: <b>${rate('NO2', b)}</b> (95% CI ${ci(b)}).`, act: () => go('New Delhi', 'NO2') },
          { ask: `Singrauli's NO₂ is rising (${signed(a[0])}) but New Delhi's is falling (${signed(b[0])}). How can that be?`,
            opts: ['One of the two measurements must be wrong', 'Changes in where and how fuel is burned can push one place up and another down at the same time', 'Satellites only work over cities'], a: 1,
            why: 'Possible reasons include cleaner fuels, newer vehicles and moving industry out of cities while coal power grows elsewhere. This is exactly what the NASA challenge warns about: one process, opposite trends in different regions.' },
          { show: 'Switch on <b>Satellite pixels</b> to see the pattern without district borders: rising across the coal belt and Indo-Gangetic plain, falling over some big cities.', act: () => { setView('pixels'); syncView('pixels'); map.flyTo({ center: [80.5, 24.5], zoom: 4.6 }); } },
          { ask: 'Faded pixels are everywhere between the bright ones. What are they?',
            opts: ['Places with no satellite data', 'Places where the change could be chance (not significant)', 'Places where NO₂ is zero'], a: 1,
            why: 'Faded means the test could not separate the trend from year-to-year noise. A longer record might make it significant, or there may be no real trend.' },
        ];
      },
    },
    rain: {
      title: 'The rain trend that wasn\'t', blurb: 'A significant result from a flawed dataset.',
      steps: () => {
        const r = row('Lawngtlai', 'PRECTOTCORR'), g = val('PRECTOTCORR', 'Lawngtlai');
        return [
          { show: `<b>Lawngtlai</b>, Mizoram. The MERRA-2 <b>model</b> says rainfall is rising <b>${rate('PRECTOTCORR', r)}</b> (q ${pq(r[2])}): a huge, highly significant change.`, act: () => go('Lawngtlai', 'PRECTOTCORR') },
          { ask: 'The result is highly significant. Is that enough to trust it?',
            opts: ['Yes: q < 0.05 means it is true', 'Not yet: a test only checks the numbers it is given. If the dataset is flawed, the result is too, so check another source', 'No: rainfall never changes'], a: 1,
            why: 'Significance protects against luck, not against a bad dataset. Rainfall here comes from a computer model, so we compare it with an independent measurement.' },
          { show: g ? `We asked NASA's Giovanni tool for <b>GPM IMERG</b>, rainfall measured by satellite radar and microwave sensors, at the same place. It shows <b>${signed(g.giovanni_slope_decade)} mm/day per decade, p = ${g.giovanni_p}</b>: no significant trend.`
            : 'NASA\'s GPM IMERG satellite rainfall at the same place shows no significant trend.', act: () => {} },
          { ask: 'What should a data detective report?',
            opts: ['The model\'s big rainfall rise', 'That the rise is not confirmed by independent data: treat it as an alibi and say so', 'That all rainfall data is useless'], a: 1,
            why: 'Good detectives cross-check. EarthSignal marks rainfall as "not yet validated" for exactly this reason, and the Policy tab leaves it out.' },
        ];
      },
    },
    quiz: {
      title: 'Quick quiz', blurb: 'Five questions on the ideas behind the map.',
      steps: () => [
        { ask: 'What does the Mann-Kendall test check?', opts: ['Whether values keep going up or down over the years, without assuming a straight line', 'The average value', 'Whether any data is missing'], a: 0,
          why: 'It compares every pair of years: are later years mostly higher, or mostly lower? It works even when the change is not a straight line.' },
        { ask: 'What is Sen\'s slope?', opts: ['The single biggest jump between two years', 'The middle value of the slopes between all pairs of years, a robust rate of change', 'The last year minus the first year'], a: 1,
          why: 'Using the middle (median) slope means one extreme year cannot drag the answer up or down.' },
        { ask: 'Why do we correct for testing 735 districts?', opts: ['With hundreds of tests, some look significant by luck; the correction removes those', 'To make the map look nicer', 'Because districts are different sizes'], a: 0,
          why: 'At p < 0.05, about 1 in 20 tests looks significant by chance, roughly 37 of 735 districts. The q-value accounts for that.' },
        { ask: 'Why remove the seasonal cycle before testing?', opts: ['Satellites do not work in summer', 'Monsoon and winter swings repeat every year and would hide or fake a trend; comparing the same month across years cancels them', 'Seasons do not matter for air quality'], a: 1,
          why: 'Winter NO₂ is always higher than monsoon NO₂. Comparing January with January removes that, leaving the long-term change.' },
        { ask: 'A trend\'s 95% confidence interval is −0.2 to +0.6. What can you say?', opts: ['It is definitely rising', 'It is definitely falling', 'It might not be changing at all: the range includes zero'], a: 2,
          why: 'When the range crosses zero, the data are consistent with no change. A longer record might narrow the range enough to decide.' },
      ],
    },
  };

  // ---------- open / close (top-right button) ----------
  btn.onclick = () => (open ? close() : openLearn());
  function openLearn() {
    if (!window.__ready) return;
    if (document.body.classList.contains('policy-mode')) { const d = document.querySelector('#modeTabs button[data-mode=detect]'); if (d) d.click(); }
    open = true;
    document.body.classList.add('learn-mode');
    btn.setAttribute('aria-pressed', 'true');
    $l('#controls').hidden = true; $l('#policy').hidden = true; panel.hidden = false;
    render();
    place();
  }
  function close() {
    open = false; run = null;
    document.body.classList.remove('learn-mode');
    btn.setAttribute('aria-pressed', 'false');
    panel.hidden = true;
    const pol = document.body.classList.contains('policy-mode');
    $l('#controls').hidden = pol; $l('#policy').hidden = !pol;
    setView('districts'); syncView('districts');
    place();
  }
  document.querySelectorAll('#learnTabs button').forEach((b) => { b.onclick = () => { section = b.dataset.l; run = null; render(); }; });

  // Keep the button just left of whatever sits in the top-right corner.
  function place() {
    const exp = document.body.classList.contains('exp'), anchor = exp ? $l('#modeTabs') : $l('#uiToggle');
    if (!anchor || window.innerWidth <= 820) { btn.style.right = ''; return; }
    const r = anchor.getBoundingClientRect();
    btn.style.right = `${Math.round(window.innerWidth - r.left + 8)}px`;
  }
  window.addEventListener('resize', place);
  new MutationObserver(place).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  setTimeout(place, 300);

  // ---------- render ----------
  function render() {
    document.querySelectorAll('#learnTabs button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.l === section));
    body.innerHTML = section === 'defs' ? defs() : section === 'start' ? investigate() : run ? stepView() : caseList();
    if (section === 'start') wireInvestigate();
    body.querySelectorAll('[data-case]').forEach((b) => { b.onclick = () => start(b.dataset.case); });
    body.querySelectorAll('[data-opt]').forEach((b) => { b.onclick = () => answer(+b.dataset.opt); });
    const nx = body.querySelector('#lNext'); if (nx) nx.onclick = next;
    for (const id of ['#lBack', '#lBack2']) { const bk = body.querySelector(id); if (bk) bk.onclick = () => { run = null; render(); }; }
    body.querySelectorAll('[data-show]').forEach((b) => { b.onclick = () => { pickVar(b.dataset.show); }; });
    panel.scrollTop = 0;
  }
  function caseList() {
    return `<p class="lintro">Each case flies the map, opens the evidence and asks you to make the call, like a detective. About 2 minutes each.</p>` +
      Object.entries(CASES).map(([k, c], i) => `<button type="button" class="lcase" data-case="${k}"><span class="ln">${i + 1}</span><span><b>${esc(c.title)}</b><small>${esc(c.blurb)}</small></span><span class="go">Start →</span></button>`).join('');
  }
  function start(key) { run = { key, steps: CASES[key].steps(), step: 0, score: 0, asked: 0, answered: null }; enter(); }
  function enter() { const s = run.steps[run.step]; run.answered = null; if (s.act) { try { s.act(); } catch (e) { /* map not ready */ } } render(); }
  function next() { if (run.step < run.steps.length - 1) { run.step++; enter(); } else { run.step = run.steps.length; render(); } }
  function answer(i) { if (run.answered !== null) return; const s = run.steps[run.step]; run.answered = i; run.asked++; if (i === s.a) run.score++; render(); }
  function stepView() {
    const c = CASES[run.key], n = run.steps.length;
    const dots = `<div class="ldots" aria-label="Step ${Math.min(run.step + 1, n)} of ${n}">${run.steps.map((_, i) => `<span class="${i < run.step ? 'done' : i === run.step ? 'now' : ''}"></span>`).join('')}</div>`;
    let h = `<div class="lhead"><button type="button" id="lBack" class="lback">← All cases</button>${dots}</div><h3 class="ltitle">${esc(c.title)}</h3>`;
    if (run.step >= n) {
      return h + `<div class="lcard done"><p class="lscore">${run.score} / ${run.asked}</p><p>${run.score === run.asked ? 'Perfect detective work.' : 'Good work. The explanations above are worth a second read.'}</p>
        <p class="lsmall">You can keep exploring: the map and case file stay where the case left them.</p></div>
        <div class="lnav"><button type="button" id="lBack2" class="lprimary">Try another case</button></div>`;
    }
    const s = run.steps[run.step];
    if (s.show) return h + `<div class="lcard"><p>${s.show}</p></div><div class="lnav"><button type="button" id="lNext" class="lprimary">${run.step === n - 1 ? 'Finish' : 'Next →'}</button></div>`;
    const done = run.answered !== null, ok = done && run.answered === s.a;
    h += `<div class="lcard q"><p class="lq">${s.ask}</p><div class="lopts">` + s.opts.map((o, i) => {
      const cls = !done ? '' : i === s.a ? 'right' : i === run.answered ? 'wrong' : 'dim';
      return `<button type="button" data-opt="${i}" class="${cls}" ${done ? 'disabled' : ''}>${esc(o)}</button>`;
    }).join('') + '</div>';
    if (done) h += `<p class="lwhy ${ok ? 'ok' : 'no'}"><b>${ok ? 'Right.' : 'Not quite.'}</b> ${s.why}</p>`;
    h += '</div>';
    if (done) h += `<div class="lnav"><button type="button" id="lNext" class="lprimary">${run.step === n - 1 ? 'Finish' : 'Next →'}</button></div>`;
    return h;
  }
  // ---------- Investigate: where? what are you curious about? -> suggested variables ----------
  const TOPICS = { air: ['Air I breathe', ['NO2', 'SO2', 'AOD_55', 'ALLSKY_SFC_SW_DWN']], fire: ['Fire and smoke', ['FIRE', 'AOD_55', 'NO2']],
    green: ['Crops and forests', ['NDVI', 'GWETROOT', 'FIRE']], heat: ['Heat', ['LST', 'T2M', 'T2M_MAX']], water: ['Rain and water', ['PRECTOTCORR', 'GWETROOT', 'NDVI']] };
  const inv = { id: null, topic: null, ai: '', busy: false };
  const SEAS = ['year', 'winter', 'premonsoon', 'monsoon', 'postmonsoon'];
  function verdict(id, v) { // strongest significant period, else the whole-year result
    const rows = T.d[id] && T.d[id][v]; if (!rows) return null;
    const hits = SEAS.map((p) => ({ p, r: rows[T.periods.indexOf(p)] })).filter((x) => x.r[2] !== null && x.r[2] < T.alpha && x.r[0] !== null);
    const best = hits.find((x) => x.p === 'year') || hits.sort((a, b) => a.r[2] - b.r[2])[0];
    return best ? { ...best, sig: true } : { p: 'year', r: rows[0], sig: false };
  }
  function clues(f) {
    const P = f.properties, src = suspects.features.filter((s) => s.properties.district === P.label && s.properties.state === P.state), out = [];
    if (src.length) { const by = {}; src.forEach((s) => { by[s.properties.type] = (by[s.properties.type] || 0) + 1; });
      const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t, n]) => `${n} × ${t.toLowerCase()}`).join(', ');
      out.push(`${src.length} mapped industrial source${src.length > 1 ? 's' : ''} here (${top}). Worth checking <b>NO₂</b> and <b>SO₂</b>.`); }
    const fr = T.d[P.id] && T.d[P.id].FIRE ? T.d[P.id].FIRE[0][3] : null;
    if (fr !== null) { const all = Object.values(T.d).map((d) => (d.FIRE ? d.FIRE[0][3] : null)).filter((x) => x !== null).sort((a, b) => a - b), pct = all.filter((x) => x <= fr).length / all.length;
      if (pct >= 0.8) out.push(`Fires are common here (more than in ${Math.round(pct * 100)}% of districts). Check <b>Fires</b> and <b>Haze</b>.`); }
    const nd = T.d[P.id] && T.d[P.id].NDVI ? T.d[P.id].NDVI[0][3] : null;
    if (nd !== null) out.push(nd >= 0.5 ? 'Very green land (forest or intensive farming). <b>Greenness</b> shows whether that is changing.' : nd <= 0.25 ? 'Dry or built-up land with little vegetation. <b>Land temperature</b> and <b>Haze</b> are good first checks.' : '');
    return out.filter(Boolean);
  }
  function investigate() {
    const f = inv.id && districts.features.find((x) => x.properties.id === inv.id);
    let h = `<p class="lintro">Answer two questions and we suggest what to look at first, based on what the data shows about that place.</p>
      <p class="istep"><span class="n">1</span>Where do you want to investigate?</p>
      <div class="isearch"><input id="iQ" type="search" placeholder="Type a district, e.g. Pune" autocomplete="off" value="${f ? esc(f.properties.label) : ''}" aria-label="District"><ul id="iR" hidden></ul></div>
      <p class="istep"><span class="n">2</span>What are you curious about?</p>
      <div class="itopics">${Object.entries(TOPICS).map(([k, t]) => `<button type="button" data-topic="${k}" aria-pressed="${inv.topic === k}">${t[0]}</button>`).join('')}</div>`;
    if (!f || !inv.topic) return h + '<p class="lsmall">Pick a place and a topic to get suggestions.</p>';
    h += `<p class="istep"><span class="n">3</span>Start with these in ${esc(f.properties.label)}</p>` + clues(f).map((c) => `<p class="iclue">${c}</p>`).join('');
    const list = TOPICS[inv.topic][1].filter((v) => T.vars[v]).map((v) => ({ v, x: verdict(f.properties.id, v) })).filter((o) => o.x && o.x.r[0] !== null)
      .sort((a, b) => (b.x.sig - a.x.sig) || ((a.x.r[2] ?? 1) - (b.x.r[2] ?? 1)));
    h += list.map(({ v, x }) => { const m = T.vars[v];
      return `<button type="button" class="ivar" data-inv="${v}" data-p="${x.p}"><span class="go">Investigate →</span><b>${esc(m.short)}</b> ${x.sig ? `is <span class="${x.r[0] > 0 ? 'up' : 'down'}">${x.r[0] > 0 ? 'rising' : 'falling'}</span> significantly` : 'shows no significant trend'}
        <small>${x.sig ? `${signed(x.r[0])}${unit(v)} per decade · ${esc(String(T.period_labels[x.p]))} · q ${pq(x.r[2])}` : 'An interesting result too: is it steady, or just too noisy to tell?'}${m.kind === 'model' ? ' · model data, not yet validated' : ''}</small></button>`; }).join('');
    h += `<div class="lnav" style="justify-content:flex-start"><button type="button" id="iAI" class="lback" ${inv.busy ? 'disabled' : ''}>${inv.busy ? 'Asking…' : '✦ Ask AI which to check first'}</button></div>` + (inv.ai ? `<div class="iai">${esc(inv.ai)}</div>` : '');
    return h;
  }
  function wireInvestigate() {
    const q = $l('#iQ'), r = $l('#iR');
    q.oninput = () => { let t = q.value.trim().toLowerCase(); if (t.length >= 2 && !districts.features.some((f) => f.properties.label.toLowerCase().includes(t))) t = window.placeAlias(t); r.innerHTML = ''; if (t.length < 2) { r.hidden = true; return; }
      const hits = districts.features.filter((f) => f.properties.label.toLowerCase().includes(t)).sort((a, b) => a.properties.label.toLowerCase().indexOf(t) - b.properties.label.toLowerCase().indexOf(t)).slice(0, 8);
      for (const f of hits) { const li = document.createElement('li'); li.innerHTML = `${esc(f.properties.label)}<small>${esc(f.properties.state)}</small>`; li.onclick = () => { inv.id = f.properties.id; inv.ai = ''; select(inv.id, true); render(); }; r.append(li); }
      r.hidden = !hits.length; };
    q.onkeydown = (e) => { if (e.key === 'Enter' && r.firstChild) r.firstChild.click(); };
    body.querySelectorAll('[data-topic]').forEach((b) => { b.onclick = () => { inv.topic = b.dataset.topic; inv.ai = ''; render(); }; });
    body.querySelectorAll('[data-inv]').forEach((b) => { b.onclick = () => { setView('districts'); syncView('districts'); pickVar(b.dataset.inv); pickSeason(b.dataset.p); select(inv.id, true); }; });
    const ai = $l('#iAI'); if (ai) ai.onclick = askAI;
  }
  async function askAI() {
    const f = districts.features.find((x) => x.properties.id === inv.id); inv.busy = true; render();
    const facts = { place: { district: f.properties.label, state: f.properties.state }, topic: TOPICS[inv.topic][0],
      issues: TOPICS[inv.topic][1].filter((v) => T.vars[v]).map((v, i) => { const x = verdict(f.properties.id, v); return { id: `I${i + 1}`, variable: T.vars[v].label, kind: T.vars[v].kind, significant: x.sig, season: String(T.period_labels[x.p]), change_per_decade: x.r[0], ci95_per_decade: [x.r[4], x.r[5]], q_value: x.r[2], unit: T.vars[v].unit || 'unitless' }; }),
      sources_in_district: suspects.features.filter((s) => s.properties.district === f.properties.label).length };
    try { const res = await fetch('api/brief', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'ask', facts,
        question: 'I am a student. In plain words and under 120 words, which of these variables should I investigate first in this district and why? Cite fact IDs. Mention if a variable is model data that needs checking.' }) });
      const j = await res.json(); inv.ai = res.ok ? j.text : `AI unavailable: ${j.message || res.status}. The suggestions above do not need AI.`; }
    catch (e) { inv.ai = 'AI unavailable right now. The suggestions above do not need AI.'; }
    inv.busy = false; render();
  }

  function defs() {
    const groups = [['Air quality', ['NO2', 'SO2', 'AOD_55', 'ALLSKY_SFC_SW_DWN']], ['Land and fire', ['FIRE', 'NDVI', 'LST']], ['Climate model · not yet validated', ['T2M', 'T2M_MAX', 'PRECTOTCORR', 'GWETROOT']]];
    let h = '<p class="lintro">Tap a name to show it on the map.</p>';
    for (const [g, keys] of groups) {
      h += `<p class="vgl">${esc(g)}</p>`;
      for (const k of keys) {
        const m = T.vars[k], d = DEFS[k];
        if (!m || !d) continue;
        h += `<details class="ldef"><summary><button type="button" class="lname" data-show="${k}">${esc(m.short)}</button><span class="lone">${esc(d[0])}</span></summary>
          <dl><dt>Why it matters</dt><dd>${esc(d[1])}</dd><dt>How it is measured</dt><dd>${esc(d[2])}</dd><dt>What changes it</dt><dd>${esc(d[3])}</dd>
          <dt>Our record</dt><dd>${m.years.join('–')} · ${esc(m.res)} grid · ${esc(m.unit || 'no unit')} · ${esc(m.source)}</dd></dl></details>`;
      }
    }
    h += '<p class="vgl" style="margin-top:14px">Detective terms</p>' + TERMS.map(([t, d]) => `<details class="ldef"><summary><b class="lterm">${esc(t)}</b></summary><p class="lsmall">${esc(d)}</p></details>`).join('');
    return h;
  }
})();
