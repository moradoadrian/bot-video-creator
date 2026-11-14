/**
 * Datos de las animaciones que salen de ejecutar el código de verdad.
 * La plantilla no puede ejecutar código: render.ts calcula esto y se lo pasa ya listo.
 */
import { parse } from 'acorn';
import { Animacion, CicloCalculado, EscenaCodigo, PasoTraza, VariableTraza, VueltaCiclo } from '../src/types';
import { momentosClave } from '../src/momentos';
import { trazar } from './traza';

/** Vueltas que vale la pena guardar de un bucle infinito: después solo se ve acelerar. */
const MAX_VUELTAS_INFINITO = 60;

const recorrer = (n: any, f: (n: any) => boolean | void) => {
  if (!n || typeof n.type !== 'string') return;
  if (f(n) === false) return;
  for (const k of Object.keys(n)) {
    if (k === 'loc') continue;
    const v = n[k];
    if (Array.isArray(v)) v.forEach((x) => recorrer(x, f));
    else if (v && typeof v.type === 'string') recorrer(v, f);
  }
};

const variablesDe = (paso: PasoTraza): VariableTraza[] => {
  const vistas = new Set<string>();
  // Los grupos van del ámbito más interno al global: el primero que la nombra es el que cuenta.
  return paso.grupos.flatMap((g) => g.variables.filter((v) => !vistas.has(v.nombre) && vistas.add(v.nombre)));
};

const nombreDe = (n: any): string | undefined => {
  if (!n) return undefined;
  if (n.type === 'Identifier') return n.name;
  if (n.type === 'VariableDeclaration') return nombreDe(n.declarations[0]?.id);
  if (n.type === 'UpdateExpression') return nombreDe(n.argument);
  if (n.type === 'AssignmentExpression') return nombreDe(n.left);
  if (n.type === 'BinaryExpression' || n.type === 'LogicalExpression') return nombreDe(n.left) ?? nombreDe(n.right);
  return undefined;
};

/** Busca el primer for o while del código y lo describe. */
export const leerCiclo = (codigo: string) => {
  const ast: any = parse(codigo, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  let ciclo: any = null;
  recorrer(ast, (n) => {
    if (ciclo) return false;
    if (n.type === 'ForStatement' || n.type === 'WhileStatement') {
      ciclo = n;
      return false;
    }
  });
  if (!ciclo) return null;
  const texto = (n: any) => (n ? codigo.slice(n.start, n.end) : undefined);
  const esFor = ciclo.type === 'ForStatement';
  const variable = esFor ? (nombreDe(ciclo.init) ?? nombreDe(ciclo.update) ?? nombreDe(ciclo.test)) : nombreDe(ciclo.test);
  return {
    tipo: (esFor ? 'for' : 'while') as CicloCalculado['tipo'],
    variable,
    linea: ciclo.loc.start.line as number,
    cuerpo: [ciclo.body.loc.start.line, ciclo.body.loc.end.line] as [number, number],
    partes: { inicio: texto(ciclo.init), condicion: texto(ciclo.test) ?? 'true', cambio: texto(ciclo.update) },
  };
};

/**
 * Calcula las vueltas de un ciclo: cada paso en la línea del ciclo es una revisión de la condición.
 * Si después de revisar la ejecución entra al cuerpo, la condición fue verdadera.
 */
export const calcularCiclo = (codigo: string): { calculado?: CicloCalculado; error?: string } => {
  let info: ReturnType<typeof leerCiclo>;
  try {
    info = leerCiclo(codigo);
  } catch (e: any) {
    return { error: `el código no se puede leer (${e.message})` };
  }
  if (!info) return { error: 'el código no tiene un ciclo for ni while' };
  if (!info.variable) return { error: 'no se encontró la variable que cuenta las vueltas' };
  if (info.cuerpo[0] === info.linea && info.cuerpo[1] === info.linea) {
    return { error: 'el cuerpo del ciclo está en la misma línea; ponlo en su propia línea para animarlo' };
  }
  const { traza, error, incompleta } = trazar(codigo, { parcial: true });
  if (!traza) return { error: `no se pudo ejecutar (${error})` };

  const { pasos } = traza;
  const dentro = (linea: number) => linea > info!.linea && linea >= info!.cuerpo[0] && linea <= info!.cuerpo[1];
  const revisiones = pasos.flatMap((p, i) => (p.linea === info!.linea ? [i] : []));
  const vueltas: VueltaCiclo[] = [];
  for (let k = 0; k < revisiones.length; k++) {
    const r = revisiones[k];
    // Entra si lo siguiente pasa dentro del cuerpo, o si se revisa otra vez (un cuerpo vacío no deja pasos).
    const entra = r + 1 < pasos.length && (dentro(pasos[r + 1].linea) || revisiones[k + 1] === r + 1);
    let fin = r;
    if (entra && revisiones[k + 1] !== undefined && revisiones[k + 1] > r + 1) {
      // Todo lo que pasa antes de la siguiente revisión es parte de la vuelta, aunque llame a una función de otra línea.
      fin = revisiones[k + 1] - 1;
    } else if (entra && revisiones[k + 1] === undefined) {
      // Salió con break: la vuelta termina en el último paso dentro del cuerpo.
      for (let p = r + 1; p < pasos.length && dentro(pasos[p].linea); p++) fin = p;
    }
    const valor = variablesDe(pasos[r]).find((v) => v.nombre === info!.variable)?.valor ?? '?';
    const salidas: number[] = [];
    for (let s = pasos[r].nSalida; s < pasos[fin].nSalida; s++) salidas.push(s);
    const otras = variablesDe(pasos[fin]).filter((v) => v.nombre !== info!.variable).slice(0, 2);
    vueltas.push({ revision: r, valor, entra, finCuerpo: fin, salidas, otras });
    // Un break sale sin volver a revisar: ya no hay más vueltas.
    if (!entra) break;
    if (incompleta && vueltas.length >= MAX_VUELTAS_INFINITO) break;
  }
  if (!vueltas.length) return { error: 'el ciclo nunca se revisa' };
  // Una vuelta guardada a medias (cortada por el límite de pasos) no sirve.
  if (incompleta && vueltas.length > 1) vueltas.pop();
  return {
    calculado: {
      tipo: info.tipo,
      variable: info.variable,
      linea: info.linea,
      partes: info.partes,
      vueltas,
      infinito: !!incompleta,
    },
  };
};

/** Agrega a la animación de cada escena lo que sale de ejecutar su código. */
export const calcularAnimacion = (e: EscenaCodigo): Animacion | undefined => {
  if (!e.animacion || !e.codigo) return e.animacion;
  if (e.animacion.tipo === 'ciclo') {
    const { calculado } = calcularCiclo(e.codigo);
    return calculado ? { ...e.animacion, calculado } : e.animacion;
  }
  return e.animacion;
};

/** Avisos de una escena con animación: los datos escritos deben coincidir con lo que hace el código. */
export const verificarAnimacion = (e: EscenaCodigo, n: string): string[] => {
  const a = e.animacion;
  if (!a) return [];
  if (!e.codigo) return [`${n}: la animación "${a.tipo}" necesita código.`];
  if (a.tipo === 'ciclo') {
    const { calculado, error } = calcularCiclo(e.codigo);
    if (!calculado) return [`${n}: no se puede animar el ciclo: ${error}. Se mostrará el editor normal.`];
    const avisos: string[] = [];
    if (a.datos?.variable && a.datos.variable !== calculado.variable) {
      avisos.push(`${n}: la animación dice que la variable es "${a.datos.variable}", pero el ciclo usa "${calculado.variable}".`);
    }
    const entradas = calculado.vueltas.filter((v) => v.entra).length;
    if (a.datos?.vueltas !== undefined && !calculado.infinito && a.datos.vueltas !== entradas) {
      avisos.push(`${n}: la animación dice ${a.datos.vueltas} vueltas, pero el código da ${entradas}.`);
    }
    for (const [parte, clave] of Object.entries(a.datos?.claves ?? {})) {
      if (clave && !momentosClave([clave], e.narracion, 10)[0].ok) {
        avisos.push(`${n}: la clave "${clave}" (${parte}) no se dice en la narración; esa parte entrará en un tiempo estimado.`);
      }
    }
    if (calculado.vueltas.length > 40 && !calculado.infinito) {
      avisos.push(`${n}: el ciclo da ${calculado.vueltas.length} vueltas; se verán muy rápido. Usa un ejemplo más corto.`);
    }
    return avisos;
  }
  return [];
};
