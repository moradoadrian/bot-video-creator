/** Cuándo pasa cada cosa en el editor normal. Lo comparten el editor, la cámara y las animaciones. */
import { duracionTecleo } from './tecleo';
import { EscenaCodigo } from './types';

/** Ritmo de la consola cuando hay una animación al lado: cada línea es una vuelta que se debe alcanzar a ver. */
export type RitmoSalida = { inicio?: number; fin?: number };

export const tiemposEditor = (e: EscenaCodigo, duracionSeg: number, ritmo?: RitmoSalida) => {
  const lineas = (e.codigo ?? '').split('\n');
  // El código se teclea casi de inmediato; el resultado se guarda para cuando la voz lo explique.
  const inicio = 0.1;
  const durTecleo = duracionTecleo(lineas.reduce((a, l) => a + l.length, 0), Math.min(2.5, duracionSeg * 0.4));
  const finCodigo = inicio + durTecleo;
  const tResaltar = finCodigo + 0.3;
  const salida = (e.salida ?? '').split('\n').filter((l) => l.length);
  const n = Math.max(1, salida.length);
  let tSalida = Math.max(finCodigo + 0.6, duracionSeg * 0.3);
  let pasoSalida = Math.min(0.45, (duracionSeg * 0.35) / n);
  if (ritmo) {
    // Con animación, la consola va al paso de las vueltas: más lenta y repartida hasta casi el final.
    tSalida = Math.max(finCodigo + 0.6, ritmo.inicio ?? duracionSeg * 0.3);
    const fin = Math.max(tSalida + 0.3 * n, ritmo.fin ?? duracionSeg * 0.85);
    pasoSalida = Math.min(1.1, Math.max(0.3, (fin - tSalida) / n));
  }
  /** Cuando sale la última línea de la consola: ahí se celebra. */
  const tUltima = salida.length ? tSalida + (salida.length - 1) * pasoSalida : Infinity;
  const tLinea = (i: number) => tSalida + i * pasoSalida;
  return { lineas, salida, inicio, durTecleo, finCodigo, tResaltar, tSalida, pasoSalida, tUltima, tLinea };
};
