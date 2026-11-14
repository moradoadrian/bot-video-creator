/**
 * Transiciones entre bloques: una pieza de la escena que termina (la raya del título, el número
 * de escena) se despega, se transforma y aterriza como una pieza de la siguiente (el número
 * nuevo, el botón de seguir). Aquí está la geometría, sin React, para poder probarla.
 */
import { zoomCamara } from './camara';

/** Frames antes del corte (la pieza despega) y después (llega a su lugar). */
export const ANTES = 9;
export const DESPUES = 11;
/** En el cierre, el botón de seguir aparece a los 0.5 s: la pieza aterriza justo ahí. */
export const DESPUES_CIERRE = 15;

export type Pieza = { x: number; y: number; ancho: number; alto: number; radio: number };

const ORIGEN = { x: 540, y: 1920 * 0.42 };

/** Una caja vista a través de la cámara del bloque (zoom alrededor del 50% 42%). */
const porCamara = (p: Pieza, escala: number): Pieza => ({
  x: ORIGEN.x + (p.x - ORIGEN.x) * escala,
  y: ORIGEN.y + (p.y - ORIGEN.y) * escala,
  ancho: p.ancho * escala,
  alto: p.alto * escala,
  radio: p.radio * escala,
});

/** Líneas que ocupa un texto de `n` caracteres a `fs` px en `ancho` px (Bricolage 800: ~0.52 em por carácter). */
const lineas = (n: number, fs: number, ancho: number) => Math.max(1, Math.ceil((n * fs * 0.52) / ancho));

/** Insignia "2/5" de una escena; x, y es la esquina superior izquierda en coordenadas del bloque. */
export const insignia = (numero: number, total: number, titulo: string): Pieza => {
  const texto = `${numero}/${total}`;
  const ancho = texto.length * 34 * 0.6 + 36;
  const alto = 58;
  const libre = 1080 - 70 - 160 - ancho - 24;
  const altoTitulo = lineas(titulo.length, 70, libre) * 70;
  const centroY = 205 + Math.max(alto, altoTitulo) / 2;
  return { x: 70, y: centroY - alto / 2, ancho, alto, radio: 14 };
};

/** La raya bajo el título del gancho. */
export const rayaGancho = (titulo: string): Pieza => {
  const altoTitulo = lineas(titulo.length, 112, 850) * 112 * 0.98;
  return { x: 70, y: 210 + 50 + 34 + altoTitulo + 22, ancho: 320, alto: 14, radio: 7 };
};

/** El botón "+ Seguir" del cierre. */
export const botonSeguir = (): Pieza => ({ x: 70, y: 990, ancho: 8 * 46 * 0.6 + 84, alto: 97, radio: 48 });

/** Pieza que despega al final de un bloque (con la cámara como está al terminar). */
export const piezaSalida = (p: Pieza, duracion: number) => porCamara(p, zoomCamara(duracion, duracion, []));
/** Pieza donde aterriza, en el segundo `t` del bloque que empieza. */
export const piezaLlegada = (p: Pieza, t: number, duracion: number) => porCamara(p, zoomCamara(t, duracion, []));

/** El punto medio del viaje: un círculo al centro de la pantalla, donde ocurre el corte. */
export const CENTRO: Pieza = { x: 540 - 95, y: 760 - 95, ancho: 190, alto: 190, radio: 95 };
