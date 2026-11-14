/** Pruebas sin red ni créditos. Uso: npm test */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inicioDePasos, pasoActual, recortar, tiemposDePasos } from '../src/depurador';
import { anguloMarcador, momentosPartes, valorVisible, vueltasDeConsola } from '../src/animaciones/ciclo';
import { planAnimacion, planCiclo, ritmoConAnimacion } from '../src/animaciones/plan';
import { anclasDeClaves, lineasDeConsola, tiemposPorPasos } from '../src/animaciones/pasos';
import {
  calcularArreglo,
  calcularCiclo,
  calcularCondicion,
  calcularFuncion,
  calcularObjeto,
  calcularVariable,
  elementosDe,
  partesDeNivel,
  propiedadesDe,
} from './animaciones';
import { medidasEditor } from '../src/medidas';
import { ALTO_VENTANA, TRANSICION, camaraEscenario, encuadre, limpiarTomas, mundoDe, pesoFoco, viaja } from '../src/escenario';
import { agruparPalabras, indiceActual, palabrasDeAlineacion } from '../src/subtitulos';
import { clavesDe, momentosClave } from '../src/momentos';
import { duracionTecleo, iniciosDeLinea, lineaDelCursor, momentosDeTecla, visiblesPorLinea } from '../src/tecleo';
import { esClave, palabrasClave } from '../src/subtitulos';
import { golpesDeCamara, SEPARACION_MIN, ZOOM_ENTRADA, ZOOM_GOLPE, ZOOM_LENTO, zoomCamara } from '../src/camara';
import { CicloCalculado, EscenaCodigo, FuncionCalculada, GuionCodigo, PasoTraza, Traza } from '../src/types';
import { agregarTrazas, conReintentos, ejecutar, leerGuion, parsearGuion, slugify, verificarCodigo, verificarVisuales } from './lib';
import { formatoValor, trazar } from './traza';
import { camaraEn, geometria, llavesCamara, paqueteEn, planoCerrado, planoGeneral, tiemposRecorrido } from '../src/recorrido';

const escena = (e: Partial<EscenaCodigo>): EscenaCodigo => ({ titulo: 'Prueba', narracion: 'Texto', ...e });
const contiene = (avisos: string[], texto: string) => avisos.some((a) => a.includes(texto));

test('slugify quita acentos y signos', () => {
  assert.equal(slugify('¿Qué pasa en cada vuelta de un ciclo for?'), 'que-pasa-en-cada-vuelta-de-un-ciclo-for');
});

test('ejecutar captura console.log y detecta bucles infinitos', () => {
  assert.equal(ejecutar('for (let i = 0; i < 2; i++) console.log(i);').salida, '0\n1');
  assert.equal(ejecutar('while (true) {}').timeout, true);
});

test('verificarCodigo acepta una salida correcta', () => {
  assert.deepEqual(verificarCodigo([escena({ codigo: 'console.log(1);', salida: '1' })], false), []);
});

test('verificarCodigo corrige una salida equivocada', () => {
  const e = escena({ codigo: 'console.log(1);', salida: '2' });
  assert.ok(contiene(verificarCodigo([e], true), 'no coincide'));
  assert.equal(e.salida, '1');
});

test('verificarCodigo avisa si hay salida escrita pero el código no imprime', () => {
  assert.ok(contiene(verificarCodigo([escena({ codigo: 'let a = 1;', salida: '1' })], false), 'no coincide'));
});

test('verificarCodigo respeta la salida escrita de un bucle infinito', () => {
  assert.deepEqual(verificarCodigo([escena({ codigo: 'while (true) {}', salida: '... nunca termina' })], false), []);
});

test('verificarCodigo avisa si la consola taparía el subtítulo', () => {
  const codigo = Array.from({ length: 10 }, (_, i) => `console.log(${i});`).join('\n');
  const salida = Array.from({ length: 10 }, (_, i) => i).join('\n');
  assert.ok(contiene(verificarCodigo([escena({ codigo, salida })], false), 'tapan el subtítulo'));
});

test('verificarCodigo avisa si resaltar apunta a una línea inexistente', () => {
  assert.ok(contiene(verificarCodigo([escena({ codigo: 'let a = 1;', resaltar: [5] })], false), 'no existen'));
});

test('verificarCodigo no ejecuta el código ilustrativo, pero sí revisa que quepa', () => {
  assert.deepEqual(verificarCodigo([escena({ codigo: '<button>{{ n }}</button>', archivo: 'Contador.vue' })], false), []);
  assert.ok(contiene(verificarCodigo([escena({ codigo: '<a>', archivo: 'a.vue', resaltar: [5] })], false), 'no existen'));
});

test('medidasEditor agranda el código corto y respeta el mínimo en el largo', () => {
  assert.ok(medidasEditor(['let a = 1;'], 0).fs > 38);
  assert.equal(medidasEditor(['x'.repeat(35)], 0).fs, 38);
});

test('palabrasDeAlineacion arma palabras con sus tiempos', () => {
  const texto = 'Hola mundo';
  const palabras = palabrasDeAlineacion({
    characters: [...texto],
    character_start_times_seconds: [...texto].map((_, i) => i / 10),
    character_end_times_seconds: [...texto].map((_, i) => (i + 1) / 10),
  });
  assert.deepEqual(palabras.map((p) => p.texto), ['Hola', 'mundo']);
  assert.equal(palabras[1].inicio, 0.5);
  assert.equal(palabras[1].fin, 1);
});

test('agruparPalabras corta en la puntuación y a las 6 palabras', () => {
  const p = (texto: string) => ({ texto, inicio: 0, fin: 0 });
  const grupos = agruparPalabras(['Hola', 'mundo.', 'a', 'b', 'c', 'd', 'e', 'f', 'g'].map(p));
  assert.deepEqual(grupos.map((g) => g.length), [2, 6, 1]);
});

test('indiceActual elige lo último que ya empezó', () => {
  const inicios = [0, 1, 2];
  assert.equal(indiceActual(inicios, (x) => x, -1), 0);
  assert.equal(indiceActual(inicios, (x) => x, 1.5), 1);
  assert.equal(indiceActual(inicios, (x) => x, 9), 2);
});

test('conReintentos reintenta lo temporal y se detiene en lo definitivo', async () => {
  let veces = 0;
  const ok = await conReintentos(
    async () => {
      if (++veces < 3) throw new Error('temporal');
      return 'listo';
    },
    () => true,
    { esperaMs: 1 },
  );
  assert.equal(ok, 'listo');
  assert.equal(veces, 3);

  veces = 0;
  await assert.rejects(
    conReintentos(
      async () => {
        veces++;
        throw new Error('definitivo');
      },
      () => false,
      { esperaMs: 1 },
    ),
  );
  assert.equal(veces, 1);
});

const trazaDe = (codigo: string): Traza => {
  const { traza, error } = trazar(codigo);
  if (!traza) throw new Error(`${error} en:\n${codigo}`);
  return traza;
};
const lineasDe = (t: Traza) => t.pasos.map((p) => p.linea);
const variable = (p: PasoTraza, nombre: string) => p.grupos.flatMap((g) => g.variables).find((v) => v.nombre === nombre)?.valor;

test('trazar sigue un for e incluye la revisión que lo termina', () => {
  const t = trazaDe('for (let i = 0; i < 2; i++) {\n  console.log(i);\n}');
  assert.deepEqual(lineasDe(t), [1, 2, 1, 2, 1, 0]);
  assert.equal(variable(t.pasos[4], 'i'), '2');
  assert.deepEqual(t.salida, ['0', '1']);
  assert.equal(t.pasos[t.pasos.length - 1].nSalida, 2);
});

test('cada paso ya muestra el efecto de su línea', () => {
  const t = trazaDe('let a = 1;\na++;\nconsole.log(a);');
  assert.deepEqual(lineasDe(t), [1, 2, 3, 0]);
  assert.equal(variable(t.pasos[0], 'a'), '1');
  assert.equal(variable(t.pasos[1], 'a'), '2');
  assert.equal(t.pasos[2].nSalida, 1);
});

test('una línea que llama a una función vuelve a resaltarse cuando regresa', () => {
  const t = trazaDe('function f() {\n  return 1;\n}\nconsole.log(f());\nconsole.log(2);');
  assert.deepEqual(lineasDe(t), [4, 2, 4, 5, 0]);
  assert.deepEqual(t.pasos.map((p) => p.nSalida), [0, 0, 1, 2, 2]);
});

test('una llamada recursiva en la misma línea no se confunde con su efecto', () => {
  const t = trazaDe('function f(n) {\n  if (n === 0) return;\n  f(n - 1);\n}\nf(1);');
  assert.deepEqual(lineasDe(t), [5, 2, 3, 2, 3, 5, 0]);
});

test('trazar marca como recordada la variable de una función que ya terminó', () => {
  const t = trazaDe(`function crear() {
  let cuenta = 0;
  return function () {
    cuenta++;
    return cuenta;
  };
}
const contar = crear();
contar();
contar();`);
  const dentro = t.pasos.filter((p) => p.linea === 5);
  assert.deepEqual(dentro.map((p) => variable(p, 'cuenta')), ['1', '2']);
  assert.ok(dentro.every((p) => p.grupos.some((g) => g.recordada && g.etiqueta === 'crear')));
  // Mientras crear() corre, la variable todavía no es un recuerdo.
  const creando = t.pasos.find((p) => p.linea === 3) as PasoTraza;
  assert.ok(creando.grupos.every((g) => !g.recordada));
  // Afuera no se ve: solo reaparece dentro de la función que la recuerda.
  assert.equal(variable(t.pasos[t.pasos.length - 1], 'cuenta'), undefined);
});

test('trazar distingue var y let en un closure dentro de un ciclo', () => {
  const codigo = (tipo: string) => `const f = [];\nfor (${tipo} i = 0; i < 2; i++) {\n  f.push(() => i);\n}\nconsole.log(f[0]());\nconsole.log(f[1]());`;
  assert.deepEqual(trazaDe(codigo('var')).salida, ['2', '2']);
  const conLet = trazaDe(codigo('let'));
  assert.deepEqual(conLet.salida, ['0', '1']);
  assert.ok(conLet.pasos.some((p) => p.grupos.some((g) => g.etiqueta === 'for' && g.recordada)));
});

test('trazar conserva la salida de ejemplos con sintaxis variada', () => {
  const ejemplos = [
    'for (let i = 0; i < 2; i++) console.log(i);',
    'if (1 > 2) console.log("a"); else console.log("b");',
    'const f = () => ({ a: 1 });\nconsole.log(f());',
    'const g = (x) => (x, x + 1);\nconsole.log(g(1));',
    'for (const x of [1, 2]) console.log(x);',
    'for (const k in { a: 1 }) { console.log(k); }',
    'let n = 0;\nwhile (n < 2) n++;\ndo { n--; } while (n > 0);\nconsole.log(n);',
    'switch (1) {\n  case 1: { console.log("uno"); break; }\n  default: console.log("otro");\n}',
    'try { throw new Error("x"); } catch (e) { console.log(e.message); } finally { console.log("fin"); }',
    'class A {\n  constructor(n) { this.n = n; }\n  doble() { return this.n * 2; }\n}\nconsole.log(new A(2).doble());',
    'class B extends Array {\n  constructor() { super(); this.push(1); }\n}\nconsole.log(new B().length);',
    'function h(){return 1}console.log(h());',
    'const { a, b: [c] } = { a: 1, b: [2] };\nconsole.log(a, c);',
    'fuera: for (let i = 0; i < 3; i++) {\n  for (;;) { if (i === 1) break fuera; continue fuera; }\n}\nconsole.log("fin");',
    'function r(n) { return n <= 1 ? 1 : n * r(n - 1); }\nconsole.log(r(4));',
    'console.log(1); // comentario final',
  ];
  for (const codigo of ejemplos) assert.equal(trazaDe(codigo).salida.join('\n'), ejecutar(codigo).salida, codigo);
});

test('trazar conserva la salida de los guiones reales del canal', () => {
  const slugs = ['el-ciclo-for-en-javascript-explicado-facil', 'por-que-tu-for-da-una-vuelta-de-mas-o-de-menos', 'que-pasa-en-cada-vuelta-de-un-ciclo-for', 'closures-sin-misterio'];
  for (const slug of slugs) {
    for (const e of (leerGuion(slug) as any).escenas as EscenaCodigo[]) {
      const real = e.codigo ? ejecutar(e.codigo) : null;
      if (real && !real.timeout && !real.error) assert.equal(trazaDe(e.codigo as string).salida.join('\n'), real.salida);
    }
  }
});

test('trazar reporta lo que no puede seguir sin romperse', () => {
  assert.match(trazar('while (true) {}').error ?? '', /no termina|pasos/);
  assert.match(trazar('let i = 0;\nwhile (true) {\n  i++;\n}').error ?? '', /pasos/);
  assert.match(trazar('async function f() {}').error ?? '', /async/);
  assert.match(trazar('esto no es javascript').error ?? '', /SyntaxError/);
});

test('formatoValor nombra las funciones y resume objetos', () => {
  assert.equal(formatoValor(() => 1), 'función');
  assert.equal(formatoValor([() => 1, 2]), '[ƒ, 2]');
  assert.equal(formatoValor({ a: 'x' }), '{a: "x"}');
  const ciclo: any[] = [];
  ciclo.push(ciclo);
  assert.ok(formatoValor(ciclo).includes('…'));
  assert.equal(recortar('abc', 'x'.repeat(30)).length, 16);
});

const trazaSimple: Traza = { salida: [], pasos: [1, 2, 3, 2, 0].map((linea) => ({ linea, en: 'programa', grupos: [], nSalida: 0 })) };

test('tiemposDePasos reparte parejo sin marcas y siempre avanza', () => {
  const { tiempos, problemas } = tiemposDePasos(trazaSimple, [], 'Texto', 10, 1);
  assert.deepEqual(problemas, []);
  assert.equal(tiempos.length, 5);
  assert.equal(tiempos[0], 1);
  assert.ok(Math.abs(tiempos[4] - 9.6) < 1e-9);
  assert.ok(tiempos.every((t, i) => i === 0 || t > tiempos[i - 1]));
  assert.equal(pasoActual(tiempos, 0.5), -1);
  assert.equal(pasoActual(tiempos, 99), 4);
});

test('tiemposDePasos fija el paso cuando la voz dice la frase', () => {
  const narracion = 'uno dos tres cuatro';
  const palabras = narracion.split(' ').map((texto, i) => ({ texto, inicio: i * 2, fin: i * 2 + 1 }));
  const { tiempos, problemas } = tiemposDePasos(trazaSimple, [{ frase: 'tres', linea: 2, vez: 2 }], narracion, 8, 0, palabras);
  assert.deepEqual(problemas, []);
  assert.equal(tiempos[3], 4); // la segunda vez que corre la línea 2
});

test('tiemposDePasos reporta marcas que no sirven y no se rompe', () => {
  const { tiempos, problemas } = tiemposDePasos(
    trazaSimple,
    [
      { frase: 'no existe', linea: 1 },
      { frase: 'cuatro', linea: 9 },
      { frase: 'cuatro', linea: 3 },
      { frase: 'uno', linea: 2, vez: 2 },
    ],
    'uno dos tres cuatro',
    8,
    0,
  );
  assert.equal(problemas.length, 3);
  assert.ok(contiene(problemas, 'no está en la narración'));
  assert.ok(contiene(problemas, 'no se ejecuta'));
  assert.ok(contiene(problemas, 'fuera de orden'));
  assert.equal(tiempos.length, 5);
  assert.ok(tiempos.every((t) => Number.isFinite(t)));
});

test('verificarCodigo avisa sobre una marca rota en una escena animada', () => {
  const avisos = verificarCodigo([escena({ codigo: 'console.log(1);', salida: '1', depurar: { marcas: [{ frase: 'nada', linea: 1 }] } })], false, [5]);
  assert.ok(contiene(avisos, 'no está en la narración'));
});

test('parsearGuion conserva la portada opcional', () => {
  const g: any = parsearGuion({
    canal: 'codigo',
    lenguaje: 'javascript',
    slug: 'prueba',
    tema: 'Prueba',
    gancho: { titulo: 'a', narracion: 'b' },
    cierre: { titulo: 'a', narracion: 'b' },
    descripcion: '',
    hashtags: [],
    escenas: [1, 2, 3].map(() => ({ titulo: 'a', narracion: 'b' })),
    portada: { frase: 'Entiéndelo de una vez' },
  });
  assert.equal(g.portada.frase, 'Entiéndelo de una vez');
});

const guionCodigo = (extra: any = {}) => ({
  canal: 'codigo',
  lenguaje: 'javascript',
  slug: 'prueba',
  tema: 'Prueba',
  gancho: { titulo: 'a', narracion: 'b' },
  cierre: { titulo: 'a', narracion: 'b' },
  descripcion: '',
  hashtags: [],
  escenas: [1, 2, 3].map(() => ({ titulo: 'a', narracion: 'b' })),
  ...extra,
});

test('momentosClave estima por posición en el texto y respeta el orden', () => {
  const m = momentosClave(['Frontend', 'Backend', 'nada'], 'Primero el Frontend y luego el Backend.', 10);
  assert.ok(m[0].ok && m[1].ok && !m[2].ok);
  assert.ok(m[0].t < m[1].t && m[1].t <= m[2].t);
});

test('momentosClave usa los tiempos reales de la voz y tolera acentos y signos', () => {
  const palabras = ['Usa', 'Node.js', 'y', 'después', 'Imágenes.'].map((texto, i) => ({ texto, inicio: i, fin: i + 0.5 }));
  const m = momentosClave(['node', 'imagenes'], 'Usa Node.js y después Imágenes.', 5, palabras);
  assert.deepEqual(m.map((x) => x.t), [1, 4]);
});

test('parsearGuion acepta un visual y rechaza codigo y visual en la misma escena', () => {
  const visual = { tipo: 'suma', partes: [{ texto: 'A' }, { texto: 'B' }], resultado: { texto: 'C', icono: 'capas' } };
  const ok: any = parsearGuion(guionCodigo({ escenas: [1, 2, 3].map(() => ({ titulo: 'a', narracion: 'A B C', visual })) }));
  assert.equal(ok.escenas[0].visual.tipo, 'suma');
  assert.throws(() => parsearGuion(guionCodigo({ escenas: [1, 2, 3].map(() => ({ titulo: 'a', narracion: 'b', codigo: 'let a;', visual })) })));
});

test('verificarVisuales avisa si un elemento no se nombra en la narración', () => {
  const g: any = parsearGuion(
    guionCodigo({ gancho: { titulo: 'a', narracion: 'Solo Frontend', visual: { tipo: 'versus', lados: [{ texto: 'Frontend' }, { texto: 'Backend' }] } } }),
  );
  const avisos = verificarVisuales(g);
  assert.equal(avisos.length, 1);
  assert.ok(contiene(avisos, '"Backend"'));
});

test('golpesDeCamara ordena, descarta los de fuera y los demasiado juntos', () => {
  assert.deepEqual(golpesDeCamara([3, 1, 1.5, 0.1, 9.9, Infinity], 10), [1, 3]);
  assert.deepEqual(golpesDeCamara([1, 1 + SEPARACION_MIN], 10), [1, 1 + SEPARACION_MIN]);
});

test('zoomCamara entra acercada, se asienta, avanza lento y golpea en los momentos clave', () => {
  const cerca = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);
  cerca(zoomCamara(0, 10, []), 1 + ZOOM_ENTRADA);
  cerca(zoomCamara(10, 10, []), 1 + ZOOM_LENTO);
  cerca(zoomCamara(5.12, 10, [5]) - zoomCamara(5.12, 10, []), ZOOM_GOLPE);
  cerca(zoomCamara(7, 10, [5]), zoomCamara(7, 10, []));
});

test('visiblesPorLinea teclea en orden y lineaDelCursor sigue al tecleo', () => {
  const lineas = ['abcd', '', 'ef'];
  assert.deepEqual(visiblesPorLinea(lineas, 0, 0, 6), [0, 0, 0]);
  assert.deepEqual(visiblesPorLinea(lineas, 3, 0, 6), [3, 0, 0]);
  assert.deepEqual(visiblesPorLinea(lineas, 5, 0, 6), [4, 0, 1]);
  assert.deepEqual(visiblesPorLinea(lineas, 99, 0, 6), [4, 0, 2]);
  assert.equal(lineaDelCursor(lineas, [3, 0, 0]), 0);
  assert.equal(lineaDelCursor(lineas, [4, 0, 1]), 2);
  assert.equal(lineaDelCursor(lineas, [4, 0, 2]), 2);
  assert.deepEqual(iniciosDeLinea(lineas, 1, 6), [1, 5, 5]);
  assert.equal(momentosDeTecla(lineas, 0, 6).length, 2);
});

test('duracionTecleo crece con el código pero respeta el máximo', () => {
  assert.ok(duracionTecleo(10, 2.5) < duracionTecleo(60, 2.5));
  assert.equal(duracionTecleo(1000, 2.5), 2.5);
});

test('palabrasClave toma nombres del código, del diagrama y del título, sin comentarios ni cadenas', () => {
  const claves = palabrasClave({ titulo: 'Cuándo usar while', codigo: ['let total = 0; // suma', 'console.log("hola mundo");'].join('\n') });
  assert.ok(esClave('total,', claves));
  assert.ok(esClave('While', claves));
  assert.ok(esClave('console', claves));
  assert.ok(!esClave('suma', claves));
  assert.ok(!esClave('hola', claves));
  assert.ok(!esClave('cuándo', claves));
  const visual = palabrasClave({ titulo: 'x', visual: { tipo: 'versus', lados: [{ texto: 'Frontend' }, { texto: 'Backend' }] } });
  assert.ok(esClave('frontends', visual));
});

test('recorrido: la cámara abre en plano general, llega a cada paso al nombrarlo y cierra en general', () => {
  const g = geometria(3, false, true);
  const tm = tiemposRecorrido([1, 3, 5, 6], 3, false, true);
  const llaves = llavesCamara(g, tm, 8, 1080, 940);
  for (let k = 1; k < llaves.length; k++) assert.ok(llaves[k].t > llaves[k - 1].t, 'llaves en orden');
  assert.deepEqual(camaraEn(llaves, 0), planoGeneral(g, 1080, 940));
  assert.deepEqual(camaraEn(llaves, tm.llegadas[1]), planoCerrado(g, 1, 940));
  assert.deepEqual(camaraEn(llaves, 7.9), planoGeneral(g, 1080, 940));
  // El paquete llega al final del tramo justo cuando se nombra el paso
  const p = paqueteEn(g, tm, tm.llegadas[2]);
  assert.equal(p?.p, 1);
  assert.equal(paqueteEn(g, tm, 0.5), null);
});

test('recorrido: momentos repetidos o fuera de orden no rompen los tiempos', () => {
  const tm = tiemposRecorrido([2, 2, 2], 3, false, false);
  assert.ok(tm.llegadas[1] > tm.llegadas[0] && tm.llegadas[2] > tm.llegadas[1]);
  assert.ok(tm.salidas.slice(1).every((s: number, i: number) => s < tm.llegadas[i + 1] && Number.isFinite(s)));
  const ok: any = parsearGuion(
    guionCodigo({ escenas: [1, 2, 3].map(() => ({ titulo: 'a', narracion: 'A B', visual: { tipo: 'recorrido', pasos: [{ texto: 'A' }, { texto: 'B' }] } })) }),
  );
  assert.equal(ok.escenas[0].visual.tipo, 'recorrido');
});

test('red, cascada y verificar: se validan y dan sus claves en orden', () => {
  const red = { tipo: 'red', centro: { texto: 'Centro' }, nodos: [{ texto: 'A' }, { texto: 'B' }], falla: { texto: 'Cae', clave: 'se cae' } };
  const cascada = { tipo: 'cascada', fichas: [{ texto: 'Uno' }, { texto: 'Dos' }], final: { texto: 'Fin' } };
  const verificar = {
    tipo: 'verificar',
    items: [
      { texto: 'Rumor', veredicto: 'falso', claveVeredicto: 'mentira' },
      { texto: 'Hecho', veredicto: 'confirmado', claveVeredicto: 'cierto' },
    ],
  };
  const g: any = parsearGuion(
    guionCodigo({
      escenas: [
        { titulo: 'a', narracion: 'El Centro llama a A y a B, y luego se cae.', visual: red },
        { titulo: 'a', narracion: 'Uno empuja a Dos y al Fin.', visual: cascada },
        { titulo: 'a', narracion: 'Rumor: mentira. Hecho: cierto.', visual: verificar },
      ],
    }),
  );
  assert.deepEqual(clavesDe(g.escenas[0].visual), ['Centro', 'A', 'B', 'se cae']);
  assert.deepEqual(clavesDe(g.escenas[1].visual), ['Uno', 'Dos', 'Fin']);
  assert.deepEqual(clavesDe(g.escenas[2].visual), ['Rumor', 'mentira', 'Hecho', 'cierto']);
  assert.deepEqual(verificarVisuales(g), []);
  const malo = { ...verificar, items: [{ texto: 'X', veredicto: 'quizas', claveVeredicto: 'x' }, verificar.items[0]] };
  assert.throws(() => parsearGuion(guionCodigo({ escenas: [1, 2, 3].map(() => ({ titulo: 'a', narracion: 'b', visual: malo })) })));
});

// ── Animaciones por concepto: ciclo ──

test('calcularCiclo sigue un for: valor en cada revisión, cuándo entra y qué imprime', () => {
  const { calculado } = calcularCiclo('for (let i = 3; i > 0; i--) {\n  console.log(i);\n}\nconsole.log("fin");');
  assert.ok(calculado);
  assert.equal(calculado.variable, 'i');
  assert.deepEqual(calculado.partes, { inicio: 'let i = 3', condicion: 'i > 0', cambio: 'i--' });
  assert.deepEqual(calculado.vueltas.map((v) => v.valor), ['3', '2', '1', '0']);
  assert.deepEqual(calculado.vueltas.map((v) => v.entra), [true, true, true, false]);
  assert.deepEqual(calculado.vueltas.map((v) => v.salidas), [[0], [1], [2], []]);
  assert.equal(calculado.infinito, false);
});

test('calcularCiclo entiende cuerpos vacíos, while, otras variables y break', () => {
  const vacio = calcularCiclo('for (let i = 0; i < 3; i++) {\n  // nada\n}').calculado!;
  assert.deepEqual(vacio.vueltas.map((v) => v.entra), [true, true, true, false]);
  const mientras = calcularCiclo('let n = 2;\nwhile (n > 0) {\n  n--;\n}').calculado!;
  assert.equal(mientras.tipo, 'while');
  assert.equal(mientras.variable, 'n');
  assert.deepEqual(mientras.vueltas.map((v) => v.valor), ['2', '1', '0']);
  const suma = calcularCiclo('let suma = 0;\nfor (let i = 1; i <= 2; i++) {\n  suma += i;\n}').calculado!;
  assert.deepEqual(suma.vueltas[1].otras, [{ nombre: 'suma', valor: '3' }]);
  const corte = calcularCiclo('for (let i = 0; i < 9; i++) {\n  if (i === 1) break;\n}').calculado!;
  assert.equal(corte.vueltas.length, 2);
  assert.ok(corte.vueltas.every((v) => v.entra));
});

test('calcularCiclo anima las primeras vueltas de un bucle infinito', () => {
  const { calculado } = calcularCiclo('for (let i = 0; i < 5; i--) {\n  console.log(i);\n}');
  assert.ok(calculado?.infinito);
  assert.deepEqual(calculado!.vueltas.slice(0, 3).map((v) => v.valor), ['0', '-1', '-2']);
  assert.ok(calculado!.vueltas.every((v) => v.entra));
});

test('calcularCiclo explica por qué no puede animar', () => {
  assert.match(calcularCiclo('console.log(1);').error!, /no tiene un ciclo/);
  assert.match(calcularCiclo('for (let i = 0; i < 2; i++) console.log(i);').error!, /misma línea/);
});

test('trazar con parcial devuelve los pasos de un código que no termina', () => {
  assert.equal(trazar('for (let i = 0; i < 5; i--) {}').traza, undefined);
  const r = trazar('for (let i = 0; i < 5; i--) {}', { parcial: true });
  assert.ok(r.incompleta && r.traza!.pasos.length > 10);
});

test('verificarCodigo compara los datos de la animación con el código', () => {
  const codigo = 'for (let i = 1; i <= 3; i++) {\n  console.log(i);\n}';
  const bien = escena({ codigo, salida: '1\n2\n3', animacion: { tipo: 'ciclo', datos: { variable: 'i', vueltas: 3 } } });
  assert.deepEqual(verificarCodigo([bien], false), []);
  const mal = escena({ codigo, salida: '1\n2\n3', animacion: { tipo: 'ciclo', datos: { variable: 'j', vueltas: 4 } } });
  const avisos = verificarCodigo([mal], false);
  assert.ok(contiene(avisos, 'usa "i"'));
  assert.ok(contiene(avisos, 'el código da 3'));
  const clave = escena({ codigo, salida: '1\n2\n3', narracion: 'Empieza en uno.', animacion: { tipo: 'ciclo', datos: { claves: { cambio: 'aumenta' } } } });
  assert.ok(contiene(verificarCodigo([clave], false), 'la clave "aumenta"'));
  const sinCiclo = escena({ codigo: 'console.log(1);', salida: '1', animacion: { tipo: 'ciclo' } });
  assert.ok(contiene(verificarCodigo([sinCiclo], false), 'no se puede animar'));
});

test('con animación, el código largo hace viajar a la cámara en vez de encogerse o desbordar', () => {
  const largo = Array.from({ length: 7 }, (_, k) => `let v${k} = ${k};`).join('\n') + '\nfor (let i = 0; i < 2; i++) {\n  v0++;\n}';
  assert.deepEqual(verificarCodigo([escena({ codigo: largo, animacion: { tipo: 'ciclo' } })], false), []);
  const m = medidasEditor(largo.split('\n'), 0, true);
  assert.ok(m.viaja && !m.desborda && m.fs >= 38);
  const corto = medidasEditor(['for (let i = 0; i < 3; i++) {', '  x++;', '}'], 0, true);
  assert.equal(corto.viaja, false);
});

test('la cámara del escenario se queda quieta si todo cabe y viaja si no', () => {
  const cabe = mundoDe(400, 380, 26);
  assert.equal(viaja(cabe), false);
  assert.equal(encuadre(cabe, 'abajo').dy, 0);
  assert.ok(encuadre(cabe, 'abajo').escala > 1);
  const largo = mundoDe(760, 380, 26);
  assert.ok(viaja(largo));
  assert.equal(encuadre(largo, 'editor').dy, 0);
  assert.equal(encuadre(largo, 'abajo').dy, ALTO_VENTANA - largo.alto);
  const tomas = limpiarTomas([{ t: 0, foco: 'editor' }, { t: 3, foco: 'abajo' }, { t: 3.4, foco: 'todo' }, { t: 9, foco: 'abajo' }], 10);
  assert.deepEqual(tomas.map((x) => [x.t, x.foco]), [[0, 'editor'], [3, 'todo'], [9, 'abajo']]);
  const medio = camaraEscenario(largo, [{ t: 0, foco: 'editor' }, { t: 2, foco: 'abajo' }], 2 + TRANSICION / 2);
  assert.ok(medio.dy < 0 && medio.dy > encuadre(largo, 'abajo').dy);
  assert.equal(pesoFoco([{ t: 0, foco: 'editor' }, { t: 2, foco: 'abajo' }], 5, 'editor'), 0);
});

test('parsearGuion acepta la animación opcional y la rechaza sin código', () => {
  const base = leerGuion('el-ciclo-for-en-javascript-explicado-facil') as GuionCodigo;
  const con = parsearGuion({ ...base, escenas: base.escenas.map((e, i) => (i === 0 ? { ...e, animacion: { tipo: 'ciclo' } } : e)) });
  assert.equal((con as GuionCodigo).escenas[0].animacion?.tipo, 'ciclo');
  const sinCodigo = { ...base, escenas: base.escenas.map((e, i) => (i === 0 ? { titulo: e.titulo, narracion: e.narracion, animacion: { tipo: 'ciclo' } } : e)) };
  assert.throws(() => parsearGuion(sinCodigo));
});

test('momentosPartes usa las palabras de la voz, respeta el orden y escalona lo que no se dice', () => {
  const narracion = 'Empiezas en cinco. La condición dice mayor que cero. Y le resta uno en cada vuelta.';
  const palabras = narracion.split(' ').map((texto, k) => ({ texto, inicio: k * 0.5, fin: k * 0.5 + 0.4 }));
  const p = momentosPartes(undefined, narracion, 10, palabras, 0);
  assert.equal(p.inicio, 0.1); // momentosClave nunca da menos de 0.1 s
  assert.equal(p.condicion, 2);
  assert.equal(p.cambio, 5.5);
  const nada = momentosPartes(undefined, 'Mira esto.', 10, undefined, 1);
  assert.deepEqual(nada, { inicio: 1, condicion: 1.35, cambio: 1.7 });
});

test('vueltasDeConsola ancla cada vuelta a su línea de consola y sale después de la última', () => {
  const c = calcularCiclo('for (let i = 1; i <= 3; i++) {\n  console.log(i);\n}').calculado!;
  const tc = vueltasDeConsola(c, (i) => 4 + i, 3, 3, 9);
  assert.deepEqual(tc.vueltas.slice(0, 3).map((v) => v.cuerpo), [4, 5, 6]);
  assert.ok(tc.vueltas.every((v, k) => k === 0 || v.revision > tc.vueltas[k - 1].revision));
  assert.ok(tc.salida! > 6 && tc.salida! < 7);
  assert.equal(tc.desboque, null);
});

test('el marcador da una vuelta completa por iteración y el valor cambia con la variable', () => {
  const c = calcularCiclo('for (let i = 1; i <= 2; i++) {\n  console.log(i);\n}').calculado!;
  const tc = { partes: { inicio: 0, condicion: 0, cambio: 0 }, ...vueltasDeConsola(c, (i) => 2 + i * 2, 2, 1, 8) };
  const v0 = tc.vueltas[0];
  assert.equal(anguloMarcador(tc, v0.revision).angulo, 0);
  assert.equal(Math.round(anguloMarcador(tc, v0.cuerpo!).angulo), 90);
  const casiFin = anguloMarcador(tc, tc.vueltas[1].revision - 0.01).angulo;
  assert.ok(casiFin > 300 && casiFin <= 360);
  assert.equal(valorVisible(tc, v0.cambio! - 0.01), 0);
  assert.equal(valorVisible(tc, v0.cambio! + 0.01), 1);
});

test('planCiclo usa los pasos reales del depurador cuando la escena tiene depurar', () => {
  const g = agregarTrazas(leerGuion('el-ciclo-for-animado') as GuionCodigo);
  const e = g.escenas[1];
  assert.ok(e.traza && e.animacion?.calculado);
  const plan = planCiclo(e, 19.15)!;
  const { tiempos } = tiemposDePasos(e.traza!, e.depurar!.marcas!, e.narracion, 19.15, inicioDePasos(3));
  assert.deepEqual(plan.vueltas.map((v) => v.revision), (e.animacion!.calculado as CicloCalculado).vueltas.map((v) => tiempos[v.revision]));
  assert.ok(plan.partes.cambio <= plan.vueltas[0].revision);
});

test('los guiones de muestra con animación no dan avisos', () => {
  for (const slug of ['el-ciclo-for-animado', 'contar-hacia-atras-animado']) {
    const g = leerGuion(slug) as GuionCodigo;
    assert.deepEqual(verificarCodigo(g.escenas, false), [], slug);
  }
});

// ── Animaciones paso a paso: variable, arreglo, condición, función y objeto ──

test('partesDeNivel, elementosDe y propiedadesDe leen los valores de la traza sin cortar dentro de comillas', () => {
  assert.deepEqual(partesDeNivel('1, [2, 3], "a, b"'), ['1', '[2, 3]', '"a, b"']);
  assert.deepEqual(elementosDe('["pan", "té"]'), ['"pan"', '"té"']);
  assert.equal(elementosDe('3'), null);
  assert.deepEqual(propiedadesDe('{a: 1, b: {c: 2}}'), [
    { clave: 'a', valor: '1' },
    { clave: 'b', valor: '{c: 2}' },
  ]);
});

test('calcularVariable registra cuándo entra y cambia cada valor, y cuándo sale', () => {
  const c = calcularVariable('let edad = 20;\nedad = edad + 1;\nconst nombre = "Ana";').calculado!;
  assert.deepEqual(
    c.cajas.map((x) => [x.nombre, x.declaracion, x.cambios.map((k) => k.valor)]),
    [
      ['edad', 'let', ['20', '21']],
      ['nombre', 'const', ['"Ana"']],
    ],
  );
  const bloque = calcularVariable('{\n  let x = 1;\n}\nconsole.log("fuera");', { variables: ['x'] }).calculado!;
  assert.ok(bloque.cajas[0].sale !== undefined);
  assert.match(calcularVariable('let a = 1;', { variables: ['b'] }).error!, /no declara "b"/);
});

test('calcularArreglo conserva cada casilla en push, pop, shift y unshift, y sigue la casilla que se lee', () => {
  const c = calcularArreglo('const f = ["a", "b"];\nf.push("c");\nf.shift();\nf.unshift("z");\nf.pop();\nconsole.log(f[1]);').calculado!;
  assert.deepEqual(c.estados.map((e) => e.accion), ['crea', 'push', 'shift', 'unshift', 'pop']);
  assert.deepEqual(c.estados[2].celdas.map((x) => x.id), [1, 2]);
  assert.deepEqual(c.estados[4].celdas.map((x) => x.valor), ['"z"', '"b"']);
  assert.equal(c.foco[c.foco.length - 2], 1);
  const deOf = calcularArreglo('const n = [3, 5];\nfor (const x of n) {\n  console.log(x);\n}\nconsole.log("fin");').calculado!;
  assert.deepEqual(deOf.foco, [null, 0, 0, 1, 1, null, null]);
});

test('calcularCondicion registra cada evaluación con su rama y sus valores', () => {
  const c = calcularCondicion('for (let i = 0; i < 3; i++) {\n  if (i % 2 === 0) {\n    console.log(i);\n  }\n}').calculado!;
  assert.deepEqual(c.evaluaciones.map((e) => [e.rama, e.sustituida]), [
    ['si', '0 % 2 === 0'],
    ['no', '1 % 2 === 0'],
    ['si', '2 % 2 === 0'],
  ]);
  assert.equal(c.si, 'imprime i');
  assert.equal(c.no, null);
  const conElse = calcularCondicion('const e = 15;\nif (e >= 18) {\n  console.log("sí");\n} else {\n  console.log("no");\n}').calculado!;
  assert.equal(conElse.evaluaciones[0].rama, 'no');
  assert.equal(conElse.no, 'imprime "no"');
});

test('calcularFuncion registra argumentos y resultado de cada llamada', () => {
  const c = calcularFuncion('function sumar(a, b) {\n  return a + b;\n}\nconsole.log(sumar(2, 3));\nconst r = sumar(10, 5);').calculado!;
  assert.deepEqual(c.parametros, ['a', 'b']);
  assert.deepEqual(c.llamadas.map((l) => [l.argumentos, l.resultado]), [
    [['2', '3'], '5'],
    [['10', '5'], '15'],
  ]);
  assert.ok(c.llamadas.every((l) => l.sale > l.entra));
  const flecha = calcularFuncion('const doble = (n) => n * 2;\nconsole.log(doble(4));').calculado!;
  assert.equal(flecha.llamadas[0].resultado, '8');
  assert.match(calcularFuncion('function f() {}').error!, /nunca se llama/);
});

test('calcularObjeto sigue propiedades nuevas, cambios y lecturas (no escrituras)', () => {
  const c = calcularObjeto('const p = { nombre: "Rex", edad: 3 };\np.edad = 4;\np.raza = "pug";\nconsole.log(p.nombre);').calculado!;
  assert.deepEqual(c.estados.map((e) => e.props.map((x) => `${x.clave}=${x.valor}`).join(' ')), [
    'nombre="Rex" edad=3',
    'nombre="Rex" edad=4',
    'nombre="Rex" edad=4 raza="pug"',
  ]);
  assert.deepEqual(c.accesos.slice(0, 4), [null, null, null, 'nombre']);
});

test('verificarCodigo compara los datos escritos de cada tipo con la ejecución', () => {
  const avisos = (codigo: string, animacion: EscenaCodigo['animacion'], salida?: string) =>
    verificarCodigo([escena({ codigo, salida, animacion, narracion: 'Mira esto.' })], false);
  assert.ok(contiene(avisos('const e = 15;\nif (e >= 18) {\n  e;\n}', { tipo: 'condicion', datos: { rama: 'si' } }), 'toma "no"'));
  assert.ok(contiene(avisos('const f = (n) => n * 2;\nf(2);', { tipo: 'funcion', datos: { resultado: '5' } }), 'devuelve 4'));
  assert.ok(contiene(avisos('const p = { a: 1 };', { tipo: 'objeto', datos: { propiedades: ['b'] } }), 'nunca tiene "b"'));
  assert.ok(contiene(avisos('let n = 1;', { tipo: 'arreglo' }), 'no tiene un arreglo'));
  assert.ok(contiene(avisos('let n = 1;', { tipo: 'variable', datos: { claves: ['ausente'] } }), 'la clave "ausente"'));
});

test('tiemposPorPasos reparte por peso, respeta las anclas y nunca retrocede', () => {
  const pasos = [0, 0, 0, 1, 1, 2].map((s, i) => ({ l: i + 1, s }));
  const libre = tiemposPorPasos(pasos, [3], [], 1, 6);
  assert.equal(libre[0], 1);
  assert.equal(libre[5], 6);
  assert.ok(libre.every((t, i) => i === 0 || t >= libre[i - 1]));
  // El evento y las líneas impresas pesan más que los pasos de trámite
  assert.ok(libre[4] - libre[3] > libre[2] - libre[1]);
  // Un ancla que retrocede en el tiempo se ignora
  const anclado = tiemposPorPasos(pasos, [3], [{ paso: 3, t: 5 }, { paso: 4, t: 4 }], 1, 6);
  assert.equal(anclado[3], 5);
  assert.ok(anclado[2] < 5 && anclado[4] > 5);
  assert.deepEqual(lineasDeConsola(pasos, libre, 2), [libre[3], libre[5]]);
});

test('anclasDeClaves une cada clave con su evento cuando la voz la dice', () => {
  const narracion = 'Primero guardas veinte y luego cambia a veinticinco.';
  const palabras = narracion.split(' ').map((texto, k) => ({ texto, inicio: k, fin: k + 0.5 }));
  assert.deepEqual(anclasDeClaves([0, 1], ['veinte', 'cambia a'], narracion, 10, palabras), [
    { paso: 0, t: 2 },
    { paso: 1, t: 5 },
  ]);
  assert.deepEqual(anclasDeClaves([0], ['no aparece'], narracion, 10, palabras), []);
});

test('planAnimacion arma los tiempos de un tipo paso a paso y la consola sale en el paso que imprime', () => {
  const g = agregarTrazas(leerGuion('animaciones-muestra') as GuionCodigo);
  const e = g.escenas[3];
  const plan = planAnimacion(e, 8)!;
  assert.ok(plan.tiempos && !plan.ciclo);
  const c = (e.animacion!.calculado as FuncionCalculada);
  const ritmo = ritmoConAnimacion(e, 8)!;
  const primeraImpresion = c.pasos.findIndex((p) => p.s > 0);
  assert.equal(ritmo.lineas![0], plan.tiempos![primeraImpresion]);
  assert.ok(plan.aparece <= plan.tiempos![0]);
});

test('parsearGuion acepta los seis tipos y rechaza datos mal formados', () => {
  const g = leerGuion('animaciones-muestra') as GuionCodigo;
  assert.deepEqual(g.escenas.map((e) => e.animacion?.tipo), ['variable', 'arreglo', 'condicion', 'funcion', 'objeto']);
  const malo = { ...g, escenas: g.escenas.map((e, i) => (i === 2 ? { ...e, animacion: { tipo: 'condicion', datos: { rama: 'quizas' } } } : e)) };
  assert.throws(() => parsearGuion(malo));
});

test('los guiones de muestra de la fase 2 no dan avisos', () => {
  for (const slug of ['animaciones-muestra', '5-conceptos-animado', 'api-animado']) {
    const g = leerGuion(slug) as GuionCodigo;
    assert.deepEqual(verificarCodigo(g.escenas, false), [], slug);
  }
});
