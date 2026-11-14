/**
 * Escenario de una escena con código: dónde está cada panel (editor, fila de la animación o
 * del depurador, consola) y a cuál mira la cámara en cada momento. Si todo cabe en la ventana,
 * la cámara solo se acerca e inclina hacia el panel en foco; si no cabe, viaja entre ellos.
 * Todo en segundos y píxeles, sin React, para poder probarlo.
 */

/** Zona de la pantalla donde viven los paneles: del editor hasta el respiro sobre el personaje. */
export const VENTANA = { arriba: 400, abajo: 1266 };
export const ALTO_VENTANA = VENTANA.abajo - VENTANA.arriba;
/** Lo que tarda la cámara en pasar de una toma a otra. */
export const TRANSICION = 0.75;

export type Foco = 'editor' | 'abajo' | 'todo';
export type Toma = { t: number; foco: Foco };
export type Caja = { y: number; alto: number };
/** Posiciones relativas al borde superior de la ventana. */
export type Mundo = { editor: Caja; abajo: Caja | null; alto: number; viaja: boolean };

/**
 * `puedeViajar`: las medidas decidieron que el código y lo de abajo no caben juntos.
 * Sin ese permiso la cámara nunca viaja (por ejemplo, el depurador llena la pantalla a propósito).
 */
export const mundoDe = (altoEditor: number, altoAbajo: number, separacion: number, puedeViajar = true): Mundo => {
  const editor = { y: 0, alto: altoEditor };
  const abajo = altoAbajo > 0 ? { y: altoEditor + separacion, alto: altoAbajo } : null;
  const alto = abajo ? abajo.y + abajo.alto : altoEditor;
  return { editor, abajo, alto, viaja: puedeViajar && alto > ALTO_VENTANA + 0.5 };
};

/** ¿Hace falta viajar? Solo si los paneles no caben juntos en la ventana. */
export const viaja = (m: Mundo) => m.viaja;

export type Encuadre = {
  /** Desplazamiento vertical del mundo (negativo = sube). */
  dy: number;
  /** Acercamiento hacia el panel en foco. */
  escala: number;
  /** Punto (y, relativo a la ventana) hacia el que se acerca. */
  origen: number;
};

const ACERCAMIENTO = 0.03;

export const encuadre = (m: Mundo, foco: Foco): Encuadre => {
  const caja = foco === 'editor' ? m.editor : foco === 'abajo' ? (m.abajo ?? m.editor) : null;
  if (!viaja(m)) {
    // Todo cabe: no se mueve, solo se acerca un poco al panel en foco
    if (!caja) return { dy: 0, escala: 1, origen: m.alto / 2 };
    return { dy: 0, escala: 1 + ACERCAMIENTO, origen: caja.y + caja.alto / 2 };
  }
  // No cabe: el editor se ve desde arriba, lo de abajo se alinea al borde inferior
  const minimo = ALTO_VENTANA - m.alto;
  if (foco === 'editor') return { dy: 0, escala: 1, origen: m.editor.alto / 2 };
  return { dy: minimo, escala: 1, origen: m.alto - ALTO_VENTANA / 2 };
};

const easeInOut = (x: number) => {
  const p = Math.min(1, Math.max(0, x));
  return p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
};

/** Toma vigente y cuánto avanzó la transición desde la anterior. */
const tomaEn = (tomas: Toma[], t: number) => {
  let k = 0;
  tomas.forEach((x, i) => {
    if (x.t <= t) k = i;
  });
  const p = k === 0 ? 1 : easeInOut((t - tomas[k].t) / TRANSICION);
  return { actual: tomas[k], previa: tomas[Math.max(0, k - 1)], p };
};

export const camaraEscenario = (m: Mundo, tomas: Toma[], t: number): Encuadre => {
  if (!tomas.length) return { dy: 0, escala: 1, origen: m.alto / 2 };
  const { actual, previa, p } = tomaEn(tomas, t);
  const a = encuadre(m, previa.foco);
  const b = encuadre(m, actual.foco);
  return { dy: a.dy + (b.dy - a.dy) * p, escala: a.escala + (b.escala - a.escala) * p, origen: a.origen + (b.origen - a.origen) * p };
};

/** Qué tan en foco está un panel (1 = de frente, 0 = inclinado y atenuado). 'todo' deja ambos de frente. */
export const pesoFoco = (tomas: Toma[], t: number, panel: 'editor' | 'abajo') => {
  if (!tomas.length) return 1;
  const peso = (f: Foco) => (f === 'todo' || f === panel ? 1 : 0);
  const { actual, previa, p } = tomaEn(tomas, t);
  return peso(previa.foco) + (peso(actual.foco) - peso(previa.foco)) * p;
};

/** Ordena las tomas, quita las que caen fuera de la escena o demasiado juntas, y las repetidas. */
export const limpiarTomas = (tomas: Toma[], dur: number, separacion = 1.0): Toma[] => {
  const out: Toma[] = [];
  for (const x of [...tomas].filter((x) => Number.isFinite(x.t)).sort((a, b) => a.t - b.t)) {
    const t = Math.max(0, Math.min(x.t, dur - 0.2));
    const prev = out[out.length - 1];
    if (prev && prev.foco === x.foco) continue;
    if (prev && t - prev.t < separacion) {
      // Dos cambios muy juntos: gana el último
      out[out.length - 1] = { t: prev.t, foco: x.foco };
      continue;
    }
    out.push({ t, foco: x.foco });
  }
  return out.filter((x, i) => i === 0 || x.foco !== out[i - 1].foco);
};
