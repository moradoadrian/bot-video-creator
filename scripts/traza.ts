/**
 * Ejecuta un ejemplo de JavaScript paso a paso y registra línea, variables y consola en cada paso.
 * Inserta llamadas de registro en el código (sin cambiar sus números de línea) y lo corre con node:vm.
 * vm no es una barrera de seguridad: solo sirve para código ya revisado.
 */
import { parse } from 'acorn';
import vm from 'node:vm';
import { ANONIMA } from '../src/depurador';
import { GrupoTraza, PasoTraza, Traza } from '../src/types';

/** Un video no puede mostrar más pasos; también corta bucles largos antes del timeout. */
export const MAX_PASOS = 300;

type Ambito = {
  id: number;
  nombres: string[];
  etiqueta: string;
  funcionId: number;
  esBloque: boolean;
};

const SIN_PASO = new Set([
  'BlockStatement',
  'FunctionDeclaration',
  'ClassDeclaration',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'LabeledStatement',
  'EmptyStatement',
]);

/** Sentencias que siguen de largo al terminar, y por eso pueden registrar su resultado. */
const CON_EFECTO = new Set(['ExpressionStatement', 'VariableDeclaration']);

const nombresDePatron = (p: any, out: string[]) => {
  if (!p) return;
  if (p.type === 'Identifier') out.push(p.name);
  else if (p.type === 'ObjectPattern') p.properties.forEach((x: any) => nombresDePatron(x.type === 'Property' ? x.value : x, out));
  else if (p.type === 'ArrayPattern') p.elements.forEach((x: any) => nombresDePatron(x, out));
  else if (p.type === 'RestElement') nombresDePatron(p.argument, out);
  else if (p.type === 'AssignmentPattern') nombresDePatron(p.left, out);
};

const hijos = (n: any): any[] => {
  const out: any[] = [];
  for (const k of Object.keys(n)) {
    if (k === 'loc') continue;
    const v = n[k];
    if (Array.isArray(v)) out.push(...v.filter((x) => x && typeof x.type === 'string'));
    else if (v && typeof v.type === 'string') out.push(v);
  }
  return out;
};

const esFuncion = (n: any) => ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type);

/** Variables con var: suben hasta la función, sin entrar a funciones internas. */
const varsProfundas = (n: any, out: string[]) => {
  if (n.type === 'VariableDeclaration' && n.kind === 'var') n.declarations.forEach((d: any) => nombresDePatron(d.id, out));
  for (const h of hijos(n)) if (!esFuncion(h)) varsProfundas(h, out);
};

/** let y const del bloque. Las funciones y clases declaradas no se listan: solo llenarían el panel. */
const lexicas = (sentencias: any[], out: string[]) => {
  for (const s of sentencias) {
    if (s.type === 'VariableDeclaration' && s.kind !== 'var') s.declarations.forEach((d: any) => nombresDePatron(d.id, out));
  }
};

/** Devuelve el código instrumentado y los datos de cada ámbito. */
export const instrumentar = (codigo: string) => {
  const ast: any = parse(codigo, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  // Las inserciones en la misma posición conservan el orden en que se agregaron.
  const edits: { pos: number; texto: string }[] = [];
  const insertar = (pos: number, texto: string) => edits.push({ pos, texto });
  const ambitos: Ambito[] = [];
  const cadena: Ambito[] = [];
  const nombresFuncion = new WeakMap<object, string>();
  const funciones = ['programa'];
  let funcionActual = 0;

  const abrir = (nombres: string[], etiqueta: string, esBloque: boolean) => {
    const a: Ambito = { id: ambitos.length, nombres: [...new Set(nombres)], etiqueta, funcionId: funcionActual, esBloque };
    ambitos.push(a);
    cadena.push(a);
  };

  const llamadaPaso = (linea: number, registro = '__t') => {
    const vistos = new Set<string>();
    const partes: string[] = [];
    // Del ámbito más interno al global: una variable interna oculta a la de afuera.
    for (const a of [...cadena].reverse()) {
      const propias = a.nombres.filter((x) => !vistos.has(x));
      propias.forEach((x) => vistos.add(x));
      if (propias.length) partes.push(`${a.id}:{${propias.map((x) => `${JSON.stringify(x)}:()=>${x}`).join(',')}}`);
    }
    return `${registro}(${linea},{${partes.join(',')}})`;
  };

  const sentencia = (n: any, unica: boolean) => {
    const conPaso = !SIN_PASO.has(n.type) && !n.directive;
    if (!conPaso) return visitar(n);
    if (unica) insertar(n.start, '{');
    insertar(n.start, `${llamadaPaso(n.loc.start.line)};`);
    visitar(n);
    // Al terminar la línea se registra otra vez: así el paso muestra su efecto, y una línea que
    // llamó a una función vuelve a resaltarse cuando esa función regresa.
    if (CON_EFECTO.has(n.type)) insertar(n.end, `;${llamadaPaso(n.loc.start.line, '__d')};`);
    if (unica) insertar(n.end, '}');
  };

  /** La condición de un ciclo registra un paso cada vez que se revisa. */
  const condicion = (test: any) => {
    insertar(test.start, `(${llamadaPaso(test.loc.start.line)},`);
    visitar(test);
    insertar(test.end, ')');
  };

  const funcion = (n: any) => {
    if (n.async || n.generator) throw new Error('El depurador aún no soporta funciones async ni generadores');
    const nombre = n.id?.name ?? nombresFuncion.get(n) ?? ANONIMA;
    const anterior = funcionActual;
    funcionActual = funciones.push(nombre) - 1;
    const id = funcionActual;
    const nombres: string[] = [];
    n.params.forEach((p: any) => nombresDePatron(p, nombres));
    varsProfundas(n.body, nombres);
    if (n.body.type === 'BlockStatement') lexicas(n.body.body, nombres);
    abrir(nombres, nombre, false);
    n.params.forEach(visitar);
    const entrada = `__e(${id});try{`;
    const salida = '}finally{__s();}';
    if (n.body.type === 'BlockStatement') {
      insertar(n.body.start + 1, entrada);
      n.body.body.forEach((s: any) => sentencia(s, false));
      insertar(n.body.end - 1, salida);
    } else {
      // Flecha con expresión: se convierte en bloque. Se busca la flecha porque el cuerpo puede ir entre paréntesis.
      const flecha = codigo.lastIndexOf('=>', n.body.start) + 2;
      insertar(flecha, `{${entrada}${llamadaPaso(n.body.loc.start.line)};return (`);
      visitar(n.body);
      insertar(n.end, `);${salida}}`);
    }
    cadena.pop();
    funcionActual = anterior;
  };

  const conAmbito = (nombres: string[], etiqueta: string, cuerpo: () => void) => {
    abrir(nombres, etiqueta, true);
    cuerpo();
    cadena.pop();
  };

  const visitar = (n: any): void => {
    switch (n.type) {
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return funcion(n);
      case 'BlockStatement': {
        const nombres: string[] = [];
        lexicas(n.body, nombres);
        return conAmbito(nombres, 'bloque', () => n.body.forEach((s: any) => sentencia(s, false)));
      }
      case 'IfStatement':
        visitar(n.test);
        sentencia(n.consequent, true);
        if (n.alternate) sentencia(n.alternate, true);
        return;
      case 'ForStatement': {
        const nombres: string[] = [];
        if (n.init?.type === 'VariableDeclaration' && n.init.kind !== 'var') lexicas([n.init], nombres);
        return conAmbito(nombres, 'for', () => {
          if (n.init) visitar(n.init);
          if (n.test) condicion(n.test);
          if (n.update) visitar(n.update);
          sentencia(n.body, true);
        });
      }
      case 'ForInStatement':
      case 'ForOfStatement': {
        const nombres: string[] = [];
        if (n.left.type === 'VariableDeclaration' && n.left.kind !== 'var') lexicas([n.left], nombres);
        return conAmbito(nombres, 'for', () => {
          visitar(n.right);
          // Registra cada vuelta sobre la línea del ciclo, con la variable ya asignada.
          const paso = `${llamadaPaso(n.loc.start.line)};`;
          if (n.body.type === 'BlockStatement') {
            insertar(n.body.start + 1, paso);
            sentenciasDeBloque(n.body);
          } else {
            insertar(n.body.start, `{${paso}`);
            sentencia(n.body, false);
            insertar(n.body.end, '}');
          }
        });
      }
      case 'WhileStatement':
        condicion(n.test);
        return sentencia(n.body, true);
      case 'DoWhileStatement':
        sentencia(n.body, true);
        return condicion(n.test);
      case 'LabeledStatement':
        return sentencia(n.body, true);
      case 'SwitchStatement': {
        visitar(n.discriminant);
        const nombres: string[] = [];
        n.cases.forEach((c: any) => lexicas(c.consequent, nombres));
        return conAmbito(nombres, 'bloque', () =>
          n.cases.forEach((c: any) => {
            if (c.test) visitar(c.test);
            c.consequent.forEach((s: any) => sentencia(s, false));
          }),
        );
      }
      case 'TryStatement':
        visitar(n.block);
        if (n.handler) {
          const nombres: string[] = [];
          nombresDePatron(n.handler.param, nombres);
          conAmbito(nombres, 'bloque', () => visitar(n.handler.body));
        }
        if (n.finalizer) visitar(n.finalizer);
        return;
      default:
        if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init) nombresFuncion.set(n.init, n.id.name);
        if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier') nombresFuncion.set(n.right, n.left.name);
        if (n.type === 'Property' && n.key.type === 'Identifier') nombresFuncion.set(n.value, n.key.name);
        if ((n.type === 'MethodDefinition' || n.type === 'PropertyDefinition') && n.key.type === 'Identifier' && n.value) {
          nombresFuncion.set(n.value, n.key.name);
        }
        hijos(n).forEach(visitar);
    }
  };

  const sentenciasDeBloque = (bloque: any) => {
    const nombres: string[] = [];
    lexicas(bloque.body, nombres);
    conAmbito(nombres, 'bloque', () => bloque.body.forEach((s: any) => sentencia(s, false)));
  };

  const globales: string[] = [];
  varsProfundas(ast, globales);
  lexicas(ast.body, globales);
  abrir(globales, 'global', false);
  ast.body.forEach((s: any) => sentencia(s, false));
  insertar(codigo.length, `\n${llamadaPaso(0)};`);

  let salida = '';
  let cursor = 0;
  edits
    .map((e, orden) => ({ ...e, orden }))
    .sort((a, b) => a.pos - b.pos || a.orden - b.orden)
    .forEach((e) => {
      salida += codigo.slice(cursor, e.pos) + e.texto;
      cursor = e.pos;
    });
  return { codigo: salida + codigo.slice(cursor), ambitos, funciones };
};

/** Valor como se ve en el panel: una función no se puede imprimir, así que se nombra. */
export const formatoValor = (v: unknown, profundidad = 0): string => {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'function') return profundidad ? 'ƒ' : 'función';
  if (Array.isArray(v)) return profundidad > 2 ? '[…]' : `[${v.map((x) => formatoValor(x, profundidad + 1)).join(', ')}]`;
  if (v && typeof v === 'object') {
    if (profundidad > 2) return '{…}';
    return `{${Object.entries(v).map(([k, x]) => `${k}: ${formatoValor(x, profundidad + 1)}`).join(', ')}}`;
  }
  return String(v);
};

const formatoConsola = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

/**
 * Corre el código y devuelve sus pasos, o el motivo por el que no se pudo seguir.
 * Con `parcial`, un código que no termina (o da demasiados pasos) devuelve los pasos que alcanzó
 * y `incompleta: true`: así se pueden animar las primeras vueltas de un bucle infinito.
 */
export const trazar = (codigo: string, { parcial = false } = {}): { traza?: Traza; error?: string; incompleta?: boolean } => {
  const pasos: PasoTraza[] = [];
  const salida: string[] = [];
  const cortado = (error: string) => (parcial && pasos.length ? { traza: { pasos, salida }, error, incompleta: true } : { error });
  try {
    const { codigo: instrumentado, ambitos, funciones } = instrumentar(codigo);
    const pila = [0];
    let profundidadUltimo = 0;

    const registrar = (linea: number, valores: Record<string, Record<string, () => unknown>>, esEfecto = false) => {
      const grupos: GrupoTraza[] = [];
      const actual = pila[pila.length - 1];
      // Se recorre en el orden de la cadena: los ámbitos internos se insertaron primero, pero
      // las llaves numéricas de un objeto se ordenan; por eso se ordena de mayor a menor id.
      for (const id of Object.keys(valores).map(Number).sort((a, b) => b - a)) {
        const a = ambitos[id];
        const variables = Object.entries(valores[id]).flatMap(([nombre, leer]) => {
          try {
            return [{ nombre, valor: formatoValor(leer()) }];
          } catch {
            return []; // aún no existe (let o const antes de su declaración)
          }
        });
        if (!variables.length) continue;
        // Sigue viva aunque su función ya terminó, o aunque el bloque quedó atrás: eso es un closure.
        const recordada = !pila.includes(a.funcionId) || (a.esBloque && actual !== a.funcionId);
        const etiqueta = recordada ? a.etiqueta : funciones[a.funcionId] === 'programa' ? 'global' : funciones[a.funcionId];
        const previo = grupos.find((g) => g.etiqueta === etiqueta && g.recordada === recordada);
        if (previo) previo.variables.push(...variables);
        else grupos.push({ etiqueta, recordada, variables });
      }
      const paso: PasoTraza = { linea, en: funciones[actual], grupos, nSalida: salida.length };
      const ultimo = pasos[pasos.length - 1];
      // Una línea que no llamó a nada es un solo paso, que ya muestra su resultado.
      if (esEfecto && ultimo?.linea === linea && profundidadUltimo === pila.length) {
        pasos[pasos.length - 1] = paso;
        return;
      }
      if (ultimo && linea !== 0 && JSON.stringify(ultimo) === JSON.stringify(paso)) return;
      pasos.push(paso);
      profundidadUltimo = pila.length;
      if (pasos.length > MAX_PASOS) throw new RangeError(`el código da más de ${MAX_PASOS} pasos`);
    };

    const consola = {
      log: (...a: unknown[]) => salida.push(a.map(formatoConsola).join(' ')),
      error: () => {},
      warn: () => {},
    };
    vm.runInNewContext(
      instrumentado,
      {
        console: consola,
        __t: (linea: number, valores: Record<string, Record<string, () => unknown>>) => registrar(linea, valores),
        __d: (linea: number, valores: Record<string, Record<string, () => unknown>>) => registrar(linea, valores, true),
        __e: (id: number) => pila.push(id),
        __s: () => pila.pop(),
      },
      { timeout: 1000 },
    );
    return { traza: { pasos, salida } };
  } catch (e: any) {
    if (e?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') return cortado('el código no termina');
    if (e instanceof RangeError || e?.name === 'RangeError') return cortado(`${e.name}: ${e.message}`);
    return { error: `${e?.name ?? 'Error'}: ${e?.message ?? e}` };
  }
};
