/** Medidas del editor en pantalla, compartidas por la plantilla y los validadores. */
const TOPE_SUPERIOR = 400;
/** El personaje y el subtítulo empiezan en 1310; se deja un respiro antes. */
const TOPE_INFERIOR = 1290;
const CABECERA = 124; // barra del editor más su relleno interno
const ANCHO_CODIGO = 795; // ancho del editor menos los números de línea
const ANCHO_CARACTER = 0.6; // JetBrains Mono: cada carácter mide 0.6 em
const FS_MIN = 38;
const FS_MAX = 54;
const FS_MIN_ANIMACION = 34;
const INTERLINEA = 60 / 38;
export const MAX_SALIDA_VISIBLE = 6;
/** Alto de la fila de la animación (la animación y la consola, lado a lado) bajo el editor. */
export const ALTO_ANIMACION = 380;
/** Ancho de la animación cuando comparte la fila con la consola. */
export const ANCHO_ANIMACION = 440;
export const SEPARACION_FILA = 26;
export const RESPIRO_ANIMACION = 24;
/** Lo que cabe en la consola angosta de la fila de la animación, a 32 px. */
export const MAX_COLUMNAS_CONSOLA_ANIMACION = 19;

const altoConsola = (nSalida: number) => (nSalida ? 26 + 75 + 46 * Math.min(nSalida, MAX_SALIDA_VISIBLE) : 0);

/** Agranda el código cuando sobra espacio, sin bajar del tamaño mínimo legible. */
export const medidasEditor = (lineas: string[], nSalida: number, conAnimacion = false) => {
  const columnas = Math.max(1, ...lineas.map((l) => l.length));
  // Con animación la pantalla va llena hasta abajo: se deja un respiro extra para que el zoom de la cámara no toque al personaje
  const abajo = conAnimacion ? ALTO_ANIMACION + SEPARACION_FILA + RESPIRO_ANIMACION : altoConsola(nSalida);
  const disponible = TOPE_INFERIOR - TOPE_SUPERIOR - CABECERA - abajo;
  const porAncho = ANCHO_CODIGO / (columnas * ANCHO_CARACTER);
  const porAlto = disponible / Math.max(1, lineas.length) / INTERLINEA;
  // Junto a una animación se permite letra un poco más chica, para que quepan 6 líneas
  const fs = Math.max(conAnimacion ? FS_MIN_ANIMACION : FS_MIN, Math.min(FS_MAX, porAncho, porAlto));
  const lh = fs * INTERLINEA;
  return { fs, lh, desborda: lineas.length * lh > disponible + 0.5 };
};
