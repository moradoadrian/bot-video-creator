export const ICONOS = ['globo', 'pastel', 'regalo', 'estrella', 'gorro', 'pinata', 'vela', 'dulce'] as const;
export type Icono = (typeof ICONOS)[number];

export type Canal = 'fiestas' | 'codigo';

type Bloque = { titulo: string; narracion: string };

export type Escena = Bloque & { icono: Icono };

/** Escena del canal código: el código es opcional (una escena puede ser solo concepto). */
export type EscenaCodigo = Bloque & {
  /** Código a mostrar, máx. 10 líneas de 35 caracteres */
  codigo?: string;
  /** Números de línea (desde 1) que se resaltan después de aparecer */
  resaltar?: number[];
  /** Lo que imprime el código en consola. El bot lo verifica ejecutándolo. */
  salida?: string;
};

type Comun = {
  slug: string;
  tema: string;
  /** Primera escena: el gancho de 2–3 segundos */
  gancho: Bloque;
  cierre: Bloque;
  descripcion: string;
  hashtags: string[];
};

export type GuionFiestas = Comun & { canal?: 'fiestas'; escenas: Escena[] };
export type GuionCodigo = Comun & { canal: 'codigo'; lenguaje: 'javascript'; escenas: EscenaCodigo[] };
export type Guion = GuionFiestas | GuionCodigo;

/** Duración en segundos de cada bloque de audio, en orden: gancho, escenas..., cierre */
export type Timing = { duraciones: number[]; conAudio: boolean };

export type Marca = {
  handle: string;
  ctaSecundario: string;
  colores: string[];
};

export type VideoProps = {
  guion: GuionFiestas;
  timing: Timing;
  marca: Marca;
};

export type CodigoProps = {
  guion: GuionCodigo;
  timing: Timing;
  marca: Marca;
};
