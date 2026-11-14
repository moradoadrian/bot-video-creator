/**
 * Recorrido: los pasos viven en un mismo "mundo" más grande que la pantalla y la cámara
 * viaja por él siguiendo a un paquete de luz. Plano general al inicio (el mapa entero),
 * plano cerrado en cada paso cuando la voz lo nombra y plano general al final para
 * revelar toda la ruta encendida. Todo en segundos y sin React, para poder probarlo.
 */

export type Punto = { x: number; y: number };
export type Curva = [Punto, Punto, Punto, Punto];
export type Plano = { cx: number; cy: number; escala: number };

export const NODO_W = 500;
export const NODO_H = 210;
const PASO_Y = 500;
const CENTRO_X = 540;
const BANNER_H = 140;
/** Lo que tarda el paquete en regresar al inicio. */
export const DUR_REGRESO = 1.3;
/** Tras llegar a un paso, el paquete se encoge y desaparece en este tiempo. */
export const DESVANECER = 0.25;

const fijar01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);

export const puntoEnCurva = ([a, b, c, d]: Curva, t: number): Punto => {
  const u = 1 - t;
  return {
    x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
    y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y,
  };
};

/** Puntos de la curva desde el inicio hasta `hasta` (0–1), para dibujar el trazo encendido. */
export const muestras = (curva: Curva, hasta: number, k = 36): Punto[] => {
  const h = fijar01(hasta);
  return Array.from({ length: k + 1 }, (_, i) => puntoEnCurva(curva, (i / k) * h));
};

export type Geometria = {
  nodos: Punto[];
  tramos: Curva[];
  regreso: Curva | null;
  banner: Punto | null;
  limites: { x0: number; y0: number; x1: number; y1: number };
};

/** Pasos en zigzag, unidos por curvas en S; el regreso rodea por la derecha. */
export const geometria = (n: number, conRegreso: boolean, conFinal: boolean): Geometria => {
  const nodos = Array.from({ length: n }, (_, i) => ({ x: i % 2 === 0 ? 320 : 760, y: 260 + i * PASO_Y }));
  const tramos = nodos.slice(1).map((b, i): Curva => {
    const a = nodos[i];
    const p0 = { x: a.x, y: a.y + NODO_H / 2 };
    const p3 = { x: b.x, y: b.y - NODO_H / 2 };
    const dy = (p3.y - p0.y) * 0.6;
    return [p0, { x: a.x, y: p0.y + dy }, { x: b.x, y: p3.y - dy }, p3];
  });
  const primero = nodos[0];
  const ultimo = nodos[n - 1];
  const regreso: Curva | null = conRegreso
    ? [
        { x: ultimo.x + NODO_W / 2, y: ultimo.y },
        { x: 1260, y: ultimo.y },
        { x: 1260, y: primero.y },
        { x: primero.x + NODO_W / 2 + 14, y: primero.y },
      ]
    : null;
  const banner = conFinal ? { x: CENTRO_X, y: ultimo.y + NODO_H / 2 + 60 + BANNER_H / 2 } : null;
  return {
    nodos,
    tramos,
    regreso,
    banner,
    limites: {
      x0: 60,
      x1: conRegreso ? 1110 : 1020,
      y0: primero.y - NODO_H / 2 - 30,
      y1: (banner ? banner.y + BANNER_H / 2 : ultimo.y + NODO_H / 2) + 30,
    },
  };
};

/** Plano general: todo el mundo cabe en pantalla. */
export const planoGeneral = (g: Geometria, ancho: number, alto: number): Plano => {
  const { x0, x1, y0, y1 } = g.limites;
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, escala: Math.min(1, ancho / (x1 - x0), alto / (y1 - y0)) };
};

/** Plano cerrado sobre un paso; se corre un poco al centro para que asome el vecino. */
export const planoCerrado = (g: Geometria, i: number, alto: number): Plano => {
  const p = g.nodos[i];
  return { cx: 0.6 * p.x + 0.4 * CENTRO_X, cy: p.y, escala: Math.min(1.15, alto / (NODO_H * 2.4)) };
};

export type Tiempos = {
  /** Segundo en que el paquete llega a cada paso (cuando la voz lo nombra). */
  llegadas: number[];
  /** Segundo en que sale hacia cada paso; salidas[0] no se usa. */
  salidas: number[];
  regreso: number | null;
  final: number | null;
};

/** Ordena los momentos de la voz y calcula cuándo sale el paquete hacia cada paso. */
export const tiemposRecorrido = (ms: number[], n: number, conRegreso: boolean, conFinal: boolean): Tiempos => {
  const llegadas: number[] = [];
  for (let i = 0; i < n; i++) llegadas.push(i === 0 ? Math.max(0.05, ms[0]) : Math.max(ms[i], llegadas[i - 1] + 0.3));
  const salidas = llegadas.map((t, i) => (i === 0 ? t : t - Math.min(1, Math.max(0.3, (t - llegadas[i - 1]) * 0.6))));
  const extra = (k: number) => Math.max(ms[k] ?? 0, llegadas[n - 1] + 0.3);
  return {
    llegadas,
    salidas,
    regreso: conRegreso ? extra(n) : null,
    final: conFinal ? extra(n + (conRegreso ? 1 : 0)) : null,
  };
};

type Llave = { t: number; plano: Plano };

/** Llaves de la cámara: general → cada paso al nombrarlo → general al final. */
export const llavesCamara = (g: Geometria, tm: Tiempos, duracion: number, ancho: number, alto: number): Llave[] => {
  const general = planoGeneral(g, ancho, alto);
  const cerca = (i: number) => planoCerrado(g, i, alto);
  const n = g.nodos.length;
  const llaves: Llave[] = [];
  const poner = (t: number, plano: Plano) => {
    const previo = llaves.length ? llaves[llaves.length - 1].t + 0.05 : 0;
    llaves.push({ t: Math.max(t, previo), plano });
  };
  poner(0, general);
  // Plano de establecimiento, luego se acerca al primer paso
  const tAcercar = Math.max(0.35, tm.llegadas[0] - 0.3);
  poner(tAcercar, general);
  poner(tAcercar + 0.8, cerca(0));
  for (let i = 1; i < n; i++) {
    poner(tm.salidas[i], cerca(i - 1));
    poner(tm.llegadas[i], cerca(i));
  }
  const tAbrir = tm.regreso ?? (tm.final !== null ? tm.final - 0.2 : null);
  if (tAbrir !== null) {
    poner(tAbrir, cerca(n - 1));
    poner(tAbrir + (tm.regreso !== null ? DUR_REGRESO : 0.8), general);
  } else {
    // Sin regreso ni final: revela la ruta completa al terminar, si hay tiempo
    const fin = duracion - 0.3;
    if (fin - llaves[llaves.length - 1].t > 1.6) {
      poner(fin - 1.2, cerca(n - 1));
      poner(fin, general);
    }
  }
  return llaves;
};

/** Plano de la cámara en el segundo t; la escala se interpola en logaritmo para que el zoom se sienta parejo. */
export const camaraEn = (llaves: Llave[], t: number): Plano => {
  if (t <= llaves[0].t) return llaves[0].plano;
  for (let k = 1; k < llaves.length; k++) {
    const a = llaves[k - 1];
    const b = llaves[k];
    if (t <= b.t) {
      const p = easeInOut(fijar01((t - a.t) / Math.max(1e-6, b.t - a.t)));
      return {
        cx: a.plano.cx + (b.plano.cx - a.plano.cx) * p,
        cy: a.plano.cy + (b.plano.cy - a.plano.cy) * p,
        escala: Math.exp(Math.log(a.plano.escala) + (Math.log(b.plano.escala) - Math.log(a.plano.escala)) * p),
      };
    }
  }
  return llaves[llaves.length - 1].plano;
};

/** Avance (0–1) del paquete por el tramo hacia el paso i. */
export const avanceTramo = (tm: Tiempos, i: number, t: number) =>
  easeInOut(fijar01((t - tm.salidas[i]) / Math.max(1e-6, tm.llegadas[i] - tm.salidas[i])));

export const avanceRegreso = (tm: Tiempos, t: number) => (tm.regreso === null ? 0 : easeInOut(fijar01((t - tm.regreso) / DUR_REGRESO)));

/** Dónde está el paquete y qué tan grande se ve (0 = oculto). */
export const paqueteEn = (g: Geometria, tm: Tiempos, t: number): { curva: Curva; p: number; tam: number } | null => {
  const ver = (llegada: number) => (t <= llegada ? 1 : 1 - fijar01((t - llegada) / DESVANECER));
  if (tm.regreso !== null && g.regreso && t >= tm.regreso && t <= tm.regreso + DUR_REGRESO + DESVANECER) {
    return { curva: g.regreso, p: avanceRegreso(tm, t), tam: ver(tm.regreso + DUR_REGRESO) };
  }
  for (let i = g.tramos.length; i >= 1; i--) {
    if (t >= tm.salidas[i] && t <= tm.llegadas[i] + DESVANECER) {
      return { curva: g.tramos[i - 1], p: avanceTramo(tm, i, t), tam: ver(tm.llegadas[i]) };
    }
  }
  return null;
};
