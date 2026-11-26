# Mi menú

Planificador semanal de comidas, instalable como app (PWA), pensado para Jorge: 180 cm, ~93 kg, diabetes tipo 2, con el objetivo de perder grasa y ganar músculo. Usa productos de supermercado normal (Gadis, Froiz, Mercadona). Inspirado en Whipp.

- Publicación: <https://prodesin.github.io/mi-menu/>
- App hermana: [Mi tensión](https://prodesin.github.io/mi-tension/)

## Qué hace

- **Hoy**: selector de día (L M X J V S D), resumen con kcal, proteína, hidratos y grasa, barras de progreso con la zona objetivo e indicador «Día en objetivo» o «Revisa» (con el motivo: «Hidratos altos», «Proteína baja», «Kcal altas»…). Abre por defecto en el día actual.
- **4 tomas al día** (desayuno, comida, cena, tentempié) con macros por plato y etiqueta de índice glucémico (bajo/medio).
- **Cambiar plato**: hoja con las alternativas del mismo tipo y la diferencia respecto al actual (+120 kcal, −8 g HC…). Los totales se recalculan al instante. «Restaurar menú original» por día o de toda la semana.
- **Semana**: cuadrícula de 7 días con totales y estado.
- **Compra**: lista agregada del plan actual, por secciones del súper y con cantidades redondeadas a algo comprable. Cada artículo se puede marcar como *comprado* o *en casa* (despensa, que se conserva entre semanas). «Nueva semana» desmarca lo comprado.
- **Recetas**: 9 desayunos, 15 comidas, 15 cenas y 9 tentempiés con ingredientes en gramos, pasos y consejo. **Modo cocina** con pasos grandes y pantalla activa.
- **Más**: objetivos (se pueden editar kcal y proteína), copia de seguridad, enlaces y aviso médico.

Funciona sin conexión tras la primera visita. Layout adaptado al iPhone Duo (exterior, interior, vertical y apaisado) y al iPhone normal, con navegación en un rail vertical a la derecha, modo claro y oscuro.

## Instalar en el iPhone

1. Abre <https://prodesin.github.io/mi-menu/> en **Safari**.
2. Toca el botón **Compartir**.
3. Elige **«Añadir a pantalla de inicio»**.

## Copia de seguridad y privacidad

Todo se guarda **solo en el dispositivo** (`localStorage`, clave `mi-menu:v1`). No hay servidor, cuentas ni analítica. En **Más → Copia de seguridad** puedes **Exportar** un JSON con fecha e **Importar** otro (se valida y se pide confirmación). Haz una copia de vez en cuando y antes de borrar los datos de Safari.

## Objetivos nutricionales usados

| Concepto | Valor |
|---|---|
| Energía | 1.850–1.900 kcal/día (aceptable 1.750–1.950) |
| Proteína | ~150 g/día (mínimo 140 g) |
| Hidratos | 120–170 g/día, ≤ 50 g por comida principal |
| Preferencia | Índice glucémico bajo: legumbre, integrales, verdura, fruta entera; sin zumos, azúcar, pan blanco ni arroz blanco |

Los macros de cada receta se **calculan a partir de sus ingredientes** (tabla por 100 g, valores tipo BEDCA / etiquetas españolas habituales). Son aproximados: las marcas y el punto de cocción cambian los números.

> **Aviso.** Orientativo: no sustituye a tu médico ni a tu endocrino. Si usas insulina o sulfonilureas, consulta antes de cambiar hidratos.

## Estructura

```
index.html                  Estructura y diálogos
styles.css                  Estilos (claro/oscuro, safe areas, rail, layouts del Duo)
app.js                      Lógica: estado, vistas, compra, importar/exportar
data.js                     Alimentos, recetas, plan por defecto y objetivos
sw.js                       Service worker (cache-first, versión en el nombre de caché)
manifest.webmanifest        Manifiesto PWA
icon-192.png, icon-512.png, apple-touch-icon.png, favicon.png
tools/check-nutricion.mjs   Validador de números
.nojekyll
```

## Editar recetas y validar

Todo está en `data.js`:

1. **Alimentos** (`FOODS`): `k` (kcal), `p`, `h`, `g` por 100 g, `s` (sección del súper) y `u` opcional (unidad de compra: huevos, latas, botes…).
2. **Recetas** (`RAW`): `[id, tipo, nombre, tiempo, IG, [[alimento, gramos], …], [pasos], consejo]`. Los macros salen solos.
3. **Plan por defecto** (`PLAN`): para cada día, los ids `[desayuno, comida, cena, tentempié]`.

Después, valida:

```sh
node tools/check-nutricion.mjs            # tabla de totales por día del plan
node tools/check-nutricion.mjs --recetas  # además, macros de cada receta
```

El script falla (código 1) si algún día del plan se sale de objetivos (kcal, ≥ 140 g de proteína, 120–170 g de hidratos), si una receta supera 50 g de hidratos en una toma principal, o si faltan recetas mínimas por tipo.

Al publicar cambios, sube `CACHE_VERSION` en `sw.js` para que los móviles actualicen la caché.

Probar en local: `python3 -m http.server` y abrir <http://localhost:8000/>.
