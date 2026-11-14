/**
 * Datos de las animaciones que salen de ejecutar el código de verdad.
 * La plantilla no puede ejecutar código: render.ts calcula esto y se lo pasa ya listo.
 */
import { parse } from 'acorn';
import vm from 'node:vm';
import {
  Animacion,
  AnimacionPorPasos,
  ArregloCalculado,
  CajaVariable,
  CeldaArreglo,
  CicloCalculado,
  CondicionCalculada,
  DatosArreglo,
  DatosFuncion,
  DatosObjeto,
  DatosVariable,
  EscenaCodigo,
  FuncionCalculada,
  ObjetoCalculado,
  PasoTraza,
  VariableCalculada,
  VariableTraza,
  VueltaCiclo,
} from '../src/types';
import { momentosClave } from '../src/momentos';
import { formatoValor, trazar } from './traza';

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

// ── Animaciones paso a paso: variable, arreglo, condición, función y objeto ──

/** Divide "a, [b, c], "d, e"" en sus partes de primer nivel, sin cortar dentro de corchetes, llaves ni comillas. */
export const partesDeNivel = (s: string): string[] => {
  const partes: string[] = [];
  let nivel = 0;
  let comilla = false;
  let actual = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (comilla) {
      actual += c;
      if (c === '\\') actual += s[++i] ?? '';
      else if (c === '"') comilla = false;
      continue;
    }
    if (c === '"') comilla = true;
    if (c === '[' || c === '{') nivel++;
    if (c === ']' || c === '}') nivel--;
    if (c === ',' && nivel === 0) {
      partes.push(actual.trim());
      actual = '';
      continue;
    }
    actual += c;
  }
  if (actual.trim()) partes.push(actual.trim());
  return partes;
};

/** Elementos de un arreglo tal como los escribe formatoValor: "[1, "a"]" → ["1", "\"a\""]. */
export const elementosDe = (valor: string): string[] | null =>
  valor.startsWith('[') && valor.endsWith(']') ? partesDeNivel(valor.slice(1, -1)) : null;

/** Propiedades de un objeto tal como las escribe formatoValor: "{a: 1}" → [{clave: "a", valor: "1"}]. */
export const propiedadesDe = (valor: string): { clave: string; valor: string }[] | null => {
  if (!valor.startsWith('{') || !valor.endsWith('}')) return null;
  return partesDeNivel(valor.slice(1, -1)).map((p) => {
    const k = p.indexOf(': ');
    return { clave: p.slice(0, k), valor: p.slice(k + 2) };
  });
};

const valorEn = (paso: PasoTraza, nombre: string) => variablesDe(paso).find((v) => v.nombre === nombre)?.valor;

const leer = (codigo: string): any => parse(codigo, { ecmaVersion: 'latest', sourceType: 'script', locations: true });

/** Traza resumida que comparten todas las animaciones paso a paso. */
const conTraza = (codigo: string) => {
  const r = trazar(codigo, { parcial: true });
  if (!r.traza) return { error: `no se pudo ejecutar (${r.error})` } as const;
  return { traza: r.traza, pasos: r.traza.pasos.map((p) => ({ l: p.linea, s: p.nSalida })) } as const;
};

/** Declaraciones del código en orden: nombre y si es let, const, var o parámetro. */
const declaraciones = (ast: any) => {
  const out: { nombre: string; declaracion: CajaVariable['declaracion'] }[] = [];
  recorrer(ast, (n) => {
    if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) {
        const nombres: string[] = [];
        if (d.id.type === 'Identifier') nombres.push(d.id.name);
        nombres.forEach((x) => out.push({ nombre: x, declaracion: n.kind }));
      }
    }
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type)) {
      n.params.forEach((p: any) => p.type === 'Identifier' && out.push({ nombre: p.name, declaracion: 'param' }));
    }
  });
  return out;
};

export const calcularVariable = (codigo: string, datos?: DatosVariable): { calculado?: VariableCalculada; error?: string } => {
  const t = conTraza(codigo);
  if (!('traza' in t) || !t.traza) return { error: t.error };
  const decl = declaraciones(leer(codigo));
  const esFuncion = (v?: string) => v === 'función';
  const elegidas = datos?.variables?.length
    ? datos.variables
    : [...new Set(decl.map((d) => d.nombre))].filter((x) => !t.traza.pasos.some((p) => esFuncion(valorEn(p, x)))).slice(0, 3);
  const faltan = elegidas.filter((x) => !decl.some((d) => d.nombre === x));
  if (faltan.length) return { error: `el código no declara ${faltan.map((x) => `"${x}"`).join(', ')}` };
  if (!elegidas.length) return { error: 'el código no declara variables' };
  const cajas: CajaVariable[] = elegidas.map((nombre) => {
    const cambios: CajaVariable['cambios'] = [];
    let sale: number | undefined;
    let previo: string | undefined;
    t.traza.pasos.forEach((p, i) => {
      const v = valorEn(p, nombre);
      if (v === undefined) {
        if (previo !== undefined && sale === undefined && p.linea !== 0) sale = i;
        return;
      }
      if (v !== previo) cambios.push({ paso: i, valor: v });
      previo = v;
    });
    return { nombre, declaracion: decl.find((d) => d.nombre === nombre)!.declaracion, cambios, ...(sale !== undefined ? { sale } : {}) };
  });
  if (cajas.every((c) => !c.cambios.length)) return { error: 'las variables nunca toman un valor' };
  const eventos = [...new Set(cajas.flatMap((c) => [...c.cambios.map((x) => x.paso), ...(c.sale !== undefined ? [c.sale] : [])]))].sort((a, b) => a - b);
  return { calculado: { pasos: t.pasos, eventos, cajas } };
};

/** Qué le pasó a un arreglo entre dos momentos, conservando la identidad de cada casilla. */
const transicion = (antes: CeldaArreglo[], valores: string[], nuevoId: () => number) => {
  const iguales = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const vals = antes.map((c) => c.valor);
  if (valores.length === vals.length + 1 && iguales(vals, valores.slice(0, -1))) {
    return { accion: 'push' as const, celdas: [...antes, { id: nuevoId(), valor: valores[valores.length - 1] }] };
  }
  if (valores.length === vals.length - 1 && iguales(vals.slice(0, -1), valores)) return { accion: 'pop' as const, celdas: antes.slice(0, -1) };
  if (valores.length === vals.length - 1 && iguales(vals.slice(1), valores)) return { accion: 'shift' as const, celdas: antes.slice(1) };
  if (valores.length === vals.length + 1 && iguales(vals, valores.slice(1))) {
    return { accion: 'unshift' as const, celdas: [{ id: nuevoId(), valor: valores[0] }, ...antes] };
  }
  if (valores.length === vals.length) return { accion: 'cambia' as const, celdas: antes.map((c, i) => ({ ...c, valor: valores[i] })) };
  return { accion: 'crea' as const, celdas: valores.map((valor) => ({ id: nuevoId(), valor })) };
};

export const calcularArreglo = (codigo: string, datos?: DatosArreglo): { calculado?: ArregloCalculado; error?: string } => {
  const t = conTraza(codigo);
  if (!('traza' in t) || !t.traza) return { error: t.error };
  const { pasos } = t.traza;
  const nombre =
    datos?.nombre ?? declaraciones(leer(codigo)).map((d) => d.nombre).find((x) => pasos.some((p) => elementosDe(valorEn(p, x) ?? '') !== null));
  if (!nombre) return { error: 'el código no tiene un arreglo' };
  if (!pasos.some((p) => elementosDe(valorEn(p, nombre) ?? '') !== null)) return { error: `"${nombre}" no es un arreglo` };
  let id = 0;
  const nuevoId = () => id++;
  const estados: ArregloCalculado['estados'] = [];
  let actual: CeldaArreglo[] | null = null;
  pasos.forEach((p, i) => {
    const valores = elementosDe(valorEn(p, nombre) ?? '');
    if (!valores) return;
    if (actual && actual.length === valores.length && actual.every((c, k) => c.valor === valores[k])) return;
    const r: { accion: ArregloCalculado['estados'][number]['accion']; celdas: CeldaArreglo[] } = actual
      ? transicion(actual, valores, nuevoId)
      : { accion: 'crea', celdas: valores.map((valor) => ({ id: nuevoId(), valor })) };
    estados.push({ paso: i, ...r });
    actual = r.celdas;
  });
  // Casilla que se lee: nombre[i] con i una variable o un número en la línea que corre, o la vuelta de un for...of
  const lineas = codigo.split('\n');
  const indice = new RegExp(`\\b${nombre}\\s*\\[\\s*([A-Za-z_$][\\w$]*|\\d+)\\s*\\]`);
  let lineaForOf: number | null = null;
  let finForOf = 0;
  recorrer(leer(codigo), (n) => {
    if (lineaForOf === null && n.type === 'ForOfStatement' && n.right.type === 'Identifier' && n.right.name === nombre) {
      lineaForOf = n.loc.start.line;
      finForOf = n.loc.end.line;
    }
  });
  let vuelta = -1;
  const foco = pasos.map((p) => {
    if (p.linea === lineaForOf) vuelta++;
    const m = (lineas[p.linea - 1] ?? '').match(indice);
    if (m) {
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : Number(valorEn(p, m[1]));
      return Number.isInteger(n) && n >= 0 ? n : null;
    }
    // Dentro del for...of, la casilla es la de la vuelta en curso
    if (lineaForOf !== null && vuelta >= 0 && p.linea >= lineaForOf && p.linea <= finForOf) return vuelta;
    return null;
  });
  // Momentos: cada cambio del arreglo y cada vez que empieza a leerse una casilla
  const lecturas = foco.flatMap((f, i) => (f !== null && f !== foco[i - 1] ? [i] : []));
  const eventos = [...new Set([...estados.map((e) => e.paso), ...lecturas])].sort((x, y) => x - y);
  return { calculado: { pasos: t.pasos, eventos, nombre, estados, foco } };
};

/** Primera línea de una rama, para rotularla. */
const primeraLinea = (codigo: string, n: any) => {
  const s = n.type === 'BlockStatement' ? n.body[0] : n;
  if (!s) return '{ }';
  let texto = codigo.slice(s.start, s.end).split('\n')[0].trim();
  // Un console.log se entiende mejor por lo que imprime
  const log = texto.match(/^console\.log\((.*)\);?$/);
  if (log) texto = `imprime ${log[1]}`;
  return texto.length > 24 ? `${texto.slice(0, 23)}…` : texto;
};

/** Cambia cada nombre de variable de la condición por su valor en ese paso: "edad >= 18" → "20 >= 18". */
export const sustituir = (condicion: string, paso: PasoTraza) =>
  condicion.replace(/(?<![.\w$"'])([A-Za-z_$][\w$]*)(?![\w$]*\s*\()/g, (m) => {
    if (['true', 'false', 'null', 'undefined', 'length'].includes(m)) return m;
    const v = valorEn(paso, m);
    return v === undefined || v.length > 12 ? m : v;
  });

export const calcularCondicion = (codigo: string): { calculado?: CondicionCalculada; error?: string } => {
  let si: any = null;
  recorrer(leer(codigo), (n) => {
    if (si) return false;
    if (n.type === 'IfStatement') {
      si = n;
      return false;
    }
  });
  if (!si) return { error: 'el código no tiene un if' };
  const nodo: any = si;
  const t = conTraza(codigo);
  if (!('traza' in t) || !t.traza) return { error: t.error };
  const { pasos } = t.traza;
  const linea = nodo.loc.start.line;
  const en = (n: any, l: number) => !!n && l >= n.loc.start.line && l <= n.loc.end.line && l !== linea;
  const condicion = codigo.slice(nodo.test.start, nodo.test.end);
  const evaluaciones: CondicionCalculada['evaluaciones'] = [];
  pasos.forEach((p, i) => {
    if (p.linea !== linea) return;
    const sig = pasos[i + 1];
    const rama = sig && en(nodo.consequent, sig.linea) ? 'si' : 'no';
    evaluaciones.push({ paso: i, rama, sustituida: sustituir(condicion, p) });
  });
  if (!evaluaciones.length) return { error: 'el if nunca se ejecuta' };
  const no = nodo.alternate
    ? nodo.alternate.type === 'IfStatement'
      ? `else if (${codigo.slice(nodo.alternate.test.start, nodo.alternate.test.end)})`.slice(0, 24)
      : primeraLinea(codigo, nodo.alternate)
    : null;
  return {
    calculado: {
      pasos: t.pasos,
      eventos: evaluaciones.map((e) => e.paso),
      condicion,
      si: primeraLinea(codigo, nodo.consequent),
      no,
      evaluaciones: evaluaciones.slice(0, 12),
    },
  };
};

export const calcularFuncion = (codigo: string, datos?: DatosFuncion): { calculado?: FuncionCalculada; error?: string } => {
  const ast = leer(codigo);
  // Primera función con nombre: declaración, o expresión guardada en una variable
  let f: { nombre: string; params: any[]; inicio: number; fin: number; declarada: boolean } | null = null;
  recorrer(ast, (n) => {
    if (f) return false;
    const quiere = (x: string) => !datos?.nombre || datos.nombre === x;
    if (n.type === 'FunctionDeclaration' && n.id && quiere(n.id.name)) {
      f = { nombre: n.id.name, params: n.params, inicio: n.start, fin: n.end, declarada: true };
      return false;
    }
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init && /Function|Arrow/.test(n.init.type) && quiere(n.id.name)) {
      f = { nombre: n.id.name, params: n.init.params, inicio: n.init.start, fin: n.init.end, declarada: false };
      return false;
    }
  });
  if (!f) return { error: datos?.nombre ? `el código no define la función "${datos.nombre}"` : 'el código no define una función con nombre' };
  const fn: { nombre: string; params: any[]; inicio: number; fin: number; declarada: boolean } = f;
  const t = conTraza(codigo);
  if (!('traza' in t) || !t.traza) return { error: t.error };

  // Segunda ejecución con la función envuelta: registra argumentos y resultado de cada llamada
  const envuelto = fn.declarada
    ? `${codigo.slice(0, fn.fin)};${fn.nombre} = __envolver(${fn.nombre});${codigo.slice(fn.fin)}`
    : `${codigo.slice(0, fn.inicio)}__envolver(${codigo.slice(fn.inicio, fn.fin)})${codigo.slice(fn.fin)}`;
  const registradas: { argumentos: string[]; resultado: string }[] = [];
  let profundidad = 0;
  try {
    vm.runInNewContext(
      envuelto,
      {
        console: { log: () => {}, error: () => {}, warn: () => {} },
        __envolver: (g: (...a: unknown[]) => unknown) =>
          function (this: unknown, ...a: unknown[]) {
            profundidad++;
            try {
              const r = g.apply(this, a);
              if (profundidad === 1) registradas.push({ argumentos: a.map((x) => formatoValor(x)), resultado: formatoValor(r) });
              return r;
            } finally {
              profundidad--;
            }
          },
      },
      { timeout: 1000 },
    );
  } catch {
    // Si truena a la mitad, se animan las llamadas que sí terminaron
  }
  const { pasos } = t.traza;
  const entradas: { entra: number; sale: number }[] = [];
  for (let i = 0; i < pasos.length; i++) {
    if (pasos[i].en === fn.nombre && (i === 0 || pasos[i - 1].en !== fn.nombre)) {
      let j = i;
      while (j < pasos.length && pasos[j].en === fn.nombre) j++;
      entradas.push({ entra: i, sale: Math.min(j, pasos.length - 1) });
      i = j - 1;
    }
  }
  const n = Math.min(entradas.length, registradas.length, 6);
  if (!n) return { error: `la función "${fn.nombre}" nunca se llama` };
  const llamadas = Array.from({ length: n }, (_, k) => ({ ...entradas[k], ...registradas[k] }));
  return {
    calculado: {
      pasos: t.pasos,
      eventos: llamadas.flatMap((l) => [l.entra, l.sale]),
      nombre: fn.nombre,
      parametros: fn.params.map((p: any) => codigo.slice(p.start, p.end)),
      llamadas,
    },
  };
};

export const calcularObjeto = (codigo: string, datos?: DatosObjeto): { calculado?: ObjetoCalculado; error?: string } => {
  const t = conTraza(codigo);
  if (!('traza' in t) || !t.traza) return { error: t.error };
  const { pasos } = t.traza;
  const nombre =
    datos?.nombre ?? declaraciones(leer(codigo)).map((d) => d.nombre).find((x) => pasos.some((p) => propiedadesDe(valorEn(p, x) ?? '') !== null));
  if (!nombre) return { error: 'el código no tiene un objeto' };
  if (!pasos.some((p) => propiedadesDe(valorEn(p, nombre) ?? '') !== null)) return { error: `"${nombre}" no es un objeto` };
  const estados: ObjetoCalculado['estados'] = [];
  let previo = '';
  pasos.forEach((p, i) => {
    const v = valorEn(p, nombre);
    const props = propiedadesDe(v ?? '');
    if (!props || v === previo) return;
    previo = v!;
    estados.push({ paso: i, props });
  });
  const lineas = codigo.split('\n');
  // Solo lecturas: perro.edad = 4 escribe (eso ya se ve como cambio), no lee
  const acceso = new RegExp(`\\b${nombre}\\s*(?:\\.\\s*([A-Za-z_$][\\w$]*)(?![\\w$])|\\[\\s*["']([^"']+)["']\\s*\\])(?!\\s*[-+*/]?=(?!=))`);
  const accesos = pasos.map((p) => {
    const m = (lineas[p.linea - 1] ?? '').match(acceso);
    return m ? (m[1] ?? m[2]) : null;
  });
  // Momentos: cada cambio del objeto y cada vez que se empieza a leer una propiedad
  const lecturas = accesos.flatMap((a, i) => (a !== null && a !== accesos[i - 1] ? [i] : []));
  const eventos = [...new Set([...estados.map((e) => e.paso), ...lecturas])].sort((x, y) => x - y);
  return { calculado: { pasos: t.pasos, eventos, nombre, estados, accesos } };
};

/** Calcula los datos de cualquier tipo de animación; error explica por qué no se puede. */
export const calcularTipo = (a: Animacion, codigo: string): { calculado?: Animacion['calculado']; error?: string } => {
  switch (a.tipo) {
    case 'ciclo':
      return calcularCiclo(codigo);
    case 'variable':
      return calcularVariable(codigo, a.datos);
    case 'arreglo':
      return calcularArreglo(codigo, a.datos);
    case 'condicion':
      return calcularCondicion(codigo);
    case 'funcion':
      return calcularFuncion(codigo, a.datos);
    case 'objeto':
      return calcularObjeto(codigo, a.datos);
  }
};

/** Agrega a la animación de cada escena lo que sale de ejecutar su código. */
export const calcularAnimacion = (e: EscenaCodigo): Animacion | undefined => {
  if (!e.animacion || !e.codigo) return e.animacion;
  let calculado: Animacion['calculado'];
  try {
    calculado = calcularTipo(e.animacion, e.codigo).calculado;
  } catch {
    calculado = undefined;
  }
  return calculado ? ({ ...e.animacion, calculado } as Animacion) : e.animacion;
};

const NOMBRES: Record<Animacion['tipo'], string> = {
  ciclo: 'el ciclo',
  variable: 'la variable',
  arreglo: 'el arreglo',
  condicion: 'la condición',
  funcion: 'la función',
  objeto: 'el objeto',
};

/** Avisos de una escena con animación: los datos escritos deben coincidir con lo que hace el código. */
export const verificarAnimacion = (e: EscenaCodigo, n: string): string[] => {
  const a = e.animacion;
  if (!a) return [];
  if (!e.codigo) return [`${n}: la animación "${a.tipo}" necesita código.`];
  let r: ReturnType<typeof calcularTipo>;
  try {
    r = calcularTipo(a, e.codigo);
  } catch (err: any) {
    r = { error: err.message };
  }
  if (!r.calculado) return [`${n}: no se puede animar ${NOMBRES[a.tipo]}: ${r.error}. Se mostrará el editor normal.`];
  const avisos: string[] = [];
  const claveAusente = (clave: string, que: string) => {
    if (clave && !momentosClave([clave], e.narracion, 10)[0].ok) {
      avisos.push(`${n}: la clave "${clave}" (${que}) no se dice en la narración; ese momento saldrá en un tiempo estimado.`);
    }
  };
  if (a.tipo === 'ciclo') {
    const calculado = r.calculado as CicloCalculado;
    if (a.datos?.variable && a.datos.variable !== calculado.variable) {
      avisos.push(`${n}: la animación dice que la variable es "${a.datos.variable}", pero el ciclo usa "${calculado.variable}".`);
    }
    const entradas = calculado.vueltas.filter((v) => v.entra).length;
    if (a.datos?.vueltas !== undefined && !calculado.infinito && a.datos.vueltas !== entradas) {
      avisos.push(`${n}: la animación dice ${a.datos.vueltas} vueltas, pero el código da ${entradas}.`);
    }
    for (const [parte, clave] of Object.entries(a.datos?.claves ?? {})) if (clave) claveAusente(clave, parte);
    if (calculado.vueltas.length > 40 && !calculado.infinito) {
      avisos.push(`${n}: el ciclo da ${calculado.vueltas.length} vueltas; se verán muy rápido. Usa un ejemplo más corto.`);
    }
    return avisos;
  }
  const c = r.calculado as AnimacionPorPasos['calculado'] & {};
  const claves = a.datos?.claves ?? [];
  claves.forEach((clave, k) => claveAusente(clave, `momento ${k + 1}`));
  if (claves.length > c.eventos.length) {
    avisos.push(`${n}: hay ${claves.length} claves pero la animación solo tiene ${c.eventos.length} momentos; las de más no se usan.`);
  }
  if (a.tipo === 'condicion' && a.datos?.rama) {
    const real = (r.calculado as CondicionCalculada).evaluaciones[0].rama;
    if (real !== a.datos.rama) avisos.push(`${n}: la animación dice que el if toma la rama "${a.datos.rama}", pero el código toma "${real}".`);
  }
  if (a.tipo === 'funcion' && a.datos?.resultado !== undefined) {
    const real = (r.calculado as FuncionCalculada).llamadas[0].resultado;
    if (real !== a.datos.resultado) avisos.push(`${n}: la animación dice que la función devuelve ${a.datos.resultado}, pero devuelve ${real}.`);
  }
  if (a.tipo === 'objeto' && a.datos?.propiedades) {
    const claves = new Set((r.calculado as ObjetoCalculado).estados.flatMap((s) => s.props.map((p) => p.clave)));
    const faltan = a.datos.propiedades.filter((p) => !claves.has(p));
    if (faltan.length) avisos.push(`${n}: el objeto nunca tiene ${faltan.map((p) => `"${p}"`).join(', ')}.`);
  }
  if (a.tipo === 'arreglo' && (r.calculado as ArregloCalculado).estados.some((s) => s.celdas.length > 7)) {
    avisos.push(`${n}: el arreglo llega a más de 7 casillas y no cabrían; usa uno más corto.`);
  }
  if (a.tipo === 'variable' && (r.calculado as VariableCalculada).cajas.some((cj) => cj.cambios.some((x) => x.valor.length > 14))) {
    avisos.push(`${n}: un valor pasa de 14 caracteres y se recortará en la caja.`);
  }
  return avisos;
};
