import { Palabra } from './types';

/** Tiempos por carácter tal como los devuelve ElevenLabs en /with-timestamps. */
export type Alineacion = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

export const palabrasDeAlineacion = (a: Alineacion): Palabra[] => {
  const palabras: Palabra[] = [];
  let actual: Palabra | null = null;
  a.characters.forEach((c, i) => {
    if (/\s/.test(c)) {
      actual = null;
      return;
    }
    if (!actual) {
      actual = { texto: '', inicio: a.character_start_times_seconds[i], fin: a.character_end_times_seconds[i] };
      palabras.push(actual);
    }
    actual.texto += c;
    actual.fin = a.character_end_times_seconds[i];
  });
  return palabras;
};

/** Mismo criterio que trozos(): máximo 6 palabras, y corta en la puntuación. */
export const agruparPalabras = (palabras: Palabra[], max = 6): Palabra[][] => {
  const grupos: Palabra[][] = [];
  let cur: Palabra[] = [];
  for (const p of palabras) {
    cur.push(p);
    if (cur.length >= max || (/[.,;:!?]$/.test(p.texto) && cur.length >= 2)) {
      grupos.push(cur);
      cur = [];
    }
  }
  if (cur.length) grupos.push(cur);
  return grupos;
};

/** Índice del último elemento que ya empezó en el segundo t; 0 si aún no empieza ninguno. */
export const indiceActual = <T>(elementos: T[], inicioDe: (e: T) => number, t: number) => {
  let idx = 0;
  elementos.forEach((e, i) => {
    if (inicioDe(e) <= t) idx = i;
  });
  return idx;
};
