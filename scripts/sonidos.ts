/**
 * Crea los sonidos del editor en public/sfx. Son sintetizados aquí mismo, así que no dependen de ninguna licencia.
 * Uso: npm run sonidos
 * Para usarlos: "sonidos": true en config/marca-codigo.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RAIZ } from './lib';

const MUESTRAS = 44100;

const wav = (muestras: number[]) => {
  const datos = Buffer.alloc(muestras.length * 2);
  muestras.forEach((m, i) => datos.writeInt16LE(Math.round(Math.max(-1, Math.min(1, m)) * 32767), i * 2));
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0);
  cab.writeUInt32LE(36 + datos.length, 4);
  cab.write('WAVEfmt ', 8);
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20); // PCM
  cab.writeUInt16LE(1, 22); // mono
  cab.writeUInt32LE(MUESTRAS, 24);
  cab.writeUInt32LE(MUESTRAS * 2, 28);
  cab.writeUInt16LE(2, 32);
  cab.writeUInt16LE(16, 34);
  cab.write('data', 36);
  cab.writeUInt32LE(datos.length, 40);
  return Buffer.concat([cab, datos]);
};

const generar = (seg: number, f: (t: number) => number) => Array.from({ length: Math.round(seg * MUESTRAS) }, (_, i) => f(i / MUESTRAS));

// Semilla fija: el archivo sale idéntico cada vez
let semilla = 1;
const ruido = () => {
  semilla = (semilla * 16807) % 2147483647;
  return semilla / 1073741823.5 - 1;
};

const tecla = generar(0.04, (t) => ruido() * Math.exp(-t * 170));
const resultado = generar(0.13, (t) => {
  const tono = t < 0.055 ? 880 : 1175;
  return Math.sin(2 * Math.PI * tono * t) * Math.exp(-(t < 0.055 ? t : t - 0.055) * 32) * 0.7;
});

// Ruido filtrado que se abre y se cierra: el "fuuush" de las transiciones.
// Va después de los otros para no cambiar la secuencia de ruido de la tecla.
const DUR_WHOOSH = 0.4;
let filtrado = 0;
const whoosh = generar(DUR_WHOOSH, (t) => {
  const p = t / DUR_WHOOSH;
  const forma = Math.sin(Math.PI * p);
  filtrado += (0.03 + 0.3 * forma) * (ruido() - filtrado);
  return filtrado * forma ** 2 * 1.8;
});

// Burbuja: un tono que cae rápido. Para cada elemento que aparece en un diagrama.
const pop = generar(0.09, (t) => {
  const fase = 2 * Math.PI * (650 * t - 2200 * t * t); // de 650 Hz hacia abajo
  return Math.sin(fase) * Math.exp(-t * 45) * 0.8;
});

// Éxito: arpegio do–mi–sol con un brillo encima. Cuando la consola termina.
const NOTAS = [1047, 1319, 1568];
const exito = generar(0.5, (t) =>
  NOTAS.reduce((a, f, i) => {
    const t0 = i * 0.075;
    if (t < t0) return a;
    const dt = t - t0;
    return a + (Math.sin(2 * Math.PI * f * dt) + 0.3 * Math.sin(4 * Math.PI * f * dt)) * Math.exp(-dt * 9) * 0.28;
  }, 0),
);

// ── Sonidos de las animaciones (fase 6). Van al final para no cambiar la secuencia de ruido de los anteriores ──

// Vuelta: un clic de madera corto, para cada revisión de un ciclo
const vuelta = generar(0.06, (t) => (Math.sin(2 * Math.PI * 1900 * t) * 0.6 + ruido() * 0.25) * Math.exp(-t * 90));

// Rama: dos notas que suben (la condición decidió). Para cada evaluación de un if
const rama = generar(0.22, (t) => {
  const f = t < 0.08 ? 660 : 990;
  const dt = t < 0.08 ? t : t - 0.08;
  return Math.sin(2 * Math.PI * f * dt) * Math.exp(-dt * 22) * 0.55;
});

// Caída: un golpe grave y suave, cuando un valor aterriza en su caja o una casilla cae
const caida = generar(0.18, (t) => {
  const fase = 2 * Math.PI * (180 * t - 260 * t * t);
  return (Math.sin(fase) * 0.8 + ruido() * 0.12) * Math.exp(-t * 26);
});

// Morph: un barrido que sube con brillo, para la pieza que viaja entre escenas
const DUR_MORPH = 0.45;
const morph = generar(DUR_MORPH, (t) => {
  const p = t / DUR_MORPH;
  const fase = 2 * Math.PI * (300 * t + (1500 * t * t * t) / (3 * DUR_MORPH * DUR_MORPH));
  const forma = Math.sin(Math.PI * p);
  return (Math.sin(fase) * 0.35 + Math.sin(fase * 2.01) * 0.12) * forma;
});

// Brillo: campanitas agudas al azar (con semilla), para las explosiones de partículas
const NOTAS_BRILLO = [2093, 2637, 3136, 3520, 4186];
const toques = Array.from({ length: 7 }, (_, i) => ({ t0: i * 0.045 + ((ruido() + 1) / 2) * 0.02, f: NOTAS_BRILLO[Math.floor(((ruido() + 1) / 2) * NOTAS_BRILLO.length) % NOTAS_BRILLO.length] }));
const brillo = generar(0.6, (t) =>
  toques.reduce((a, { t0, f }) => (t < t0 ? a : a + Math.sin(2 * Math.PI * f * (t - t0)) * Math.exp(-(t - t0) * 14) * 0.13), 0),
);

const dir = path.join(RAIZ, 'public', 'sfx');
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, 'tecla.wav'), wav(tecla));
writeFileSync(path.join(dir, 'resultado.wav'), wav(resultado));
writeFileSync(path.join(dir, 'whoosh.wav'), wav(whoosh));
writeFileSync(path.join(dir, 'pop.wav'), wav(pop));
writeFileSync(path.join(dir, 'exito.wav'), wav(exito));
writeFileSync(path.join(dir, 'vuelta.wav'), wav(vuelta));
writeFileSync(path.join(dir, 'rama.wav'), wav(rama));
writeFileSync(path.join(dir, 'caida.wav'), wav(caida));
writeFileSync(path.join(dir, 'morph.wav'), wav(morph));
writeFileSync(path.join(dir, 'brillo.wav'), wav(brillo));
console.log('✔ Sonidos en public/sfx. Actívalos con "sonidos": true en config/marca-codigo.json');
