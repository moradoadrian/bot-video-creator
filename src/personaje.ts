/**
 * Poses del personaje animado a lo largo de un bloque. Cada momento importante de la escena
 * (se resalta el código, sale el resultado, termina el ciclo…) dispara una pose que dura un rato
 * y luego vuelve a la neutral. Sin React, para poder probarlo.
 */
import { random } from 'remotion';

export type Pose = 'neutral' | 'senala' | 'celebra' | 'sorpresa' | 'saluda';
export type Gesto = { t: number; pose: Pose };

/** Cuánto dura cada pose antes de volver a la neutral (la de saludo y celebrar se sostienen más). */
const DURA: Record<Pose, number> = { neutral: Infinity, senala: 1.8, celebra: 2.2, sorpresa: 1.8, saluda: 2.4 };
/** Gestos más juntos que esto se ignoran: el personaje no debe verse nervioso. */
const SEPARACION = 1.2;
/** Antes de cada pose, un pequeño movimiento contrario (anticipación). */
export const ANTICIPACION = 0.14;

export const limpiarGestos = (gestos: Gesto[], dur: number): Gesto[] => {
  const out: Gesto[] = [];
  for (const g of [...gestos].filter((x) => Number.isFinite(x.t) && x.t >= 0 && x.t < dur - 0.3).sort((a, b) => a.t - b.t)) {
    const prev = out[out.length - 1];
    // Un gesto importante (celebrar, sorprenderse) reemplaza a uno menor que iba a ocurrir muy cerca
    if (prev && g.t - prev.t < SEPARACION) {
      if (g.pose === 'celebra' || g.pose === 'sorpresa') out[out.length - 1] = g;
      continue;
    }
    out.push(g);
  }
  return out;
};

export type EstadoPose = { pose: Pose; previa: Pose; desde: number };

/** Pose vigente en el segundo t, la anterior y desde cuándo (para mezclar con rebote). */
export const poseEn = (gestos: Gesto[], t: number): EstadoPose => {
  // Línea de tiempo con los regresos a neutral ya intercalados
  const linea: Gesto[] = [{ t: -1, pose: 'neutral' }];
  gestos.forEach((g, i) => {
    linea.push(g);
    const fin = g.t + DURA[g.pose];
    const siguiente = gestos[i + 1]?.t ?? Infinity;
    if (fin < siguiente) linea.push({ t: fin, pose: 'neutral' });
  });
  let k = 0;
  linea.forEach((g, i) => {
    if (g.t <= t) k = i;
  });
  return { pose: linea[k].pose, previa: linea[Math.max(0, k - 1)].pose, desde: linea[k].t };
};

/** Cuánto están cerrados los ojos (0 abiertos, 1 cerrados): parpadeos cada 2.5–4.5 s, con semilla. */
export const parpadeo = (t: number, semilla: string) => {
  let tk = 0.8 + random(`${semilla}-p0`) * 1.5;
  for (let k = 1; tk < t + 0.2 && k < 200; k++) {
    const dt = t - tk;
    if (dt >= 0 && dt < 0.16) return Math.sin((dt / 0.16) * Math.PI);
    // A veces parpadea dos veces seguidas
    const doble = random(`${semilla}-d${k}`) < 0.2;
    tk += doble ? 0.28 : 2.5 + random(`${semilla}-p${k}`) * 2;
  }
  return 0;
};
