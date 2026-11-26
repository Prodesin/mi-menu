# Mi menú

Planificador semanal de comidas, instalable como app (PWA), pensado para Jorge: 180 cm, ~93 kg, diabetes tipo 2, con el objetivo de perder grasa y ganar músculo. Compra pensada para Mercadona y Eroski. Inspirado en Whipp.

- Publicación: <https://prodesin.github.io/mi-menu/>
- App hermana: [Mi tensión](https://prodesin.github.io/mi-tension/)

## Qué hace

- **Hoy**: navegador de semanas («‹ Semana del 30 nov – 6 dic ›»), selector de día (L M X J V S D), resumen con kcal, proteína, hidratos y grasa, barras con la zona objetivo e indicador «Día en objetivo» o «Revisa». Cada toma tiene candado (se mantiene al regenerar), favorito y valoración.
- **4 tomas al día** (desayuno, comida, cena, tentempié) con macros, tiempo e índice glucémico. Las raciones se ajustan solas (×0,85–1,20) para cuadrar los objetivos.
- **Menús distintos cada semana**: «Generar menú nuevo» (semana) y «Regenerar este día», aleatorios pero siempre dentro de objetivos. Historial de semanas, semilla guardada por semana y anti-repetición: un plato como mucho 2 veces por semana (3 en desayunos y tentempiés), penalización de lo comido en las 2 semanas anteriores y sin repetir principal en días seguidos.
- **Alimentos que no quiero**: buscador con todos los ingredientes y grupos rápidos (pescado, marisco, cerdo, ternera, pollo y pavo, huevo, lácteos, legumbres, frutos secos, gluten, setas, picante). Lo excluido no sale en el generador ni en «Cambiar plato»; si el menú ya lo llevaba, avisa y ofrece sustituirlo.
- **Cambiar plato**: alternativas del mismo tipo con la diferencia respecto al actual; los totales se recalculan al instante.
- **Compra (Mercadona / Eroski)**: producto típico de cada cadena, envases a comprar, precio **aprox.** por envase, total semanal por envases completos y «coste de lo que comes». Enlace «Buscar» a la web de cada súper. Cantidades ajustables (+/−), artículos libres, *comprado* y *en casa* (despensa) que no se pierden al cambiar el menú, y «Personas en casa» (1–6) que multiplica la lista.
- **Sobras / batch cooking**: opción de cocinar doble la cena para la comida del día siguiente (recetas con `sobras: true`).
- **Filtro de tiempo**: máximo entre semana y en fin de semana para comidas y cenas.
- **¿Qué tengo en la nevera?**: marcas lo que tienes y ordena las recetas por lo que aprovechan y lo que falta; puedes meter una en un día.
- **Valoraciones**: 👍 Me gusta, 👎 Menos a menudo, 🚫 No volver a poner; influyen en el generador y se deshacen desde Más.
- **Recetas**: 109 (19 desayunos, 38 comidas, 33 cenas, 19 tentempiés) con ingredientes en gramos, pasos, consejo y **modo cocina**.
- **Más**: objetivos (kcal y proteína editables), ajustes del generador, exclusiones, valoraciones, copia de seguridad, enlaces a Mi entrenador, Mi plato, Mi salud y Mi tensión, y aviso médico.

Funciona sin conexión tras la primera visita. Layout adaptado al iPhone Duo (exterior, interior, vertical y apaisado) y al iPhone normal, con navegación en un rail vertical a la derecha, modo claro y oscuro.

## Instalar en el iPhone

1. Abre <https://prodesin.github.io/mi-menu/> en **Safari**.
2. Toca el botón **Compartir**.
3. Elige **«Añadir a pantalla de inicio»**.

## Copia de seguridad y privacidad

Todo se guarda **solo en el dispositivo** (`localStorage`, clave `mi-menu:v2`, por semanas). Los datos de la versión anterior (`mi-menu:v1`) se migran solos al abrir la app (cambios de platos, comprados, despensa y objetivos) y la copia antigua se conserva; también se pueden importar copias v1. No hay servidor, cuentas ni analítica. En **Más → Copia de seguridad** puedes **Exportar** un JSON con fecha e **Importar** otro (se valida y se pide confirmación). Haz una copia de vez en cuando y antes de borrar los datos de Safari.

## Objetivos nutricionales usados

| Concepto | Valor |
|---|---|
| Energía | 1.840–1.920 kcal/día (objetivo 1.880 ± 40) |
| Proteína | ~150 g/día (mínimo 140 g) |
| Hidratos | 120–170 g/día, ≤ 50 g por comida principal |
| Preferencia | Índice glucémico bajo: legumbre, integrales, verdura, fruta entera; sin zumos, azúcar, pan blanco ni arroz blanco |

Los macros de cada receta se **calculan a partir de sus ingredientes** (tabla por 100 g, valores tipo BEDCA / etiquetas españolas habituales). Son aproximados: las marcas y el punto de cocción cambian los números.

> **Aviso.** Orientativo: no sustituye a tu médico ni a tu endocrino. Si usas insulina o sulfonilureas, consulta antes de cambiar hidratos.

## Estructura

```
index.html                  Estructura y diálogos
styles.css                  Estilos (claro/oscuro, safe areas, rail, layouts del Duo)
app.js                      Lógica: estado por semanas, vistas, compra, importar/exportar, migración v1
data.js                     Alimentos (con grupos), precios Mercadona/Eroski, recetas, plan por defecto y objetivos
planner.js                  Generador de menús (semilla, exclusiones, raciones, sobras, anti-repetición)
sw.js                       Service worker (cache-first, versión en el nombre de caché)
manifest.webmanifest        Manifiesto PWA
icon-192.png, icon-512.png, apple-touch-icon.png, favicon.png
tools/check-nutricion.mjs   Validador de números
.nojekyll
```

## Editar recetas y validar

Todo está en `data.js`:

1. **Alimentos** (`FOODS`): `k` (kcal), `p`, `h`, `g` por 100 g, `s` (sección del súper), `t` (grupos para excluir) y `u` opcional (unidad de compra).
   **Precios** (`PRECIOS`): por alimento y tienda, `{ n: producto, f: formato, g: gramos por envase, p: precio €, q: búsqueda }`. Salen de las tiendas online (nov. 2026) con `python3 /workspace/mi-menu-tools/precios.py mercadona "<regex>"` (catálogo de tienda.mercadona.es descargado) y `python3 /workspace/mi-menu-tools/precios.py eroski "<búsqueda>"` (en vivo en supermercado.eroski.es). Son orientativos y se muestran como «aprox.».
2. **Recetas** (`RAW`): `[id, tipo, nombre, tiempo, IG, [[alimento, gramos], …], [pasos], consejo, extras]`, con `extras` opcional `{ sobras, tomas, tupper }`. Los macros salen solos.
3. **Plan por defecto** (`PLAN`): para cada día, los ids `[desayuno, comida, cena, tentempié]`.

Después, valida:

```sh
node tools/check-nutricion.mjs            # tabla de totales por día del plan
node tools/check-nutricion.mjs --recetas  # además, macros de cada receta
```

El script falla (código 1) si algún alimento tiene macros incoherentes o le faltan precios, si una receta supera 50 g de hidratos en una toma principal, si algún día del plan se sale de objetivos (1.840–1.920 kcal, ≥ 140 g de proteína, 120–170 g de hidratos) o si el generador, simulando 400 semanas con distintas exclusiones, sobras, filtro de tiempo y personas, produce algún día fuera de objetivo, algún ingrediente excluido o demasiadas repeticiones.

Al publicar cambios, sube `CACHE_VERSION` en `sw.js` para que los móviles actualicen la caché.

Probar en local: `python3 -m http.server` y abrir <http://localhost:8000/>.
