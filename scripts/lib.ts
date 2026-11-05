import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { z } from 'zod';
import { Canal, EscenaCodigo, Guion, ICONOS, Marca, Timing } from '../src/types';

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
  escenas: z
    .array(
      z.object({
        titulo: z.string().max(36),
        narracion: z.string(),
        codigo: Codigo.optional(),
        resaltar: z.array(z.number().int().min(1)).optional(),
        salida: z.string().optional(),
      }),
    )
    .min(3)
    .max(7),
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
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : timingEstimado(g);
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
 * Ejecuta el código de una escena en una caja aislada y devuelve lo que imprime con console.log.
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

/**
 * Revisa que la salida de cada escena sea la que imprime su código.
 * Si corregir = true, reemplaza la salida por la real. Devuelve avisos legibles.
 */
export const verificarCodigo = (escenas: EscenaCodigo[], corregir: boolean): string[] => {
  const avisos: string[] = [];
  escenas.forEach((e, i) => {
    if (!e.codigo) return;
    const r = ejecutar(e.codigo);
    const n = `Escena ${i + 1} (${e.titulo})`;
    if (r.timeout) {
      if (!e.salida) avisos.push(`${n}: el código no termina (¿bucle infinito?) y no tiene salida escrita.`);
      return; // un bucle infinito a propósito: se respeta la salida escrita a mano
    }
    if (r.error) {
      avisos.push(`${n}: el código lanza ${r.error}`);
      return;
    }
    if (r.salida && r.salida !== (e.salida ?? '').trim()) {
      avisos.push(`${n}: la salida no coincide con lo que imprime el código.${corregir ? ' Corregida.' : ''}`);
      if (corregir) e.salida = r.salida;
    }
  });
  return avisos;
};
