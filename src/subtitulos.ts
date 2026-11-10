import { clavesDe, normalizar } from './momentos';
import { Palabra, Visual } from './types';

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

/** Palabras comunes que no vale la pena marcar aunque estén en el título. */
const COMUNES = new Set(['cuando', 'donde', 'desde', 'hasta', 'entre', 'sobre', 'porque', 'para', 'como', 'cada', 'todo', 'todos', 'nada', 'esto', 'este', 'esta', 'tiene', 'hace', 'sirve', 'explicado', 'facil', 'parte', 'partes', 'primero', 'segundo', 'segundos', 'minuto']);

/**
 * Palabras que el subtítulo marca con el color de acento: los nombres del código
 * (variables, funciones, palabras reservadas), los elementos del diagrama y las palabras largas del título.
 */
export const palabrasClave = (b: { titulo: string; codigo?: string; visual?: Visual }) => {
  const claves = new Set<string>();
  const de = (texto: string, minimo: number) =>
    normalizar(texto)
      .split(' ')
      .filter((w) => w.length >= minimo && !COMUNES.has(w) && !/^\d+$/.test(w))
      .forEach((w) => claves.add(w));
  // Solo nombres del código, no el texto de comentarios ni de cadenas
  if (b.codigo) de(b.codigo.replace(/\/\/.*$/gm, '').replace(/(["'`]).*?\1/g, ' '), 3);
  if (b.visual) clavesDe(b.visual).forEach((c) => de(c, 3));
  de(b.titulo, 5);
  return claves;
};

/** ¿La palabra dicha es clave? Tolera acentos, signos y el plural. */
export const esClave = (palabra: string, claves: Set<string>) => {
  const w = normalizar(palabra);
  return w.length > 0 && (claves.has(w) || (w.endsWith('s') && claves.has(w.slice(0, -1))));
};
