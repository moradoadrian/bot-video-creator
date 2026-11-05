/**
 * Genera la portada de un video del canal código.
 * Uso: npm run portada -- <slug>
 * Título y frase opcionales en el guion: "portada": { "titulo": "...", "frase": "..." }
 */
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { RAIZ, leerGuion, leerMarca } from './lib';

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error('Uso: npm run portada -- <slug>');
  const guion = leerGuion(slug);
  if (guion.canal !== 'codigo') throw new Error('La portada automática solo existe para el canal código.');
  const inputProps = { guion, marca: leerMarca('codigo') } as Record<string, unknown>;

  const serveUrl = await bundle({ entryPoint: path.join(RAIZ, 'src', 'index.ts'), publicDir: path.join(RAIZ, 'public') });
  const browserExecutable = process.env.CHROME_PATH || null;
  const composition = await selectComposition({ serveUrl, id: 'Portada', inputProps, browserExecutable });

  mkdirSync(path.join(RAIZ, 'out'), { recursive: true });
  await renderStill({
    composition,
    serveUrl,
    inputProps,
    browserExecutable,
    output: path.join(RAIZ, 'out', `${slug}-portada.png`),
  });
  console.log(`✔ Portada: out/${slug}-portada.png`);
}

main().catch((e) => {
  console.error('✖', e.message);
  process.exit(1);
});
