import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { z } from 'zod';
import { MAX_COLUMNAS_CONSOLA, inicioDePasos, medidasDepurador, tiemposDePasos } from '../src/depurador';
import { MAX_COLUMNAS_CONSOLA_ANIMACION, MAX_SALIDA_VISIBLE, medidasEditor } from '../src/medidas';
import { clavesDe, momentosClave } from '../src/momentos';
import { Canal, EscenaCodigo, Guion, GuionCodigo, ICONOS, ICONOS_CODIGO, Marca, VEREDICTOS, Timing, Visual } from '../src/types';
import { calcularAnimacion, verificarAnimacion } from './animaciones';
import { trazar } from './traza';

export const RAIZ = path.resolve(__dirname, '..');
export const dirContenido = (slug: string) => path.join(RAIZ, 'content', slug);
export const dirAudio = (slug: string) => path.join(RAIZ, 'public', 'audio', slug);

/** Límites del editor en pantalla (fuente de 38 px en 1080 de ancho, sin invadir la zona de TikTok). */
export const MAX_LINEAS = 10;
export const MAX_COLUMNAS = 35;

const Bloque = (maxTitulo: number) => z.object({ titulo: z.string().max(maxTitulo), narracion: z.string() });
const Comun = {
  slug: z.string().regex(/^[a-z0-9-]+$/),
  tema: z.string(),
  gancho: Bloque(40),
  cierre: Bloque(36),
  descripcion: z.string(),
  hashtags: z.array(z.string()).max(8),
};

const Codigo = z
  .string()
  .refine((c) => c.split('\n').length <= MAX_LINEAS, `El código debe tener máximo ${MAX_LINEAS} líneas`)
  .refine(
    (c) => c.split('\n').every((l) => l.length <= MAX_COLUMNAS),
    `Cada línea de código debe tener máximo ${MAX_COLUMNAS} caracteres para que quepa en pantalla`,
  );

const Item = z.object({
  texto: z.string().max(22),
  detalle: z.string().max(28).optional(),
  icono: z.enum(ICONOS_CODIGO).optional(),
  clave: z.string().optional(),
});

const VisualSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('tarjetas'),
    items: z.array(Item).min(2).max(6),
    etiquetas: z
      .object({ titulo: z.string().max(24).optional(), lista: z.array(z.string().max(14)).min(1).max(8), clave: z.string().optional() })
      .optional(),
  }),
  z.object({
    tipo: z.literal('flujo'),
    pasos: z.array(Item).min(2).max(5),
    regreso: z.object({ texto: z.string().max(20), clave: z.string().optional() }).optional(),
    final: Item.optional(),
  }),
  z.object({ tipo: z.literal('suma'), partes: z.array(Item).min(2).max(3), resultado: Item }),
  z.object({ tipo: z.literal('versus'), lados: z.tuple([Item, Item]) }),
  z.object({
    tipo: z.literal('recorrido'),
    pasos: z.array(Item).min(2).max(5),
    regreso: z.object({ texto: z.string().max(20), clave: z.string().optional() }).optional(),
    final: Item.optional(),
  }),
  z.object({
    tipo: z.literal('red'),
    centro: Item,
    nodos: z.array(Item).min(2).max(6),
    falla: z.object({ texto: z.string().max(24), clave: z.string().optional() }).optional(),
  }),
  z.object({ tipo: z.literal('cascada'), fichas: z.array(Item).min(2).max(5), final: Item.optional() }),
  z.object({
    tipo: z.literal('verificar'),
    items: z.array(Item.extend({ veredicto: z.enum(VEREDICTOS), claveVeredicto: z.string().min(1) })).min(2).max(4),
  }),
]);

const ClaveOpcional = z.string().min(1).optional();

/** Animación por concepto. Los datos son opcionales: lo demás sale de ejecutar el código. */
export const AnimacionSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('ciclo'),
    datos: z
      .object({
        variable: z.string().min(1).optional(),
        vueltas: z.number().int().min(0).optional(),
        claves: z.object({ inicio: ClaveOpcional, condicion: ClaveOpcional, cambio: ClaveOpcional, vueltas: ClaveOpcional }).optional(),
      })
      .optional(),
  }),
]);

export const GuionFiestasSchema = z.object({
  ...Comun,
  canal: z.literal('fiestas').optional(),
  escenas: z
    .array(z.object({ titulo: z.string().max(36), narracion: z.string(), icono: z.enum(ICONOS) }))
    .min(3)
    .max(7),
});

export const GuionCodigoSchema = z.object({
  ...Comun,
  canal: z.literal('codigo'),
  lenguaje: z.literal('javascript'),
  gancho: Bloque(40).extend({ visual: VisualSchema.optional() }),
  escenas: z
    .array(
      z
        .object({
        titulo: z.string().max(36),
        narracion: z.string(),
        codigo: Codigo.optional(),
        resaltar: z.array(z.number().int().min(1)).optional(),
        salida: z.string().optional(),
        archivo: z.string().max(30).optional(),
        visual: VisualSchema.optional(),
        animacion: AnimacionSchema.optional(),
        depurar: z
          .object({
            marcas: z
              .array(z.object({ frase: z.string().min(1), linea: z.number().int().min(0), vez: z.number().int().min(1).optional() }))
              .optional(),
          })
          .optional(),
      })
        .refine((e) => !(e.codigo && e.visual), 'Una escena lleva codigo o visual, no los dos')
        .refine((e) => !(e.depurar && e.archivo), 'depurar ejecuta el código: no se combina con archivo (código ilustrativo)')
        .refine((e) => !(e.animacion && !e.codigo), 'animacion necesita codigo: se mueve con su ejecución')
        .refine((e) => !(e.animacion && e.archivo), 'animacion ejecuta el código: no se combina con archivo (código ilustrativo)'),
    )
    .min(3)
    .max(7),
  etiqueta: z.string().max(30).optional(),
  portada: z.object({ titulo: z.string().max(40).optional(), frase: z.string().max(40).optional() }).optional(),
});

export const parsearGuion = (data: any): Guion =>
  data?.canal === 'codigo' ? GuionCodigoSchema.parse(data) : GuionFiestasSchema.parse(data);

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

export const leerGuion = (slug: string): Guion => {
  const f = path.join(dirContenido(slug), 'guion.json');
  if (!existsSync(f)) throw new Error(`No existe ${f}. Corre primero: npm run guion -- "tu tema"`);
  return parsearGuion(JSON.parse(readFileSync(f, 'utf8')));
};

export const canalDe = (g: Guion): Canal => (g.canal === 'codigo' ? 'codigo' : 'fiestas');

export const leerMarca = (canal: Canal): Marca =>
  JSON.parse(readFileSync(path.join(RAIZ, 'config', canal === 'codigo' ? 'marca-codigo.json' : 'marca.json'), 'utf8'));

export const escribirJson = (f: string, data: unknown) => {
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
};

export const narraciones = (g: Guion) => [g.gancho.narracion, ...g.escenas.map((e) => e.narracion), g.cierre.narracion];

/** Duraciones estimadas (~15 caracteres/seg) para previsualizar sin voz. */
export const timingEstimado = (g: Guion): Timing => ({
  conAudio: false,
  duraciones: narraciones(g).map((t) => Math.max(2.5, t.length / 15)),
});

export const leerTiming = (slug: string, g: Guion): Timing => {
  const f = path.join(dirContenido(slug), 'timing.json');
  if (!existsSync(f)) return timingEstimado(g);
  const timing: Timing = JSON.parse(readFileSync(f, 'utf8'));
  if (timing.duraciones.length !== narraciones(g).length) {
    throw new Error(`El guion cambió de bloques desde la última voz. Corre: npm run voz -- ${slug}`);
  }
  return timing;
};

/** Reintenta errores temporales con espera creciente; un error definitivo sale de inmediato. */
export const conReintentos = async <T>(
  intento: () => Promise<T>,
  esTemporal: (e: any) => boolean,
  { veces = 3, esperaMs = 2000 } = {},
): Promise<T> => {
  for (let i = 1; ; i++) {
    try {
      return await intento();
    } catch (e) {
      if (i >= veces || !esTemporal(e)) throw e;
      await new Promise((r) => setTimeout(r, esperaMs * i));
    }
  }
};

/** Duración de un mp3 en segundos, en JavaScript puro (sin ffprobe ni npx, funciona igual en Windows). */
export const duracionAudio = async (archivo: string): Promise<number> => {
  const { parseFile } = await import('music-metadata');
  const meta = await parseFile(archivo, { duration: true });
  if (!meta.format.duration) throw new Error(`No se pudo leer la duración de ${archivo}`);
  return meta.format.duration;
};

export const requiereEnv = (nombre: string) => {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable ${nombre} en .env`);
  return v;
};

/**
 * Ejecuta el código de una escena con node:vm y devuelve lo que imprime con console.log.
 * vm no es una barrera de seguridad: solo sirve para código ya revisado.
 * timeout = true cuando el código no termina (por ejemplo, un bucle infinito a propósito).
 */
export const ejecutar = (codigo: string): { salida: string; error?: string; timeout?: boolean } => {
  const lineas: string[] = [];
  const fmt = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
  const consola = { log: (...a: unknown[]) => lineas.push(a.map(fmt).join(' ')), error: () => {}, warn: () => {} };
  try {
    vm.runInNewContext(codigo, { console: consola }, { timeout: 300 });
    return { salida: lineas.join('\n') };
  } catch (e: any) {
    if (e?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') return { salida: lineas.slice(0, 6).join('\n'), timeout: true };
    return { salida: lineas.join('\n'), error: `${e?.name ?? 'Error'}: ${e?.message ?? e}` };
  }
};

/** Avisos propios de una escena animada: la traza debe salir, caber y seguir el ritmo de la voz. */
const verificarDepurador = (e: EscenaCodigo, n: string, duracionSeg: number, conAnimacion = false): string[] => {
  const { traza, error } = trazar(e.codigo ?? '');
  if (!traza) return [`${n}: no se puede animar la ejecución (${error}). Se mostrará el editor normal.`];
  const avisos: string[] = [];
  const lineas = (e.codigo ?? '').split('\n');
  if (medidasDepurador(lineas, traza, conAnimacion).desborda) {
    avisos.push(`${n}: el código y el panel de variables tapan el subtítulo. Quita líneas de código o variables.`);
  }
  if (traza.salida.some((l) => l.length > MAX_COLUMNAS_CONSOLA)) {
    avisos.push(`${n}: una línea de consola pasa de ${MAX_COLUMNAS_CONSOLA} caracteres y se cortaría en el depurador.`);
  }
  const { tiempos, problemas } = tiemposDePasos(traza, e.depurar?.marcas ?? [], e.narracion, duracionSeg, inicioDePasos(lineas.length));
  for (const p of problemas) avisos.push(`${n}: ${p}.`);
  if (tiempos.some((t, i) => i > 0 && t - tiempos[i - 1] < 0.2)) {
    avisos.push(`${n}: algunos pasos duran menos de 0.2 s y no se alcanzarían a ver. Alarga la narración o mueve las marcas.`);
  }
  return avisos;
};

/** Calcula los pasos de las escenas animadas y los datos de sus animaciones; la plantilla no puede ejecutar código. */
export const agregarTrazas = (g: GuionCodigo): GuionCodigo => ({
  ...g,
  escenas: g.escenas.map((e) => {
    const conTraza = e.depurar && e.codigo ? { ...e, traza: trazar(e.codigo).traza } : e;
    return e.animacion ? { ...conTraza, animacion: calcularAnimacion(conTraza) } : conTraza;
  }),
});

/**
 * Revisa que la salida de cada escena sea la que imprime su código y que todo quepa en pantalla.
 * Si corregir = true, reemplaza la salida por la real. Devuelve avisos legibles.
 */
export const verificarCodigo = (escenas: EscenaCodigo[], corregir: boolean, duraciones?: number[]): string[] => {
  const avisos: string[] = [];
  escenas.forEach((e, i) => {
    if (!e.codigo) return;
    const n = `Escena ${i + 1} (${e.titulo})`;
    avisos.push(...verificarAnimacion(e, n));
    const conAnimacion = !!e.animacion && !avisos.some((a) => a.startsWith(`${n}: no se puede animar`));
    const lineas = e.codigo.split('\n');
    const nSalida = (e.salida ?? '').split('\n').filter((l) => l.length).length;
    if (e.depurar) {
      avisos.push(...verificarDepurador(e, n, duraciones?.[i] ?? Math.max(2.5, e.narracion.length / 15), conAnimacion));
    } else {
      if (medidasEditor(lineas, nSalida, conAnimacion).desborda) {
        avisos.push(
          conAnimacion
            ? `${n}: el código no cabe junto a la animación sin tapar el subtítulo. Usa máximo 5 líneas de código.`
            : `${n}: el código y la consola tapan el subtítulo. Quita líneas de código o de salida.`,
        );
      }
      if (nSalida > MAX_SALIDA_VISIBLE) avisos.push(`${n}: la consola solo muestra las últimas ${MAX_SALIDA_VISIBLE} líneas de salida.`);
      if (conAnimacion && (e.salida ?? '').split('\n').some((l) => l.length > MAX_COLUMNAS_CONSOLA_ANIMACION)) {
        avisos.push(`${n}: una línea de consola pasa de ${MAX_COLUMNAS_CONSOLA_ANIMACION} caracteres y se cortaría junto a la animación.`);
      }
    }
    const fuera = (e.resaltar ?? []).filter((l) => l > lineas.length);
    if (fuera.length) avisos.push(`${n}: resaltar apunta a líneas que no existen: ${fuera.join(', ')}.`);
    if (e.archivo) return; // código ilustrativo (JSX, Vue, Angular…): no corre en node:vm
    const r = ejecutar(e.codigo);
    if (r.timeout) {
      if (!e.salida) avisos.push(`${n}: el código no termina (¿bucle infinito?) y no tiene salida escrita.`);
      return; // un bucle infinito a propósito: se respeta la salida escrita a mano
    }
    if (r.error) {
      avisos.push(`${n}: el código lanza ${r.error}`);
      return;
    }
    if (r.salida !== (e.salida ?? '').trim()) {
      avisos.push(`${n}: la salida no coincide con lo que imprime el código.${corregir ? ' Corregida.' : ''}`);
      if (corregir) e.salida = r.salida;
    }
  });
  return avisos;
};

/** Avisa si un elemento de un diagrama no se nombra en la narración (saldría en un tiempo estimado). */
export const verificarVisuales = (g: GuionCodigo): string[] => {
  const bloques: { n: string; narracion: string; visual?: Visual }[] = [
    { n: 'Gancho', ...g.gancho },
    ...g.escenas.map((e, i) => ({ n: `Escena ${i + 1} (${e.titulo})`, ...e })),
  ];
  return bloques.flatMap(({ n, narracion, visual }) => {
    if (!visual) return [];
    const claves = clavesDe(visual);
    return momentosClave(claves, narracion, 10)
      .map((m, i) => (m.ok ? null : `${n}: "${claves[i]}" no se dice en la narración (o no en ese orden); aparecerá en un tiempo estimado.`))
      .filter((a): a is string => a !== null);
  });
};
