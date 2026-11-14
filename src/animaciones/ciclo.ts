/**
 * Tiempos de la animación del ciclo, sin React, para poder probarlos.
 * Cada vuelta tiene cuatro momentos: se revisa la condición (arriba de la pista), corre el cuerpo
 * (a la derecha), cambia la variable (abajo a la izquierda) y vuelve a revisar.
 */
import { momentosClave } from '../momentos';
import { CicloCalculado, ClavesCiclo, Palabra } from '../types';

export type MomentosVuelta = {
  revision: number;
  /** Cuando corre el cuerpo; null si la condición no dejó entrar. */
  cuerpo: number | null;
  /** Cuando la variable cambia (después del cuerpo). */
  cambio: number | null;
};

export type TiemposCiclo = {
  partes: { inicio: number; condicion: number; cambio: number };
  vueltas: MomentosVuelta[];
  /** Cuando sale del ciclo (la revisión que dio falso); null si no sale. */
  salida: number | null;
  /** En un bucle infinito: desde cuándo la pista se acelera sin fin. */
  desboque: number | null;
};

/** Palabras que suelen anunciar cada parte, si el guion no da las suyas. */
export const CANDIDATAS: Record<keyof Omit<ClavesCiclo, 'vueltas'>, string[]> = {
  inicio: ['empieza', 'empiezas', 'empezamos', 'empezar', 'comienza', 'inicia', 'arranca'],
  condicion: ['condicion', 'mientras'],
  // "suma" no: suele aparecer como "en lugar de sumar" o como el nombre de una variable
  cambio: ['cada vuelta', 'aumenta', 'resta', 'cambia', 'incrementa', 'disminuye', 'baja', 'sube'],
};

/** Primer momento en que la voz dice alguna de las claves, sin ir antes de `desde`. */
const primeraDicha = (claves: string[], narracion: string, dur: number, palabras: Palabra[] | undefined, desde: number) => {
  const hallados = claves
    .map((c) => momentosClave([c], narracion, dur, palabras)[0])
    .filter((m) => m.ok && m.t >= desde - 0.05)
    .map((m) => m.t);
  return hallados.length ? Math.min(...hallados) : null;
};

/**
 * Segundo en que entra cada parte del ciclo: cuando la voz la nombra o, si no la nombra,
 * escalonadas a partir de `piso` (cuando el código ya está escrito).
 */
export const momentosPartes = (claves: ClavesCiclo | undefined, narracion: string, dur: number, palabras: Palabra[] | undefined, piso: number) => {
  let prev = 0;
  const parte = (k: keyof typeof CANDIDATAS, i: number) => {
    const lista = claves?.[k] ? [claves[k]!] : CANDIDATAS[k];
    const t = primeraDicha(lista, narracion, dur, palabras, prev);
    const final = Math.max(t ?? piso + i * 0.35, prev, piso);
    prev = final;
    return final;
  };
  const inicio = parte('inicio', 0);
  const condicion = parte('condicion', 1);
  const cambio = parte('cambio', 2);
  return { inicio, condicion, cambio };
};

/** Cuándo empiezan a correr las vueltas, si la voz lo anuncia con `claves.vueltas`. */
export const momentoVueltas = (claves: ClavesCiclo | undefined, narracion: string, dur: number, palabras?: Palabra[]) =>
  claves?.vueltas ? primeraDicha([claves.vueltas], narracion, dur, palabras, 0) : null;

const MIN_HUECO = 0.12;

/** Vueltas a partir de los pasos reales de la ejecución (escena con depurar). */
export const vueltasDeTraza = (c: CicloCalculado, tiempos: number[]): Omit<TiemposCiclo, 'partes'> => {
  const vueltas = c.vueltas.map((v, k): MomentosVuelta => {
    const revision = tiempos[v.revision];
    if (!v.entra) return { revision, cuerpo: null, cambio: null };
    const siguiente = c.vueltas[k + 1] ? tiempos[c.vueltas[k + 1].revision] : null;
    const cuerpo = tiempos[v.revision + 1] ?? revision;
    const finCuerpo = tiempos[v.finCuerpo] ?? cuerpo;
    const cambio = siguiente === null ? null : siguiente - Math.min(0.3, 0.45 * Math.max(0, siguiente - finCuerpo));
    return { revision, cuerpo, cambio };
  });
  const ultima = c.vueltas[c.vueltas.length - 1];
  return {
    vueltas,
    salida: ultima && !ultima.entra ? vueltas[vueltas.length - 1].revision : null,
    desboque: c.infinito ? vueltas[vueltas.length - 1].revision : null,
  };
};

/**
 * Vueltas en el editor normal: cada vuelta que imprime se ancla al momento en que su línea
 * aparece en la consola; las demás se reparten entre las ancladas. Sin anclas, se reparten
 * parejo entre `desde` y `hasta`.
 */
export const vueltasDeConsola = (
  c: CicloCalculado,
  tLinea: (i: number) => number,
  nLineas: number,
  desde: number,
  hasta: number,
  tDesboque?: number,
): Omit<TiemposCiclo, 'partes'> => {
  const entran = c.vueltas.filter((v) => v.entra);
  const n = entran.length;
  // Momento del cuerpo de cada vuelta que entra
  const cuerpos: (number | null)[] = entran.map((v) => (v.salidas.length && v.salidas[0] < nLineas ? tLinea(v.salidas[0]) : null));
  const anclas = cuerpos.flatMap((t, k) => (t === null ? [] : [{ k, t }]));
  let hueco: number;
  if (!anclas.length) {
    hueco = Math.max(MIN_HUECO, (hasta - desde) / Math.max(1, n + 0.5));
    for (let k = 0; k < n; k++) cuerpos[k] = desde + hueco * (k + 0.6);
  } else {
    hueco = anclas.length > 1 ? (anclas[anclas.length - 1].t - anclas[0].t) / (anclas[anclas.length - 1].k - anclas[0].k) : 0.8;
    hueco = Math.max(MIN_HUECO, hueco);
    for (let k = 0; k < n; k++) {
      if (cuerpos[k] !== null) continue;
      const antes = [...anclas].reverse().find((a) => a.k < k);
      const despues = anclas.find((a) => a.k > k);
      if (antes && despues) cuerpos[k] = antes.t + ((despues.t - antes.t) * (k - antes.k)) / (despues.k - antes.k);
      else if (despues) cuerpos[k] = Math.max(desde, despues.t - hueco * (despues.k - k));
      else cuerpos[k] = null; // después de la última ancla: se calcula abajo
    }
    // Después de la última línea impresa: en un bucle infinito se acelera, si no, sigue al mismo paso.
    const ultima = anclas[anclas.length - 1];
    let t = ultima.t;
    let h = hueco;
    for (let k = ultima.k + 1; k < n; k++) {
      if (c.infinito) h = Math.max(MIN_HUECO, h * 0.82);
      t += h;
      cuerpos[k] = t;
    }
  }
  const vueltas: MomentosVuelta[] = [];
  entran.forEach((_, k) => {
    const cuerpo = cuerpos[k] as number;
    const previo = k ? (cuerpos[k - 1] as number) : cuerpo - hueco;
    const siguiente = k + 1 < n ? (cuerpos[k + 1] as number) : cuerpo + hueco;
    const revision = cuerpo - Math.min(0.35, 0.4 * (cuerpo - previo));
    const cambio = siguiente - Math.min(0.35, 0.4 * (siguiente - cuerpo)) - Math.min(0.2, 0.25 * (siguiente - cuerpo));
    vueltas.push({ revision: Math.max(0, revision), cuerpo, cambio });
  });
  const ultima = c.vueltas[c.vueltas.length - 1];
  let salida: number | null = null;
  if (ultima && !ultima.entra) {
    const tCuerpo = n ? (cuerpos[n - 1] as number) : desde;
    const h = n > 1 ? (cuerpos[n - 1] as number) - (cuerpos[n - 2] as number) : hueco;
    salida = n ? tCuerpo + h - Math.min(0.35, 0.4 * h) : desde + 0.3;
    vueltas.push({ revision: salida, cuerpo: null, cambio: null });
  }
  // El desboque empieza con la línea "... nunca termina", o al acabar las vueltas ancladas
  const desboque = c.infinito ? (tDesboque ?? (anclas.length ? anclas[anclas.length - 1].t + hueco : desde)) : null;
  return { vueltas, salida, desboque };
};

const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);

/** Ángulo del marcador (grados, 0 = arriba, sentido del reloj) y número de vueltas completas. */
export const anguloMarcador = (tc: TiemposCiclo, t: number): { angulo: number; vuelta: number } => {
  const vs = tc.vueltas;
  if (!vs.length || t < vs[0].revision) return { angulo: 0, vuelta: 0 };
  let k = 0;
  for (let i = 0; i < vs.length; i++) if (vs[i].revision <= t) k = i;
  const v = vs[k];
  if (v.cuerpo === null) return { angulo: 0, vuelta: k };
  const siguiente = vs[k + 1]?.revision ?? (v.cambio !== null ? v.cambio + 0.3 : v.cuerpo + 0.6);
  const cambio = v.cambio ?? (v.cuerpo + siguiente) / 2;
  const tramos: [number, number, number, number][] = [
    [v.revision, v.cuerpo, 0, 90],
    [v.cuerpo, cambio, 90, 235],
    [cambio, siguiente, 235, 360],
  ];
  for (const [t0, t1, a0, a1] of tramos) {
    if (t <= t1) {
      const p = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 1;
      return { angulo: a0 + (a1 - a0) * easeInOut(p), vuelta: k };
    }
  }
  return { angulo: 360, vuelta: k };
};

/** Índice de la vuelta cuyo valor se muestra: cambia cuando la variable cambia, no cuando se revisa. */
export const valorVisible = (tc: TiemposCiclo, t: number) => {
  let idx = 0;
  tc.vueltas.forEach((v, k) => {
    if (v.cambio !== null && t >= v.cambio && k + 1 < tc.vueltas.length) idx = k + 1;
  });
  return idx;
};
