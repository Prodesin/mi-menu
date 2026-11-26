#!/usr/bin/env node
/* Valida los números de Mi menú.
 *   node tools/check-nutricion.mjs            → tabla del plan por defecto + validaciones
 *   node tools/check-nutricion.mjs --recetas  → además, macros de cada receta
 * Sale con código 1 si algún día del plan o alguna receta no cumple. */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const D = require(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data.js'));
const { GOALS: G, FOODS, RECIPES, BY_ID, PLAN, DAYS, TYPES } = D;
// Formato español (1.850 · coma decimal); toLocaleString no agrupa los miles de 4 cifras en es-ES
const fmt = (n, d = 0) => n.toFixed(d).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const pad = (s, n) => String(s).padStart(n);
const errors = [];

/* 1) Alimentos: valores coherentes (kcal ≈ 4·P + 4·H + 9·G; la fibra explica la diferencia) */
for (const [id, f] of Object.entries(FOODS)) {
  const a = 4 * f.p + 4 * f.h + 9 * f.g;
  if (f.k > 50 && (f.k / a < 0.78 || f.k / a > 1.32)) errors.push(`Alimento ${id}: ${f.k} kcal vs ${fmt(a)} por Atwater`);
  if (f.p + f.h + f.g > 100) errors.push(`Alimento ${id}: macros suman más de 100 g`);
}

/* 2) Biblioteca: mínimos y reglas por receta */
const MIN = { desayuno: 8, comida: 14, cena: 14, tentempie: 8 };
for (const [t, n] of Object.entries(MIN)) {
  const c = RECIPES.filter((r) => r.tipo === t).length;
  if (c < n) errors.push(`Faltan recetas de ${t}: hay ${c}, mínimo ${n}`);
}
const kcalRange = { desayuno: [330, 520], comida: [520, 760], cena: [430, 680], tentempie: [150, 320] };
const protMin = { desayuno: 24, comida: 40, cena: 38, tentempie: 14 };
for (const r of RECIPES) {
  const m = r.macros;
  if (r.pasos.length < 3 || r.pasos.length > 7) errors.push(`${r.id}: debe tener 3–7 pasos`);
  r.ing.forEach((i) => { if (!FOODS[i.f]) errors.push(`${r.id}: ingrediente desconocido ${i.f}`); });
  if (!['bajo', 'medio'].includes(r.ig)) errors.push(`${r.id}: IG inválido`);
  const [a, b] = kcalRange[r.tipo];
  if (m.k < a || m.k > b) errors.push(`${r.id} «${r.nombre}»: ${fmt(m.k)} kcal fuera de ${a}–${b}`);
  if (m.p < protMin[r.tipo]) errors.push(`${r.id} «${r.nombre}»: proteína baja (${fmt(m.p)} g)`);
  if (r.tipo !== 'tentempie' && m.h > G.hcComida) errors.push(`${r.id} «${r.nombre}»: ${fmt(m.h)} g de hidratos (máx. ${G.hcComida})`);
  if (r.tipo === 'tentempie' && m.h > 28) errors.push(`${r.id} «${r.nombre}»: ${fmt(m.h)} g de hidratos en un tentempié`);
}
if (process.argv.includes('--recetas')) {
  console.log('\nRecetas');
  for (const r of RECIPES) {
    const m = r.macros;
    console.log(`${r.id.padEnd(4)} ${pad(fmt(m.k), 5)} kcal  P ${pad(fmt(m.p), 3)}  HC ${pad(fmt(m.h), 3)}  G ${pad(fmt(m.g), 3)}  ${r.ig.padEnd(5)} ${r.nombre}`);
  }
}

/* 3) Plan por defecto: cada día debe cumplir objetivos */
console.log('\nPlan por defecto (totales por día)');
console.log('Día         |   kcal | Prot | Hidr | Grasa | Estado');
console.log('------------+--------+------+------+-------+-------');
PLAN.forEach((day, i) => {
  const t = { k: 0, p: 0, h: 0, g: 0 };
  day.forEach((id, s) => {
    const r = BY_ID[id];
    if (!r) { errors.push(`${DAYS[i]}: receta inexistente ${id}`); return; }
    if (r.tipo !== TYPES[s].id) errors.push(`${DAYS[i]}: ${id} no es de tipo ${TYPES[s].id}`);
    for (const k of Object.keys(t)) t[k] += r.macros[k];
  });
  const fails = [];
  if (t.k < G.kcalMin || t.k > G.kcalMax) fails.push(t.k < G.kcalMin ? 'kcal bajas' : 'kcal altas');
  if (t.p < G.protMin) fails.push('proteína baja');
  if (t.h < G.hcMin) fails.push('hidratos bajos');
  if (t.h > G.hcMax) fails.push('hidratos altos');
  if (t.k < 1840 || t.k > 1920) fails.push(`fuera de 1.840–1.920 kcal (${fmt(t.k)})`);
  if (fails.length) errors.push(`${DAYS[i]}: ${fails.join(', ')}`);
  console.log(`${DAYS[i].padEnd(11)} | ${pad(fmt(t.k), 6)} | ${pad(fmt(t.p), 4)} | ${pad(fmt(t.h), 4)} | ${pad(fmt(t.g), 5)} | ${fails.length ? 'REVISA: ' + fails.join(', ') : 'OK'}`);
});

console.log(`\nObjetivo: ${fmt(G.kcalMin)}–${fmt(G.kcalMax)} kcal · ≥ ${G.protMin} g prot · ${G.hcMin}–${G.hcMax} g HC · ≤ ${G.hcComida} g HC por toma principal`);
if (errors.length) {
  console.error('\n✗ Problemas:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}
console.log('✓ Todo en orden: alimentos, recetas y los 7 días del plan cumplen los objetivos.');
