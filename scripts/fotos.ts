/**
 * Saca imágenes fijas de un video para revisarlo sin renderizarlo completo.
 * Uso: npm run fotos -- <slug> [--sin-voz] [--en=12.5,30] [--bloque=2]
 * Sin --en, toma tres momentos de cada bloque (inicio, mitad y casi el final).
 * Salen en out/fotos/<slug>/.
 */
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { FPS, framesPorBloque } from '../src/bloques';
import { RAIZ, agregarTrazas, canalDe, leerGuion, leerMarca, leerTiming, timingEstimado } from './lib';
import { chromiumOptions } from './navegador';

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith('--'));
  if (!slug) throw new Error('Uso: npm run fotos -- <slug> [--sin-voz] [--en=seg,seg] [--bloque=n]');
  const opcion = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
  const guion = leerGuion(slug);
  const timing = args.includes('--sin-voz') ? timingEstimado(guion) : leerTiming(slug, guion);
  const canal = canalDe(guion);
  const inputProps = {
    guion: guion.canal === 'codigo' ? agregarTrazas(guion) : guion,
    timing,
    marca: leerMarca(canal),
  } as Record<string, unknown>;

  const frames = framesPorBloque(timing.duraciones);
  const inicios = frames.map((_, i) => frames.slice(0, i).reduce((a, f) => a + f, 0));
  const bloque = opcion('bloque');
  const momentos = opcion('en')
    ? opcion('en')!.split(',').map((s) => Math.round(Number(s) * FPS))
    : inicios.flatMap((ini, i) =>
        bloque !== undefined && Number(bloque) !== i ? [] : [0.12, 0.5, 0.92].map((p) => ini + Math.round(frames[i] * p)),
      );

  const serveUrl = await bundle({ entryPoint: path.join(RAIZ, 'src', 'index.ts'), publicDir: path.join(RAIZ, 'public') });
  const browserExecutable = process.env.CHROME_PATH || null;
  const id = canal === 'codigo' ? 'CodigoVideo' : 'FiestaVideo';
  const composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable, chromiumOptions });
  const dir = path.join(RAIZ, 'out', 'fotos', slug);
  mkdirSync(dir, { recursive: true });
  for (const f of momentos) {
    const n = inicios.reduce((acc, ini, i) => (f >= ini ? i : acc), 0);
    const archivo = path.join(dir, `b${n}-${(f / FPS).toFixed(2)}s.png`);
    await renderStill({ composition, serveUrl, frame: f, output: archivo, inputProps, browserExecutable, chromiumOptions });
    console.log('  ' + path.relative(RAIZ, archivo));
  }
}

main().catch((e) => {
  console.error('✖', e.message);
  process.exit(1);
});
