/** Pruebas sin red ni créditos. Uso: npm test */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pasoActual, recortar, tiemposDePasos } from '../src/depurador';
import { medidasEditor } from '../src/medidas';
import { agruparPalabras, indiceActual, palabrasDeAlineacion } from '../src/subtitulos';
import { EscenaCodigo, PasoTraza, Traza } from '../src/types';
import { conReintentos, ejecutar, leerGuion, parsearGuion, slugify, verificarCodigo } from './lib';
import { formatoValor, trazar } from './traza';

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
