/**
 * Une la animación de una escena con su editor: decide de dónde salen los tiempos
 * (pasos reales del depurador, líneas de la consola o claves de la voz) y el ritmo de la consola.
 * Sin React, para usarlo en la plantilla, la cámara y las pruebas.
 */
import { inicioDePasos, tiemposDePasos } from '../depurador';
import { RitmoSalida, tiemposEditor } from '../editor';
import { AnimacionPorPasos, CicloCalculado, ClavesCiclo, EscenaCodigo, Palabra } from '../types';
import { TiemposCiclo, momentoVueltas, momentosPartes, vueltasDeConsola, vueltasDeTraza } from './ciclo';
import { anclasDeClaves, lineasDeConsola, tiemposPorPasos } from './pasos';

/** Una escena con animación lista para dibujarse (el código se pudo analizar). */
export const tieneAnimacion = (e: EscenaCodigo) => !!(e.codigo && e.animacion?.calculado);

const datosCiclo = (e: EscenaCodigo) => (e.animacion?.tipo === 'ciclo' ? e.animacion : null);
const porPasos = (e: EscenaCodigo) => (e.animacion && e.animacion.tipo !== 'ciclo' ? (e.animacion as AnimacionPorPasos) : null);

/** Ritmo de la consola del editor normal cuando hay un ciclo al lado: las vueltas empiezan después de presentar sus partes. */
const ritmoCiclo = (e: EscenaCodigo, dur: number, palabras?: Palabra[]): RitmoSalida => {
  const base = tiemposEditor(e, dur);
  const claves: ClavesCiclo | undefined = datosCiclo(e)?.datos?.claves;
  const partes = momentosPartes(claves, e.narracion, dur, palabras, base.tResaltar);
  const anunciadas = momentoVueltas(claves, e.narracion, dur, palabras);
  // Sin aviso en la voz, las vueltas arrancan cuando ya se presentaron las tres partes
  const inicio = anunciadas ?? Math.min(partes.cambio + 0.6, dur * 0.8);
  // Si arrancan tarde, pueden usar el respiro del bloque para que cada vuelta se alcance a ver
  const n = Math.max(1, base.salida.length);
  return { inicio, fin: Math.min(dur + 0.2, Math.max(dur * 0.88, inicio + 0.55 * n)) };
};

/** Segundo de cada paso de la ejecución, para las animaciones paso a paso. */
export const tiemposDeAnimacion = (e: EscenaCodigo, dur: number, palabras?: Palabra[]): number[] | null => {
  const a = porPasos(e);
  if (!e.codigo || !a?.calculado) return null;
  if (e.traza) {
    const n = e.codigo.split('\n').length;
    return tiemposDePasos(e.traza, e.depurar?.marcas ?? [], e.narracion, dur, inicioDePasos(n), palabras).tiempos;
  }
  const c = a.calculado;
  const base = tiemposEditor(e, dur);
  const anclas = anclasDeClaves(c.eventos, a.datos?.claves, e.narracion, dur, palabras);
  return tiemposPorPasos(c.pasos, c.eventos, anclas, base.tResaltar + 0.3, dur * 0.9);
};

/** Ritmo de la consola del editor normal según la animación de la escena (undefined: el de siempre). */
export const ritmoConAnimacion = (e: EscenaCodigo, dur: number, palabras?: Palabra[]): RitmoSalida | undefined => {
  if (!tieneAnimacion(e) || e.traza) return undefined;
  if (datosCiclo(e)) return ritmoCiclo(e, dur, palabras);
  const tiempos = tiemposDeAnimacion(e, dur, palabras);
  const c = porPasos(e)?.calculado;
  const nLineas = (e.salida ?? '').split('\n').filter((l) => l.length).length;
  // Cada línea de consola sale en el paso real que la imprimió
  return tiempos && c && nLineas ? { lineas: lineasDeConsola(c.pasos, tiempos, nLineas) } : undefined;
};

/** Tiempos completos del ciclo de una escena. */
export const planCiclo = (e: EscenaCodigo, dur: number, palabras?: Palabra[]): TiemposCiclo | null => {
  const a = datosCiclo(e);
  const c: CicloCalculado | undefined = a?.calculado;
  if (!e.codigo || !a || !c) return null;
  const claves = a.datos?.claves;
  if (e.traza) {
    const n = e.codigo.split('\n').length;
    const piso = inicioDePasos(n);
    const { tiempos } = tiemposDePasos(e.traza, e.depurar?.marcas ?? [], e.narracion, dur, piso, palabras);
    const resto = vueltasDeTraza(c, tiempos);
    return { partes: antesDeVueltas(momentosPartes(claves, e.narracion, dur, palabras, piso), resto.vueltas[0]?.revision), ...resto };
  }
  const ritmo = ritmoCiclo(e, dur, palabras);
  const te = tiemposEditor(e, dur, ritmo);
  const partes = momentosPartes(claves, e.narracion, dur, palabras, te.tResaltar);
  const nunca = te.salida.length && te.salida[te.salida.length - 1].startsWith('...');
  const reales = nunca ? te.salida.length - 1 : te.salida.length;
  const desde = Math.max(te.tResaltar, ritmo.inicio ?? 0);
  // Sin consola que marque el paso, las vueltas pueden usar hasta el final del bloque (incluido su respiro)
  const hasta = reales ? dur * 0.88 : dur + 0.25;
  const resto = vueltasDeConsola(c, te.tLinea, reales, desde, hasta, nunca ? te.tLinea(te.salida.length - 1) : undefined);
  return { partes: antesDeVueltas(partes, resto.vueltas[0]?.revision), ...resto };
};

/** Las partes deben estar a la vista antes de la primera revisión, aunque la voz las nombre después. */
const antesDeVueltas = (p: TiemposCiclo['partes'], primera?: number): TiemposCiclo['partes'] => {
  if (primera === undefined) return p;
  const tope = Math.max(0, primera - 0.15);
  return { inicio: Math.min(p.inicio, tope), condicion: Math.min(p.condicion, tope), cambio: Math.min(p.cambio, tope) };
};

/** Lo que necesita la plantilla para dibujar la animación de una escena. */
export type PlanAnimacion = {
  ciclo: TiemposCiclo | null;
  tiempos: number[] | null;
  momentos: number[];
  /** Cuando el panel entra: en cuanto el código está escrito, aunque lo demás espere a la voz. */
  aparece: number;
};

export const planAnimacion = (e: EscenaCodigo, dur: number, palabras?: Palabra[]): PlanAnimacion | null => {
  if (!tieneAnimacion(e)) return null;
  if (datosCiclo(e)) {
    const ciclo = planCiclo(e, dur, palabras);
    if (!ciclo) return null;
    const { partes, salida, desboque } = ciclo;
    const momentos = [partes.inicio, partes.condicion, partes.cambio, ...(salida !== null ? [salida] : []), ...(desboque !== null ? [desboque] : [])];
    return { ciclo, tiempos: null, momentos, aparece: Math.max(0, partes.inicio - 0.2) };
  }
  const tiempos = tiemposDeAnimacion(e, dur, palabras);
  const c = porPasos(e)?.calculado;
  if (!tiempos || !c) return null;
  const aparece = e.traza ? inicioDePasos(e.codigo!.split('\n').length) - 0.2 : tiemposEditor(e, dur).tResaltar;
  return { ciclo: null, tiempos, momentos: c.eventos.map((i) => tiempos[i]).filter((t) => t !== undefined), aparece: Math.min(aparece, tiempos[0] ?? aparece) };
};
