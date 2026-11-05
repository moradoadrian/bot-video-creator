/**
 * Todo el flujo en un comando: guion → voz → render.
 * Uso: npm run todo -- "tema del video"
 *      npm run todo -- --canal=codigo "tema del video"
 * Recomendado: usar los pasos por separado para revisar el guion antes de la voz.
 */
import { execFileSync } from 'node:child_process';
import { RAIZ, slugify } from './lib';

const args = process.argv.slice(2);
const canal = args.includes('--canal=codigo') ? ['--canal=codigo'] : [];
const tema = args.filter((a) => !a.startsWith('--canal=')).join(' ').trim();
if (!tema) {
  console.error('Uso: npm run todo -- "tema del video"');
  process.exit(1);
}
const slug = slugify(tema);
const correr = (script: string, ...args: string[]) =>
  execFileSync('npx', ['tsx', '--env-file-if-exists=.env', `scripts/${script}.ts`, ...args], { stdio: 'inherit', cwd: RAIZ, shell: process.platform === 'win32' });

correr('guion', tema, ...canal);
correr('voz', slug);
correr('render', slug);
