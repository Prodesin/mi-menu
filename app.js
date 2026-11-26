/* Mi menú — lógica de la app. Sin dependencias. Datos en data.js (window.MENU_DATA). */
(() => {
  'use strict';
  const { GOALS, TYPES, SECTIONS, FOODS, RECIPES, BY_ID, PLAN, DAYS } = window.MENU_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ================= Utilidades ================= */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Formato español: 1.850 y coma decimal (toLocaleString no agrupa los miles de 4 cifras)
  const nf = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const nd = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '');
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + nf(Math.abs(n));
  const todayIdx = () => (new Date().getDay() + 6) % 7;
  const isoDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const VIEWS = ['hoy', 'semana', 'compra', 'recetas', 'mas'];
  const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.id, t.label]));
  const IN_MEAL = { desayuno: 'el desayuno', comida: 'la comida', cena: 'la cena' };

  /* ================= Estado y persistencia ================= */
  const KEY = 'mi-menu:v1';
  const SCHEMA = 1;
  const defaults = () => ({ v: SCHEMA, swaps: {}, bought: {}, pantry: {}, day: todayIdx(), dayDate: isoDate(), view: 'hoy', sel: 0, filter: 'todas', goals: { kcal: GOALS.kcal, prot: GOALS.prot } });

  const inRange = (n, a, b) => Number.isFinite(n) && n >= a && n <= b;
  /* Valida y normaliza un objeto de estado (carga y también importación). Devuelve null si no es válido. */
  function sanitize(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    if (o.v !== SCHEMA) return null;
    const s = defaults();
    if (o.swaps && typeof o.swaps === 'object') {
      for (const [k, id] of Object.entries(o.swaps)) {
        const m = /^([0-6]):([0-3])$/.exec(k);
        if (m && BY_ID[id] && BY_ID[id].tipo === TYPES[+m[2]].id && id !== PLAN[+m[1]][+m[2]]) s.swaps[k] = id;
      }
    }
    for (const field of ['bought', 'pantry']) {
      if (o[field] && typeof o[field] === 'object') for (const [k, v] of Object.entries(o[field])) if (FOODS[k] && v === true) s[field][k] = true;
    }
    if (Number.isInteger(o.day) && inRange(o.day, 0, 6) && typeof o.dayDate === 'string') { s.day = o.day; s.dayDate = o.dayDate; }
    if (VIEWS.includes(o.view)) s.view = o.view;
    if (Number.isInteger(o.sel) && inRange(o.sel, 0, 3)) s.sel = o.sel;
    if (['todas', ...TYPES.map((t) => t.id)].includes(o.filter)) s.filter = o.filter;
    if (o.goals && typeof o.goals === 'object') {
      if (inRange(o.goals.kcal, 1200, 3500)) s.goals.kcal = Math.round(o.goals.kcal);
      if (inRange(o.goals.prot, 60, 300)) s.goals.prot = Math.round(o.goals.prot);
    }
    return s;
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = sanitize(JSON.parse(raw)); if (s) return s; }
    } catch (e) { /* almacenamiento no disponible o corrupto */ }
    return defaults();
  }
  let state = load();
  // Un día nuevo vuelve a abrir en el día actual; durante el mismo día se recuerda la selección.
  if (state.dayDate !== isoDate()) { state.day = todayIdx(); state.dayDate = isoDate(); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* sin espacio / modo privado */ }
  }

  /* ================= Objetivos y cálculos ================= */
  function goals() {
    const kcal = state.goals.kcal, prot = state.goals.prot;
    return { kcal, kcalMin: kcal - 125, kcalMax: kcal + 75, prot, protMin: prot - 10, hcMin: GOALS.hcMin, hcMax: GOALS.hcMax, hcComida: GOALS.hcComida };
  }
  const recipeAt = (day, slot) => BY_ID[state.swaps[`${day}:${slot}`]] || BY_ID[PLAN[day][slot]];
  const isSwapped = (day, slot) => !!state.swaps[`${day}:${slot}`];
  const dayHasSwaps = (day) => [0, 1, 2, 3].some((s) => isSwapped(day, s));
  function dayTotals(day) {
    const t = { k: 0, p: 0, h: 0, g: 0 };
    for (let s = 0; s < 4; s++) { const m = recipeAt(day, s).macros; t.k += m.k; t.p += m.p; t.h += m.h; t.g += m.g; }
    return t;
  }
  /* Lista de problemas del día; vacía = «Día en objetivo» */
  function dayIssues(day, t = dayTotals(day)) {
    const g = goals(), out = [];
    if (t.k < g.kcalMin) out.push('Kcal bajas'); else if (t.k > g.kcalMax) out.push('Kcal altas');
    if (t.p < g.protMin) out.push('Proteína baja');
    if (t.h < g.hcMin) out.push('Hidratos bajos'); else if (t.h > g.hcMax) out.push('Hidratos altos');
    for (let s = 0; s < 3; s++) if (recipeAt(day, s).macros.h > g.hcComida + 0.5) out.push(`Hidratos altos en ${IN_MEAL[TYPES[s].id]}`);
    return out;
  }

  /* ================= Toast y diálogos ================= */
  let toastTimer;
  function toast(msg, error = false) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('error', error);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function openDialog(d) { if (!d.open) d.showModal(); }
  $$('dialog').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); }); // clic en el fondo o en ✕
  });
  function confirmBox(title, text, okLabel, danger = false) {
    const d = $('#dlg-confirm');
    $('#cf-title').textContent = title;
    $('#cf-text').textContent = text;
    const ok = $('#cf-ok');
    ok.textContent = okLabel;
    ok.className = `btn ${danger ? 'danger' : 'primary'}`;
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

  const macroLine = (m) => `<p class="macro-line"><span class="hl">${nf(m.k)} kcal</span> · <span>${nf(m.p)} g prot</span> · <span class="hl">${nf(m.h)} g HC</span> · <span>${nf(m.g)} g grasa</span></p>`;

  /* Barra con zona objetivo: fill = valor, banda = rango deseado. */
  function bar(label, value, unitTxt, rightTxt, scaleMax, zoneFrom, zoneTo, ok) {
    const pct = Math.min(100, (value / scaleMax) * 100);
    const z0 = (zoneFrom / scaleMax) * 100, z1 = Math.min(100, (zoneTo / scaleMax) * 100);
    return `<div class="bar">
      <div class="bar-head"><span><b>${label}</b> ${nf(value)} ${unitTxt}</span><span>${rightTxt}</span></div>
      <div class="track" role="img" aria-label="${label}: ${nf(value)} ${unitTxt}, ${rightTxt}">
        <div class="zone" style="left:${z0}%;width:${z1 - z0}%"></div>
        <div class="fill ${ok ? '' : 'warn'}" style="width:${pct}%"></div>
      </div>
    </div>`;
  }

  /* ================= HOY ================= */
  function renderChips() {
    const today = todayIdx();
    $('#day-chips').innerHTML = DAYS.map((name, i) => {
      const ok = dayIssues(i).length === 0;
      return `<button type="button" class="chip-day${i === today ? ' is-today' : ''}" data-act="day" data-day="${i}" data-key="day${i}"
        aria-pressed="${i === state.day}" aria-label="${name}${i === today ? ' (hoy)' : ''}${ok ? '' : ', revisar'}">
        <span>${LETTERS[i]}</span><i class="dot ${ok ? 'ok' : 'warn'}" aria-hidden="true"></i></button>`;
    }).join('');
  }

  function renderSummary() {
    const g = goals(), t = dayTotals(state.day), issues = dayIssues(state.day, t), ok = issues.length === 0;
    $('#day-summary').innerHTML = `
      <div class="sum-top">
        <div>
          <p class="sum-kcal"><b>${nf(t.k)}</b> kcal</p>
          <p class="hint">${DAYS[state.day]} · objetivo ${nf(g.kcal - 25)}–${nf(g.kcal + 25)}<span class="fat-inline"> · grasa ${nf(t.g)} g</span></p>
        </div>
        <span class="pill ${ok ? 'ok' : 'warn'}"><i></i>${ok ? 'Día en objetivo' : 'Revisa'}</span>
      </div>
      ${ok ? '' : `<p class="issues">${issues.map(esc).join(' · ')}</p>`}
      <div class="bars">
        ${bar('Kcal', t.k, '', `${nf(g.kcalMin)}–${nf(g.kcalMax)}`, g.kcalMax * 1.08, g.kcalMin, g.kcalMax, t.k >= g.kcalMin && t.k <= g.kcalMax)}
        ${bar('Proteína', t.p, 'g', `objetivo ${nf(g.prot)} g`, g.prot * 1.25, g.protMin, g.prot * 1.25, t.p >= g.protMin)}
        ${bar('Hidratos', t.h, 'g', `${nf(g.hcMin)}–${nf(g.hcMax)} g`, g.hcMax * 1.15, g.hcMin, g.hcMax, t.h >= g.hcMin && t.h <= g.hcMax)}
        <p class="fat-line"><b>Grasa</b> ${nf(t.g)} g</p>
      </div>`;
  }

  function renderMeals() {
    const html = TYPES.map((tp, s) => {
      const r = recipeAt(state.day, s), swapped = isSwapped(state.day, s);
      return `<article class="meal type-${tp.id}${state.sel === s ? ' selected' : ''}" ${state.sel === s ? 'aria-current="true"' : ''}>
        <div class="meal-top"><span class="meal-type">${tp.label}${swapped ? ' · <em>cambiado</em>' : ''}</span>${igPill(r.ig)}</div>
        <button type="button" class="meal-main" data-act="open" data-slot="${s}" data-key="open${s}" aria-label="Ver receta: ${esc(r.nombre)}">
          <span class="meal-name">${esc(r.nombre)}</span><span class="meal-time">${esc(r.tiempo)}</span>
        </button>
        <div class="meal-foot">
        ${macroRow(r.macros)}${macroLine(r.macros)}
        <div class="meal-actions">
          <button type="button" class="btn-sm" data-act="open" data-slot="${s}" data-key="recipe${s}">Receta</button>
          <button type="button" class="btn-sm accent" data-act="swap" data-slot="${s}" data-key="swap${s}" aria-label="Cambiar ${tp.label.toLowerCase()}">Cambiar</button>
        </div></div>
      </article>`;
    }).join('');
    const restore = dayHasSwaps(state.day) ? '<button type="button" class="btn secondary restore-day" data-act="restore-day" data-key="restore-day">Restaurar menú original</button>' : '';
    $('#meals').innerHTML = html + restore;
  }

  /* Cuerpo de receta (diálogo y panel lateral) */
  function unitHint(i) {
    const u = FOODS[i.f].u;
    if (!u || u.g > 160) return '';
    const n = i.g / u.g, r = Math.round(n);
    return r >= 1 && Math.abs(n - r) < 0.12 ? ` <small>(${r} ${r === 1 ? u.s : u.p})</small>` : '';
  }
  function recipeBody(r, withTitle) {
    return `${withTitle ? `<h2>${esc(r.nombre)}</h2>` : ''}
      <p class="rcp-meta"><span>${TYPE_LABEL[r.tipo]}</span><span>⏱ ${esc(r.tiempo)}</span>${igPill(r.ig)}<span>1 ración</span></p>
      ${macroRow(r.macros)}
      <h3>Ingredientes</h3>
      <ul class="ing-list">${r.ing.map((i) => `<li><span>${esc(FOODS[i.f].n)}</span><span>${nf(i.g)} g${unitHint(i)}</span></li>`).join('')}</ul>
      <p class="hint">Sal y especias al gusto.</p>
      <h3>Preparación</h3>
      <ol class="steps">${r.pasos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
      ${r.consejo ? `<p class="tip"><b>Consejo.</b> ${esc(r.consejo)}</p>` : ''}
      <button type="button" class="btn primary" data-act="cook" data-id="${r.id}">Modo cocina</button>`;
  }
  const renderInline = () => { $('#today-recipe').innerHTML = recipeBody(recipeAt(state.day, state.sel), true); };

  function renderHoy() {
    renderChips(); renderSummary(); renderMeals(); renderInline();
  }

  /* ----- Hoja de recetas, cambio de plato y modo cocina ----- */
  function openRecipe(r) {
    $('#rcp-title').textContent = r.nombre;
    $('#rcp-body').innerHTML = recipeBody(r, false);
    openDialog($('#dlg-recipe'));
  }

  let swapSlot = 0;
  function openSwap(slot) {
    swapSlot = slot;
    const tp = TYPES[slot], cur = recipeAt(state.day, slot);
    $('#swap-title').textContent = `Cambiar ${tp.label.toLowerCase()}`;
    $('#swap-sub').textContent = `${DAYS[state.day]} · ahora: ${cur.nombre}`;
    const alts = RECIPES.filter((r) => r.tipo === tp.id && r.id !== cur.id)
      .sort((a, b) => Math.abs(a.macros.k - cur.macros.k) - Math.abs(b.macros.k - cur.macros.k));
    const diff = (a, b, unit, cls) => {
      const d = Math.round(a) - Math.round(b);
      return `<span class="diff ${d === 0 ? '' : cls(d)}">${signed(d)} ${unit}</span>`;
    };
    const item = (r, isCur) => `<li><button type="button" class="swap-item${isCur ? ' current' : ''}" data-act="pick" data-id="${r.id}" data-key="pick-${r.id}" ${isCur ? 'aria-current="true"' : ''}>
        <span class="swap-name">${esc(r.nombre)}${isCur ? ' <em>actual</em>' : ''}</span>
        <span class="swap-macros">${nf(r.macros.k)} kcal · ${nf(r.macros.p)} g prot. · ${nf(r.macros.h)} g HC ${igPill(r.ig)}</span>
        ${isCur ? '' : `<span class="swap-diffs">${diff(r.macros.k, cur.macros.k, 'kcal', () => '')}${diff(r.macros.p, cur.macros.p, 'g prot.', (d) => (d > 0 ? 'good' : 'bad'))}${diff(r.macros.h, cur.macros.h, 'g HC', (d) => (d > 0 ? 'bad' : 'good'))}</span>`}
      </button></li>`;
    $('#swap-list').innerHTML = item(cur, true) + alts.map((r) => item(r, false)).join('');
    $('#swap-restore').hidden = !isSwapped(state.day, slot);
    openDialog($('#dlg-swap'));
  }
  function setRecipe(day, slot, id) {
    if (id === PLAN[day][slot]) delete state.swaps[`${day}:${slot}`]; else state.swaps[`${day}:${slot}`] = id;
    save(); renderAll();
  }
  $('#swap-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="pick"]');
    if (!b) return;
    if (b.dataset.id !== recipeAt(state.day, swapSlot).id) { setRecipe(state.day, swapSlot, b.dataset.id); toast('Plato cambiado. Totales actualizados.'); }
    $('#dlg-swap').close();
  });
  $('#swap-restore').addEventListener('click', () => {
    setRecipe(state.day, swapSlot, PLAN[state.day][swapSlot]);
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

  /* ================= SEMANA ================= */
  function renderWeek() {
    const today = todayIdx();
    const tot = DAYS.map((_, i) => dayTotals(i));
    const avg = (k) => tot.reduce((a, t) => a + t[k], 0) / 7;
    $('#week-avg').textContent = `Media semanal: ${nf(avg('k'))} kcal · ${nf(avg('p'))} g de proteína · ${nf(avg('h'))} g de hidratos al día.`;
    $('#week-grid').innerHTML = DAYS.map((name, i) => {
      const t = tot[i], issues = dayIssues(i, t), ok = issues.length === 0;
      return `<button type="button" class="card week-day${i === today ? ' is-today' : ''}" data-act="goto-day" data-day="${i}" data-key="wd${i}"
        aria-label="${name}: ${nf(t.k)} kcal, ${ok ? 'en objetivo' : 'revisar'}. Abrir el día">
        <span class="wd-head"><b>${name}</b>${i === today ? '<em>hoy</em>' : ''}<span class="pill sm ${ok ? 'ok' : 'warn'}"><i></i>${ok ? 'En objetivo' : 'Revisa'}</span></span>
        <ul class="wd-meals">${TYPES.map((tp, s) => `<li><span>${tp.label}</span>${esc(recipeAt(i, s).nombre)}</li>`).join('')}</ul>
        ${ok ? '' : `<span class="issues">${issues.map(esc).join(' · ')}</span>`}
        <span class="wd-tot"><span><b>${nf(t.k)}</b> kcal</span> · <span><b>${nf(t.p)}</b> g prot</span> · <span><b>${nf(t.h)}</b> g HC</span></span>
      </button>`;
    }).join('');
  }

  /* ================= COMPRA ================= */
  /* Agrega el plan actual por alimento y redondea a algo comprable. */
  function shoppingItems() {
    const total = {};
    for (let d = 0; d < 7; d++) for (let s = 0; s < 4; s++) recipeAt(d, s).ing.forEach((i) => { total[i.f] = (total[i.f] || 0) + i.g; });
    return Object.entries(total).map(([id, g]) => {
      const f = FOODS[id];
      let qty, sub = '';
      if (f.u) {
        const n = Math.max(1, Math.ceil(g / f.u.g - 0.03));
        qty = `${nf(n)} ${n === 1 ? f.u.s : f.u.p}`;
        if (f.u.g >= 200) sub = `necesitas ${nf(g)} g`;
      } else {
        const step = g >= 1000 ? 100 : 50, r = Math.max(step, Math.ceil(g / step) * step);
        qty = r >= 1000 ? `${nd(r / 1000)} kg` : `${nf(r)} g`;
      }
      return { id, name: f.n, section: f.s, qty, sub };
    });
  }
  const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const HOME_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7M6 10v9h12v-9"/></svg>';

  function renderShop() {
    const all = shoppingItems();
    const need = all.filter((i) => !state.pantry[i.id]);
    const missing = need.filter((i) => !state.bought[i.id]).length;
    const done = need.length - missing;
    $('#shop-head').innerHTML = `
      <div class="sh-top">
        <div>
          <h2>${need.length === 0 ? 'Lista vacía' : missing === 0 ? '¡Compra completa!' : missing === 1 ? 'Falta 1 artículo' : `Faltan ${nf(missing)} artículos`}</h2>
          <p class="hint">${nf(done)} de ${nf(need.length)} comprados${all.length - need.length ? ` · ${nf(all.length - need.length)} en casa` : ''}</p>
        </div>
        <button type="button" class="btn secondary btn-inline" data-act="new-week" data-key="new-week">Nueva semana</button>
      </div>
      <div class="track" aria-hidden="true"><div class="fill" style="width:${need.length ? (done / need.length) * 100 : 0}%"></div></div>`;

    const bySec = SECTIONS.map((sec) => ({ sec, items: need.filter((i) => i.section === sec) })).filter((x) => x.items.length);
    $('#shop-list').innerHTML = bySec.map(({ sec, items }) => {
      items.sort((a, b) => (!!state.bought[a.id] - !!state.bought[b.id]) || a.name.localeCompare(b.name, 'es'));
      return `<section class="card shop-sec"><h2>${esc(sec)} <small>${items.length}</small></h2><ul>${items.map((i) => {
        const b = !!state.bought[i.id];
        return `<li class="shop-item${b ? ' bought' : ''}">
          <button type="button" class="check" role="checkbox" aria-checked="${b}" data-act="buy" data-f="${i.id}" data-key="buy-${i.id}" aria-label="Comprado: ${esc(i.name)}, ${esc(i.qty)}">${CHECK_SVG}</button>
          <span class="si-text"><span class="si-name">${esc(i.name)}</span><span class="si-qty">${esc(i.qty)}${i.sub ? ` <small>${esc(i.sub)}</small>` : ''}</span></span>
          <button type="button" class="btn-sm home-btn" data-act="home" data-f="${i.id}" data-key="home-${i.id}" aria-label="Lo tengo en casa: ${esc(i.name)}">${HOME_SVG}<span>En casa</span></button>
        </li>`;
      }).join('')}</ul></section>`;
    }).join('') || '<p class="empty">Todo lo de esta semana está en casa. 🎉</p>';

    const home = Object.keys(state.pantry).sort((a, b) => FOODS[a].n.localeCompare(FOODS[b].n, 'es'));
    const box = $('#shop-home');
    box.hidden = home.length === 0;
    $('#shop-home').innerHTML = `<summary>En casa <small>${home.length}</small></summary>
      <p class="hint">Lo que ya tienes se queda fuera de la lista, también en las próximas semanas.</p>
      <ul>${home.map((id) => `<li class="shop-item">
        <span class="si-text"><span class="si-name">${esc(FOODS[id].n)}</span></span>
        <button type="button" class="btn-sm" data-act="unhome" data-f="${id}" data-key="unhome-${id}" aria-label="Devolver a la lista: ${esc(FOODS[id].n)}">Devolver</button></li>`).join('')}</ul>`;
  }

  /* ================= RECETAS ================= */
  function renderRecipes() {
    const opts = [['todas', 'Todas'], ...TYPES.map((t) => [t.id, t.label + 's'])];
    $('#recipe-filter').innerHTML = opts.map(([id, l]) => `<button type="button" data-act="filter" data-f="${id}" data-key="flt-${id}" aria-pressed="${state.filter === id}">${l}</button>`).join('');
    const list = RECIPES.filter((r) => state.filter === 'todas' || r.tipo === state.filter);
    $('#recipe-list').innerHTML = list.map((r) => `<button type="button" class="card recipe-card" data-act="recipe" data-id="${r.id}" data-key="rc-${r.id}">
        <span class="rc-top"><span>${TYPE_LABEL[r.tipo]} · ${esc(r.tiempo)}</span>${igPill(r.ig)}</span>
        <span class="rc-name">${esc(r.nombre)}</span>
        <span class="rc-macros">${nf(r.macros.k)} kcal · ${nf(r.macros.p)} g prot. · ${nf(r.macros.h)} g HC · ${nf(r.macros.g)} g grasa</span>
      </button>`).join('');
  }

  /* ================= MÁS ================= */
  function renderMore() {
    const g = goals();
    $('#goals-card').innerHTML = `<h2>Tus objetivos</h2>
      <ul class="goal-list">
        <li><span>Energía</span><b>${nf(g.kcal - 25)}–${nf(g.kcal + 25)} kcal</b></li>
        <li><span>Aceptable</span><b>${nf(g.kcalMin)}–${nf(g.kcalMax)} kcal</b></li>
        <li><span>Proteína</span><b>~${nf(g.prot)} g (mín. ${nf(g.protMin)})</b></li>
        <li><span>Hidratos</span><b>${nf(g.hcMin)}–${nf(g.hcMax)} g al día</b></li>
        <li><span>Por comida principal</span><b>≤ ${nf(g.hcComida)} g de HC</b></li>
        <li><span>Preferencia</span><b>Índice glucémico bajo</b></li>
      </ul>
      <div class="row2 goal-edit">
        <label class="field"><span>Kcal objetivo</span><input id="in-kcal" type="text" inputmode="numeric" autocomplete="off" value="${g.kcal}"></label>
        <label class="field"><span>Proteína objetivo (g)</span><input id="in-prot" type="text" inputmode="numeric" autocomplete="off" value="${g.prot}"></label>
      </div>
      <p class="hint">Si los cambias, solo se actualiza el indicador del día: las recetas no se reajustan. Los hidratos se mantienen fijos.</p>
      <button type="button" class="btn secondary" id="goals-reset">Restablecer objetivos</button>`;
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

  /* ----- Exportar / importar ----- */
  $('#btn-export').addEventListener('click', () => {
    const payload = { app: 'mi-menu', exportedAt: new Date().toISOString(), data: state };
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
      if (file.size > 2e6) throw new Error('grande');
      const obj = JSON.parse(await file.text());
      if (obj && obj.app === 'mi-menu') incoming = sanitize(obj.data);
    } catch (err) { /* se trata abajo */ }
    if (!incoming) { toast('Ese archivo no es una copia válida de Mi menú.', true); return; }
    const n = Object.keys(incoming.swaps).length;
    const ok = await confirmBox('¿Importar la copia?', `Se reemplazarán tus datos actuales por los de la copia (${n} ${n === 1 ? 'plato cambiado' : 'platos cambiados'}). Esta acción no se puede deshacer.`, 'Importar', true);
    if (!ok) return;
    state = incoming; state.dayDate = isoDate(); state.day = todayIdx();
    save(); renderAll(); showView(state.view, false);
    toast('Copia importada correctamente.');
  });
  $('#btn-reset-plan').addEventListener('click', async () => {
    if (!Object.keys(state.swaps).length) { toast('Ya estás con el menú original.'); return; }
    if (!(await confirmBox('¿Restaurar el menú original?', 'Se deshacen todos los cambios de platos de la semana. La lista de la compra se recalcula.', 'Restaurar', true))) return;
    state.swaps = {}; save(); renderAll(); toast('Menú original restaurado.');
  });

  /* ================= Acciones (delegación) ================= */
  const wideMQ = window.matchMedia('(min-width: 600px) and (min-height: 560px)');
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const a = el.dataset.act;
    if (a === 'day') { state.day = +el.dataset.day; state.dayDate = isoDate(); save(); keepFocus(renderAll); }
    else if (a === 'open') {
      const slot = +el.dataset.slot;
      if (wideMQ.matches) { state.sel = slot; save(); keepFocus(() => { renderMeals(); renderInline(); }); }
      else openRecipe(recipeAt(state.day, slot));
    }
    else if (a === 'swap') { state.sel = +el.dataset.slot; openSwap(+el.dataset.slot); }
    else if (a === 'restore-day') {
      for (let s = 0; s < 4; s++) delete state.swaps[`${state.day}:${s}`];
      save(); renderAll(); toast(`${DAYS[state.day]}: menú original restaurado.`);
    }
    else if (a === 'goto-day') { state.day = +el.dataset.day; state.dayDate = isoDate(); save(); renderAll(); showView('hoy'); }
    else if (a === 'recipe') openRecipe(BY_ID[el.dataset.id]);
    else if (a === 'cook') openCook(el.dataset.id);
    else if (a === 'filter') { state.filter = el.dataset.f; save(); keepFocus(renderRecipes); }
    else if (a === 'buy') { const f = el.dataset.f; if (state.bought[f]) delete state.bought[f]; else state.bought[f] = true; save(); keepFocus(renderShop); }
    else if (a === 'home') { state.pantry[el.dataset.f] = true; delete state.bought[el.dataset.f]; save(); renderShop(); toast(`${FOODS[el.dataset.f].n}: en casa.`); }
    else if (a === 'unhome') { delete state.pantry[el.dataset.f]; save(); renderShop(); toast('Devuelto a la lista.'); }
    else if (a === 'new-week') {
      if (await confirmBox('¿Empezar una nueva semana?', 'Se desmarcarán todos los artículos comprados. Lo que tienes en casa se mantiene.', 'Nueva semana')) {
        state.bought = {}; save(); renderShop(); toast('Nueva semana: lista reiniciada.');
      }
    }
  });

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
    renderHoy(); renderWeek(); renderShop(); renderRecipes(); renderMore();
  }
  function renderDate() {
    const d = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#today-label').textContent = d.charAt(0).toUpperCase() + d.slice(1);
  }
  renderDate(); renderAll(); showView(state.view, false);
  // Al volver a la app tras medianoche: actualiza fecha y día actual
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || state.dayDate === isoDate()) return;
    state.day = todayIdx(); state.dayDate = isoDate(); save(); renderDate(); renderAll();
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
