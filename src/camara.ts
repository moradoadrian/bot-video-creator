/**
 * "Cámara" de cada bloque: entra un poco acercada y se asienta, avanza con un zoom lento
 * y da un golpe de acercamiento en los momentos clave (línea resaltada, consola, elemento de un diagrama).
 * Todo en segundos, sin depender de React, para poder probarlo.
 */

/** Cuánto se acerca a lo largo de todo el bloque. */
export const ZOOM_LENTO = 0.03;
/** Acercamiento extra al empezar el bloque, que se asienta enseguida. */
export const ZOOM_ENTRADA = 0.06;
/** Tamaño del golpe en un momento clave. */
export const ZOOM_GOLPE = 0.045;
/** Golpes más juntos que esto se ignoran: la cámara no debe temblar. */
export const SEPARACION_MIN = 1.2;

const ENTRADA = 0.5;
const SUBIDA = 0.12;
const BAJADA = 1.0;

const easeOut = (x: number) => 1 - (1 - x) ** 3;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const fijar01 = (x: number) => Math.min(1, Math.max(0, x));

/** Ordena los momentos, descarta los que caen fuera del bloque y los demasiado juntos. */
export const golpesDeCamara = (tiempos: number[], duracion: number, separacion = SEPARACION_MIN) => {
  const golpes: number[] = [];
  for (const t of tiempos.filter(Number.isFinite).sort((a, b) => a - b)) {
    if (t < 0.3 || t > duracion - 0.3) continue;
    if (golpes.length && t - golpes[golpes.length - 1] < separacion) continue;
    golpes.push(t);
  }
  return golpes;
};

/** Forma de un golpe: sube rápido y regresa suave. dt = segundos desde el golpe. */
const golpe = (dt: number) => {
  if (dt < 0 || dt > SUBIDA + BAJADA) return 0;
  return dt < SUBIDA ? easeOut(dt / SUBIDA) : 1 - easeInOut((dt - SUBIDA) / BAJADA);
};

/** Escala de la cámara en el segundo t del bloque. */
export const zoomCamara = (t: number, duracion: number, golpes: number[]) => {
  const lento = ZOOM_LENTO * fijar01(t / Math.max(0.1, duracion));
  const entrada = ZOOM_ENTRADA * (1 - easeOut(fijar01(t / ENTRADA)));
  const g = golpes.reduce((m, t0) => Math.max(m, golpe(t - t0)), 0);
  return 1 + lento + entrada + ZOOM_GOLPE * g;
};
