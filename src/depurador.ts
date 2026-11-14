/** Cálculos del depurador visual, compartidos por la plantilla y los validadores. */
import { ALTO_ANIMACION, RESPIRO_ANIMACION } from './medidas';
import { MarcaDepurador, Palabra, Traza } from './types';

/** Inicio de cada paso cuando la narración no marca otro momento: se reparten hasta casi el final. */
const FRACCION_FIN = 0.96;
export const ANONIMA = 'función anónima';
export const INICIO_CODIGO = 0.1;
export const PASO_CODIGO = 0.08;
export const ANCHO_PANEL_VARIABLES = 470;
export const MAX_CONSOLA_DEPURADOR = 4;
/** Lo que cabe en el panel a 30 px de fuente. */
export const MAX_COLUMNAS_VARIABLE = 22;
export const MAX_COLUMNAS_CONSOLA = 17;

/** Cuando el código ya apareció y la ejecución puede empezar. */
export const inicioDePasos = (nLineas: number) => INICIO_CODIGO + PASO_CODIGO * nLineas + 0.25;

export const recortar = (nombre: string, valor: string) => {
  const libre = Math.max(4, MAX_COLUMNAS_VARIABLE - nombre.length - 3);
  return valor.length > libre ? `${valor.slice(0, libre - 1)}…` : valor;
};

const tiempoDeFrase = (narracion: string, frase: string, duracionSeg: number, palabras?: Palabra[]) => {
  const idx = narracion.toLowerCase().indexOf(frase.toLowerCase());
  if (idx < 0) return null;
  if (palabras?.length) {
    const antes = narracion.slice(0, idx).trim();
    const p = palabras[antes ? antes.split(/\s+/).length : 0];
    if (p) return p.inicio;
  }
  return (idx / narracion.length) * duracionSeg;
};

/**
 * Segundo en el que empieza cada paso. Cada marca fija un paso al momento en que la voz dice su
 * frase; los pasos entre dos marcas se reparten parejo. Lo que no se puede usar se reporta.
 */
export const tiemposDePasos = (
  traza: Traza,
  marcas: MarcaDepurador[],
  narracion: string,
  duracionSeg: number,
  inicio: number,
  palabras?: Palabra[],
): { tiempos: number[]; problemas: string[] } => {
  const ultimo = traza.pasos.length - 1;
  const problemas: string[] = [];
  const anclas: { paso: number; t: number }[] = [{ paso: 0, t: inicio }];

  for (const m of marcas) {
    const dicha = tiempoDeFrase(narracion, m.frase, duracionSeg, palabras);
    if (dicha === null) {
      problemas.push(`la frase "${m.frase}" no está en la narración`);
      continue;
    }
    // Una frase dicha antes de que aparezca el código espera a que la ejecución pueda empezar.
    const t = Math.max(dicha, inicio);
    const vez = m.vez ?? 1;
    const coincidencias = traza.pasos.flatMap((p, i) => (p.linea === m.linea ? [i] : []));
    const paso = coincidencias[vez - 1];
    if (paso === undefined) {
      problemas.push(`la línea ${m.linea} no se ejecuta ${vez} ${vez === 1 ? 'vez' : 'veces'}`);
      continue;
    }
    const previa = anclas[anclas.length - 1];
    if (paso < previa.paso || t < previa.t) {
      problemas.push(`la marca "${m.frase}" está fuera de orden`);
      continue;
    }
    if (paso === previa.paso) previa.t = t;
    else anclas.push({ paso, t });
  }

  const final = anclas[anclas.length - 1];
  if (final.paso < ultimo) anclas.push({ paso: ultimo, t: Math.max(final.t, duracionSeg * FRACCION_FIN) });

  const tiempos: number[] = [];
  for (let a = 0; a < anclas.length - 1; a++) {
    const { paso: p0, t: t0 } = anclas[a];
    const { paso: p1, t: t1 } = anclas[a + 1];
    for (let p = p0; p < p1; p++) tiempos[p] = t0 + ((t1 - t0) * (p - p0)) / (p1 - p0);
  }
  tiempos[ultimo] = anclas[anclas.length - 1].t;
  return { tiempos, problemas };
};

/** Índice del paso que está en pantalla en el segundo t; -1 si la ejecución aún no empieza. */
export const pasoActual = (tiempos: number[], t: number) => {
  let idx = -1;
  for (let i = 0; i < tiempos.length && tiempos[i] <= t; i++) idx = i;
  return idx;
};

const TOPE_DISPONIBLE = 890; // del inicio del editor al subtítulo, igual que en medidas.ts
const CABECERA = 124;
const SEPARACION = 26;
const FS_MIN = 38;
const FS_MAX = 54;
const INTERLINEA = 1.3; // más junta que el editor normal: el panel necesita el espacio
const ANCHO_CODIGO = 795;
const ANCHO_CARACTER = 0.6;
const RELLENO_PANEL = 36;
const TITULO_PANEL = 44;
const ALTO_GRUPO = 34;
export const ALTO_FILA = 46;

/** Reserva el alto del panel más lleno de toda la escena, para que nada brinque durante la animación. */
export const medidasDepurador = (lineas: string[], traza: Traza, conAnimacion = false) => {
  const altoVariables = Math.max(
    0,
    ...traza.pasos.map((p) => p.grupos.length * ALTO_GRUPO + p.grupos.reduce((a, g) => a + g.variables.length, 0) * ALTO_FILA),
  );
  const altoConsola = Math.max(1, Math.min(traza.salida.length, MAX_CONSOLA_DEPURADOR)) * ALTO_FILA;
  const altoPanel = conAnimacion ? ALTO_ANIMACION : RELLENO_PANEL + TITULO_PANEL + Math.max(altoVariables, altoConsola);
  const disponible = TOPE_DISPONIBLE - SEPARACION - altoPanel - CABECERA - (conAnimacion ? RESPIRO_ANIMACION : 0);
  const columnas = Math.max(1, ...lineas.map((l) => l.length));
  const n = Math.max(1, lineas.length);
  const porAncho = ANCHO_CODIGO / (columnas * ANCHO_CARACTER);
  const porAlto = disponible / n / INTERLINEA;
  // Con animación, si no cabe todo junto, el editor se mide solo y la cámara viaja entre el código y la fila
  if (conAnimacion && porAlto < FS_MIN) {
    const soloEditor = TOPE_DISPONIBLE - RESPIRO_ANIMACION - CABECERA;
    // Letra mínima legible: así el viaje de la cámara es el más corto posible
    const fs = Math.max(FS_MIN, Math.min(FS_MIN, porAncho, soloEditor / n / INTERLINEA));
    const lh = fs * INTERLINEA;
    return { fs, lh, altoPanel, viaja: true, desborda: n * lh > soloEditor + 0.5 };
  }
  const fs = Math.max(FS_MIN, Math.min(FS_MAX, porAncho, porAlto));
  const lh = fs * INTERLINEA;
  return { fs, lh, altoPanel, viaja: false, desborda: n * lh > disponible + 0.5 };
};
