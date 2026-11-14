/**
 * Tiempos de las animaciones paso a paso (variable, arreglo, condición, función, objeto)
 * cuando la escena no usa el depurador. Sin React, para poder probarlo.
 *
 * Los pasos de la ejecución se reparten entre `desde` y `hasta`; los pasos importantes pesan más
 * que los de trámite. Cada clave del guion ancla un evento al momento en que la voz la dice,
 * y la consola muestra cada línea en el paso real que la imprimió.
 */
import { momentosClave } from '../momentos';
import { Palabra, PasoAnimacion } from '../types';

const PESO_TRAMITE = 0.4;

export type Ancla = { paso: number; t: number };

/** Anclas de las claves: la k-ésima clave fija el evento k. Las que no se dicen o van fuera de orden se ignoran. */
export const anclasDeClaves = (eventos: number[], claves: string[] | undefined, narracion: string, dur: number, palabras?: Palabra[]): Ancla[] => {
  if (!claves?.length) return [];
  const usadas = claves.slice(0, eventos.length);
  return momentosClave(usadas, narracion, dur, palabras).flatMap((m, k) => (m.ok ? [{ paso: eventos[k], t: m.t }] : []));
};

/** Segundo de cada paso: reparte por peso entre anclas que nunca retroceden. */
export const tiemposPorPasos = (pasos: PasoAnimacion[], eventos: number[], anclas: Ancla[], desde: number, hasta: number): number[] => {
  const n = pasos.length;
  if (!n) return [];
  const importantes = new Set(eventos);
  const peso = pasos.map((p, i) => (importantes.has(i) || (i > 0 && p.s > pasos[i - 1].s) ? 1 : PESO_TRAMITE));
  const acumulado: number[] = [];
  peso.reduce((a, w, i) => (acumulado[i] = a + w), 0);
  // El paso i "llega" cuando se acumuló el peso de los anteriores
  const llegada = (i: number) => (i ? acumulado[i - 1] : 0);

  const lista: Ancla[] = [{ paso: 0, t: desde }];
  for (const a of [...anclas].sort((x, y) => x.paso - y.paso)) {
    const prev = lista[lista.length - 1];
    if (a.paso <= prev.paso || a.t <= prev.t) {
      // Una clave del primer paso (o de uno ya anclado) lo retrasa hasta que la voz la dice
      if (a.paso === prev.paso && a.t > prev.t) prev.t = a.t;
      continue;
    }
    lista.push(a);
  }
  const ultimo = lista[lista.length - 1];
  if (ultimo.paso < n - 1) lista.push({ paso: n - 1, t: Math.max(hasta, ultimo.t + 0.3 * (n - 1 - ultimo.paso)) });

  const tiempos: number[] = new Array(n);
  for (let k = 0; k < lista.length - 1; k++) {
    const a = lista[k];
    const b = lista[k + 1];
    const w0 = llegada(a.paso);
    const w1 = llegada(b.paso);
    for (let i = a.paso; i <= b.paso; i++) tiempos[i] = w1 > w0 ? a.t + ((b.t - a.t) * (llegada(i) - w0)) / (w1 - w0) : a.t;
  }
  if (lista.length === 1) tiempos[0] = desde;
  return tiempos;
};

/** Segundo en que aparece cada línea de consola: el del paso que la imprimió. */
export const lineasDeConsola = (pasos: PasoAnimacion[], tiempos: number[], nLineas: number) =>
  Array.from({ length: nLineas }, (_, k) => {
    const i = pasos.findIndex((p) => p.s > k);
    return i >= 0 ? tiempos[i] : tiempos[tiempos.length - 1];
  });

/** Índice del paso en pantalla en el segundo t (-1 antes del primero). */
export const pasoEn = (tiempos: number[], t: number) => {
  let idx = -1;
  for (let i = 0; i < tiempos.length && tiempos[i] <= t; i++) idx = i;
  return idx;
};

/** Momento en que la voz dice un nombre (la variable, el arreglo, la función), o null. */
export const momentoNombre = (nombre: string, narracion: string, dur: number, palabras?: Palabra[]) => {
  const m = momentosClave([nombre], narracion, dur, palabras)[0];
  return m.ok ? m.t : null;
};
