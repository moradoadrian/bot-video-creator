/**
 * Une la animación de una escena con su editor: decide de dónde salen los tiempos
 * (pasos reales del depurador o líneas de la consola) y el ritmo de la consola.
 * Sin React, para usarlo en la plantilla, la cámara y las pruebas.
 */
import { inicioDePasos, tiemposDePasos } from '../depurador';
import { RitmoSalida, tiemposEditor } from '../editor';
import { EscenaCodigo, Palabra } from '../types';
import { TiemposCiclo, momentoVueltas, momentosPartes, vueltasDeConsola, vueltasDeTraza } from './ciclo';

/** Una escena con animación lista para dibujarse (el código se pudo analizar). */
export const tieneAnimacion = (e: EscenaCodigo) => !!(e.codigo && e.animacion?.calculado);

/** Ritmo de la consola del editor normal cuando hay un ciclo al lado: las vueltas empiezan después de presentar sus partes. */
export const ritmoConAnimacion = (e: EscenaCodigo, dur: number, palabras?: Palabra[]): RitmoSalida | undefined => {
  if (!tieneAnimacion(e) || e.traza) return undefined;
  const base = tiemposEditor(e, dur);
  const claves = e.animacion!.datos?.claves;
  const partes = momentosPartes(claves, e.narracion, dur, palabras, base.tResaltar);
  const anunciadas = momentoVueltas(claves, e.narracion, dur, palabras);
  // Sin aviso en la voz, las vueltas arrancan cuando ya se presentaron las tres partes
  const inicio = anunciadas ?? Math.min(partes.cambio + 0.6, dur * 0.8);
  // Si arrancan tarde, pueden usar el respiro del bloque para que cada vuelta se alcance a ver
  const n = Math.max(1, base.salida.length);
  return { inicio, fin: Math.min(dur + 0.2, Math.max(dur * 0.88, inicio + 0.55 * n)) };
};

/** Tiempos completos del ciclo de una escena. */
export const planCiclo = (e: EscenaCodigo, dur: number, palabras?: Palabra[]): TiemposCiclo | null => {
  const c = e.animacion?.calculado;
  if (!e.codigo || !c) return null;
  const claves = e.animacion!.datos?.claves;
  if (e.traza) {
    const n = e.codigo.split('\n').length;
    const piso = inicioDePasos(n);
    const { tiempos } = tiemposDePasos(e.traza, e.depurar?.marcas ?? [], e.narracion, dur, piso, palabras);
    const resto = vueltasDeTraza(c, tiempos);
    return { partes: antesDeVueltas(momentosPartes(claves, e.narracion, dur, palabras, piso), resto.vueltas[0]?.revision), ...resto };
  }
  const ritmo = ritmoConAnimacion(e, dur, palabras);
  const te = tiemposEditor(e, dur, ritmo);
  const partes = momentosPartes(claves, e.narracion, dur, palabras, te.tResaltar);
  const nunca = te.salida.length && te.salida[te.salida.length - 1].startsWith('...');
  const reales = nunca ? te.salida.length - 1 : te.salida.length;
  const desde = Math.max(te.tResaltar, ritmo?.inicio ?? 0);
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
