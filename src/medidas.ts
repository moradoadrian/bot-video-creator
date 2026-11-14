/** Medidas del editor en pantalla, compartidas por la plantilla y los validadores. */
const TOPE_SUPERIOR = 400;
/** El personaje y el subtítulo empiezan en 1310; se deja un respiro antes. */
const TOPE_INFERIOR = 1290;
export const CABECERA = 124; // barra del editor más su relleno interno
const ANCHO_CODIGO = 795; // ancho del editor menos los números de línea
const ANCHO_CARACTER = 0.6; // JetBrains Mono: cada carácter mide 0.6 em
const FS_MIN = 38;
const FS_MAX = 54;
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

export const altoConsola = (nSalida: number) => (nSalida ? 26 + 75 + 46 * Math.min(nSalida, MAX_SALIDA_VISIBLE) : 0);

/** Alto que ocupa el editor con `n` líneas de alto `lh`. */
export const altoEditor = (n: number, lh: number) => CABECERA + n * lh;

/**
 * Agranda el código cuando sobra espacio, sin bajar del tamaño mínimo legible.
 * Con animación, si el código y la fila no caben juntos, el editor se mide solo y la cámara
 * viaja entre los dos (viaja = true): así no hay límite de líneas.
 */
export const medidasEditor = (lineas: string[], nSalida: number, conAnimacion = false) => {
  const columnas = Math.max(1, ...lineas.map((l) => l.length));
  const n = Math.max(1, lineas.length);
  // Con animación se deja un respiro extra para que el zoom de la cámara no toque al personaje
  const abajo = conAnimacion ? ALTO_ANIMACION + SEPARACION_FILA + RESPIRO_ANIMACION : altoConsola(nSalida);
  const disponible = TOPE_INFERIOR - TOPE_SUPERIOR - CABECERA - abajo;
  const porAncho = ANCHO_CODIGO / (columnas * ANCHO_CARACTER);
  const porAlto = disponible / n / INTERLINEA;
  if (conAnimacion && porAlto < FS_MIN) {
    const soloEditor = TOPE_INFERIOR - TOPE_SUPERIOR - RESPIRO_ANIMACION - CABECERA;
    // Letra mínima legible: así el viaje de la cámara es el más corto posible
    const fs = Math.max(FS_MIN, Math.min(FS_MIN, porAncho, soloEditor / n / INTERLINEA));
    const lh = fs * INTERLINEA;
    return { fs, lh, viaja: true, desborda: n * lh > soloEditor + 0.5 };
  }
  const fs = Math.max(FS_MIN, Math.min(FS_MAX, porAncho, porAlto));
  const lh = fs * INTERLINEA;
  return { fs, lh, viaja: false, desborda: n * lh > disponible + 0.5 };
};
