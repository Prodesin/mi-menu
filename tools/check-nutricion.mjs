#!/usr/bin/env node
/* Valida los números y el generador de Mi menú.
 *   node tools/check-nutricion.mjs            → validaciones + simulación de semanas
 *   node tools/check-nutricion.mjs --recetas  → además, macros de cada receta
 *   node tools/check-nutricion.mjs --semanas=40  → semanas por caso (por defecto 40 → 400 en total)
 * Sale con código 1 si algo falla (alimentos, recetas, precios, plan por defecto o semanas generadas). */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = require(path.join(root, 'data.js'));
const P = require(path.join(root, 'planner.js'));
const { GOALS: G, FOODS, RECIPES, BY_ID, PLAN, DAYS, TYPES, PRECIOS, GROUPS } = D;
const fmt = (n, d = 0) => n.toFixed(d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const pad = (s, n) => String(s).padStart(n);
const errors = [];
const wk = (process.argv.find((a) => a.startsWith('--semanas=')) || '--semanas=40').split('=')[1] | 0;

/* 1) Alimentos: macros coherentes (kcal ≈ 4·P + 4·H + 9·G ±15 %; la fibra explica parte de la diferencia) */
const groupIds = new Set(GROUPS.map((g) => g.id));
for (const [id, f] of Object.entries(FOODS)) {
  const a = 4 * f.p + 4 * f.h + 9 * f.g;
  if (f.k > 50 && (f.k / a < 0.85 || f.k / a > 1.15)) errors.push(`Alimento ${id}: ${f.k} kcal vs ${fmt(a)} por Atwater (±15 %)`);
  if (f.k <= 50 && Math.abs(f.k - a) > 12) errors.push(`Alimento ${id}: ${f.k} kcal vs ${fmt(a)} por Atwater`);
  if (f.p + f.h + f.g > 100) errors.push(`Alimento ${id}: macros suman más de 100 g`);
  (f.t || []).forEach((t) => { if (!groupIds.has(t)) errors.push(`Alimento ${id}: grupo desconocido ${t}`); });
  if (!D.SECTIONS.includes(f.s)) errors.push(`Alimento ${id}: sección desconocida`);
}
/* Cada grupo debe tener al menos un alimento y cada FOOD debe usarse en alguna receta */
GROUPS.forEach((g) => { if (!Object.values(FOODS).some((f) => (f.t || []).includes(g.id))) errors.push(`Grupo ${g.id} sin alimentos`); });
const used = new Set(RECIPES.flatMap((r) => r.ing.map((i) => i.f)));
for (const id of Object.keys(FOODS)) if (!used.has(id)) errors.push(`Alimento ${id} no se usa en ninguna receta`);

/* 2) Precios: todo alimento usado tiene precio (o null explícito) en ambas tiendas */
let sinPrecio = 0;
for (const id of used) {
  const p = PRECIOS[id];
  if (!p) { errors.push(`Precios: falta ${id}`); continue; }
  for (const shop of ['mercadona', 'eroski']) {
    if (!(shop in p)) { errors.push(`Precios: ${id} sin ${shop} (usa null si no hay producto)`); continue; }
    const x = p[shop];
    if (x === null) { sinPrecio++; continue; }
    if (!(x.p > 0) || !(x.g > 0) || !x.n || !x.f || !x.q) errors.push(`Precios: ${id}/${shop} incompleto`);
    const unit = x.w ? x.p : x.p / x.g * 1000; // € por kg
    const mkg = FOODS[id].k; // sanidad gruesa: ningún alimento básico a más de 80 €/kg
    if (unit > 80 || unit < 0.4) errors.push(`Precios: ${id}/${shop} ${fmt(unit, 2)} €/kg poco creíble (${mkg} kcal)`);
  }
}
if (!D.PRECIOS_FECHA) errors.push('Falta PRECIOS_FECHA');

/* 3) Biblioteca: mínimos y reglas por receta */
const MIN = { desayuno: 18, comida: 32, cena: 32, tentempie: 18 };
const count = {};
for (const r of RECIPES) count[r.tipo] = (count[r.tipo] || 0) + 1;
for (const [t, n] of Object.entries(MIN)) if ((count[t] || 0) < n) errors.push(`Faltan recetas de ${t}: hay ${count[t] || 0}, mínimo ${n}`);
if (RECIPES.length < 100) errors.push(`Hay ${RECIPES.length} recetas (mínimo 100)`);
const kcalRange = { desayuno: [330, 520], comida: [520, 760], cena: [430, 680], tentempie: [150, 320] };
const protMin = { desayuno: 24, comida: 40, cena: 38, tentempie: 14 };
const ids = new Set();
for (const r of RECIPES) {
  const m = r.macros;
  if (ids.has(r.id)) errors.push(`${r.id}: id duplicado`);
  ids.add(r.id);
  if (r.pasos.length < 3 || r.pasos.length > 7) errors.push(`${r.id}: debe tener 3–7 pasos`);
  r.ing.forEach((i) => { if (!FOODS[i.f]) errors.push(`${r.id}: ingrediente desconocido ${i.f}`); });
  if (!['bajo', 'medio'].includes(r.ig)) errors.push(`${r.id}: IG inválido`);
  if (!(r.min > 0 && r.min <= 60)) errors.push(`${r.id}: tiempo inválido`);
  const [a, b] = kcalRange[r.tipo];
  if (m.k < a || m.k > b) errors.push(`${r.id} «${r.nombre}»: ${fmt(m.k)} kcal fuera de ${a}–${b}`);
  if (m.p < protMin[r.tipo]) errors.push(`${r.id} «${r.nombre}»: proteína baja (${fmt(m.p)} g)`);
  if (r.tipo !== 'tentempie' && m.h > G.hcComida) errors.push(`${r.id} «${r.nombre}»: ${fmt(m.h)} g de hidratos (máx. ${G.hcComida})`);
  if (r.tipo === 'tentempie' && m.h > 28) errors.push(`${r.id} «${r.nombre}»: ${fmt(m.h)} g de hidratos en un tentempié`);
  if (r.tomas) {
    if (!r.tomas.includes('comida') || !r.tomas.includes('cena')) errors.push(`${r.id}: tomas debe incluir comida y cena`);
    if (m.k < 450 || m.k > 700) errors.push(`${r.id}: receta de sobras fuera de 450–700 kcal`);
  }
  if (r.sobras && !r.tomas) errors.push(`${r.id}: sobras sin tomas`);
  // IG alto vetado: nada de azúcar, zumo, bollería, pan blanco ni arroz blanco
  if (r.ing.some((i) => /zumo|azúcar|bollería|pan blanco|arroz blanco/i.test(FOODS[i.f].n))) errors.push(`${r.id}: ingrediente no apto para diabetes`);
}
if (process.argv.includes('--recetas')) {
  console.log('\nRecetas');
  for (const r of RECIPES) {
    const m = r.macros;
    console.log(`${r.id.padEnd(4)} ${pad(fmt(m.k), 5)} kcal  P ${pad(fmt(m.p), 3)}  HC ${pad(fmt(m.h), 3)}  G ${pad(fmt(m.g), 3)}  ${r.ig.padEnd(5)} ${pad(r.min, 2)}′ ${r.sobras ? 'S' : ' '} ${r.nombre}`);
  }
}

/* 4) Plan por defecto: cada día en 1.840–1.920 kcal, ≥ 140 g prot, 120–170 g HC */
console.log('\nPlan por defecto (totales por día)');
console.log('Día         |   kcal | Prot | Hidr | Grasa | Estado');
console.log('------------+--------+------+------+-------+-------');
const defGoals = P.goalsFor();
PLAN.forEach((day, i) => {
  const slots = day.map((id, s) => {
    const r = BY_ID[id];
    if (!r) { errors.push(`${DAYS[i]}: receta inexistente ${id}`); return null; }
    if (r.tipo !== TYPES[s].id && !(r.tomas && r.tomas.includes(TYPES[s].id))) errors.push(`${DAYS[i]}: ${id} no es de tipo ${TYPES[s].id}`);
    return { r: id, f: 1 };
  });
  if (slots.includes(null)) return;
  const t = P.dayTotals(slots), fails = P.dayIssues(slots, defGoals);
  if (fails.length) errors.push(`${DAYS[i]} (plan por defecto): ${fails.join(', ')}`);
  console.log(`${DAYS[i].padEnd(11)} | ${pad(fmt(t.k), 6)} | ${pad(fmt(t.p), 4)} | ${pad(fmt(t.h), 4)} | ${pad(fmt(t.g), 5)} | ${fails.length ? 'REVISA: ' + fails.join(', ') : 'OK'}`);
});
console.log(`\nObjetivo: ${fmt(G.kcalMin)}–${fmt(G.kcalMax)} kcal · ≥ ${G.protMin} g prot · ${G.hcMin}–${G.hcMax} g HC · ≤ ${G.hcComida} g HC por toma principal`);

/* 5) Simulación del generador: cadenas de semanas consecutivas por caso */
const tagged = (...tags) => Object.fromEntries(Object.entries(FOODS).filter(([, f]) => (f.t || []).some((t) => tags.includes(t))).map(([id]) => [id, true]));
const CASES = [
  { name: 'ninguna', opts: {} },
  { name: 'sin pescado', opts: { excl: tagged('pescado') } },
  { name: 'sin lácteos', opts: { excl: tagged('lacteos') } },
  { name: 'sin cerdo', opts: { excl: tagged('cerdo') } },
  { name: 'sin legumbres', opts: { excl: tagged('legumbres') } },
  { name: 'sin pescado+marisco', opts: { excl: tagged('pescado', 'marisco') } },
  { name: 'sin huevo', opts: { excl: tagged('huevo') } },
  { name: 'con sobras', opts: { leftovers: true } },
  { name: 'máx. 15 min entre semana', opts: { timeWeek: 15 } },
  { name: '2 personas', opts: { people: [2, 2, 2, 2] } },
  { name: 'extra: sin pollo+huevo (informativo)', opts: { excl: tagged('pollo', 'huevo') }, info: true }
];
const caseRows = [];
let totalWeeks = 0, totalOk = 0;
const t0 = Date.now();
CASES.forEach((c, ci) => {
  let okWeeks = 0, unsolved = 0, days = 0, pairs = 0, fmax = 0, fsum = 0, fn = 0;
  const problems = [];
  let prev = [];
  for (let w = 0; w < wk; w++) {
    const seed = 1000 + ci * 7919 + w * 104729;
    const res = P.generateWeek({ seed, prev, goals: undefined, ...c.opts });
    totalWeeks += c.info ? 0 : 1;
    unsolved += res.failed.length;
    const plan = res.plan;
    const weekProblems = [];
    const uses = {};
    for (let d = 0; d < 7; d++) {
      if (res.failed.includes(d)) { weekProblems.push(`${DAYS[d]} no resuelto`); continue; }
      days++;
      const day = plan[d];
      const t = P.dayTotals(day);
      if (t.k < G.kcalMin || t.k > G.kcalMax) weekProblems.push(`${DAYS[d]}: ${fmt(t.k)} kcal`);
      if (t.p < G.protMin) weekProblems.push(`${DAYS[d]}: ${fmt(t.p)} g prot`);
      if (t.h < G.hcMin || t.h > G.hcMax) weekProblems.push(`${DAYS[d]}: ${fmt(t.h)} g HC`);
      day.forEach((slot, s) => {
        const r = BY_ID[slot.r];
        if (!r) { weekProblems.push('receta inexistente'); return; }
        if (r.tipo !== TYPES[s].id && !(r.tomas && r.tomas.includes(TYPES[s].id))) weekProblems.push(`${r.id} en toma equivocada`);
        if (c.opts.excl && P.usesExcluded(r, c.opts.excl)) weekProblems.push(`${DAYS[d]}: ${r.id} lleva un ingrediente excluido`);
        if (slot.f < 0.85 - 1e-9 || slot.f > 1.2 + 1e-9) weekProblems.push(`factor ${slot.f} fuera de rango`);
        fmax = Math.max(fmax, slot.f); fsum += Math.abs(slot.f - 1); fn++;
        if (s < 3 && P.slotMacros(slot).h > G.hcComida) weekProblems.push(`${DAYS[d]}: ${r.id} supera ${G.hcComida} g HC`);
        if (c.opts.timeWeek && (s === 1 || s === 2) && d < 5 && r.min > c.opts.timeWeek) weekProblems.push(`${DAYS[d]}: ${r.id} tarda ${r.min} min`);
        if (!slot.left) uses[r.id] = (uses[r.id] || 0) + 1;
        if (slot.left) {
          const a = d > 0 && plan[d - 1][2];
          if (!a || a.r !== slot.r || !a.dbl || a.f !== slot.f || s !== 1) weekProblems.push(`${DAYS[d]}: sobras sin cena doble`);
        } else {
          const a = d > 0 && plan[d - 1][s];
          if (a && a.r === slot.r) weekProblems.push(`${DAYS[d]}: ${r.id} repetido en días consecutivos`);
        }
        if (slot.dbl) {
          pairs++;
          const b = d < 6 && plan[d + 1][1];
          if (!(b && b.left && b.r === slot.r)) weekProblems.push(`${DAYS[d]}: cena doble sin comida de sobras`);
          if (!c.opts.leftovers) weekProblems.push('sobras sin activar');
        }
      });
    }
    for (const [id, n] of Object.entries(uses)) {
      const r = BY_ID[id], lim = r.tipo === 'desayuno' || r.tipo === 'tentempie' ? 3 : 2;
      if (n > lim) weekProblems.push(`${id} aparece ${n} veces (máx. ${lim})`);
    }
    // compra con personas: los gramos se multiplican y las sobras no duplican de más
    if (c.opts.people) {
      const g1 = P.weekFoodGrams(plan), g2 = P.weekFoodGrams(plan, c.opts.people);
      for (const k of Object.keys(g1)) if (Math.abs(g2[k] - 2 * g1[k]) > 1e-6) weekProblems.push('compra no escala con personas');
    }
    if (!res.failed.length && !weekProblems.length) okWeeks++;
    else if (problems.length < 5) problems.push(...weekProblems.slice(0, 2));
    prev = [plan, prev[0]].filter(Boolean);
  }
  caseRows.push({ c, okWeeks, unsolved, days, pairs, problems, fmean: fn ? fsum / fn : 0, fmax });
  if (!c.info) totalOk += okWeeks;
  if (!c.info && (okWeeks < wk || unsolved)) errors.push(`Caso «${c.name}»: ${okWeeks}/${wk} semanas válidas, ${unsolved} días no resueltos. ${problems.join(' | ')}`);
});
console.log(`\nSimulación del generador (${wk} semanas encadenadas por caso, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
console.log('Caso                                    | Semanas OK | Días sin resolver | Parejas sobras | Ración media ±  | máx.');
console.log('----------------------------------------+------------+-------------------+----------------+-----------------+-----');
for (const r of caseRows) {
  console.log(`${r.c.name.padEnd(39)} | ${pad(`${r.okWeeks}/${wk}`, 10)} | ${pad(r.unsolved, 17)} | ${pad(r.pairs, 14)} | ${pad('±' + fmt(r.fmean, 3), 15)} | ${fmt(r.fmax, 2)}${r.c.info ? '  (informativo)' : ''}`);
}
console.log(`\nSemanas simuladas (casos obligatorios): ${totalWeeks} · válidas: ${totalOk} (${fmt((totalOk / totalWeeks) * 100, 1)} %)`);
if (totalWeeks < 300) errors.push(`Solo ${totalWeeks} semanas simuladas (mínimo 300)`);

console.log(`Recetas por toma: desayuno ${count.desayuno} · comida ${count.comida} · cena ${count.cena} · tentempié ${count.tentempie} (total ${RECIPES.length}) · con sobras: ${RECIPES.filter((r) => r.sobras).length}`);
console.log(`Alimentos: ${Object.keys(FOODS).length} · con precio en ambas tiendas: ${[...used].filter((i) => PRECIOS[i] && PRECIOS[i].mercadona && PRECIOS[i].eroski).length}/${used.size} · precios null: ${sinPrecio}`);

if (errors.length) {
  console.error('\n✗ Problemas:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}
console.log('✓ Todo en orden: alimentos, precios, recetas, plan por defecto y semanas generadas cumplen los objetivos.');
