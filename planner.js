/* Mi menú — generador de menús semanales.
 *
 * Determinista con semilla. Funciona en navegador (window.MENU_PLANNER) y en Node (module.exports).
 * Cada toma del plan es un «slot»: { r: id de receta, f: factor de ración (0,85–1,20),
 *   dbl: true → se cocina doble (cena para la comida de mañana), left: true → sobras de la cena de ayer }.
 * Un plan semanal es una matriz 7 × 4 de slots (L–D × desayuno, comida, cena, tentempié).
 */
(function () {
  'use strict';
  const D = (typeof window !== 'undefined' && window.MENU_DATA) || (typeof require !== 'undefined' ? require('./data.js') : null);
  const { RECIPES, BY_ID, FOODS, GOALS, DAYS, calcIng, scaledIng } = D;

  const FACTORS = [0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2];
  const SLOT_TYPES = ['desayuno', 'comida', 'cena', 'tentempie'];
  const MAX_USES = 2, MAX_USES_LIGHT = 3;          // por semana: platos principales / desayunos y tentempiés
  const TRIES = 90;

  /* ---------- Utilidades ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const fKey = (f) => Math.round(f * 100);

  /* Macros escaladas por receta y factor (calculadas desde los gramos redondeados, que son los que se muestran) */
  const SC = {};
  RECIPES.forEach((r) => {
    SC[r.id] = FACTORS.map((f) => { const ing = scaledIng(r, f); return { f, ing, m: calcIng(ing) }; });
  });
  const scaled = (r, f) => {
    const i = FACTORS.indexOf(f);
    if (i >= 0) return SC[r.id][i];
    const ing = scaledIng(r, f); return { f, ing, m: calcIng(ing) };
  };
  const slotMacros = (slot) => scaled(BY_ID[slot.r], slot.f || 1).m;
  const slotIng = (slot) => scaled(BY_ID[slot.r], slot.f || 1).ing;

  function dayTotals(day) {
    const t = { k: 0, p: 0, h: 0, g: 0 };
    day.forEach((s) => { const m = slotMacros(s); t.k += m.k; t.p += m.p; t.h += m.h; t.g += m.g; });
    return t;
  }

  /* Objetivos efectivos (kcal ±40 y proteína ≥ objetivo − 10; hidratos siempre 120–170) */
  function goalsFor(g) {
    const kcal = (g && g.kcal) || GOALS.kcal, prot = (g && g.prot) || GOALS.prot;
    return { kcal, kcalMin: kcal - GOALS.kcalTol, kcalMax: kcal + GOALS.kcalTol, prot, protMin: prot - 10, hcMin: GOALS.hcMin, hcMax: GOALS.hcMax, hcComida: GOALS.hcComida };
  }
  /* Problemas de un día (vacío = cumple) */
  function dayIssues(day, g) {
    const t = dayTotals(day), out = [], k = Math.round(t.k), h = Math.round(t.h);
    if (k < g.kcalMin) out.push('Kcal bajas'); else if (k > g.kcalMax) out.push('Kcal altas');
    if (Math.round(t.p) < g.protMin) out.push('Proteína baja');
    if (h < g.hcMin) out.push('Hidratos bajos'); else if (h > g.hcMax) out.push('Hidratos altos');
    const IN = ['el desayuno', 'la comida', 'la cena'];
    for (let s = 0; s < 3; s++) if (slotMacros(day[s]).h > g.hcComida + 0.5) out.push(`Hidratos altos en ${IN[s]}`);
    return out;
  }

  /* Categoría de proteína principal de una receta (para variar) */
  const CAT_OF_TAG = { pescado: 'mar', marisco: 'mar', pollo: 'pollo', ternera: 'ternera', cerdo: 'cerdo', huevo: 'huevo', legumbres: 'legumbre', lacteos: 'lacteo' };
  RECIPES.forEach((r) => {
    const acc = {};
    r.ing.forEach((i) => {
      const f = FOODS[i.f], cats = new Set((f.t || []).map((t) => CAT_OF_TAG[t]).filter(Boolean));
      cats.forEach((c) => { acc[c] = (acc[c] || 0) + f.p * i.g / 100; });
    });
    r.cat = Object.entries(acc).sort((a, b) => b[1] - a[1]).map((e) => e[0])[0] || 'otro';
  });

  /* Gramos totales por alimento de una semana (cuenta dobles, sobras y personas por toma) */
  function weekFoodGrams(plan, people) {
    const out = {}, pp = people || [1, 1, 1, 1];
    plan.forEach((day) => day.forEach((slot, s) => {
      if (slot.left) return;
      const mult = (slot.dbl ? 2 : 1) * (pp[s] || 1);
      slotIng(slot).forEach((i) => { out[i.f] = (out[i.f] || 0) + i.g * mult; });
    }));
    return out;
  }
  /* ¿Contiene algún alimento excluido? Devuelve los ids de alimento afectados */
  const hitsOf = (r, excl) => r.ing.filter((i) => excl && excl[i.f]).map((i) => i.f);
  const usesExcluded = (r, excl) => !!excl && r.ing.some((i) => excl[i.f]);

  /* Lunes (ISO, local) de la semana que contiene una fecha */
  const pad2 = (n) => String(n).padStart(2, '0');
  function isoOf(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
  function mondayOf(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return isoOf(d);
  }
  function addWeeks(iso, n) {
    const [y, m, dd] = iso.split('-').map(Number);
    const d = new Date(y, m - 1, dd + 7 * n, 12);
    return isoOf(d);
  }

  /* ---------- Generador ---------- */
  /* opts: { seed, goals:{kcal,prot}, excl:{alimento:true}, ratings:{receta:'like'|'less'|'never'}, favs:{receta:true},
   *   prev:[plan semana −1, plan semana −2], leftovers, timeWeek, timeWeekend (min; 0 = sin límite),
   *   fridge:{alimento:true}, fridgeOn, current: plan actual o null, days: [días a (re)generar],
   *   keep: {'d:s': true} (platos que se conservan; se mantiene la receta y se reajusta la ración) } */
  function generateWeek(opts) {
    const rng = mulberry32((opts.seed >>> 0) || 1);
    const g = goalsFor(opts.goals);
    const excl = opts.excl || {}, ratings = opts.ratings || {}, favs = opts.favs || {};
    const prev = opts.prev || [], fridge = opts.fridge || {};
    const days = opts.days || [0, 1, 2, 3, 4, 5, 6];
    const keep = opts.keep || {};
    const cur = opts.current;

    // Plan de trabajo: conserva los días no regenerados y los platos bloqueados
    const plan = [0, 1, 2, 3, 4, 5, 6].map(() => [null, null, null, null]);
    if (cur) for (let d = 0; d < 7; d++) for (let s = 0; s < 4; s++) {
      const slot = cur[d] && cur[d][s];
      if (!slot) continue;
      if (!days.includes(d)) plan[d][s] = { ...slot };
      else if (keep[`${d}:${s}`]) plan[d][s] = { r: slot.r, f: slot.f || 1, kept: true };
    }
    // Las parejas de sobras se conservan enteras (con su ración) si cualquiera de los dos platos se conserva
    if (cur) for (let d = 0; d < 6; d++) {
      const a = cur[d] && cur[d][2], b = cur[d + 1] && cur[d + 1][1];
      if (!a || !b || !a.dbl || !b.left || (!days.includes(d) && !days.includes(d + 1))) continue;
      if (keep[`${d}:2`] || keep[`${d + 1}:1`]) {
        plan[d][2] = { ...a, kept: true, fixedF: true };
        plan[d + 1][1] = { ...b, kept: true, fixedF: true };
      }
    }
    // En días regenerados, un slot de sobras/doble sin su pareja se libera
    for (const d of days) for (let s = 0; s < 4; s++) {
      const x = plan[d][s];
      if (x && !x.kept && (x.dbl || x.left)) plan[d][s] = null;
    }

    const uses = {};
    const countUses = () => {
      Object.keys(uses).forEach((k) => delete uses[k]);
      for (let d = 0; d < 7; d++) for (let s = 0; s < 4; s++) { const x = plan[d][s]; if (x && !x.left) uses[x.r] = (uses[x.r] || 0) + 1; }
    };
    countUses();

    const hasR = (pl, id) => !!pl && pl.some((day) => day && day.some((x) => x && x.r === id));
    const inPrev = (id) => (hasR(prev[0], id) ? 1 : 0) + (hasR(prev[1], id) ? 2 : 0);
    const baseW = {};
    RECIPES.forEach((r) => {
      let w = 1;
      const rt = ratings[r.id];
      if (rt === 'like') w *= 2.2; else if (rt === 'less') w *= 0.3;
      if (favs[r.id]) w *= 1.8;
      const p = inPrev(r.id);
      if (p & 1) w *= 0.08;
      if (p & 2) w *= 0.3;
      if (opts.fridgeOn) { const n = r.ing.filter((i) => fridge[i.f]).length; if (n) w *= 1 + 2.5 * n / r.ing.length; }
      baseW[r.id] = w;
    });

    const maxUses = (r) => (r.tipo === 'desayuno' || r.tipo === 'tentempie' ? MAX_USES_LIGHT : MAX_USES);
    const okBasic = (r) => !usesExcluded(r, excl) && ratings[r.id] !== 'never';
    const forSlot = (r, s) => r.tipo === SLOT_TYPES[s] || (r.tomas && r.tomas.includes(SLOT_TYPES[s]));
    const timeOk = (r, s, d) => {
      if (s !== 1 && s !== 2) return true;
      const lim = d < 5 ? opts.timeWeek : opts.timeWeekend;
      return !lim || r.min <= lim;
    };
    const POOL = SLOT_TYPES.map((_, s) => RECIPES.filter((r) => forSlot(r, s) && okBasic(r)));

    const sameCatRun = (r, s, d) => {
      if (s !== 1 && s !== 2) return false;
      let n = 0;
      for (let e = 0; e < 7; e++) if (e !== d && plan[e][s] && BY_ID[plan[e][s].r].cat === r.cat) n++;
      if (n >= 3) return true;
      const at = (e) => (e >= 0 && e < 7 && plan[e][s] && BY_ID[plan[e][s].r].cat === r.cat);
      return (at(d - 1) && at(d - 2)) || (at(d - 1) && at(d + 1)) || (at(d + 1) && at(d + 2));
    };
    /* Candidatos válidos para un slot (sin contar los ya elegidos hoy) */
    function candidates(d, s, strict) {
      return POOL[s].filter((r) => {
        if ((uses[r.id] || 0) >= maxUses(r)) return false;
        if (!timeOk(r, s, d)) return false;
        const a = d > 0 && plan[d - 1][s], b = d < 6 && plan[d + 1][s];
        if ((a && a.r === r.id) || (b && b.r === r.id)) return false;
        if (strict && sameCatRun(r, s, d)) return false;
        return true;
      });
    }
    function pickWeighted(list, taken) {
      const pool = list.filter((r) => !taken.has(r.id));
      if (!pool.length) return null;
      let tot = 0; pool.forEach((r) => { tot += baseW[r.id]; });
      let x = rng() * tot;
      for (const r of pool) { x -= baseW[r.id]; if (x <= 0) return r; }
      return pool[pool.length - 1];
    }

    /* Resuelve un día: devuelve [4 slots] o null. `fixed[s]` = slot ya decidido (con f fijo si fixedF) */
    function solveDay(d, fixed, strict) {
      const free = [0, 1, 2, 3].filter((s) => !fixed[s] || (!fixed[s].fixedF && !fixed[s].left && !fixed[s].dbl && fixed[s].kept));
      // Los slots con receta decidida pero ración libre (bloqueados) también entran en la enumeración de factores
      const E = [3, 0].find((s) => free.includes(s) && !fixed[s]);
      for (let t = 0; t < TRIES; t++) {
        const taken = new Set([0, 1, 2, 3].filter((s) => fixed[s]).map((s) => fixed[s].r));
        const opt = [null, null, null, null];
        let fail = false;
        for (const s of [1, 2, 0, 3]) {
          if (s === E) continue;
          if (fixed[s]) {
            const r = BY_ID[fixed[s].r];
            opt[s] = SC[r.id].filter((x) => !fixed[s].fixedF || fKey(x.f) === fKey(fixed[s].f)).map((x) => ({ r, x }));
          } else {
            const r = pickWeighted(candidates(d, s, strict && t < TRIES * 0.7), taken);
            if (!r) { fail = true; break; }
            taken.add(r.id);
            opt[s] = SC[r.id].map((x) => ({ r, x }));
          }
        }
        if (fail) continue;
        // Opciones de E (tentempié o desayuno), todas las recetas válidas × factores, ordenadas por kcal
        let eList = null;
        if (E !== undefined) {
          eList = [];
          candidates(d, E, false).forEach((r) => {
            if (taken.has(r.id)) return;
            SC[r.id].forEach((x) => eList.push({ r, x, w: baseW[r.id] }));
          });
          eList.sort((a, b) => a.x.m.k - b.x.m.k);
          if (!eList.length) continue;
        }
        const fixedSlots = [0, 1, 2, 3].filter((s) => s !== E);
        // Enumeración
        let best = null, bestScore = Infinity;
        const lists = fixedSlots.map((s) => opt[s].filter((o) => s === 3 || o.x.m.h <= g.hcComida));
        const rec = (i, acc, pk, pp, ph) => {
          if (i === lists.length) {
            if (!eList) {
              const k = pk, p = pp, h = ph;
              if (k < g.kcalMin + 0.5 || k > g.kcalMax - 0.5 || p < g.protMin + 0.5 || h < g.hcMin + 0.5 || h > g.hcMax - 0.5) return;
              consider(acc, null, k, p, h);
              return;
            }
            const lo = g.kcalMin + 0.5 - pk, hi = g.kcalMax - 0.5 - pk;
            // búsqueda binaria del primer elemento con kcal ≥ lo
            let a = 0, b = eList.length;
            while (a < b) { const m = (a + b) >> 1; if (eList[m].x.m.k < lo) a = m + 1; else b = m; }
            for (let j = a; j < eList.length && eList[j].x.m.k <= hi; j++) {
              const e = eList[j], p = pp + e.x.m.p, h = ph + e.x.m.h;
              if (p < g.protMin + 0.5 || h < g.hcMin + 0.5 || h > g.hcMax - 0.5) continue;
              if (E === 0 && e.x.m.h > g.hcComida) continue;
              consider(acc, e, pk + e.x.m.k, p, h);
            }
            return;
          }
          for (const o of lists[i]) { acc.push(o); rec(i + 1, acc, pk + o.x.m.k, pp + o.x.m.p, ph + o.x.m.h); acc.pop(); }
        };
        const consider = (acc, e, k, p, h) => {
          let sc = Math.abs(k - g.kcal) / 25 + rng() * 0.6;
          acc.forEach((o) => { sc += Math.abs(o.x.f - 1) * 4; });
          if (e) sc += Math.abs(e.x.f - 1) * 4 - Math.log(e.w) * 0.3;
          if (p < g.prot) sc += (g.prot - p) / 15;
          if (sc < bestScore) { bestScore = sc; best = { acc: acc.slice(), e }; }
        };
        rec(0, [], 0, 0, 0);
        if (best) {
          const out = [null, null, null, null];
          fixedSlots.forEach((s, i) => {
            const o = best.acc[i], base = fixed[s] || {};
            out[s] = { r: o.r.id, f: o.x.f };
            if (base.dbl) out[s].dbl = true;
            if (base.left) out[s].left = true;
          });
          if (best.e) out[E] = { r: best.e.r.id, f: best.e.x.f };
          return out;
        }
      }
      return null;
    }

    const failed = [];
    const dayFixed = (d) => [0, 1, 2, 3].map((s) => plan[d][s]);
    const place = (d, out) => { for (let s = 0; s < 4; s++) plan[d][s] = out[s]; countUses(); };
    const clearDay = (d, fixedBefore) => { for (let s = 0; s < 4; s++) plan[d][s] = fixedBefore[s] && fixedBefore[s].kept ? fixedBefore[s] : null; countUses(); };
    const duals = POOL[2].filter((r) => r.sobras && forSlot(r, 1) && forSlot(r, 2));
    let pairs = 0;

    for (let di = 0; di < days.length; di++) {
      const d = days[di];
      const before = dayFixed(d);
      let done = false;
      // Sobras: cena doble hoy → comida de mañana
      if (opts.leftovers && d < 6 && days.includes(d + 1) && !before[2] && !plan[d + 1][1] && pairs < 3 && rng() < 0.4) {
        const beforeN = dayFixed(d + 1);
        for (let a = 0; a < 6 && !done; a++) {
          const cand = duals.filter((r) => (uses[r.id] || 0) < maxUses(r) && timeOk(r, 2, d) && timeOk(r, 1, d + 1) && !(plan[d][1] && plan[d][1].r === r.id)
            && !(plan[d + 1][2] && plan[d + 1][2].r === r.id) && !(d > 0 && plan[d - 1][2] && plan[d - 1][2].r === r.id));
          const r = pickWeighted(cand, new Set());
          if (!r) break;
          const f = FACTORS[1 + Math.floor(rng() * 5)];
          const fx = before.slice(); fx[2] = { r: r.id, f, fixedF: true, dbl: true };
          if (fx[2] && SC[r.id].find((x) => x.f === f).m.h > g.hcComida) continue;
          const out = solveDay(d, fx, true) || solveDay(d, fx, false);
          if (!out) continue;
          place(d, out);
          const fn = beforeN.slice(); fn[1] = { r: r.id, f, fixedF: true, left: true };
          const out2 = solveDay(d + 1, fn, true) || solveDay(d + 1, fn, false);
          if (out2) { place(d + 1, out2); pairs++; done = true; di++; }
          else clearDay(d, before);
        }
      }
      if (done) continue;
      const fx = before.map((x) => (x && x.kept ? x : null));
      const out = solveDay(d, fx, true) || solveDay(d, fx, false);
      if (out) place(d, out); else { failed.push(d); clearDay(d, before); }
    }
    return { plan, failed, pairs };
  }

  /* Quita marcas de sobras/doble que han quedado sin pareja (tras cambiar o regenerar platos) */
  function fixPairs(plan) {
    for (let d = 0; d < 7; d++) {
      const a = plan[d] && plan[d][2], b = d < 6 && plan[d + 1] && plan[d + 1][1];
      const ok = a && b && a.dbl && b.left && a.r === b.r && a.f === b.f;
      if (!ok) { if (a && a.dbl) delete a.dbl; if (b && b.left) delete b.left; }
    }
    if (plan[0] && plan[0][1] && plan[0][1].left) delete plan[0][1].left;
    return plan;
  }

  /* Plan por defecto → slots */
  const planFromIds = (ids) => ids.map((day) => day.map((id) => ({ r: id, f: 1 })));

  const MENU_PLANNER = {
    FACTORS, SLOT_TYPES, MAX_USES, MAX_USES_LIGHT, mulberry32, hashSeed, generateWeek, goalsFor, dayTotals, dayIssues,
    slotMacros, slotIng, scaled, weekFoodGrams, hitsOf, usesExcluded, mondayOf, addWeeks, isoOf, planFromIds, fixPairs
  };
  if (typeof window !== 'undefined') window.MENU_PLANNER = MENU_PLANNER;
  if (typeof module !== 'undefined' && module.exports) module.exports = MENU_PLANNER;
})();
