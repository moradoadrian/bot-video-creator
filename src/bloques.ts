/** Duración de los bloques en frames. Sin React ni CSS, para usarlo también desde los scripts. */
export const FPS = 30;
export const PAD_SEG = 0.4;

/** Frames de cada bloque (gancho, escenas…, cierre) a partir de las duraciones de audio. */
export const framesPorBloque = (duraciones: number[]) => duraciones.map((d) => Math.round((d + PAD_SEG) * FPS));
