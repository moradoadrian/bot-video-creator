/**
 * Renderiza el video final y el texto para publicarlo.
 * Uso: npm run render -- <slug>            (usa la voz generada)
 *      npm run render -- <slug> --sin-voz  (preview sin audio, duraciones estimadas)
 */
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromiumOptions } from './navegador';
import { RAIZ, agregarTrazas, canalDe, leerGuion, leerMarca, leerTiming, timingEstimado, verificarCodigo, verificarVisuales } from './lib';

async function main() {
  const slug = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!slug) throw new Error('Uso: npm run render -- <slug> [--sin-voz]');
  const sinVoz = process.argv.includes('--sin-voz');

  const guion = leerGuion(slug);
  const timing = sinVoz ? timingEstimado(guion) : leerTiming(slug, guion);
  if (!timing.conAudio && !sinVoz) console.warn('⚠ No hay voz generada; se renderiza sin audio. Corre: npm run voz -- ' + slug);
  const canal = canalDe(guion);
  if (guion.canal === 'codigo') {
    // duraciones trae primero el gancho; las escenas empiezan en el índice 1
    for (const a of [...verificarCodigo(guion.escenas, false, timing.duraciones.slice(1)), ...verificarVisuales(guion)]) console.warn('⚠', a);
  }
  const inputProps = {
    guion: guion.canal === 'codigo' ? agregarTrazas(guion) : guion,
    timing,
    marca: leerMarca(canal),
  } as Record<string, unknown>;

  console.log('  Empaquetando…');
  const serveUrl = await bundle({ entryPoint: path.join(RAIZ, 'src', 'index.ts'), publicDir: path.join(RAIZ, 'public') });
  const browserExecutable = process.env.CHROME_PATH || null;
  const composition = await selectComposition({ serveUrl, id: canal === 'codigo' ? 'CodigoVideo' : 'FiestaVideo', inputProps, browserExecutable, chromiumOptions });

  const outDir = path.join(RAIZ, 'out');
  mkdirSync(outDir, { recursive: true });
  // Una vista previa nunca reemplaza el video final
  const salida = path.join(outDir, sinVoz ? `${slug}-preview.mp4` : `${slug}.mp4`);
  let ultimo = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    crf: 20,
    x264Preset: 'veryfast',
    imageFormat: 'jpeg',
    jpegQuality: 92,
    outputLocation: salida,
    inputProps,
    browserExecutable,
    chromiumOptions,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 10) * 10;
      if (p !== ultimo) {
        ultimo = p;
        process.stdout.write(`  Render ${p}%\r`);
      }
    },
  });

  const seg = composition.durationInFrames / composition.fps;
  if (sinVoz) {
    console.log(`\n✔ Vista previa sin voz: out/${slug}-preview.mp4 (${seg.toFixed(1)} s)`);
    return;
  }
  const post = [
    `${guion.descripcion}`,
    '',
    guion.hashtags.join(' '),
    '',
    '— Checklist antes de publicar —',
    '[ ] Activar "Contenido generado por IA" en Más opciones (la voz es IA).',
    '[ ] Revisar que el video dure más de 1 minuto' + (seg < 61 ? `  ⚠ ahora dura ${seg.toFixed(1)} s` : ` (dura ${seg.toFixed(1)} s ✔)`),
    '[ ] Agregar música de la biblioteca comercial de TikTok a volumen bajo (opcional).',
    ...(canal === 'codigo' ? ['[ ] Revisar que el código y la salida se vean completos en pantalla.'] : []),
    '[ ] Fijar un comentario con una pregunta para generar conversación.',
  ].join('\n');
  writeFileSync(path.join(outDir, `${slug}.txt`), post + '\n');

  console.log(`\n✔ Video: out/${slug}.mp4 (${seg.toFixed(1)} s)`);
  console.log(`✔ Texto para publicar: out/${slug}.txt`);
}

main().catch((e) => {
  console.error('✖', e.message);
  process.exit(1);
});
