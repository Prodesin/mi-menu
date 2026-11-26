/* Mi menú — lógica de la app. Sin dependencias. Datos en data.js (window.MENU_DATA), generador en planner.js (window.MENU_PLANNER). */
(() => {
  'use strict';
  const { GOALS, TYPES, SECTIONS, GROUPS, FOODS, PRECIOS, PRECIOS_FECHA, RECIPES, BY_ID, PLAN, DAYS } = window.MENU_DATA;
  const P = window.MENU_PLANNER;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ================= Utilidades ================= */
  const NB = ' ';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Formato español: 1.850 y coma decimal (toLocaleString no agrupa los miles de 4 cifras)
  const nf = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const nd = (n, d = 1) => { const s = (Math.round(n * 10 ** d) / 10 ** d).toFixed(d).replace('.', ','); return d ? s.replace(/,0+$/, '') : s; };
  const eur = (n) => `${(Math.round(n * 100) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${NB}€`;
  const val = (n, unit) => `${nf(n)}${NB}${unit}`;                 // valor + unidad sin que se parta
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + nf(Math.abs(n));
  const todayIdx = () => (new Date().getDay() + 6) % 7;
  const isoDate = (d = new Date()) => P.isoOf(d);
  const LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const VIEWS = ['hoy', 'semana', 'compra', 'recetas', 'mas'];
  const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.id, t.label]));
  const IN_MEAL = { desayuno: 'el desayuno', comida: 'la comida', cena: 'la cena' };
  const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ration = (f) => `ración ×${nd(f, 2)}`;
  const parseISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  function weekLabel(iso) {
    const a = parseISO(iso), b = parseISO(P.addWeeks(iso, 1)); b.setDate(b.getDate() - 1);
    return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]}` : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
  }
  const inRange = (n, a, b) => Number.isFinite(n) && n >= a && n <= b;
  const RATING = { like: ['👍', 'Me gusta'], less: ['👎', 'Menos a menudo'], never: ['🚫', 'No volver a poner'] };

  /* ================= Estado y persistencia ================= */
  const KEY = 'mi-menu:v2', KEY_V1 = 'mi-menu:v1';
  const SCHEMA = 2;
  const curMonday = () => P.mondayOf(new Date());
  const defaults = () => ({
    v: SCHEMA, weeks: {}, pantry: {}, wk: curMonday(), day: todayIdx(), dayDate: isoDate(), view: 'hoy', sel: 0, filter: 'todas',
    goals: { kcal: GOALS.kcal, prot: GOALS.prot }, excl: {}, ratings: {}, favs: {}, people: [1, 1, 1, 1], store: 'mercadona',
    gen: { leftovers: false, timeWeek: 0, timeWeekend: 0 }, fridge: {}, fridgeOn: false
  });
  const makeWeek = (plan, seed) => ({ plan, orig: clone(plan), seed, n: 0, locks: {}, bought: {}, adj: {}, extra: [], failed: [] });

  const snapFactor = (f) => { const x = Number(f); if (!Number.isFinite(x)) return 1; return P.FACTORS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a)); };
  const eligible = (r, s) => !!r && (r.tipo === TYPES[s].id || (r.tomas && r.tomas.includes(TYPES[s].id)));
  function sanitizePlan(plan) {
    if (!Array.isArray(plan) || plan.length !== 7) return null;
    const out = plan.map((day) => {
      if (day === null) return null;
      if (!Array.isArray(day) || day.length !== 4) return undefined;
      const slots = day.map((x, s) => (x && typeof x === 'object' && eligible(BY_ID[x.r], s)
        ? Object.assign({ r: x.r, f: snapFactor(x.f) }, x.dbl === true ? { dbl: true } : {}, x.left === true ? { left: true } : {}) : null));
      return slots.includes(null) ? undefined : slots;
    });
    if (out.includes(undefined)) return null;
    return P.fixPairs(out);
  }
  function sanitizeWeek(w) {
    if (!w || typeof w !== 'object') return null;
    const plan = sanitizePlan(w.plan);
    if (!plan) return null;
    const orig = sanitizePlan(w.orig) || clone(plan);
    const out = { plan, orig, seed: Number.isFinite(w.seed) ? w.seed >>> 0 : 1, n: Number.isInteger(w.n) ? w.n : 0, locks: {}, bought: {}, adj: {}, extra: [], failed: [] };
    if (w.locks && typeof w.locks === 'object') for (const [k, v] of Object.entries(w.locks)) if (/^[0-6]:[0-3]$/.test(k) && v === true) out.locks[k] = true;
    if (w.bought && typeof w.bought === 'object') for (const [k, v] of Object.entries(w.bought)) if (FOODS[k] && v === true) out.bought[k] = true;
    if (w.adj && typeof w.adj === 'object') for (const [k, v] of Object.entries(w.adj)) if (/^(mercadona|eroski):/.test(k) && FOODS[k.split(':')[1]] && Number.isInteger(v) && inRange(v, -50, 50) && v !== 0) out.adj[k] = v;
    if (Array.isArray(w.extra)) w.extra.slice(0, 80).forEach((x, i) => {
      if (!x || typeof x.text !== 'string' || !x.text.trim()) return;
      out.extra.push({ id: Number.isInteger(x.id) ? x.id : i + 1, text: x.text.trim().slice(0, 80), price: inRange(x.price, 0, 9999) ? Math.round(x.price * 100) / 100 : null, qty: Number.isInteger(x.qty) && inRange(x.qty, 1, 99) ? x.qty : 1, done: x.done === true });
    });
    if (Array.isArray(w.failed)) out.failed = w.failed.filter((d) => Number.isInteger(d) && inRange(d, 0, 6));
    return out;
  }
  const sanitizeMap = (m, test) => { const out = {}; if (m && typeof m === 'object') for (const [k, v] of Object.entries(m)) if (test(k, v)) out[k] = v; return out; };

  /* Migración v1 → v2: el plan guardado (con sus cambios) pasa a ser la semana actual */
  function migrateV1(o) {
    const s = defaults();
    const plan = PLAN.map((day) => day.map((id) => ({ r: id, f: 1 })));
    const orig = clone(plan);
    if (o.swaps && typeof o.swaps === 'object') {
      for (const [k, id] of Object.entries(o.swaps)) {
        const m = /^([0-6]):([0-3])$/.exec(k);
        if (m && BY_ID[id] && BY_ID[id].tipo === TYPES[+m[2]].id && id !== PLAN[+m[1]][+m[2]]) plan[+m[1]][+m[2]] = { r: id, f: 1 };
      }
    }
    const w = makeWeek(plan, P.hashSeed(s.wk));
    w.orig = orig;
    for (const f of ['bought', 'pantry']) {
      if (o[f] && typeof o[f] === 'object') for (const [k, v] of Object.entries(o[f])) if (FOODS[k] && v === true) (f === 'bought' ? w.bought : s.pantry)[k] = true;
    }
    s.weeks[s.wk] = w;
    if (Number.isInteger(o.day) && inRange(o.day, 0, 6) && typeof o.dayDate === 'string') { s.day = o.day; s.dayDate = o.dayDate; }
    if (VIEWS.includes(o.view)) s.view = o.view;
    if (Number.isInteger(o.sel) && inRange(o.sel, 0, 3)) s.sel = o.sel;
    if (['todas', ...TYPES.map((t) => t.id)].includes(o.filter)) s.filter = o.filter;
    if (o.goals && typeof o.goals === 'object') {
      if (inRange(o.goals.kcal, 1200, 3500)) s.goals.kcal = Math.round(o.goals.kcal);
      if (inRange(o.goals.prot, 60, 300)) s.goals.prot = Math.round(o.goals.prot);
      // el objetivo por defecto de la v1 (1.875) pasa al nuevo (1.880); uno editado se respeta
      if (s.goals.kcal === 1875) s.goals.kcal = GOALS.kcal;
    }
    return s;
  }
  /* Valida y normaliza un objeto de estado (carga e importación). Devuelve null si no es válido. */
  function sanitize(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    if (o.v === 1) return migrateV1(o);
    if (o.v !== SCHEMA) return null;
    const s = defaults();
    if (o.weeks && typeof o.weeks === 'object') for (const [iso, w] of Object.entries(o.weeks)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || P.mondayOf(parseISO(iso)) !== iso) continue;
      const sw = sanitizeWeek(w);
      if (sw) s.weeks[iso] = sw;
    }
    s.pantry = sanitizeMap(o.pantry, (k, v) => FOODS[k] && v === true);
    s.excl = sanitizeMap(o.excl, (k, v) => FOODS[k] && v === true);
    s.favs = sanitizeMap(o.favs, (k, v) => BY_ID[k] && v === true);
    s.ratings = sanitizeMap(o.ratings, (k, v) => BY_ID[k] && RATING[v]);
    s.fridge = sanitizeMap(o.fridge, (k, v) => FOODS[k] && v === true);
    s.fridgeOn = o.fridgeOn === true;
    if (typeof o.wk === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.wk) && P.mondayOf(parseISO(o.wk)) === o.wk) s.wk = o.wk;
    if (Number.isInteger(o.day) && inRange(o.day, 0, 6) && typeof o.dayDate === 'string') { s.day = o.day; s.dayDate = o.dayDate; }
    if (VIEWS.includes(o.view)) s.view = o.view;
    if (Number.isInteger(o.sel) && inRange(o.sel, 0, 3)) s.sel = o.sel;
    if (['todas', ...TYPES.map((t) => t.id)].includes(o.filter)) s.filter = o.filter;
    if (o.goals && typeof o.goals === 'object') {
      if (inRange(o.goals.kcal, 1200, 3500)) s.goals.kcal = Math.round(o.goals.kcal);
      if (inRange(o.goals.prot, 60, 300)) s.goals.prot = Math.round(o.goals.prot);
    }
    if (Array.isArray(o.people) && o.people.length === 4) s.people = o.people.map((n) => (Number.isInteger(n) && inRange(n, 1, 6) ? n : 1));
    if (o.store === 'mercadona' || o.store === 'eroski') s.store = o.store;
    if (o.gen && typeof o.gen === 'object') {
      s.gen.leftovers = o.gen.leftovers === true;
      for (const k of ['timeWeek', 'timeWeekend']) if ([0, 15, 30, 45].includes(o.gen[k])) s.gen[k] = o.gen[k];
    }
    return s;
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = sanitize(JSON.parse(raw)); if (s) return s; }
      const old = localStorage.getItem(KEY_V1);        // datos de la v1: se migran y la copia antigua se conserva
      if (old) { const s = sanitize(JSON.parse(old)); if (s) return s; }
    } catch (e) { /* almacenamiento no disponible o corrupto */ }
    return defaults();
  }
  let state = load();
  // Un día nuevo vuelve a abrir en la semana y el día actuales; durante el mismo día se recuerda la selección.
  if (state.dayDate !== isoDate()) { state.day = todayIdx(); state.dayDate = isoDate(); state.wk = curMonday(); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* sin espacio / modo privado */ }
  }

  /* ================= Semanas y generador ================= */
  const goals = () => P.goalsFor(state.goals);
  function genOpts(iso) {
    return {
      goals: state.goals, excl: state.excl, ratings: state.ratings, favs: state.favs, leftovers: state.gen.leftovers,
      timeWeek: state.gen.timeWeek, timeWeekend: state.gen.timeWeekend, fridge: state.fridge, fridgeOn: state.fridgeOn,
      prev: [1, 2].map((n) => (state.weeks[P.addWeeks(iso, -n)] ? state.weeks[P.addWeeks(iso, -n)].plan : null))
    };
  }
  const hasExcluded = (day) => !!day && day.some((x) => P.usesExcluded(BY_ID[x.r], state.excl));
  /* Devuelve la semana (la crea si no existe: primera vez → plan por defecto; si no, generada con semilla fija) */
  function ensureWeek(iso) {
    if (state.weeks[iso]) return state.weeks[iso];
    let w;
    if (iso === curMonday() && !Object.keys(state.weeks).length) w = makeWeek(P.planFromIds(PLAN), P.hashSeed(iso));
    else {
      const seed = P.hashSeed(`${iso}:auto`);
      const res = P.generateWeek({ ...genOpts(iso), seed });
      res.failed.forEach((d) => { res.plan[d] = null; });
      w = makeWeek(res.plan, seed);
      w.failed = res.failed;
    }
    state.weeks[iso] = w;
    save();
    return w;
  }
  const W = () => ensureWeek(state.wk);
  const slotAt = (d, s) => { const day = W().plan[d]; return day ? day[s] : null; };
  const recipeAt = (d, s) => { const x = slotAt(d, s); return x ? BY_ID[x.r] : null; };
  const slotMac = (d, s) => P.slotMacros(slotAt(d, s));
  const dayTotals = (d) => (W().plan[d] ? P.dayTotals(W().plan[d]) : null);
  const dayIssues = (d) => (W().plan[d] ? P.dayIssues(W().plan[d], goals()) : ['Sin menú']);
  const isSwapped = (d, s) => {
    const a = slotAt(d, s), o = W().orig[d] && W().orig[d][s];
    return !!a && (!o || a.r !== o.r);
  };
  const dayChanged = (d) => JSON.stringify(W().plan[d]) !== JSON.stringify(W().orig[d]);
  const weekChanged = () => W().plan.some((_, d) => dayChanged(d));
  const isLocked = (d, s) => !!W().locks[`${d}:${s}`];
  const failMsg = (days) => `Con tus exclusiones y filtros no cuadro ${days.map((d) => `el ${lc(DAYS[d])}`).join(', ').replace(/, ([^,]*)$/, ' y $1')}; quita alguno.`;

  /* Regenera días (o la semana) respetando exclusiones, valoraciones, filtros y bloqueos */
  function regenerate(days, keepFn, tag) {
    const w = W();
    w.n += 1;
    const seed = days.length === 7 ? (Math.random() * 4294967295) >>> 0 : P.hashSeed(`${w.seed}:${tag}:${w.n}`);
    const keep = {};
    days.forEach((d) => { for (let s = 0; s < 4; s++) if (keepFn(d, s)) keep[`${d}:${s}`] = true; });
    // al deshacer parejas de sobras en días que no se regeneran, el compañero queda como plato normal (fixPairs)
    const res = P.generateWeek({ ...genOpts(state.wk), seed, current: w.plan, days, keep });
    const failed = [];
    days.forEach((d) => {
      if (res.failed.includes(d)) { failed.push(d); if (!w.plan[d] || hasExcluded(w.plan[d])) w.plan[d] = null; return; }
      w.plan[d] = res.plan[d];
      w.orig[d] = clone(res.plan[d]);
    });
    P.fixPairs(w.plan); P.fixPairs(w.orig);
    if (days.length === 7) w.seed = seed;
    w.failed = [...new Set([...w.failed.filter((d) => !days.includes(d)), ...failed])];
    save();
    return failed;
  }

  /* ================= Toast y diálogos ================= */
  let toastTimer;
  function toast(msg, error = false) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('error', error);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), error ? 5200 : 2800);
  }
  function openDialog(d) { if (!d.open) d.showModal(); }
  $$('dialog').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); }); // clic en el fondo o en ✕
  });
  function confirmBox(title, text, okLabel, danger = false, cancelLabel = 'Cancelar') {
    const d = $('#dlg-confirm');
    $('#cf-title').textContent = title;
    $('#cf-text').textContent = text;
    const ok = $('#cf-ok');
    ok.textContent = okLabel;
    ok.className = `btn ${danger ? 'danger' : 'primary'}`;
    $('#cf-cancel').textContent = cancelLabel;
    return new Promise((resolve) => {
      const done = (v) => { d.removeEventListener('close', onClose); $('#cf-ok').onclick = $('#cf-cancel').onclick = null; if (d.open) d.close(); resolve(v); };
      const onClose = () => done(false);
      d.addEventListener('close', onClose);
      $('#cf-ok').onclick = () => done(true);
      $('#cf-cancel').onclick = () => done(false);
      openDialog(d);
    });
  }

  /* Conserva el foco en listas que se vuelven a pintar */
  function keepFocus(fn) {
    const k = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
    fn();
    if (k) { const el = document.querySelector(`[data-key="${CSS.escape(k)}"]`); if (el) el.focus({ preventScroll: true }); }
  }

  /* ================= Piezas de interfaz ================= */
  const igPill = (ig) => `<span class="ig ig-${ig}">IG ${ig}</span>`;
  const macroRow = (m) => `<div class="macros">
      <div><b>${nf(m.k)}</b><span>kcal</span></div>
      <div><b>${nf(m.p)}</b><span>prot. g</span></div>
      <div><b>${nf(m.h)}</b><span>HC g</span></div>
      <div><b>${nf(m.g)}</b><span>grasa g</span></div>
    </div>`;
  const macroLine = (m) => `<p class="macro-line"><span class="hl">${val(m.k, 'kcal')}</span> · <span>${val(m.p, 'g prot')}</span> · <span class="hl">${val(m.h, 'g HC')}</span> · <span>${val(m.g, 'g grasa')}</span></p>`;

  /* Barra con zona objetivo: fill = valor, banda = rango deseado. */
  function bar(label, value, unitTxt, rightTxt, scaleMax, zoneFrom, zoneTo, ok) {
    const pct = Math.min(100, (value / scaleMax) * 100);
    const z0 = (zoneFrom / scaleMax) * 100, z1 = Math.min(100, (zoneTo / scaleMax) * 100);
    return `<div class="bar">
      <div class="bar-head"><span><b>${label}</b> ${val(value, unitTxt).replace(/ $/, '')}</span><span>${rightTxt}</span></div>
      <div class="track" role="img" aria-label="${label}: ${nf(value)} ${unitTxt}, ${rightTxt}">
        <div class="zone" style="left:${z0}%;width:${z1 - z0}%"></div>
        <div class="fill ${ok ? '' : 'warn'}" style="width:${pct}%"></div>
      </div>
    </div>`;
  }

  /* Navegador de semana «‹ Semana del 30 nov – 6 dic ›» */
  function renderNav() {
    const cur = curMonday(), isCur = state.wk === cur;
    const hasPrev = Object.keys(state.weeks).some((k) => k < state.wk);
    const hasNext = state.wk < P.addWeeks(cur, 8);
    const html = `<button type="button" class="nav-btn" data-act="wk-prev" aria-label="Semana anterior"${hasPrev ? '' : ' disabled'}>‹</button>
      <div class="nav-mid"><b class="nav-label">Semana del ${weekLabel(state.wk)}</b>
      ${isCur ? '<small>Esta semana</small>' : '<button type="button" class="nav-today" data-act="wk-today">Ir a esta semana</button>'}</div>
      <button type="button" class="nav-btn" data-act="wk-next" aria-label="Semana siguiente"${hasNext ? '' : ' disabled'}>›</button>`;
    $$('.wk-nav').forEach((n) => { n.innerHTML = html; });
  }
  function gotoWeek(iso) {
    state.wk = iso; save();
    renderAll();
  }

  /* ================= HOY ================= */
  function renderChips() {
    const today = todayIdx(), isCur = state.wk === curMonday();
    $('#day-chips').innerHTML = DAYS.map((name, i) => {
      const ok = dayIssues(i).length === 0;
      const isToday = isCur && i === today;
      return `<button type="button" class="chip-day${isToday ? ' is-today' : ''}" data-act="day" data-day="${i}" data-key="day${i}"
        aria-pressed="${i === state.day}" aria-label="${name}${isToday ? ' (hoy)' : ''}${ok ? '' : ', revisar'}">
        <span>${LETTERS[i]}</span><i class="dot ${ok ? 'ok' : 'warn'}" aria-hidden="true"></i></button>`;
    }).join('');
  }

  function renderSummary() {
    const g = goals(), t = dayTotals(state.day);
    if (!t) {
      $('#day-summary').innerHTML = `<p class="issues">Sin menú este día</p><p>${esc(failMsg([state.day]))}</p>
        <button type="button" class="btn secondary spaced" data-act="open-excl" data-key="open-excl-h">Alimentos que no quiero</button>`;
      return;
    }
    const issues = dayIssues(state.day), ok = issues.length === 0;
    $('#day-summary').innerHTML = `
      <div class="sum-top">
        <div>
          <p class="sum-kcal"><b>${nf(t.k)}</b> kcal</p>
          <p class="hint">${DAYS[state.day]} · objetivo ${nf(g.kcalMin)}–${nf(g.kcalMax)}<span class="fat-inline"> · <span class="nw">grasa ${val(t.g, 'g')}</span></span></p>
        </div>
        <span class="pill ${ok ? 'ok' : 'warn'}"><i></i>${ok ? 'Día en objetivo' : 'Revisa'}</span>
      </div>
      ${ok ? '' : `<p class="issues">${issues.map(esc).join(' · ')}</p>`}
      <div class="bars">
        ${bar('Kcal', t.k, '', `${nf(g.kcalMin)}–${nf(g.kcalMax)}`, g.kcalMax * 1.08, g.kcalMin, g.kcalMax, Math.round(t.k) >= g.kcalMin && Math.round(t.k) <= g.kcalMax)}
        ${bar('Proteína', t.p, 'g', `objetivo ${val(g.prot, 'g')}`, g.prot * 1.25, g.protMin, g.prot * 1.25, Math.round(t.p) >= g.protMin)}
        ${bar('Hidratos', t.h, 'g', `${nf(g.hcMin)}–${val(g.hcMax, 'g')}`, g.hcMax * 1.15, g.hcMin, g.hcMax, Math.round(t.h) >= g.hcMin && Math.round(t.h) <= g.hcMax)}
        <p class="fat-line"><b>Grasa</b> <span class="nw">${val(t.g, 'g')}</span></p>
      </div>`;
  }

  const LOCK_SVG = (on) => `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="${on ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.5-2'}"/></svg>`;

  function renderMeals() {
    const day = W().plan[state.day];
    if (!day) { $('#meals').innerHTML = ''; return; }
    const html = TYPES.map((tp, s) => {
      const slot = day[s], r = BY_ID[slot.r], m = P.slotMacros(slot);
      const swapped = isSwapped(state.day, s), locked = isLocked(state.day, s), rt = state.ratings[r.id];
      const notes = [];
      if (slot.f !== 1) notes.push(`<span class="note">${ration(slot.f)}</span>`);
      if (slot.left) notes.push('<span class="note hl">Sobras de la cena de ayer</span>');
      if (slot.dbl) notes.push('<span class="note hl">Haz 2 raciones: una para mañana</span>');
      return `<article class="meal type-${tp.id}${state.sel === s ? ' selected' : ''}" ${state.sel === s ? 'aria-current="true"' : ''}>
        <div class="meal-top"><span class="meal-type">${tp.label}${swapped ? ' · <em>cambiado</em>' : ''}</span>
          <span class="meal-tools">${igPill(r.ig)}
            <button type="button" class="tool-btn" data-act="lock" data-slot="${s}" data-key="lock${s}" aria-pressed="${locked}" aria-label="${locked ? 'Desbloquear' : 'Bloquear'} ${tp.label.toLowerCase()}: se mantiene al regenerar">${LOCK_SVG(locked)}</button>
            <button type="button" class="tool-btn rate" data-act="rate" data-slot="${s}" data-key="rate${s}" aria-label="Valorar ${esc(r.nombre)}${rt ? ': ' + RATING[rt][1] : ''}">${rt ? RATING[rt][0] : '☆'}</button>
          </span></div>
        <button type="button" class="meal-main" data-act="open" data-slot="${s}" data-key="open${s}" aria-label="Ver receta: ${esc(r.nombre)}">
          <span class="meal-name">${esc(r.nombre)}</span><span class="meal-time">${esc(r.tiempo)}</span>
        </button>
        ${notes.length ? `<p class="meal-notes">${notes.join('')}</p>` : ''}
        <div class="meal-foot">
        ${macroRow(m)}${macroLine(m)}
        <div class="meal-actions">
          <button type="button" class="btn-sm" data-act="open" data-slot="${s}" data-key="recipe${s}">Receta</button>
          <button type="button" class="btn-sm accent" data-act="swap" data-slot="${s}" data-key="swap${s}" aria-label="Cambiar ${tp.label.toLowerCase()}">Cambiar</button>
        </div></div>
      </article>`;
    }).join('');
    const restore = dayChanged(state.day) ? '<button type="button" class="btn secondary" data-act="restore-day" data-key="restore-day">Restaurar menú original</button>' : '';
    $('#meals').innerHTML = html + `<div class="day-actions"><button type="button" class="btn secondary" data-act="regen-day" data-key="regen-day">Regenerar este día</button>${restore}</div>`;
  }

  /* Cuerpo de receta (diálogo y panel lateral). `slot` opcional: ración y sobras */
  function unitHint(i) {
    const u = FOODS[i.f].u;
    if (!u || u.g > 160) return '';
    const n = i.g / u.g, r = Math.round(n);
    return r >= 1 && Math.abs(n - r) < 0.12 ? ` <small>(${r} ${r === 1 ? u.s : u.p})</small>` : '';
  }
  function rateRow(id) {
    const rt = state.ratings[id], fav = !!state.favs[id];
    return `<div class="rate-row" role="group" aria-label="Valorar esta receta">
      <button type="button" class="btn-sm" data-act="fav" data-id="${id}" aria-pressed="${fav}">${fav ? '♥ Favorita' : '♡ Favorita'}</button>
      ${Object.entries(RATING).map(([k, [ic, lb]]) => `<button type="button" class="btn-sm" data-act="rate-set" data-id="${id}" data-v="${k}" aria-pressed="${rt === k}">${ic} ${lb}</button>`).join('')}
    </div>`;
  }
  function recipeBody(r, withTitle, slot) {
    const f = slot ? slot.f : 1, ing = slot ? P.slotIng(slot) : r.ing, m = slot ? P.slotMacros(slot) : r.macros;
    const mult = slot && slot.dbl ? 2 : 1;
    let banner = '';
    if (slot && slot.left) banner = '<p class="banner">Sobras de la cena de ayer: no hace falta cocinar, solo calentar la ración guardada.</p>';
    else if (slot && slot.dbl) banner = '<p class="banner">Haz 2 raciones: una para mañana.</p>';
    return `${withTitle ? `<h2>${esc(r.nombre)}</h2>` : ''}
      <p class="rcp-meta"><span>${TYPE_LABEL[r.tipo]}</span><span>⏱ ${esc(r.tiempo)}</span>${igPill(r.ig)}<span>${mult === 2 ? '2 raciones' : '1 ración'}${f !== 1 ? ` · ${ration(f)}` : ''}</span></p>
      ${banner}
      ${macroRow(m)}
      <h3>Ingredientes${mult === 2 ? ' (2 raciones)' : ''}</h3>
      <ul class="ing-list">${ing.map((i) => { const x = { f: i.f, g: i.g * mult }; return `<li><span>${esc(FOODS[i.f].n)}</span><span>${val(x.g, 'g')}${unitHint(x)}</span></li>`; }).join('')}</ul>
      <p class="hint">Sal y especias al gusto.</p>
      <h3>Preparación</h3>
      <ol class="steps">${r.pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
      ${r.consejo ? `<p class="tip"><b>Consejo.</b> ${esc(r.consejo)}</p>` : ''}
      ${r.tupper ? `<p class="tip"><b>Para guardar.</b> ${esc(r.tupper)}</p>` : ''}
      ${rateRow(r.id)}
      <button type="button" class="btn primary" data-act="cook" data-id="${r.id}">Modo cocina</button>`;
  }
  const renderInline = () => {
    const slot = slotAt(state.day, state.sel);
    $('#today-recipe').innerHTML = slot ? recipeBody(BY_ID[slot.r], true, slot) : '';
  };

  function renderHoy() {
    renderNav(); renderChips(); renderSummary(); renderMeals(); renderInline();
  }

  /* ----- Hoja de recetas, cambio de plato y modo cocina ----- */
  let openRecipeCtx = null;
  function openRecipe(r, slot) {
    openRecipeCtx = r.id;
    $('#rcp-title').textContent = r.nombre;
    $('#rcp-body').innerHTML = recipeBody(r, false, slot);
    openDialog($('#dlg-recipe'));
  }
  let ctxSlot = null;

  const timeLimit = (d) => (d < 5 ? state.gen.timeWeek : state.gen.timeWeekend);
  /* ¿Se puede poner este plato en la toma? (tipo, exclusiones y «no volver a poner») */
  const allowed = (r, s) => eligible(r, s) && !P.usesExcluded(r, state.excl) && state.ratings[r.id] !== 'never';

  /* Mejor ración de una receta en un día, para que el día cuadre lo mejor posible */
  function bestFactor(d, s, id) {
    const day = W().plan[d], g = goals();
    let best = 1, bestScore = Infinity;
    P.FACTORS.forEach((f) => {
      const trial = day.map((x, i) => (i === s ? { r: id, f } : x));
      const issues = P.dayIssues(trial, g).length, k = P.dayTotals(trial).k;
      const sc = issues * 1000 + Math.abs(k - g.kcal) + Math.abs(f - 1) * 40;
      if (sc < bestScore) { bestScore = sc; best = f; }
    });
    return best;
  }
  /* Cambia el plato de una toma. Si era parte de unas sobras, la pareja pasa a cocinarse aparte */
  function applySwap(d, s, id) {
    const w = W(), day = w.plan[d];
    const old = day[s];
    let note = '';
    if (old.dbl) { const nx = w.plan[d + 1] && w.plan[d + 1][1]; if (nx) delete nx.left; note = ' La comida de sobras de mañana pasa a cocinarse aparte.'; }
    if (old.left) { const pv = w.plan[d - 1] && w.plan[d - 1][2]; if (pv) delete pv.dbl; note = ' La cena de ayer ya no se cocina doble.'; }
    day[s] = { r: id, f: 1 };
    day[s].f = bestFactor(d, s, id);
    P.fixPairs(w.plan);
    save();
    return note;
  }

  let swapSlot = 0;
  function openSwap(slot) {
    swapSlot = slot;
    const tp = TYPES[slot], cur = slotAt(state.day, slot), curR = BY_ID[cur.r], curM = P.slotMacros(cur);
    $('#swap-title').textContent = `Cambiar ${tp.label.toLowerCase()}`;
    $('#swap-sub').textContent = `${DAYS[state.day]} · ahora: ${curR.nombre}`;
    const lim = slot === 1 || slot === 2 ? timeLimit(state.day) : 0;
    const alts = RECIPES.filter((r) => r.id !== curR.id && allowed(r, slot))
      .sort((a, b) => (state.favs[b.id] ? 1 : 0) - (state.favs[a.id] ? 1 : 0) || Math.abs(a.macros.k - curM.k) - Math.abs(b.macros.k - curM.k));
    const diff = (a, b, unit, cls) => {
      const d = Math.round(a) - Math.round(b);
      return `<span class="diff ${d === 0 ? '' : cls(d)}">${signed(d)}${NB}${unit}</span>`;
    };
    const item = (r, isCur) => {
      const slow = !isCur && lim && r.min > lim;
      const badge = (state.favs[r.id] ? '♥ ' : '') + (state.ratings[r.id] === 'like' ? '👍 ' : state.ratings[r.id] === 'less' ? '👎 ' : '');
      return `<li><button type="button" class="swap-item${isCur ? ' current' : ''}${slow ? ' dim' : ''}" data-act="pick" data-id="${r.id}" data-key="pick-${r.id}" ${isCur ? 'aria-current="true"' : ''}>
        <span class="swap-name">${badge}${esc(r.nombre)}${isCur ? ' <em>actual</em>' : ''}${slow ? ` <em class="slow">tarda ${r.min} min</em>` : ''}</span>
        <span class="swap-macros">${val(r.macros.k, 'kcal')} · ${val(r.macros.p, 'g prot.')} · ${val(r.macros.h, 'g HC')} ${igPill(r.ig)}</span>
        ${isCur ? '' : `<span class="swap-diffs">${diff(r.macros.k, curM.k, 'kcal', () => '')}${diff(r.macros.p, curM.p, 'g prot.', (x) => (x > 0 ? 'good' : 'bad'))}${diff(r.macros.h, curM.h, 'g HC', (x) => (x > 0 ? 'bad' : 'good'))}</span>`}
      </button></li>`;
    };
    $('#swap-list').innerHTML = item(curR, true) + alts.map((r) => item(r, false)).join('');
    $('#swap-restore').hidden = !isSwapped(state.day, slot);
    openDialog($('#dlg-swap'));
  }
  $('#swap-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="pick"]');
    if (!b) return;
    if (b.dataset.id !== slotAt(state.day, swapSlot).r) { const note = applySwap(state.day, swapSlot, b.dataset.id); renderAll(); toast(`Plato cambiado. Totales actualizados.${note}`); }
    $('#dlg-swap').close();
  });
  $('#swap-restore').addEventListener('click', () => {
    const w = W(), o = w.orig[state.day];
    if (o) { w.plan[state.day][swapSlot] = clone(o[swapSlot]); P.fixPairs(w.plan); save(); renderAll(); }
    $('#dlg-swap').close(); toast('Plato original restaurado.');
  });

  let cook = { r: null, i: 0 }, wakeLock = null;
  function renderCook() {
    $('#cook-title').textContent = cook.r.nombre;
    $('#cook-count').textContent = `Paso ${cook.i + 1} de ${cook.r.pasos.length}`;
    $('#cook-text').textContent = cook.r.pasos[cook.i];
    $('#cook-prev').disabled = cook.i === 0;
    const last = cook.i === cook.r.pasos.length - 1;
    $('#cook-next').textContent = last ? 'Terminar' : 'Siguiente';
  }
  async function openCook(id) {
    cook = { r: BY_ID[id], i: 0 };
    renderCook();
    $('#dlg-recipe').close();
    openDialog($('#dlg-cook'));
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* opcional */ }
  }
  $('#cook-prev').addEventListener('click', () => { if (cook.i > 0) { cook.i--; renderCook(); } });
  $('#cook-next').addEventListener('click', () => {
    if (cook.i < cook.r.pasos.length - 1) { cook.i++; renderCook(); } else { $('#dlg-cook').close(); toast('¡Que aproveche!'); }
  });
  $('#dlg-cook').addEventListener('close', () => { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } });

  /* ----- Valoraciones y favoritos ----- */
  function setRating(id, v) {
    if (v === 'fav') { if (state.favs[id]) delete state.favs[id]; else state.favs[id] = true; save(); return; }
    if (state.ratings[id] === v) delete state.ratings[id]; else state.ratings[id] = v;
    save();
  }
  let rateCtx = null;
  function openRate(slot) {
    const r = recipeAt(state.day, slot);
    rateCtx = r.id;
    $('#rate-sub').textContent = r.nombre;
    paintRate();
    openDialog($('#dlg-rate'));
  }
  function paintRate() {
    const id = rateCtx, rt = state.ratings[id];
    $('#rate-body').innerHTML = Object.entries(RATING).map(([k, [ic, lb]]) => `<button type="button" class="btn secondary rate-opt" data-act="rate-pick" data-v="${k}" aria-pressed="${rt === k}"><span aria-hidden="true">${ic}</span> ${lb}</button>`).join('')
      + `<button type="button" class="btn secondary rate-opt" data-act="rate-pick" data-v="fav" aria-pressed="${!!state.favs[id]}"><span aria-hidden="true">${state.favs[id] ? '♥' : '♡'}</span> Favorita</button>`;
  }

  /* ================= SEMANA ================= */
  function weekStats(iso) {
    const w = state.weeks[iso], g = goals();
    const days = w.plan.map((day) => (day ? { t: P.dayTotals(day), ok: P.dayIssues(day, g).length === 0 } : null)).filter(Boolean);
    const n = days.length || 1;
    return { k: days.reduce((a, d) => a + d.t.k, 0) / n, p: days.reduce((a, d) => a + d.t.p, 0) / n, h: days.reduce((a, d) => a + d.t.h, 0) / n, ok: days.filter((d) => d.ok).length, n: days.length };
  }
  function renderWeek() {
    renderNav();
    const w = W(), today = todayIdx(), isCur = state.wk === curMonday();
    const tot = w.plan.map((_, i) => dayTotals(i));
    const st = weekStats(state.wk);
    const missing = w.plan.map((d, i) => (d ? -1 : i)).filter((i) => i >= 0);
    $('#week-note').textContent = missing.length ? failMsg(missing) : '';
    $('#week-note').classList.toggle('warn-text', missing.length > 0);
    $('#week-avg').textContent = st.n ? `Media semanal: ${nf(st.k)} kcal · ${nf(st.p)} g de proteína · ${nf(st.h)} g de hidratos al día.` : '';
    $('#week-grid').innerHTML = DAYS.map((name, i) => {
      const day = w.plan[i], t = tot[i];
      if (!day) return `<button type="button" class="card week-day" data-act="goto-day" data-day="${i}" data-key="wd${i}"><span class="wd-head"><b>${name}</b><span class="pill sm warn"><i></i>Sin menú</span></span><span class="issues">${esc(failMsg([i]))}</span></button>`;
      const issues = P.dayIssues(day, goals()), ok = issues.length === 0;
      return `<button type="button" class="card week-day${isCur && i === today ? ' is-today' : ''}" data-act="goto-day" data-day="${i}" data-key="wd${i}"
        aria-label="${name}: ${nf(t.k)} kcal, ${ok ? 'en objetivo' : 'revisar'}. Abrir el día">
        <span class="wd-head"><b>${name}</b>${isCur && i === today ? '<em>hoy</em>' : ''}<span class="pill sm ${ok ? 'ok' : 'warn'}"><i></i>${ok ? 'En objetivo' : 'Revisa'}</span></span>
        <ul class="wd-meals">${TYPES.map((tp, s) => { const x = day[s]; return `<li><span>${tp.label}${w.locks[`${i}:${s}`] ? ' 🔒' : ''}</span>${esc(BY_ID[x.r].nombre)}${x.f !== 1 ? ` <small>(×${nd(x.f, 2)})</small>` : ''}${x.left ? ' <small>(sobras)</small>' : ''}${x.dbl ? ' <small>(doble)</small>' : ''}</li>`; }).join('')}</ul>
        ${ok ? '' : `<span class="issues">${issues.map(esc).join(' · ')}</span>`}
        <span class="wd-tot"><span><b>${nf(t.k)}</b> kcal</span> · <span><b>${nf(t.p)}</b> g prot</span> · <span><b>${nf(t.h)}</b> g HC</span></span>
      </button>`;
    }).join('');
    // Semanas anteriores
    const cur = curMonday();
    const past = Object.keys(state.weeks).filter((k) => k < cur).sort().reverse();
    const box = $('#week-history');
    box.hidden = past.length === 0;
    box.innerHTML = `<summary>Semanas anteriores <small>${past.length}</small></summary>
      <ul>${past.map((k) => { const s = weekStats(k); return `<li><button type="button" class="hist-item${k === state.wk ? ' current' : ''}" data-act="goto-week" data-wk="${k}" data-key="hist-${k}">
        <b>Semana del ${weekLabel(k)}</b><span>${val(s.k, 'kcal')} de media · ${val(s.p, 'g prot')} · ${s.ok}/${s.n} días en objetivo</span></button></li>`; }).join('')}</ul>`;
  }

  /* ================= COMPRA ================= */
  const STORE_NAME = { mercadona: 'Mercadona', eroski: 'Eroski' };
  const searchUrl = (store, q) => (store === 'mercadona'
    ? `https://tienda.mercadona.es/search-results?query=${encodeURIComponent(q)}`
    : `https://supermercado.eroski.es/es/search/results/?q=${encodeURIComponent(q)}&suggestionsFilter=false`);

  /* Agrega la semana visible por alimento, con envases completos de la tienda elegida */
  function shoppingItems() {
    const w = W(), store = state.store;
    const grams = P.weekFoodGrams(w.plan.filter(Boolean), state.people);
    return Object.entries(grams).map(([id, g]) => {
      const f = FOODS[id], pr = PRECIOS[id] ? PRECIOS[id][store] : null;
      const o = { id, food: f.n, section: f.s, g, pr };
      const adj = w.adj[`${store}:${id}`] || 0;
      if (pr && pr.w) {
        const tenths = Math.max(1, Math.ceil(g / 100 - 0.03) + adj);
        o.kg = tenths / 10; o.cost = o.kg * pr.p; o.eaten = (g / 1000) * pr.p;
        o.qty = `${nd(o.kg, 1)}${NB}kg`; o.line = `al peso · ${eur(pr.p)}/kg`;
      } else if (pr) {
        const n = Math.max(1, Math.max(1, Math.ceil(g / pr.g - 0.03)) + adj);
        o.n = n; o.cost = n * pr.p; o.eaten = (g / pr.g) * pr.p;
        o.qty = `${n}${NB}×${NB}${pr.f}`; o.line = `${eur(pr.p)} por envase`;
      } else {
        const step = g >= 1000 ? 100 : 50, r = Math.max(step, Math.ceil(g / step) * step);
        o.qty = f.u && f.u.g <= 200 ? `${Math.max(1, Math.ceil(g / f.u.g - 0.03))}${NB}${Math.ceil(g / f.u.g - 0.03) === 1 ? f.u.s : f.u.p}` : (r >= 1000 ? `${nd(r / 1000, 1)}${NB}kg` : `${nf(r)}${NB}g`);
        o.line = 'sin precio de referencia';
      }
      return o;
    });
  }
  const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const HOME_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7M6 10v9h12v-9"/></svg>';
  const SEARCH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';

  function renderShop() {
    const w = W(), store = state.store, sname = STORE_NAME[store];
    const all = shoppingItems();
    const need = all.filter((i) => !state.pantry[i.id]);
    const missing = need.filter((i) => !w.bought[i.id]).length + w.extra.filter((x) => !x.done).length;
    const total = need.length + w.extra.length, done = total - missing;
    const priced = need.filter((i) => i.pr);
    const sum = priced.reduce((a, i) => a + i.cost, 0) + w.extra.reduce((a, x) => a + (x.price || 0) * x.qty, 0);
    const noPrice = need.length - priced.length;
    const eaten = all.filter((i) => i.pr).reduce((a, i) => a + i.eaten, 0);
    const pp = state.people;
    const same = pp.every((n) => n === pp[0]);
    $('#shop-head').innerHTML = `
      <div class="segmented store-seg" role="group" aria-label="Supermercado">
        ${['mercadona', 'eroski'].map((k) => `<button type="button" data-act="store" data-s="${k}" data-key="store-${k}" aria-pressed="${store === k}">${STORE_NAME[k]}</button>`).join('')}
      </div>
      <div class="sh-top">
        <div>
          <h2>${total === 0 ? 'Lista vacía' : missing === 0 ? '¡Compra completa!' : missing === 1 ? 'Falta 1 artículo' : `Faltan ${nf(missing)} artículos`}</h2>
          <p class="hint">${nf(done)} de ${nf(total)} comprados${all.length - need.length ? ` · ${nf(all.length - need.length)} en casa` : ''}</p>
        </div>
        <button type="button" class="btn secondary btn-inline" data-act="uncheck" data-key="uncheck">Desmarcar todo</button>
      </div>
      <div class="track" aria-hidden="true"><div class="fill" style="width:${total ? (done / total) * 100 : 0}%"></div></div>
      <p class="total-line">Total estimado ${NB}<b>${eur(sum)}</b> <small>aprox.</small>${noPrice ? ` <small class="nw">+ ${noPrice} sin precio</small>` : ''}</p>
      <p class="hint">Envases completos en ${sname}, sin lo que tienes en casa. Coste de lo que comes ≈ <span class="nw">${eur(eaten)}</span>.</p>
      <div class="people">
        <span class="people-label"><b>Personas en casa</b><small>La lista se multiplica; en Hoy ves tu ración.</small></span>
        ${stepper('people-all', same ? pp[0] : null, 'personas')}
      </div>
      <details class="people-detail"><summary>Ajustar por toma</summary>
        <ul>${TYPES.map((tp, s) => `<li><span>${tp.label}</span>${stepper(`people-${s}`, pp[s], tp.label.toLowerCase())}</li>`).join('')}</ul>
      </details>`;

    const bySec = SECTIONS.map((sec) => ({ sec, items: need.filter((i) => i.section === sec) })).filter((x) => x.items.length);
    const extras = w.extra.length ? `<section class="card shop-sec"><h2>Añadido por mí <small>${w.extra.length}</small></h2><ul>${w.extra.map((x) => `<li class="shop-item${x.done ? ' bought' : ''}">
        <div class="si-row"><button type="button" class="check" role="checkbox" aria-checked="${x.done}" data-act="x-done" data-id="${x.id}" data-key="xd-${x.id}" aria-label="Comprado: ${esc(x.text)}">${CHECK_SVG}</button>
        <span class="si-text"><span class="si-name">${esc(x.text)}</span><span class="si-qty">${x.price != null ? `${x.qty}${NB}×${NB}${eur(x.price)} = ${eur(x.price * x.qty)}` : `${x.qty}${NB}${x.qty === 1 ? 'unidad' : 'unidades'} · sin precio`}</span></span></div>
        <div class="si-actions">${stepper(`xq-${x.id}`, x.qty, x.text)}<button type="button" class="btn-sm" data-act="x-del" data-id="${x.id}" data-key="xdel-${x.id}" aria-label="Quitar ${esc(x.text)}">Quitar</button></div>
      </li>`).join('')}</ul></section>` : '';
    $('#shop-list').innerHTML = bySec.map(({ sec, items }) => {
      items.sort((a, b) => (!!w.bought[a.id] - !!w.bought[b.id]) || a.food.localeCompare(b.food, 'es'));
      return `<section class="card shop-sec"><h2>${esc(sec)} <small>${items.length}</small></h2><ul>${items.map((i) => {
        const b = !!w.bought[i.id];
        const name = i.pr ? i.pr.n : i.food;
        const q = i.pr ? i.pr.q : i.food;
        return `<li class="shop-item${b ? ' bought' : ''}">
          <div class="si-row"><button type="button" class="check" role="checkbox" aria-checked="${b}" data-act="buy" data-f="${i.id}" data-key="buy-${i.id}" aria-label="Comprado: ${esc(i.food)}, ${esc(i.qty)}">${CHECK_SVG}</button>
          <span class="si-text"><span class="si-name">${esc(name)}</span>
            <span class="si-qty"><b>${esc(i.qty)}</b>${i.pr ? ` · <span class="nw">${eur(i.cost)} <small>aprox.</small></span>` : ''}</span>
            <small class="si-sub">${esc(i.food)} · necesitas ${val(i.g, 'g')} · ${esc(i.line)}</small></span></div>
          <div class="si-actions">
            ${i.pr ? stepper(`q-${i.id}`, i.pr.w ? nd(i.kg, 1) + NB + 'kg' : i.n, i.food, 'q') : ''}
            <a class="btn-sm" href="${searchUrl(store, q)}" target="_blank" rel="noopener" aria-label="Buscar ${esc(q)} en ${sname}">${SEARCH_SVG}<span>Buscar<span class="more-txt"> en ${sname}</span></span></a>
            <button type="button" class="btn-sm home-btn" data-act="home" data-f="${i.id}" data-key="home-${i.id}" aria-label="Lo tengo en casa: ${esc(i.food)}">${HOME_SVG}<span>En casa</span></button>
          </div>
        </li>`;
      }).join('')}</ul></section>`;
    }).join('') + extras || '<p class="empty">Todo lo de esta semana está en casa. 🎉</p>';

    $('#shop-add').innerHTML = `<h2>Añadir a la lista</h2>
      <form id="add-form" class="add-form" autocomplete="off">
        <label class="field"><span>Artículo</span><input id="add-text" type="text" maxlength="80" placeholder="Ej.: yogur natural"></label>
        <label class="field"><span>Precio (€, opcional)</span><input id="add-price" type="text" inputmode="decimal" placeholder="0,00"></label>
        <button type="submit" class="btn primary">Añadir</button>
      </form>`;

    const home = Object.keys(state.pantry).sort((a, b) => FOODS[a].n.localeCompare(FOODS[b].n, 'es'));
    const box = $('#shop-home');
    box.hidden = home.length === 0;
    box.innerHTML = `<summary>En casa <small>${home.length}</small></summary>
      <p class="hint">Lo que ya tienes se queda fuera de la lista, también en las próximas semanas.</p>
      <ul>${home.map((id) => `<li class="shop-item">
        <span class="si-text"><span class="si-name">${esc(FOODS[id].n)}</span></span>
        <button type="button" class="btn-sm" data-act="unhome" data-f="${id}" data-key="unhome-${id}" aria-label="Devolver a la lista: ${esc(FOODS[id].n)}">Devolver</button></li>`).join('')}</ul>`;
    $('#shop-note').textContent = `Precios aproximados de las tiendas online (nov. 2026); pueden variar en tu tienda de Lugo.${store === 'mercadona' ? ' En Mercadona no hay skyr: se usa queso fresco batido.' : ''}`;
  }
  function stepper(id, value, label, kind) {
    const shown = value === null ? '—' : esc(value);
    return `<span class="stepper" role="group" aria-label="${esc(label)}">
      <button type="button" data-act="step" data-id="${id}" data-d="-1" data-key="${id}-m" aria-label="Menos ${esc(label)}">−</button>
      <output>${shown}</output>
      <button type="button" data-act="step" data-id="${id}" data-d="1" data-key="${id}-p" aria-label="Más ${esc(label)}">+</button></span>`;
  }
  function onStep(id, d) {
    const w = W();
    if (id === 'people-all') { const n = Math.max(1, Math.min(6, (state.people.every((x) => x === state.people[0]) ? state.people[0] : Math.max(...state.people)) + d)); state.people = [n, n, n, n]; }
    else if (id.startsWith('people-')) { const s = +id.slice(7); state.people[s] = Math.max(1, Math.min(6, state.people[s] + d)); }
    else if (id.startsWith('xq-')) { const x = w.extra.find((e) => e.id === +id.slice(3)); if (x) x.qty = Math.max(1, Math.min(99, x.qty + d)); }
    else if (id.startsWith('q-')) { const k = `${state.store}:${id.slice(2)}`; const v = (w.adj[k] || 0) + d; if (v) w.adj[k] = Math.max(-50, Math.min(50, v)); else delete w.adj[k]; }
    save(); keepFocus(renderShop);
  }
  function addExtra() {
    const text = $('#add-text').value.trim();
    if (!text) { toast('Escribe qué quieres añadir.', true); $('#add-text').focus(); return; }
    const raw = $('#add-price').value.trim().replace(',', '.').replace(/[€\s]/g, '');
    let price = null;
    if (raw) { price = Number(raw); if (!inRange(price, 0, 9999)) { toast('El precio no es válido.', true); return; } price = Math.round(price * 100) / 100; }
    const w = W();
    w.extra.push({ id: Math.max(0, ...w.extra.map((x) => x.id)) + 1, text: text.slice(0, 80), price, qty: 1, done: false });
    save(); renderShop(); toast('Añadido a la lista.');
  }
  document.addEventListener('submit', (e) => { if (e.target.id === 'add-form') { e.preventDefault(); addExtra(); } });

  /* ================= RECETAS ================= */
  const rx = { fav: false, ok: false, fast: false, left: false, q: '' };
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const excludedNames = (r) => [...new Set(r.ing.filter((i) => state.excl[i.f]).map((i) => FOODS[i.f].n.toLowerCase()))];
  function renderRecipes() {
    const opts = [['todas', 'Todas'], ...TYPES.map((t) => [t.id, t.label + 's'])];
    $('#recipe-filter').innerHTML = opts.map(([id, l]) => `<button type="button" data-act="filter" data-f="${id}" data-key="flt-${id}" aria-pressed="${state.filter === id}">${l}</button>`).join('');
    $('#recipe-extra').innerHTML = [['fav', '♥ Favoritas'], ['ok', 'Sin excluidos'], ['fast', '≤ 15 min'], ['left', 'Con sobras']]
      .map(([k, l]) => `<button type="button" data-act="rx" data-k="${k}" data-key="rx-${k}" aria-pressed="${rx[k]}">${l}</button>`).join('')
      + '<button type="button" data-act="open-fridge" data-key="open-fridge-r">¿Qué tengo en la nevera?</button>';
    const q = norm(rx.q.trim());
    const list = RECIPES.filter((r) => (state.filter === 'todas' || r.tipo === state.filter)
      && (!rx.fav || state.favs[r.id]) && (!rx.ok || !P.usesExcluded(r, state.excl)) && (!rx.fast || r.min <= 15) && (!rx.left || r.sobras)
      && (!q || norm(r.nombre).includes(q) || r.ing.some((i) => norm(FOODS[i.f].n).includes(q))));
    $('#recipe-list').innerHTML = list.map((r) => {
      const ex = excludedNames(r), bad = ex.length > 0 || state.ratings[r.id] === 'never';
      const badge = (state.favs[r.id] ? '♥ ' : '') + (state.ratings[r.id] ? RATING[state.ratings[r.id]][0] + ' ' : '');
      return `<button type="button" class="card recipe-card${bad ? ' dim' : ''}" data-act="recipe" data-id="${r.id}" data-key="rc-${r.id}">
        <span class="rc-top"><span>${TYPE_LABEL[r.tipo]} · ${esc(r.tiempo)}${r.sobras ? ' · sobras' : ''}</span>${igPill(r.ig)}</span>
        <span class="rc-name">${badge}${esc(r.nombre)}</span>
        <span class="rc-macros">${val(r.macros.k, 'kcal')} · ${val(r.macros.p, 'g prot.')} · ${val(r.macros.h, 'g HC')} · ${val(r.macros.g, 'g grasa')}</span>
        ${ex.length ? `<span class="rc-contains">Contiene: ${esc(ex.join(', '))}</span>` : state.ratings[r.id] === 'never' ? '<span class="rc-contains">No volver a poner</span>' : ''}
      </button>`;
    }).join('') || '<p class="empty">Ninguna receta coincide con los filtros.</p>';
  }
  $('#recipe-search').addEventListener('input', (e) => { rx.q = e.target.value; renderRecipes(); });

  /* ================= MÁS ================= */
  function renderMore() {
    const g = goals();
    $('#goals-card').innerHTML = `<h2>Tus objetivos</h2>
      <ul class="goal-list">
        <li><span>Energía</span><b>${nf(g.kcalMin)}–${val(g.kcalMax, 'kcal')}</b></li>
        <li><span>Proteína</span><b>~${val(g.prot, 'g')} (mín. ${val(g.protMin, 'g')})</b></li>
        <li><span>Hidratos</span><b>${nf(g.hcMin)}–${val(g.hcMax, 'g')} al día</b></li>
        <li><span>Por comida principal</span><b>≤ ${val(g.hcComida, 'g')} de HC</b></li>
        <li><span>Preferencia</span><b>Índice glucémico bajo</b></li>
      </ul>
      <div class="row2 goal-edit">
        <label class="field"><span>Kcal objetivo</span><input id="in-kcal" type="text" inputmode="numeric" autocomplete="off" value="${g.kcal}"></label>
        <label class="field"><span>Proteína objetivo (g)</span><input id="in-prot" type="text" inputmode="numeric" autocomplete="off" value="${g.prot}"></label>
      </div>
      <p class="hint">El generador apunta a tu objetivo (kcal ±40, proteína ≥ objetivo − 10 g) y ajusta las raciones. Los hidratos se mantienen entre 120 y 170 g. Los cambios se aplican al generar un menú nuevo.</p>
      <button type="button" class="btn secondary" id="goals-reset">Restablecer objetivos</button>`;
    const nEx = Object.keys(state.excl).length;
    $('#excl-card').innerHTML = `<h2>Alimentos que no quiero</h2>
      <p class="hint">${nEx ? `${nEx} ${nEx === 1 ? 'alimento excluido' : 'alimentos excluidos'}: ${esc(Object.keys(state.excl).slice(0, 6).map((k) => FOODS[k].n.toLowerCase()).join(', '))}${nEx > 6 ? '…' : ''}.` : 'No has excluido nada. Puedes quitar grupos (pescado, lácteos…) o ingredientes sueltos.'}</p>
      <button type="button" class="btn secondary spaced" data-act="open-excl" data-key="open-excl-m">Elegir alimentos</button>`;
    $('#gen-card').innerHTML = `<h2>Generador de menús</h2>
      <ul class="goal-list">
        <li><span>Tiempo entre semana</span><b>${state.gen.timeWeek ? `${state.gen.timeWeek}${NB}min` : 'sin límite'}</b></li>
        <li><span>Tiempo fin de semana</span><b>${state.gen.timeWeekend ? `${state.gen.timeWeekend}${NB}min` : 'sin límite'}</b></li>
        <li><span>Sobras de la cena</span><b>${state.gen.leftovers ? 'sí' : 'no'}</b></li>
      </ul>
      <button type="button" class="btn secondary spaced" data-act="open-gen" data-key="open-gen-m">Ajustes del generador</button>
      <button type="button" class="btn secondary spaced" data-act="open-fridge" data-key="open-fridge-m">¿Qué tengo en la nevera?</button>`;
    const rated = Object.entries(state.ratings).sort((a, b) => BY_ID[a[0]].nombre.localeCompare(BY_ID[b[0]].nombre, 'es'));
    const favs = Object.keys(state.favs).filter((k) => BY_ID[k]);
    $('#ratings-card').innerHTML = `<h2>Mis valoraciones</h2>
      ${rated.length || favs.length ? `<ul class="rating-list">${rated.map(([id, v]) => `<li><span><span aria-hidden="true">${RATING[v][0]}</span> ${esc(BY_ID[id].nombre)}<small>${RATING[v][1]}</small></span><button type="button" class="btn-sm" data-act="unrate" data-id="${id}" data-key="unrate-${id}" aria-label="Quitar valoración: ${esc(BY_ID[id].nombre)}">Quitar</button></li>`).join('')}
      ${favs.map((id) => `<li><span><span aria-hidden="true">♥</span> ${esc(BY_ID[id].nombre)}<small>Favorita</small></span><button type="button" class="btn-sm" data-act="unfav" data-id="${id}" data-key="unfav-${id}" aria-label="Quitar de favoritas: ${esc(BY_ID[id].nombre)}">Quitar</button></li>`).join('')}</ul>`
    : '<p class="hint">Valora los platos con 👍 Me gusta, 👎 Menos a menudo o 🚫 No volver a poner, y márcalos con ♥ si son favoritos. Aquí podrás deshacerlo.</p>'}`;
  }
  function applyGoal(key, el, lo, hi) {
    const n = parseInt(el.value.replace(/\D/g, ''), 10);
    if (!inRange(n, lo, hi)) { toast(`Introduce un valor entre ${nf(lo)} y ${nf(hi)}.`, true); el.value = state.goals[key]; return; }
    state.goals[key] = n; save(); renderAll();
  }
  $('#goals-card').addEventListener('change', (e) => {
    if (e.target.id === 'in-kcal') applyGoal('kcal', e.target, 1200, 3500);
    if (e.target.id === 'in-prot') applyGoal('prot', e.target, 60, 300);
  });
  $('#goals-card').addEventListener('click', (e) => {
    if (e.target.id !== 'goals-reset') return;
    state.goals = { kcal: GOALS.kcal, prot: GOALS.prot }; save(); renderAll(); toast('Objetivos restablecidos.');
  });

  /* ----- Alimentos que no quiero ----- */
  const groupFoods = (gid) => Object.keys(FOODS).filter((id) => (FOODS[id].t || []).includes(gid));
  const GROUP_LABEL = Object.fromEntries(GROUPS.map((g) => [g.id, g.label]));
  function renderExcl() {
    const gs = $('#excl-groups');
    gs.innerHTML = GROUPS.map((g) => {
      const ids = groupFoods(g.id), n = ids.filter((id) => state.excl[id]).length;
      const all = n === ids.length, some = n > 0 && !all;
      return `<button type="button" class="chip${some ? ' partial' : ''}" data-act="excl-group" data-g="${g.id}" data-key="eg-${g.id}" aria-pressed="${all}">${esc(g.label)}${some ? ` <small>${n}/${ids.length}</small>` : ''}</button>`;
    }).join('');
    const q = norm($('#excl-search').value.trim());
    const bySec = SECTIONS.map((sec) => ({ sec, ids: Object.keys(FOODS).filter((id) => FOODS[id].s === sec && (!q || norm(FOODS[id].n).includes(q) || (FOODS[id].t || []).some((t) => norm(GROUP_LABEL[t]).includes(q)))) })).filter((x) => x.ids.length);
    $('#excl-list').innerHTML = bySec.map(({ sec, ids }) => `<h3>${esc(sec)}</h3><ul>${ids.sort((a, b) => FOODS[a].n.localeCompare(FOODS[b].n, 'es')).map((id) => {
      const on = !!state.excl[id], tags = (FOODS[id].t || []).map((t) => GROUP_LABEL[t]).join(', ');
      return `<li><button type="button" class="switch-row" role="switch" aria-checked="${on}" data-act="excl-food" data-f="${id}" data-key="ef-${id}">
        <span class="sw-text"><span>${esc(FOODS[id].n)}</span>${tags ? `<small>${esc(tags)}</small>` : ''}</span><span class="sw" aria-hidden="true"></span><span class="sr-only">${on ? 'Excluido' : 'Permitido'}</span></button></li>`;
    }).join('')}</ul>`).join('') || '<p class="empty">Ningún alimento coincide.</p>';
  }
  $('#excl-search').addEventListener('input', renderExcl);
  /* Al cerrar la hoja: si el menú de hoy o de semanas futuras lleva platos afectados, avisar */
  function affectedPlates() {
    const cur = curMonday(), out = { weeks: [], count: 0, foods: new Set() };
    for (const iso of Object.keys(state.weeks).filter((k) => k >= cur).sort()) {
      const w = state.weeks[iso], slots = [];
      w.plan.forEach((day, d) => { if (day) day.forEach((x, s) => { const hits = P.hitsOf(BY_ID[x.r], state.excl); if (hits.length) { slots.push([d, s]); if (!x.left) out.count++; hits.forEach((h) => out.foods.add(FOODS[h].n.toLowerCase())); } }); });
      if (slots.length) out.weeks.push({ iso, slots });
    }
    return out;
  }
  async function reviewExclusions() {
    const a = affectedPlates();
    if (!a.count) return;
    const names = [...a.foods];
    const msg = names.length === 1 ? `${a.count} ${a.count === 1 ? 'plato lleva' : 'platos llevan'} ${names[0]}` : `${a.count} ${a.count === 1 ? 'plato lleva' : 'platos llevan'} ingredientes que no quieres (${names.slice(0, 4).join(', ')})`;
    const ok = await confirmBox('Platos afectados', `${msg} en tu menú. ¿Los sustituyo por otros que mantengan tus objetivos?`, 'Sustituirlos', false, 'Mantenerlos');
    if (!ok) return;
    const saved = state.wk; let failedAll = [];
    for (const { iso, slots } of a.weeks) {
      state.wk = iso;
      const days = [...new Set(slots.map(([d]) => d))], hit = new Set(slots.map(([d, s]) => `${d}:${s}`));
      slots.forEach(([d, s]) => { delete state.weeks[iso].locks[`${d}:${s}`]; });
      const failed = regenerate(days, (d, s) => !hit.has(`${d}:${s}`), 'sub');
      if (failed.length) failedAll.push(...failed.map((d) => `${DAYS[d]} (semana del ${weekLabel(iso)})`));
    }
    state.wk = saved; save(); renderAll();
    if (failedAll.length) toast(`No he podido sustituir: ${failedAll.join(', ')}. Con tus exclusiones no cuadro esos días; quita alguna.`, true);
    else toast('Platos sustituidos. Tus objetivos se mantienen.');
  }
  $('#dlg-excl').addEventListener('close', () => { renderAll(); reviewExclusions(); });

  /* ----- Ajustes del generador ----- */
  function renderGen() {
    const seg = (key, label) => `<div class="field-block"><span class="fb-label">${label}</span><div class="segmented" role="group" aria-label="${label}">
      ${[[15, '15 min'], [30, '30 min'], [45, '45 min'], [0, 'Sin límite']].map(([v, l]) => `<button type="button" data-act="gen-time" data-k="${key}" data-v="${v}" data-key="gt-${key}-${v}" aria-pressed="${state.gen[key] === v}">${l}</button>`).join('')}</div></div>`;
    $('#gen-body').innerHTML = `
      ${seg('timeWeek', 'Tiempo máximo entre semana (comidas y cenas)')}
      ${seg('timeWeekend', 'Tiempo máximo en fin de semana (comidas y cenas)')}
      <button type="button" class="switch-row" role="switch" aria-checked="${state.gen.leftovers}" data-act="gen-left" data-key="gen-left">
        <span class="sw-text"><span>Cocinar doble la cena para la comida del día siguiente</span><small>Solo con recetas que aguantan bien (sobras). La compra cuenta las raciones justas.</small></span><span class="sw" aria-hidden="true"></span></button>
      <button type="button" class="switch-row" role="switch" aria-checked="${state.fridgeOn}" data-act="fridge-on" data-key="gen-fridge">
        <span class="sw-text"><span>Priorizar lo que tengo en la nevera</span><small>${Object.keys(state.fridge).length ? `${Object.keys(state.fridge).length} ingredientes marcados.` : 'Marca ingredientes en «¿Qué tengo en la nevera?».'}</small></span><span class="sw" aria-hidden="true"></span></button>
      <p class="hint">Los ajustes se aplican al generar el menú (semana o día). Los platos con candado se mantienen.</p>
      <button type="button" class="btn primary spaced" data-act="gen-week" data-key="gen-go">Generar menú nuevo para esta semana</button>`;
  }

  /* ----- ¿Qué tengo en la nevera? ----- */
  const STAPLES = new Set(['aceite', 'ajo', 'pimenton', 'pimentonp', 'curry', 'caldo', 'limon', 'chocolate']);
  function renderFridge() {
    const q = norm($('#fridge-search').value.trim());
    const ids = Object.keys(FOODS).filter((id) => !STAPLES.has(id) && (!q || norm(FOODS[id].n).includes(q))).sort((a, b) => FOODS[a].n.localeCompare(FOODS[b].n, 'es'));
    const sel = Object.keys(state.fridge).filter((k) => FOODS[k]);
    $('#fridge-foods').innerHTML = ids.map((id) => `<button type="button" class="chip" data-act="fridge-food" data-f="${id}" data-key="ff-${id}" aria-pressed="${!!state.fridge[id]}">${esc(FOODS[id].n)}</button>`).join('') || '<p class="empty">Ningún ingrediente coincide.</p>';
    $('#fridge-opts').innerHTML = `<div class="btn-row fridge-btns">
        <button type="button" class="btn secondary" data-act="fridge-home" data-key="fridge-home">Usar lo que tengo en casa</button>
        <button type="button" class="btn secondary" data-act="fridge-clear" data-key="fridge-clear"${sel.length ? '' : ' disabled'}>Quitar marcas (${sel.length})</button></div>
      <button type="button" class="switch-row" role="switch" aria-checked="${state.fridgeOn}" data-act="fridge-on" data-key="fridge-on">
        <span class="sw-text"><span>Priorizar estos ingredientes al generar el menú</span><small>El generador preferirá recetas que los usen.</small></span><span class="sw" aria-hidden="true"></span></button>`;
    if (!sel.length) { $('#fridge-results').innerHTML = '<p class="empty">Marca los ingredientes que tienes.</p>'; return; }
    const rows = RECIPES.filter((r) => !P.usesExcluded(r, state.excl) && state.ratings[r.id] !== 'never').map((r) => {
      const main = [...new Set(r.ing.map((i) => i.f).filter((f) => !STAPLES.has(f)))];
      const have = main.filter((f) => state.fridge[f]), miss = main.filter((f) => !state.fridge[f]);
      return { r, have, miss };
    }).filter((x) => x.have.length).sort((a, b) => a.miss.length - b.miss.length || b.have.length - a.have.length || a.r.min - b.r.min).slice(0, 30);
    $('#fridge-results').innerHTML = `<h3>Recetas (${rows.length})</h3><ul>${rows.map(({ r, have, miss }) => `<li class="fr-item">
      <b>${esc(r.nombre)}</b><small>${TYPE_LABEL[r.tipo]} · ${esc(r.tiempo)} · usa ${have.length} de ${have.length + miss.length}${miss.length ? ` · te falta: ${esc(miss.map((f) => FOODS[f].n.toLowerCase()).join(', '))}` : ' · lo tienes todo'}</small>
      <span class="fr-actions"><button type="button" class="btn-sm" data-act="recipe" data-id="${r.id}" data-key="fr-v-${r.id}">Ver receta</button><button type="button" class="btn-sm accent" data-act="place" data-id="${r.id}" data-key="fr-p-${r.id}">Poner en un día</button></span></li>`).join('')}</ul>`;
  }
  $('#fridge-search').addEventListener('input', renderFridge);
  function openPlace(id) {
    const r = BY_ID[id], s = TYPES.findIndex((t) => t.id === r.tipo);
    $('#place-sub').textContent = `${r.nombre} · ${TYPE_LABEL[r.tipo].toLowerCase()} · semana del ${weekLabel(state.wk)}`;
    $('#place-body').innerHTML = DAYS.map((name, d) => {
      const x = slotAt(d, s);
      return `<button type="button" class="btn secondary rate-opt place-opt" data-act="place-day" data-d="${d}" data-id="${id}" ${W().plan[d] ? '' : 'disabled'}><b>${name}</b><small>${x ? esc(BY_ID[x.r].nombre) : 'sin menú'}</small></button>`;
    }).join('');
    openDialog($('#dlg-place'));
  }

  /* ----- Exportar / importar ----- */
  $('#btn-export').addEventListener('click', () => {
    const payload = { app: 'mi-menu', version: SCHEMA, exportedAt: new Date().toISOString(), data: state };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `mi-menu-${isoDate()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Copia de seguridad exportada.');
  });
  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let incoming = null;
    try {
      if (file.size > 4e6) throw new Error('grande');
      const obj = JSON.parse(await file.text());
      if (obj && obj.app === 'mi-menu') incoming = sanitize(obj.data);
    } catch (err) { /* se trata abajo */ }
    if (!incoming) { toast('Ese archivo no es una copia válida de Mi menú.', true); return; }
    const n = Object.keys(incoming.weeks).length;
    const ok = await confirmBox('¿Importar la copia?', `Se reemplazarán tus datos actuales por los de la copia (${n} ${n === 1 ? 'semana' : 'semanas'} de menú). Esta acción no se puede deshacer.`, 'Importar', true);
    if (!ok) return;
    state = incoming; state.dayDate = isoDate(); state.day = todayIdx(); state.wk = curMonday();
    save(); renderAll(); showView(state.view, false);
    toast('Copia importada correctamente.');
  });
  $('#btn-reset-plan').addEventListener('click', async () => {
    if (!weekChanged()) { toast('Esta semana ya está como se generó.'); return; }
    if (!(await confirmBox('¿Restaurar el menú original?', 'Se deshacen los cambios de platos de esta semana. La lista de la compra se recalcula y lo marcado se conserva.', 'Restaurar', true))) return;
    const w = W(); w.plan = clone(w.orig); save(); renderAll(); toast('Menú original restaurado.');
  });

  /* ================= Acciones (delegación) ================= */
  const wideMQ = window.matchMedia('(min-width: 600px) and (min-height: 560px)');
  async function genWeek() {
    if (weekChanged() && !(await confirmBox('¿Generar un menú nuevo?', 'Hay cambios en esta semana. Se sustituirá por otro menú nuevo (los platos con candado se mantienen).', 'Generar', true))) return;
    if ($('#dlg-gen').open) $('#dlg-gen').close();
    const w = W();
    const failed = regenerate([0, 1, 2, 3, 4, 5, 6], (d, s) => !!w.locks[`${d}:${s}`], 'new');
    renderAll();
    if (failed.length) toast(failMsg(failed), true); else toast('Menú nuevo generado. Todos los días cumplen tus objetivos.');
  }
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const a = el.dataset.act;
    if (a === 'day') { state.day = +el.dataset.day; state.dayDate = isoDate(); save(); keepFocus(renderAll); }
    else if (a === 'open') {
      const slot = +el.dataset.slot;
      if (wideMQ.matches) { state.sel = slot; save(); keepFocus(() => { renderMeals(); renderInline(); }); }
      else { ctxSlot = slotAt(state.day, slot); openRecipe(recipeAt(state.day, slot), ctxSlot); }
    }
    else if (a === 'swap') { state.sel = +el.dataset.slot; openSwap(+el.dataset.slot); }
    else if (a === 'lock') {
      const k = `${state.day}:${+el.dataset.slot}`, w = W();
      if (w.locks[k]) delete w.locks[k]; else w.locks[k] = true;
      save(); keepFocus(renderAll); toast(w.locks[k] ? 'Plato bloqueado: se mantiene al regenerar.' : 'Plato desbloqueado.');
    }
    else if (a === 'rate') openRate(+el.dataset.slot);
    else if (a === 'rate-pick') { setRating(rateCtx, el.dataset.v); paintRate(); renderAll(); }
    else if (a === 'rate-set') { setRating(el.dataset.id, el.dataset.v); if ($('#dlg-recipe').open) { ctxRefresh(); } renderAll(); if (el.dataset.v === 'never' && state.ratings[el.dataset.id] === 'never') toast('No volverá a salir al generar ni en «Cambiar plato».'); }
    else if (a === 'fav') { setRating(el.dataset.id, 'fav'); ctxRefresh(); renderAll(); }
    else if (a === 'unrate') { delete state.ratings[el.dataset.id]; save(); renderAll(); toast('Valoración quitada.'); }
    else if (a === 'unfav') { delete state.favs[el.dataset.id]; save(); renderAll(); toast('Quitada de favoritas.'); }
    else if (a === 'restore-day') {
      const w = W(); w.plan[state.day] = clone(w.orig[state.day]); P.fixPairs(w.plan); save(); renderAll(); toast(`${DAYS[state.day]}: menú original restaurado.`);
    }
    else if (a === 'regen-day') {
      const w = W(), d = state.day;
      const failed = regenerate([d], (dd, s) => !!w.locks[`${dd}:${s}`], 'day');
      renderAll(); if (failed.length) toast(failMsg(failed), true); else toast(`${DAYS[d]}: menú nuevo. Cumple tus objetivos.`);
    }
    else if (a === 'gen-week') genWeek();
    else if (a === 'goto-day') { state.day = +el.dataset.day; state.dayDate = isoDate(); save(); renderAll(); showView('hoy'); }
    else if (a === 'goto-week') { gotoWeek(el.dataset.wk); window.scrollTo({ top: 0 }); }
    else if (a === 'wk-prev') { const prev = Object.keys(state.weeks).filter((k) => k < state.wk).sort().pop(); if (prev) gotoWeek(P.addWeeks(state.wk, -1) in state.weeks ? P.addWeeks(state.wk, -1) : prev); }
    else if (a === 'wk-next') gotoWeek(P.addWeeks(state.wk, 1));
    else if (a === 'wk-today') gotoWeek(curMonday());
    else if (a === 'recipe') { ctxSlot = null; openRecipe(BY_ID[el.dataset.id], null); }
    else if (a === 'cook') openCook(el.dataset.id);
    else if (a === 'filter') { state.filter = el.dataset.f; save(); keepFocus(renderRecipes); }
    else if (a === 'rx') { rx[el.dataset.k] = !rx[el.dataset.k]; keepFocus(renderRecipes); }
    else if (a === 'store') { state.store = el.dataset.s; save(); keepFocus(renderShop); }
    else if (a === 'buy') { const f = el.dataset.f, w = W(); if (w.bought[f]) delete w.bought[f]; else w.bought[f] = true; save(); keepFocus(renderShop); }
    else if (a === 'x-done') { const x = W().extra.find((i) => i.id === +el.dataset.id); if (x) x.done = !x.done; save(); keepFocus(renderShop); }
    else if (a === 'x-del') { const w = W(); w.extra = w.extra.filter((i) => i.id !== +el.dataset.id); save(); renderShop(); toast('Quitado de la lista.'); }
    else if (a === 'step') onStep(el.dataset.id, +el.dataset.d);
    else if (a === 'home') { state.pantry[el.dataset.f] = true; delete W().bought[el.dataset.f]; save(); renderShop(); toast(`${FOODS[el.dataset.f].n}: en casa.`); }
    else if (a === 'unhome') { delete state.pantry[el.dataset.f]; save(); renderShop(); toast('Devuelto a la lista.'); }
    else if (a === 'uncheck') {
      if (await confirmBox('¿Desmarcar todo?', 'Se desmarcarán los artículos comprados de esta semana. Lo que tienes en casa se mantiene.', 'Desmarcar')) {
        const w = W(); w.bought = {}; w.extra.forEach((x) => { x.done = false; }); save(); renderShop(); toast('Lista reiniciada.');
      }
    }
    else if (a === 'open-excl') { $('#excl-search').value = ''; renderExcl(); openDialog($('#dlg-excl')); }
    else if (a === 'excl-food') { const id = el.dataset.f; if (state.excl[id]) delete state.excl[id]; else state.excl[id] = true; save(); keepFocus(renderExcl); }
    else if (a === 'excl-group') {
      const ids = groupFoods(el.dataset.g), all = ids.every((id) => state.excl[id]);
      ids.forEach((id) => { if (all) delete state.excl[id]; else state.excl[id] = true; });
      save(); keepFocus(renderExcl);
    }
    else if (a === 'open-gen') { renderGen(); openDialog($('#dlg-gen')); }
    else if (a === 'gen-time') { state.gen[el.dataset.k] = +el.dataset.v; save(); keepFocus(renderGen); renderMore(); }
    else if (a === 'gen-left') { state.gen.leftovers = !state.gen.leftovers; save(); keepFocus(renderGen); renderMore(); }
    else if (a === 'open-fridge') { $('#fridge-search').value = ''; renderFridge(); openDialog($('#dlg-fridge')); }
    else if (a === 'fridge-food') { const id = el.dataset.f; if (state.fridge[id]) delete state.fridge[id]; else state.fridge[id] = true; save(); keepFocus(renderFridge); }
    else if (a === 'fridge-clear') { state.fridge = {}; save(); renderFridge(); }
    else if (a === 'fridge-home') { Object.keys(state.pantry).forEach((id) => { state.fridge[id] = true; }); save(); renderFridge(); toast(Object.keys(state.pantry).length ? 'Marcado lo que tienes en casa.' : 'Aún no has marcado nada «en casa» en la compra.'); }
    else if (a === 'fridge-on') { state.fridgeOn = !state.fridgeOn; save(); keepFocus(() => { renderFridge(); if ($('#dlg-gen').open) renderGen(); }); }
    else if (a === 'place') { openPlace(el.dataset.id); }
    else if (a === 'place-day') {
      const d = +el.dataset.d, id = el.dataset.id, s = TYPES.findIndex((t) => t.id === BY_ID[id].tipo);
      const note = applySwap(d, s, id);
      $('#dlg-place').close(); state.day = d; save(); renderAll(); toast(`${DAYS[d]}: ${BY_ID[id].nombre}.${note}`);
    }
  });
  function ctxRefresh() {
    if (!$('#dlg-recipe').open || !openRecipeCtx) return;
    const dlg = $('#dlg-recipe'), sc = dlg.scrollTop;
    $('#rcp-body').innerHTML = recipeBody(BY_ID[openRecipeCtx], false, ctxSlot && ctxSlot.r === openRecipeCtx ? ctxSlot : null);
    dlg.scrollTop = sc;
  }
  // El panel lateral de receta también tiene botones de valoración: se repinta con renderAll()

  /* ================= Vistas y navegación ================= */
  function showView(name, scroll = true) {
    state.view = name; save();
    $$('.tabbar button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    $$('.panel').forEach((p) => { p.hidden = p.id !== `panel-${name}`; });
    if (scroll) window.scrollTo({ top: 0, behavior: 'auto' });
  }
  $('.tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) showView(b.dataset.tab);
  });
  // Flechas arriba/abajo dentro del rail (patrón de tabs verticales)
  $('.tabbar').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const tabs = $$('.tabbar button'), i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const n = tabs[(i + (e.key === 'ArrowDown' ? 1 : tabs.length - 1)) % tabs.length];
    n.focus(); showView(n.dataset.tab);
  });

  /* Lado del rail: si la safe area grande queda a la izquierda (cámara de ese lado al girar), el rail va a la izquierda. */
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)';
  document.body.appendChild(probe);
  function syncRailSide() {
    const cs = getComputedStyle(probe);
    const l = parseFloat(cs.paddingLeft) || 0, r = parseFloat(cs.paddingRight) || 0;
    document.documentElement.dataset.rail = l > r ? 'left' : 'right';
  }
  syncRailSide();
  window.addEventListener('resize', syncRailSide);
  window.addEventListener('orientationchange', syncRailSide);

  /* ================= Arranque ================= */
  function renderAll() {
    ensureWeek(state.wk);
    renderHoy(); renderWeek(); renderShop(); renderRecipes(); renderMore();
    if ($('#dlg-recipe').open) ctxRefresh();
  }
  function renderDate() {
    const d = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#today-label').textContent = d.charAt(0).toUpperCase() + d.slice(1);
  }
  ensureWeek(curMonday());
  renderDate(); renderAll(); showView(state.view, false);
  // Al volver a la app tras medianoche: actualiza fecha, semana y día actuales
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || state.dayDate === isoDate()) return;
    state.day = todayIdx(); state.dayDate = isoDate(); state.wk = curMonday(); save(); renderDate(); renderAll();
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
