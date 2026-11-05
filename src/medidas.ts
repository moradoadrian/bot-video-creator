/** Medidas del editor en pantalla, compartidas por la plantilla y los validadores. */
const TOPE_SUPERIOR = 400;
/** El personaje y el subtítulo empiezan en 1310; se deja un respiro antes. */
const TOPE_INFERIOR = 1290;
const CABECERA = 124; // barra del editor más su relleno interno
const ANCHO_CODIGO = 795; // ancho del editor menos los números de línea
const ANCHO_CARACTER = 0.6; // JetBrains Mono: cada carácter mide 0.6 em
const FS_MIN = 38;
const FS_MAX = 54;
const INTERLINEA = 60 / 38;
export const MAX_SALIDA_VISIBLE = 6;

const altoConsola = (nSalida: number) => (nSalida ? 26 + 75 + 46 * Math.min(nSalida, MAX_SALIDA_VISIBLE) : 0);

/** Agranda el código cuando sobra espacio, sin bajar del tamaño mínimo legible. */
export const medidasEditor = (lineas: string[], nSalida: number) => {
  const columnas = Math.max(1, ...lineas.map((l) => l.length));
  const disponible = TOPE_INFERIOR - TOPE_SUPERIOR - CABECERA - altoConsola(nSalida);
  const porAncho = ANCHO_CODIGO / (columnas * ANCHO_CARACTER);
  const porAlto = disponible / Math.max(1, lineas.length) / INTERLINEA;
  const fs = Math.max(FS_MIN, Math.min(FS_MAX, porAncho, porAlto));
  const lh = fs * INTERLINEA;
  return { fs, lh, desborda: lineas.length * lh > disponible };
};
