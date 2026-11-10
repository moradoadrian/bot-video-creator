/** Tecleo carácter por carácter de varias líneas de código. Todo en segundos, sin React, para poder probarlo. */

const fijar01 = (x: number) => Math.min(1, Math.max(0, x));
const largo = (lineas: string[]) => lineas.reduce((a, l) => a + l.length, 0);

/** Lo que dura teclear `total` caracteres: ~30 ms cada uno, sin pasar de `maximo`. */
export const duracionTecleo = (total: number, maximo: number) => Math.max(0.3, Math.min(maximo, Math.max(0.5, total * 0.03)));

/** Cuántos caracteres de cada línea se ven en el segundo t. */
export const visiblesPorLinea = (lineas: string[], t: number, inicio: number, duracion: number) => {
  let restantes = Math.floor(fijar01((t - inicio) / Math.max(0.01, duracion)) * largo(lineas));
  return lineas.map((l) => {
    const n = Math.max(0, Math.min(l.length, restantes));
    restantes -= l.length;
    return n;
  });
};

/** El cursor va en la primera línea sin terminar; al acabar, en la última. */
export const lineaDelCursor = (lineas: string[], visibles: number[]) => {
  const i = lineas.findIndex((l, k) => visibles[k] < l.length);
  return i < 0 ? lineas.length - 1 : i;
};

/** Segundo en que empieza a escribirse cada línea. */
export const iniciosDeLinea = (lineas: string[], inicio: number, duracion: number) => {
  const total = Math.max(1, largo(lineas));
  let acc = 0;
  return lineas.map((l) => {
    const t = inicio + (acc / total) * duracion;
    acc += l.length;
    return t;
  });
};

/** Momentos para el sonido de tecla: uno cada `cada` caracteres. */
export const momentosDeTecla = (lineas: string[], inicio: number, duracion: number, cada = 3) => {
  const total = largo(lineas);
  return Array.from({ length: Math.ceil(total / cada) }, (_, k) => inicio + ((k * cada) / Math.max(1, total)) * duracion);
};
