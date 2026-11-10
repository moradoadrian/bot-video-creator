import { Palabra, Visual } from './types';

/** Minúsculas, sin acentos ni signos: "¿Node.js?" → "node js". */
export const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokens = (s: string) => normalizar(s).split(' ').filter(Boolean);

/** Igual, o la palabra dicha empieza con la clave ("valida" ≈ "validan") si la clave no es muy corta. */
const coincide = (dicha: string, clave: string) => dicha === clave || (clave.length >= 4 && dicha.startsWith(clave));

/** Claves de un diagrama, en el orden en que aparecen sus elementos. */
export const clavesDe = (v: Visual): string[] => {
  switch (v.tipo) {
    case 'tarjetas':
      return [...v.items.map((i) => i.clave ?? i.texto), ...(v.etiquetas ? [v.etiquetas.clave ?? v.etiquetas.lista[0]] : [])];
    case 'flujo':
      return [
        ...v.pasos.map((i) => i.clave ?? i.texto),
        ...(v.regreso ? [v.regreso.clave ?? v.regreso.texto] : []),
        ...(v.final ? [v.final.clave ?? v.final.texto] : []),
      ];
    case 'suma':
      return [...v.partes, v.resultado].map((i) => i.clave ?? i.texto);
    case 'versus':
      return v.lados.map((i) => i.clave ?? i.texto);
  }
};

/**
 * Segundo en que se dice cada clave. Con tiempos reales de la voz usa las palabras;
 * sin ellos, estima por la posición de la clave en el texto. Las claves se buscan en orden,
 * así que nunca retroceden. Si una no aparece, sale un poco después de la anterior (ok = false).
 */
export const momentosClave = (claves: string[], narracion: string, duracion: number, palabras?: Palabra[]) => {
  const dichas = palabras?.length ? palabras.flatMap((p) => tokens(p.texto).map((tok) => ({ tok, inicio: p.inicio }))) : null;
  const texto = normalizar(narracion);
  const tope = Math.max(0, duracion - 0.4);
  let pos = 0;
  let prev = 0.1;
  return claves.map((c) => {
    const cs = tokens(c);
    let t: number | null = null;
    if (cs.length && dichas) {
      for (let k = pos; k + cs.length <= dichas.length; k++) {
        if (cs.every((x, j) => coincide(dichas[k + j].tok, x))) {
          t = dichas[k].inicio;
          pos = k + cs.length;
          break;
        }
      }
    } else if (cs.length) {
      const buscado = cs.join(' ');
      let k = texto.indexOf(buscado, pos);
      while (k > 0 && texto[k - 1] !== ' ') k = texto.indexOf(buscado, k + 1);
      if (k >= 0) {
        t = (k / Math.max(1, texto.length)) * duracion;
        pos = k + buscado.length;
      }
    }
    const final = Math.min(Math.max(t ?? prev + 0.6, prev), tope);
    prev = final;
    return { t: final, ok: t !== null };
  });
};
