import React from 'react';

/** Colores del editor (tema oscuro propio del canal código). */
export const SINTAXIS = {
  texto: '#E8E4FF',
  palabra: '#FF7A8A', // for, let, if…
  cadena: '#7FD1B9',
  numero: '#FFB454',
  comentario: '#8A84A8',
  funcion: '#6CC4FF',
  objeto: '#B79CFF',
  signo: '#C9C3E6',
};

const PALABRAS = new Set([
  'for', 'let', 'const', 'var', 'while', 'do', 'if', 'else', 'return', 'function', 'true', 'false',
  'null', 'undefined', 'break', 'continue', 'of', 'in', 'new', 'switch', 'case', 'default', 'class',
]);

type Token = { t: string; c: string };

/** Resaltado sencillo de JavaScript, línea por línea. Suficiente para ejemplos de principiantes. */
export const tokens = (linea: string): Token[] => {
  const out: Token[] = [];
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(linea))) {
    const [txt, com, str, num, id, esp] = m;
    if (com) out.push({ t: txt, c: SINTAXIS.comentario });
    else if (str) out.push({ t: txt, c: SINTAXIS.cadena });
    else if (num) out.push({ t: txt, c: SINTAXIS.numero });
    else if (id) {
      const resto = linea.slice(re.lastIndex);
      if (PALABRAS.has(id)) out.push({ t: txt, c: SINTAXIS.palabra });
      else if (/^\s*\(/.test(resto)) out.push({ t: txt, c: SINTAXIS.funcion });
      else if (id === 'console' || id === 'Math') out.push({ t: txt, c: SINTAXIS.objeto });
      else out.push({ t: txt, c: SINTAXIS.texto });
    } else if (esp) out.push({ t: txt, c: SINTAXIS.texto });
    else out.push({ t: txt, c: SINTAXIS.signo });
  }
  return out;
};

export const LineaCodigo: React.FC<{ linea: string }> = ({ linea }) => (
  <>
    {tokens(linea).map((k, i) => (
      <span key={i} style={{ color: k.c }}>
        {k.t}
      </span>
    ))}
  </>
);
