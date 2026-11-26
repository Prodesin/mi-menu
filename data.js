/* Mi menú — base de datos de alimentos, recetas y plan por defecto.
 *
 * Los macros de cada receta NO se escriben a mano: se calculan a partir de sus
 * ingredientes (gramos) y de la tabla FOODS (valores por 100 g, tipo BEDCA / etiquetas
 * habituales de supermercado español). Para ajustar un plato, cambia los gramos y
 * valida con: node tools/check-nutricion.mjs
 *
 * Se carga en el navegador sin módulos (window.MENU_DATA) y en Node (module.exports).
 */
(function () {
  'use strict';

  /* Objetivos diarios (diabetes tipo 2: pérdida de grasa + ganancia muscular) */
  const GOALS = {
    kcal: 1875, kcalMin: 1750, kcalMax: 1950,   // objetivo 1.850–1.900; aceptable 1.750–1.950
    prot: 150, protMin: 140,
    hcMin: 120, hcMax: 170,
    hcComida: 50                                // máx. por toma principal (desayuno, comida, cena)
  };

  const TYPES = [
    { id: 'desayuno', label: 'Desayuno' },
    { id: 'comida', label: 'Comida' },
    { id: 'cena', label: 'Cena' },
    { id: 'tentempie', label: 'Tentempié' }
  ];

  /* Orden de las secciones del súper en la lista de la compra */
  const SECTIONS = [
    'Frutería y verdura', 'Carnicería y charcutería', 'Pescadería', 'Lácteos y huevos',
    'Panadería y cereales', 'Legumbres y conservas', 'Despensa y aceites', 'Frutos secos', 'Congelados'
  ];
  const [FV, CA, PE, LA, PA, LE, DE, FS, CO] = SECTIONS;

  /* Alimentos: k = kcal, p = proteína, h = hidratos, g = grasa (por 100 g).
   * u = unidad de compra opcional {s: singular, p: plural, g: gramos por unidad}. */
  const FOODS = {
    // Frutería y verdura
    brocoli:   { n: 'Brócoli', k: 34, p: 2.8, h: 4.4, g: 0.4, s: FV },
    coliflor:  { n: 'Coliflor', k: 27, p: 2.2, h: 3.5, g: 0.3, s: FV },
    espinaca:  { n: 'Espinacas frescas', k: 22, p: 2.6, h: 1.5, g: 0.6, s: FV },
    tomate:    { n: 'Tomate', k: 20, p: 0.9, h: 3.5, g: 0.2, s: FV },
    pepino:    { n: 'Pepino', k: 14, p: 0.7, h: 2, g: 0.1, s: FV },
    lechuga:   { n: 'Lechuga', k: 15, p: 1.2, h: 1.5, g: 0.2, s: FV },
    cebolla:   { n: 'Cebolla', k: 40, p: 1.2, h: 8, g: 0.1, s: FV, u: { s: 'cebolla', p: 'cebollas', g: 150 } },
    pimiento:  { n: 'Pimiento verde', k: 22, p: 0.9, h: 3.7, g: 0.2, s: FV },
    calabacin: { n: 'Calabacín', k: 17, p: 1.3, h: 2, g: 0.3, s: FV },
    champi:    { n: 'Champiñones', k: 25, p: 3, h: 1, g: 0.4, s: FV },
    judias:    { n: 'Judías verdes', k: 30, p: 1.8, h: 4.5, g: 0.2, s: FV },
    zanahoria: { n: 'Zanahoria', k: 38, p: 0.9, h: 8, g: 0.2, s: FV },
    berenjena: { n: 'Berenjena', k: 24, p: 1, h: 4, g: 0.2, s: FV },
    patata:    { n: 'Patata', k: 77, p: 2, h: 16.5, g: 0.1, s: FV },
    aguacate:  { n: 'Aguacate', k: 160, p: 2, h: 2, g: 15, s: FV, u: { s: 'aguacate', p: 'aguacates', g: 150 } },
    ajo:       { n: 'Ajo', k: 130, p: 6, h: 28, g: 0.5, s: FV, u: { s: 'cabeza de ajos', p: 'cabezas de ajos', g: 50 } },
    limon:     { n: 'Limón', k: 29, p: 1.1, h: 6, g: 0.3, s: FV, u: { s: 'limón', p: 'limones', g: 100 } },
    manzana:   { n: 'Manzana', k: 52, p: 0.3, h: 11.5, g: 0.2, s: FV, u: { s: 'manzana', p: 'manzanas', g: 150 } },
    pera:      { n: 'Pera', k: 55, p: 0.4, h: 12, g: 0.1, s: FV, u: { s: 'pera', p: 'peras', g: 150 } },
    kiwi:      { n: 'Kiwi', k: 52, p: 1, h: 10.5, g: 0.5, s: FV, u: { s: 'kiwi', p: 'kiwis', g: 80 } },
    fresas:    { n: 'Fresas', k: 33, p: 0.7, h: 6, g: 0.3, s: FV, u: { s: 'bandeja de 250 g', p: 'bandejas de 250 g', g: 250 } },
    // Carnicería y charcutería
    pollo:     { n: 'Pechuga de pollo', k: 110, p: 23, h: 0, g: 1.5, s: CA },
    pavo:      { n: 'Pechuga de pavo en lonchas', k: 95, p: 17.5, h: 1.5, g: 1.8, s: CA },
    pavopic:   { n: 'Pavo picado magro', k: 110, p: 20, h: 0, g: 3.5, s: CA },
    ternera:   { n: 'Ternera picada magra', k: 135, p: 21, h: 0, g: 5.5, s: CA },
    filete:    { n: 'Filete de ternera magra', k: 120, p: 21, h: 0, g: 4, s: CA },
    solomillo: { n: 'Solomillo de cerdo', k: 120, p: 21, h: 0, g: 4, s: CA },
    serrano:   { n: 'Jamón serrano', k: 200, p: 30, h: 0, g: 9, s: CA },
    // Pescadería
    merluza:   { n: 'Merluza', k: 75, p: 17, h: 0, g: 1, s: PE },
    salmon:    { n: 'Salmón', k: 190, p: 20, h: 0, g: 12.5, s: PE },
    pulpo:     { n: 'Pulpo cocido', k: 85, p: 16, h: 1.5, g: 1.5, s: PE },
    bacalao:   { n: 'Bacalao desalado', k: 80, p: 18, h: 0, g: 0.7, s: PE },
    lubina:    { n: 'Lubina', k: 100, p: 19, h: 0, g: 2.5, s: PE },
    // Lácteos y huevos
    huevo:     { n: 'Huevos', k: 140, p: 12.5, h: 0.5, g: 9.5, s: LA, u: { s: 'huevo', p: 'huevos', g: 60 } },
    clara:     { n: 'Claras de huevo líquidas', k: 48, p: 10.5, h: 0.5, g: 0.1, s: LA, u: { s: 'brick de 500 g', p: 'bricks de 500 g', g: 500 } },
    skyr:      { n: 'Skyr natural', k: 63, p: 11, h: 4, g: 0.2, s: LA, u: { s: 'tarrina de 450 g', p: 'tarrinas de 450 g', g: 450 } },
    qfresco:   { n: 'Queso fresco batido 0%', k: 46, p: 8, h: 3.5, g: 0.2, s: LA, u: { s: 'tarrina de 500 g', p: 'tarrinas de 500 g', g: 500 } },
    griego:    { n: 'Yogur griego natural 0%', k: 57, p: 10, h: 4, g: 0.2, s: LA, u: { s: 'yogur de 125 g', p: 'yogures de 125 g', g: 125 } },
    cottage:   { n: 'Queso cottage', k: 90, p: 11, h: 3, g: 3.5, s: LA, u: { s: 'tarrina de 200 g', p: 'tarrinas de 200 g', g: 200 } },
    leche:     { n: 'Leche semidesnatada', k: 46, p: 3.4, h: 4.8, g: 1.6, s: LA, u: { s: 'brick de 1 L', p: 'bricks de 1 L', g: 1000 } },
    mozza:     { n: 'Mozzarella light', k: 170, p: 20, h: 1.5, g: 9.5, s: LA, u: { s: 'bola de 125 g', p: 'bolas de 125 g', g: 125 } },
    // Panadería y cereales
    panint:    { n: 'Pan integral de molde', k: 240, p: 9, h: 41, g: 4, s: PA, u: { s: 'paquete de 400 g', p: 'paquetes de 400 g', g: 400 } },
    wrap:      { n: 'Wraps integrales', k: 290, p: 9, h: 48, g: 6, s: PA, u: { s: 'wrap', p: 'wraps', g: 60 } },
    avena:     { n: 'Copos de avena', k: 365, p: 13, h: 60, g: 7, s: PA, u: { s: 'bolsa de 500 g', p: 'bolsas de 500 g', g: 500 } },
    pastaint:  { n: 'Pasta integral (cruda)', k: 340, p: 13, h: 64, g: 2.5, s: PA, u: { s: 'paquete de 500 g', p: 'paquetes de 500 g', g: 500 } },
    arrozint:  { n: 'Arroz integral (crudo)', k: 355, p: 7.5, h: 74, g: 2.5, s: PA, u: { s: 'paquete de 1 kg', p: 'paquetes de 1 kg', g: 1000 } },
    // Legumbres y conservas (gramos = peso escurrido)
    lentejas:  { n: 'Lentejas cocidas (bote)', k: 90, p: 7, h: 12, g: 0.7, s: LE, u: { s: 'bote', p: 'botes', g: 240 } },
    garbanzos: { n: 'Garbanzos cocidos (bote)', k: 125, p: 7.5, h: 15, g: 3, s: LE, u: { s: 'bote', p: 'botes', g: 240 } },
    alubias:   { n: 'Alubias blancas cocidas (bote)', k: 85, p: 6.5, h: 11, g: 0.6, s: LE, u: { s: 'bote', p: 'botes', g: 240 } },
    atun:      { n: 'Atún al natural (lata)', k: 100, p: 23, h: 0, g: 1, s: LE, u: { s: 'lata', p: 'latas', g: 52 } },
    tomatetri: { n: 'Tomate triturado', k: 24, p: 1.2, h: 4, g: 0.2, s: LE, u: { s: 'bote de 400 g', p: 'botes de 400 g', g: 400 } },
    piquillo:  { n: 'Pimientos del piquillo', k: 30, p: 1, h: 5, g: 0.3, s: LE, u: { s: 'bote de 225 g', p: 'botes de 225 g', g: 225 } },
    // Despensa y aceites
    aceite:    { n: 'Aceite de oliva virgen extra', k: 899, p: 0, h: 0, g: 99.9, s: DE, u: { s: 'botella de 1 L', p: 'botellas de 1 L', g: 900 } },
    caldo:     { n: 'Caldo de verduras o pollo', k: 5, p: 0.3, h: 0.7, g: 0.1, s: DE, u: { s: 'brick de 1 L', p: 'bricks de 1 L', g: 1000 } },
    curry:     { n: 'Curry en polvo', k: 325, p: 13, h: 50, g: 14, s: DE, u: { s: 'bote', p: 'botes', g: 40 } },
    pimenton:  { n: 'Pimentón dulce', k: 280, p: 14, h: 35, g: 13, s: DE, u: { s: 'bote', p: 'botes', g: 75 } },
    chocolate: { n: 'Chocolate negro 85%', k: 580, p: 11, h: 18, g: 46, s: DE, u: { s: 'tableta de 100 g', p: 'tabletas de 100 g', g: 100 } },
    chia:      { n: 'Semillas de chía', k: 490, p: 17, h: 8, g: 31, s: DE, u: { s: 'bolsa de 200 g', p: 'bolsas de 200 g', g: 200 } },
    // Frutos secos
    nueces:    { n: 'Nueces', k: 650, p: 15, h: 4, g: 64, s: FS, u: { s: 'bolsa de 200 g', p: 'bolsas de 200 g', g: 200 } },
    almendras: { n: 'Almendras naturales', k: 610, p: 21, h: 6, g: 53, s: FS, u: { s: 'bolsa de 200 g', p: 'bolsas de 200 g', g: 200 } },
    cacahuete: { n: 'Crema de cacahuete 100%', k: 600, p: 25, h: 10, g: 50, s: FS, u: { s: 'bote de 350 g', p: 'botes de 350 g', g: 350 } },
    // Congelados
    gambas:    { n: 'Gambas peladas (congeladas)', k: 75, p: 16, h: 0.5, g: 1, s: CO, u: { s: 'bolsa de 400 g', p: 'bolsas de 400 g', g: 400 } },
    rojos:     { n: 'Frutos rojos (congelados)', k: 45, p: 0.9, h: 8.5, g: 0.3, s: CO, u: { s: 'bolsa de 300 g', p: 'bolsas de 300 g', g: 300 } },
    saltear:   { n: 'Verdura para saltear (congelada)', k: 33, p: 2.4, h: 4, g: 0.5, s: CO, u: { s: 'bolsa de 450 g', p: 'bolsas de 450 g', g: 450 } }
  };

  /* Recetas: [id, tipo, nombre, tiempo, IG, ingredientes [[alimento, gramos]], pasos, consejo] */
  const RAW = [
    /* ---------------- DESAYUNOS ---------------- */
    ['d1', 'desayuno', 'Skyr con frutos rojos, nueces y avena', '5 min', 'bajo',
      [['skyr', 250], ['rojos', 100], ['nueces', 24], ['avena', 40]],
      ['Descongela los frutos rojos unos minutos a temperatura ambiente.', 'Pon el skyr en un bol.', 'Añade los frutos rojos y los copos de avena.', 'Pica las nueces por encima y sirve.'],
      'Si lo preparas por la noche, la avena se ablanda y queda más cremoso.'],
    ['d2', 'desayuno', 'Tortilla francesa de pavo con tostada integral', '8 min', 'medio',
      [['huevo', 180], ['pavo', 40], ['panint', 60], ['aceite', 5]],
      ['Bate los huevos con una pizca de sal.', 'Calienta el aceite en una sartén antiadherente y vierte el huevo.', 'Cuando cuaje por abajo, añade el pavo troceado y dobla la tortilla.', 'Tuesta el pan integral y sirve junto a la tortilla.'],
      'Con un tomate rallado sobre la tostada queda más jugosa.'],
    ['d3', 'desayuno', 'Porridge de avena con skyr y nueces', '8 min', 'medio',
      [['avena', 40], ['leche', 150], ['skyr', 130], ['nueces', 20], ['manzana', 50]],
      ['Calienta la leche en un cazo con los copos de avena a fuego medio.', 'Remueve 4–5 minutos hasta que espese.', 'Retira del fuego y deja templar un minuto.', 'Incorpora el skyr, la manzana en dados y las nueces picadas.'],
      'Una pizca de canela aporta dulzor sin azúcar.'],
    ['d4', 'desayuno', 'Tostada de aguacate con huevos y pavo', '10 min', 'medio',
      [['panint', 60], ['aguacate', 50], ['huevo', 120], ['pavo', 50], ['tomate', 50]],
      ['Cuece o haz a la plancha los huevos.', 'Tuesta el pan integral.', 'Aplasta el aguacate con sal y unas gotas de limón y úntalo en la tostada.', 'Coloca encima el pavo, las rodajas de tomate y los huevos.'],
      'Un toque de pimienta negra o pimentón le va muy bien.'],
    ['d5', 'desayuno', 'Yogur griego con chía, kiwi y almendras', '5 min', 'bajo',
      [['griego', 250], ['chia', 12], ['kiwi', 80], ['almendras', 22], ['avena', 25]],
      ['Pon el yogur griego en un bol.', 'Mezcla la chía y la avena y deja reposar 5 minutos si tienes tiempo.', 'Pela y trocea el kiwi.', 'Añade el kiwi y las almendras troceadas.'],
      'La chía absorbe líquido: si te queda espesa, añade un chorrito de leche.'],
    ['d6', 'desayuno', 'Revuelto de huevo y champiñones con tostada', '10 min', 'medio',
      [['huevo', 120], ['clara', 100], ['champi', 100], ['panint', 60], ['aceite', 7]],
      ['Lamina los champiñones y saltéalos con el aceite 3–4 minutos.', 'Añade los huevos y las claras batidos con sal.', 'Remueve a fuego suave hasta que cuaje al punto que te guste.', 'Sirve con el pan integral tostado.'],
      'Las claras líquidas vienen en brick y duran varios días en la nevera una vez abiertas.'],
    ['d7', 'desayuno', 'Queso cottage con pera, nueces y tostada', '5 min', 'bajo',
      [['cottage', 200], ['pera', 120], ['nueces', 18], ['panint', 30], ['clara', 60]],
      ['Tuesta el pan integral.', 'Pon el cottage en un bol y añade la pera en dados.', 'Pica las nueces por encima.', 'Cocina las claras en una sartén seca con sal y sírvelas al lado.'],
      'Si no te gustan las claras, cámbialas por un huevo cocido.'],
    ['d8', 'desayuno', 'Wrap de huevo, pavo y tomate', '10 min', 'medio',
      [['wrap', 60], ['huevo', 120], ['clara', 50], ['pavo', 40], ['tomate', 60], ['aceite', 4]],
      ['Bate los huevos con las claras y haz una tortilla fina en sartén antiadherente.', 'Calienta el wrap 20 segundos por lado.', 'Coloca la tortilla, el pavo y el tomate en rodajas.', 'Enrolla y corta por la mitad.'],
      'Envuélvelo en papel y te lo puedes llevar fuera de casa.'],
    ['d9', 'desayuno', 'Bol de queso fresco batido con avena y manzana', '5 min', 'bajo',
      [['qfresco', 250], ['avena', 30], ['manzana', 100], ['almendras', 15]],
      ['Pon el queso fresco batido en un bol.', 'Añade los copos de avena y mezcla.', 'Corta la manzana en dados pequeños.', 'Termina con las almendras troceadas y canela.'],
      'El queso fresco batido 0% es muy saciante y casi sin grasa.'],

    /* ---------------- COMIDAS ---------------- */
    ['c1', 'comida', 'Lentejas con verduras y pollo', '25 min', 'bajo',
      [['lentejas', 240], ['pollo', 150], ['zanahoria', 60], ['cebolla', 50], ['pimiento', 50], ['ajo', 3], ['aceite', 15]],
      ['Pica la cebolla, el pimiento y la zanahoria y sofríelos en el aceite 6–7 minutos.', 'Corta la pechuga en dados, salpimienta y dóralos aparte en la misma sartén.', 'Escurre y enjuaga las lentejas del bote.', 'Junta todo con un vaso de agua o caldo y cuece 8 minutos a fuego bajo.', 'Rectifica de sal y sirve caliente.'],
      'Con las lentejas de bote ahorras mucho tiempo; enjuágalas para quitar el exceso de sal.'],
    ['c2', 'comida', 'Merluza a la gallega ligera', '30 min', 'medio',
      [['merluza', 250], ['patata', 230], ['judias', 100], ['cebolla', 40], ['ajo', 5], ['pimenton', 2], ['aceite', 15]],
      ['Cuece la patata en rodajas gruesas con las judías verdes durante 15 minutos.', 'Añade la merluza en los últimos 5 minutos de cocción.', 'Dora el ajo laminado en el aceite sin que se queme y retira del fuego.', 'Añade el pimentón y vierte este refrito sobre la merluza y la patata.', 'Sirve enseguida con un poco de sal en escamas.'],
      'Es la versión ligera: menos patata y menos aceite que la clásica, pero con el mismo sabor.'],
    ['c3', 'comida', 'Pulpo con patata y ensalada', '20 min', 'medio',
      [['pulpo', 280], ['patata', 230], ['pimenton', 2], ['aceite', 20], ['lechuga', 50], ['tomate', 100]],
      ['Cuece la patata en rodajas hasta que esté tierna (15 minutos).', 'Calienta el pulpo cocido en agua caliente o al microondas.', 'Corta el pulpo en rodajas sobre las patatas.', 'Aliña con el aceite, el pimentón y sal gorda.', 'Acompaña con la lechuga y el tomate.'],
      'Compra el pulpo ya cocido (vacío o pescadería) para ir rápido.'],
    ['c4', 'comida', 'Garbanzos con espinacas, bacalao y huevo', '25 min', 'bajo',
      [['garbanzos', 280], ['espinaca', 200], ['bacalao', 100], ['huevo', 60], ['ajo', 5], ['pimenton', 2], ['aceite', 5]],
      ['Dora el ajo laminado en el aceite y añade el pimentón fuera del fuego.', 'Agrega las espinacas y cocina 2 minutos hasta que reduzcan.', 'Incorpora los garbanzos escurridos y el bacalao desmigado.', 'Cuece 6–8 minutos con un chorrito de agua.', 'Cuece el huevo 9 minutos, pícalo y repártelo por encima.'],
      'Es un clásico de Vigilia, pero con mucha más proteína.'],
    ['c5', 'comida', 'Pollo al curry con coliflor y arroz integral', '35 min', 'medio',
      [['pollo', 200], ['coliflor', 250], ['griego', 100], ['curry', 5], ['cebolla', 60], ['arrozint', 40], ['aceite', 10]],
      ['Cuece el arroz integral 25–30 minutos y escúrrelo.', 'Sofríe la cebolla picada en el aceite 5 minutos.', 'Añade el pollo en dados y dóralo; incorpora el curry.', 'Suma la coliflor en ramilletes y medio vaso de agua; tapa 10 minutos.', 'Retira del fuego, mezcla el yogur griego y sirve con el arroz.'],
      'Cocina el arroz de más y guarda una ración: se conserva 2 días en la nevera.'],
    ['c6', 'comida', 'Alubias blancas con gambas y verduras', '20 min', 'bajo',
      [['alubias', 300], ['gambas', 200], ['pimiento', 60], ['cebolla', 50], ['tomatetri', 100], ['ajo', 3], ['aceite', 18]],
      ['Descongela las gambas.', 'Sofríe la cebolla, el pimiento y el ajo picados en el aceite.', 'Añade el tomate triturado y cocina 5 minutos.', 'Incorpora las alubias escurridas y cuece 5 minutos más.', 'Agrega las gambas los últimos 3 minutos y sirve.'],
      'Si tienes perejil fresco, pícalo al final.'],
    ['c7', 'comida', 'Macarrones integrales con atún y tomate', '20 min', 'medio',
      [['pastaint', 60], ['atun', 156], ['tomatetri', 150], ['mozza', 30], ['cebolla', 40], ['aceite', 14]],
      ['Cuece la pasta integral en agua con sal el tiempo del paquete.', 'Sofríe la cebolla picada en el aceite.', 'Añade el tomate triturado y cocina 6 minutos.', 'Incorpora el atún escurrido y la pasta.', 'Termina con la mozzarella en trocitos y deja que se funda.'],
      'Mantén la ración de pasta ajustada: la integral sacia más y sube menos el azúcar.'],
    ['c8', 'comida', 'Ternera salteada con verduras y arroz integral', '30 min', 'medio',
      [['filete', 180], ['saltear', 250], ['arrozint', 50], ['aceite', 10]],
      ['Cuece el arroz integral 25–30 minutos y escúrrelo.', 'Corta la ternera en tiras y salpimiéntala.', 'Saltéala a fuego fuerte en el aceite 2–3 minutos y resérvala.', 'Saltea la verdura congelada sin descongelar hasta que esté hecha.', 'Junta con la ternera y sirve sobre el arroz.'],
      'Un chorrito de salsa de soja baja en sal le da un toque oriental.'],
    ['c9', 'comida', 'Solomillo de cerdo con pimientos y patata', '30 min', 'medio',
      [['solomillo', 220], ['pimiento', 150], ['patata', 220], ['ajo', 3], ['aceite', 14]],
      ['Corta la patata en gajos y hornéala o cuécela hasta que esté tierna.', 'Corta el solomillo en medallones y salpimiéntalo.', 'Dóralo en una sartén con parte del aceite 3 minutos por lado.', 'Saltea los pimientos en tiras con el ajo laminado.', 'Sirve todo junto.'],
      'No lo cocines de más: el solomillo queda jugoso con el centro apenas rosado.'],
    ['c10', 'comida', 'Cocido ligero de garbanzos con pollo y verduras', '30 min', 'bajo',
      [['garbanzos', 200], ['pollo', 150], ['judias', 100], ['zanahoria', 80], ['caldo', 200], ['aceite', 8]],
      ['Pon el caldo a hervir con la zanahoria en rodajas y las judías verdes troceadas.', 'Añade el pollo en dados y cuece 10 minutos.', 'Incorpora los garbanzos escurridos y cuece 5 minutos más.', 'Termina con el aceite crudo por encima.'],
      'Admite repollo o grelos si los encuentras en temporada.'],
    ['c11', 'comida', 'Ensalada de lentejas con atún y huevo', '15 min', 'bajo',
      [['lentejas', 200], ['atun', 104], ['huevo', 120], ['tomate', 100], ['pepino', 80], ['cebolla', 30], ['aceite', 12]],
      ['Cuece los huevos 9 minutos, enfríalos y pélalos.', 'Escurre y enjuaga las lentejas.', 'Corta el tomate, el pepino y la cebolla.', 'Mezcla todo con el atún y los huevos en cuartos.', 'Aliña con el aceite y sal.'],
      'Perfecta para llevar en tápper: aliña justo antes de comer.'],
    ['c12', 'comida', 'Hamburguesas de pavo con ensalada y pan integral', '20 min', 'medio',
      [['pavopic', 220], ['panint', 60], ['lechuga', 60], ['tomate', 100], ['cebolla', 30], ['huevo', 60], ['aceite', 8]],
      ['Mezcla el pavo con el huevo, sal y pimienta y forma dos hamburguesas.', 'Hazlas a la plancha con el aceite 4–5 minutos por lado.', 'Tuesta el pan integral.', 'Prepara la ensalada con la lechuga, el tomate y la cebolla.', 'Sirve la hamburguesa sobre el pan con la ensalada.'],
      'Añade pimentón o ajo en polvo a la carne para que no quede sosa.'],
    ['c13', 'comida', 'Lubina al horno con patata y calabacín', '35 min', 'medio',
      [['lubina', 250], ['patata', 200], ['calabacin', 150], ['cebolla', 40], ['limon', 30], ['aceite', 12]],
      ['Precalienta el horno a 200 °C.', 'Coloca en una bandeja la patata en rodajas, el calabacín y la cebolla con la mitad del aceite.', 'Hornea 15 minutos.', 'Añade la lubina con sal, el limón en rodajas y el resto del aceite.', 'Hornea otros 12–15 minutos y sirve.'],
      'Pide en la pescadería que te la limpien y la abran en lomos.'],
    ['c14', 'comida', 'Albóndigas de ternera y pavo con tomate', '35 min', 'medio',
      [['ternera', 100], ['pavopic', 100], ['avena', 15], ['huevo', 60], ['tomatetri', 200], ['cebolla', 50], ['patata', 120], ['ajo', 3], ['aceite', 10]],
      ['Mezcla la ternera, el pavo, el huevo, la avena, el ajo picado y sal; forma bolitas.', 'Dóralas en el aceite 5 minutos.', 'Sofríe la cebolla en la misma sartén y añade el tomate triturado.', 'Incorpora las albóndigas y cuece tapado 12 minutos.', 'Sirve con la patata cocida.'],
      'Se congelan muy bien: haz doble cantidad y guarda para otro día.'],
    ['c15', 'comida', 'Estofado de ternera con alubias y verduras', '35 min', 'bajo',
      [['filete', 190], ['alubias', 240], ['zanahoria', 80], ['cebolla', 50], ['tomatetri', 100], ['aceite', 12]],
      ['Corta la ternera en dados y dórala en el aceite.', 'Añade la cebolla y la zanahoria picadas y sofríe 5 minutos.', 'Incorpora el tomate triturado y medio vaso de agua; tapa y cuece 15 minutos.', 'Añade las alubias escurridas y cuece 5 minutos más.'],
      'Mejora al día siguiente: puedes prepararlo con antelación.'],

    /* ---------------- CENAS ---------------- */
    ['n1', 'cena', 'Tortilla francesa con pavo y ensalada', '10 min', 'bajo',
      [['huevo', 180], ['pavo', 60], ['lechuga', 60], ['tomate', 100], ['panint', 40], ['aceite', 8]],
      ['Bate los huevos con sal.', 'Cuaja la tortilla en una sartén con parte del aceite y rellena con el pavo.', 'Prepara la ensalada con la lechuga y el tomate y aliña con el resto del aceite.', 'Sirve con el pan integral.'],
      'Sirve la tortilla poco hecha para que quede jugosa.'],
    ['n2', 'cena', 'Salmón al horno con brócoli', '25 min', 'bajo',
      [['salmon', 170], ['brocoli', 250], ['patata', 100], ['limon', 30], ['ajo', 3], ['aceite', 5]],
      ['Precalienta el horno a 200 °C.', 'Corta la patata en cuñas y el brócoli en ramilletes y ponlos en la bandeja con el ajo y el aceite.', 'Hornea 12 minutos.', 'Añade el salmón con sal y unas gotas de limón.', 'Hornea 10–12 minutos más y sirve.'],
      'El salmón es graso pero saludable: no hace falta añadirle más aceite.'],
    ['n3', 'cena', 'Revuelto de gambas y espinacas', '12 min', 'bajo',
      [['gambas', 200], ['huevo', 120], ['espinaca', 150], ['ajo', 5], ['panint', 40], ['aceite', 12]],
      ['Descongela las gambas y sécalas bien.', 'Dora el ajo laminado en el aceite.', 'Saltea las gambas 2 minutos y añade las espinacas hasta que reduzcan.', 'Vierte los huevos batidos y remueve hasta que cuajen.', 'Sirve con el pan integral tostado.'],
      'Seca bien las gambas para que no suelten agua.'],
    ['n4', 'cena', 'Ensalada de atún y huevo', '15 min', 'bajo',
      [['atun', 156], ['huevo', 120], ['lechuga', 80], ['tomate', 120], ['cebolla', 30], ['panint', 50], ['aceite', 10]],
      ['Cuece los huevos 9 minutos, enfríalos y pélalos.', 'Trocea la lechuga, el tomate y la cebolla.', 'Mezcla con el atún escurrido y los huevos en cuartos.', 'Aliña con el aceite y sal y sirve con el pan integral.'],
      'Unas gotas de limón o vinagre de Jerez le dan frescura.'],
    ['n5', 'cena', 'Pollo a la plancha con ensalada y patata cocida', '20 min', 'medio',
      [['pollo', 220], ['patata', 150], ['lechuga', 60], ['tomate', 100], ['aceite', 12]],
      ['Cuece la patata 15 minutos.', 'Aplana la pechuga, sazónala y hazla a la plancha 4–5 minutos por lado.', 'Prepara la ensalada y aliña con el aceite.', 'Sirve todo junto.'],
      'Aplanar la pechuga garantiza que quede jugosa y se haga por igual.'],
    ['n6', 'cena', 'Merluza al limón con judías verdes y patata', '25 min', 'bajo',
      [['merluza', 250], ['judias', 200], ['patata', 200], ['ajo', 3], ['limon', 30], ['aceite', 15]],
      ['Cuece la patata y las judías verdes 12–15 minutos.', 'Dora el ajo laminado en el aceite y retíralo.', 'Cocina la merluza en la misma sartén 3 minutos por lado con sal.', 'Exprime el limón por encima y sirve con la verdura.'],
      'Si usas merluza congelada, descongélala en la nevera la noche anterior.'],
    ['n7', 'cena', 'Crema de calabacín con pechuga', '25 min', 'bajo',
      [['calabacin', 300], ['cebolla', 50], ['patata', 80], ['caldo', 200], ['pollo', 180], ['qfresco', 60], ['panint', 30], ['aceite', 8]],
      ['Sofríe la cebolla en la mitad del aceite, añade el calabacín y la patata troceados.', 'Cubre con el caldo y cuece 15 minutos.', 'Tritura con el queso fresco batido hasta lograr una crema fina.', 'Haz la pechuga a tiras a la plancha con el resto del aceite.', 'Sirve la crema con el pollo y el pan tostado.'],
      'El queso fresco batido sustituye a la nata sin añadir grasa.'],
    ['n8', 'cena', 'Pimientos del piquillo rellenos de atún', '20 min', 'bajo',
      [['piquillo', 150], ['atun', 156], ['qfresco', 100], ['huevo', 60], ['panint', 40], ['lechuga', 50]],
      ['Cuece el huevo 9 minutos y pícalo.', 'Mezcla el atún escurrido con el queso fresco batido y el huevo.', 'Rellena los pimientos con la mezcla.', 'Sírvelos fríos sobre la lechuga y acompaña con el pan.'],
      'No hace falta cocinarlos: se pueden preparar por la mañana.'],
    ['n9', 'cena', 'Revuelto de champiñones y jamón', '12 min', 'bajo',
      [['huevo', 120], ['clara', 100], ['serrano', 40], ['champi', 150], ['panint', 40], ['aceite', 6]],
      ['Lamina los champiñones y dóralos en el aceite 4 minutos.', 'Añade el jamón en tacos.', 'Vierte los huevos y las claras batidos.', 'Remueve hasta que cuajen y sirve con el pan integral.'],
      'El jamón ya es salado: prueba antes de añadir sal.'],
    ['n10', 'cena', 'Brochetas de pollo y verduras con salsa de yogur', '25 min', 'bajo',
      [['pollo', 220], ['pimiento', 100], ['calabacin', 100], ['cebolla', 50], ['griego', 100], ['limon', 20], ['panint', 40], ['aceite', 10]],
      ['Corta el pollo y las verduras en trozos y ensártalos en pinchos.', 'Úntalos con el aceite y sazona.', 'Hazlos a la plancha 10–12 minutos dándoles la vuelta.', 'Mezcla el yogur con limón, sal y ajo en polvo para la salsa.', 'Sirve con el pan integral.'],
      'Si usas pinchos de madera, remójalos 10 minutos antes.'],
    ['n11', 'cena', 'Bacalao con tomate y pimientos del piquillo', '30 min', 'medio',
      [['bacalao', 250], ['tomatetri', 150], ['piquillo', 80], ['patata', 120], ['cebolla', 40], ['aceite', 10]],
      ['Cuece la patata en rodajas 12 minutos.', 'Sofríe la cebolla en el aceite y añade el tomate triturado.', 'Incorpora los pimientos troceados y cuece 5 minutos.', 'Coloca el bacalao en la salsa y cocínalo tapado 6–8 minutos.', 'Sirve con la patata.'],
      'Pide el bacalao ya desalado para no tener que remojarlo.'],
    ['n12', 'cena', 'Berenjenas rellenas de ternera y mozzarella', '40 min', 'bajo',
      [['berenjena', 300], ['ternera', 150], ['tomatetri', 100], ['mozza', 40], ['cebolla', 40], ['panint', 30], ['aceite', 8]],
      ['Parte las berenjenas por la mitad y hornéalas 20 minutos a 200 °C.', 'Vacía la pulpa y pícala.', 'Sofríe la cebolla y la ternera, añade el tomate y la pulpa.', 'Rellena las berenjenas y cubre con la mozzarella.', 'Gratina 5 minutos y sirve con el pan tostado.'],
      'Pincha la piel con un tenedor antes de hornear.'],
    ['n13', 'cena', 'Wrap de pavo picado con verduras', '20 min', 'medio',
      [['wrap', 60], ['pavopic', 200], ['champi', 100], ['pimiento', 80], ['tomate', 60], ['griego', 50], ['aceite', 6]],
      ['Saltea el pavo picado con sal y pimienta en el aceite 5 minutos.', 'Añade los champiñones y el pimiento en tiras y cocina 5 minutos.', 'Calienta el wrap.', 'Rellénalo con el salteado, el tomate y una cucharada de yogur.', 'Enrolla y sirve.'],
      'Puedes sustituir el wrap por hojas grandes de lechuga si cenas más ligero.'],
    ['n14', 'cena', 'Tortilla de calabacín y atún con claras', '20 min', 'bajo',
      [['huevo', 120], ['clara', 150], ['calabacin', 150], ['cebolla', 50], ['atun', 104], ['panint', 30], ['aceite', 10]],
      ['Pocha la cebolla y el calabacín picados en el aceite 8 minutos.', 'Bate los huevos con las claras y mezcla con el atún escurrido.', 'Añade las verduras a la mezcla.', 'Cuaja la tortilla en la sartén, dale la vuelta y termina de hacerla.', 'Sirve con el pan integral.'],
      'Usa una sartén pequeña para que la tortilla quede alta y jugosa.'],
    ['n15', 'cena', 'Ensalada templada de pulpo, patata y pimiento', '20 min', 'medio',
      [['pulpo', 240], ['patata', 150], ['pimiento', 80], ['tomate', 80], ['lechuga', 40], ['pimenton', 2], ['aceite', 14], ['panint', 30]],
      ['Cuece la patata en dados 12 minutos y escúrrela.', 'Calienta el pulpo en rodajas.', 'Mezcla con el pimiento y el tomate en trozos sobre la lechuga.', 'Aliña con el aceite, el pimentón y sal.'],
      'Se puede tomar templada o fría.'],

    /* ---------------- TENTEMPIÉS ---------------- */
    ['t1', 'tentempie', 'Yogur griego con nueces y fresas', '3 min', 'bajo',
      [['griego', 200], ['nueces', 15], ['fresas', 100], ['manzana', 100]],
      ['Pon el yogur griego en un bol.', 'Añade las fresas y la manzana troceadas.', 'Termina con las nueces picadas.'],
      'Si lo llevas fuera, guarda las nueces aparte para que no se ablanden.'],
    ['t2', 'tentempie', 'Queso fresco batido con frutos rojos y almendras', '3 min', 'bajo',
      [['qfresco', 200], ['rojos', 100], ['almendras', 15], ['avena', 15]],
      ['Sirve el queso fresco batido en un bol.', 'Añade los frutos rojos y la avena.', 'Espolvorea con las almendras troceadas.'],
      'Los frutos rojos congelados se descongelan en unos minutos.'],
    ['t3', 'tentempie', 'Huevos cocidos con manzana', '10 min', 'bajo',
      [['huevo', 120], ['manzana', 150]],
      ['Cuece los huevos 9–10 minutos en agua con sal.', 'Enfríalos y pélalos.', 'Come con una manzana entera, con piel.'],
      'Cuece varios huevos a la vez y guárdalos en la nevera hasta 5 días.'],
    ['t4', 'tentempie', 'Tostada integral con pavo y tomate', '5 min', 'medio',
      [['panint', 40], ['pavo', 90], ['tomate', 60], ['aceite', 4]],
      ['Tuesta el pan.', 'Unta el tomate rallado con el aceite.', 'Coloca el pavo encima.'],
      'Un poco de orégano o pimienta lo mejora.'],
    ['t5', 'tentempie', 'Skyr con cacao y crema de cacahuete', '3 min', 'bajo',
      [['skyr', 200], ['chocolate', 8], ['cacahuete', 10], ['pera', 100]],
      ['Pon el skyr en un bol.', 'Añade el chocolate rallado o picado.', 'Termina con la crema de cacahuete en hilo y acompaña con la pera.'],
      'El chocolate negro 85% casi no lleva azúcar; no pases de la cantidad indicada.'],
    ['t6', 'tentempie', 'Bastones de verdura con atún y queso fresco', '5 min', 'bajo',
      [['atun', 104], ['qfresco', 80], ['pepino', 100], ['zanahoria', 80], ['panint', 30]],
      ['Mezcla el atún escurrido con el queso fresco batido, sal y pimienta.', 'Corta el pepino y la zanahoria en bastones.', 'Moja los bastones en el paté o úntalo sobre el pan integral tostado.'],
      'Un chorrito de limón en el paté lo hace más fresco.'],
    ['t7', 'tentempie', 'Queso cottage con kiwi y almendras', '3 min', 'bajo',
      [['cottage', 150], ['kiwi', 160], ['almendras', 12], ['clara', 50]],
      ['Pon el cottage en un bol.', 'Pela y trocea el kiwi y añádelo.', 'Termina con las almendras troceadas.', 'Acompaña con las claras hechas en sartén seca si quieres más proteína.'],
      'Es un tentempié muy saciante para la media tarde.'],
    ['t8', 'tentempie', 'Rollitos de pavo con queso fresco y pepino', '5 min', 'bajo',
      [['pavo', 100], ['qfresco', 80], ['pepino', 80], ['nueces', 12], ['pera', 100]],
      ['Extiende las lonchas de pavo.', 'Unta con el queso fresco batido y añade tiras de pepino.', 'Enrolla y corta en trozos.', 'Acompaña con las nueces y la pera.'],
      'Se pueden dejar preparados en la nevera.'],
    ['t9', 'tentempie', 'Batido de skyr, leche y fresas', '5 min', 'bajo',
      [['skyr', 150], ['leche', 150], ['fresas', 100], ['cacahuete', 8]],
      ['Pon todos los ingredientes en el vaso de la batidora.', 'Tritura 30 segundos.', 'Sirve frío.'],
      'Con fresas congeladas queda como un batido helado.']
  ];

  const RECIPES = RAW.map((r) => ({
    id: r[0], tipo: r[1], nombre: r[2], tiempo: r[3], ig: r[4],
    ing: r[5].map((x) => ({ f: x[0], g: x[1] })), pasos: r[6], consejo: r[7] || ''
  }));
  const BY_ID = {};
  RECIPES.forEach((r) => { BY_ID[r.id] = r; });

  /* Macros de una receta a partir de sus ingredientes */
  function calc(recipe) {
    const t = { k: 0, p: 0, h: 0, g: 0 };
    recipe.ing.forEach((i) => {
      const f = FOODS[i.f], q = i.g / 100;
      t.k += f.k * q; t.p += f.p * q; t.h += f.h * q; t.g += f.g * q;
    });
    return t;
  }
  RECIPES.forEach((r) => { r.macros = calc(r); });

  /* Plan por defecto: por día, [desayuno, comida, cena, tentempié] */
  const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const PLAN = [
    ['d1', 'c1', 'n1', 't1'],
    ['d2', 'c2', 'n2', 't2'],
    ['d3', 'c5', 'n3', 't3'],
    ['d4', 'c4', 'n4', 't4'],
    ['d5', 'c3', 'n5', 't5'],
    ['d6', 'c6', 'n6', 't6'],
    ['d7', 'c7', 'n7', 't7']
  ];

  const MENU_DATA = { GOALS, TYPES, SECTIONS, FOODS, RECIPES, BY_ID, PLAN, DAYS, calc };
  if (typeof window !== 'undefined') window.MENU_DATA = MENU_DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = MENU_DATA;
})();
