/** Pruebas sin red ni créditos. Uso: npm test */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { medidasEditor } from '../src/medidas';
import { agruparPalabras, indiceActual, palabrasDeAlineacion } from '../src/subtitulos';
import { momentosClave } from '../src/momentos';
import { golpesDeCamara, SEPARACION_MIN, ZOOM_ENTRADA, ZOOM_GOLPE, ZOOM_LENTO, zoomCamara } from '../src/camara';
import { EscenaCodigo } from '../src/types';
import { conReintentos, ejecutar, parsearGuion, slugify, verificarCodigo, verificarVisuales } from './lib';

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
