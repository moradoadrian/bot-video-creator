/** Colores y fuentes del canal código, compartidos por sus plantillas. */
export const FONDO = '#15122A';
export const EDITOR = '#0E0C1E';
export const TINTA = '#F4F1FF';
export const TENUE = '#9C95BF';
export const BORDE = 'rgba(244,241,255,0.12)';
export const TITULO = '"Bricolage Grotesque", system-ui, sans-serif';
export const MONO = '"JetBrains Mono", ui-monospace, monospace';
export const TEXTO = 'Nunito, system-ui, sans-serif';

/** Sin ligaduras: un principiante debe ver <= y ++ tal cual se escriben. */
export const SIN_LIGADURAS = { fontVariantLigatures: 'none' as const, fontFeatureSettings: '"liga" 0, "calt" 0' };

export const segAFrames = (s: number, fps: number) => Math.round(s * fps);
