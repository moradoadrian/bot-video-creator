import type { ChromiumOptions } from '@remotion/renderer';

/**
 * Opciones del Chromium que renderiza; las comparten render.ts y fotos.ts.
 * 'angle' activa WebGL sin ventana para las escenas en 3D (three.js), como recomienda Remotion en escritorio.
 * En una máquina sin GPU, usa REMOTION_GL=swangle (más lento).
 */
export const chromiumOptions: ChromiumOptions = { gl: (process.env.REMOTION_GL as ChromiumOptions['gl']) || 'angle' };
