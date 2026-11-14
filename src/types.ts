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
  /** Nombre del archivo en el editor. Con él, el código es ilustrativo: se muestra pero no se ejecuta. */
  archivo?: string;
  /** Diagrama animado en lugar del editor. Una escena lleva codigo o visual, no los dos. */
  visual?: Visual;
  /** Anima la ejecución real del código: línea activa, variables y consola paso a paso. */
  depurar?: { marcas?: MarcaDepurador[] };
  /** Pasos de la ejecución. No se escribe a mano: render.ts los calcula ejecutando el código. */
  traza?: Traza;
};

/** Cuando la voz dice `frase`, la ejecución llega a la vez número `vez` que corre `linea` (0 = el programa terminó). */
export type MarcaDepurador = { frase: string; linea: number; vez?: number };

export type VariableTraza = { nombre: string; valor: string };
/** `recordada`: la variable sigue viva aunque su función ya terminó (un closure). */
export type GrupoTraza = { etiqueta: string; recordada: boolean; variables: VariableTraza[] };
/** `linea` = 0 es el último paso, cuando el programa ya terminó. */
export type PasoTraza = { linea: number; en: string; grupos: GrupoTraza[]; nSalida: number };
export type Traza = { pasos: PasoTraza[]; salida: string[] };

export const ICONOS_CODIGO = [
  'pantalla', 'servidor', 'base-datos', 'api', 'cursor', 'imagen', 'formulario', 'menu', 'engrane', 'escudo',
  'lista', 'capas', 'check', 'carrito', 'codigo', 'rayo', 'gota', 'usuario', 'nube', 'candado',
  'avion', 'torre', 'alerta', 'reloj', 'antena',
] as const;
export type IconoCodigo = (typeof ICONOS_CODIGO)[number];

/**
 * Elemento de un diagrama. Aparece cuando la voz dice su `clave` (por defecto, su `texto`).
 * Las claves se buscan en orden dentro de la narración.
 */
export type ItemVisual = { texto: string; detalle?: string; icono?: IconoCodigo; clave?: string };

/** Sello de una afirmación en `verificar`. */
export const VEREDICTOS = ['confirmado', 'sin-pruebas', 'falso'] as const;
export type Veredicto = (typeof VEREDICTOS)[number];
/** Afirmación que aparece con su `clave` y recibe el sello cuando la voz dice `claveVeredicto`. */
export type ItemVerificar = ItemVisual & { veredicto: Veredicto; claveVeredicto: string };

export type Visual =
  /** Cuadrícula de tarjetas, con una fila opcional de etiquetas (tecnologías, por ejemplo). */
  | { tipo: 'tarjetas'; items: ItemVisual[]; etiquetas?: { titulo?: string; lista: string[]; clave?: string } }
  /** Pasos en cadena con un paquete que viaja entre ellos; opcionalmente regresa al inicio. */
  | { tipo: 'flujo'; pasos: ItemVisual[]; regreso?: { texto: string; clave?: string }; final?: ItemVisual }
  /** A + B = C */
  | { tipo: 'suma'; partes: ItemVisual[]; resultado: ItemVisual }
  /** Dos lados frente a frente. */
  | { tipo: 'versus'; lados: [ItemVisual, ItemVisual] }
  /** Como flujo, pero en un mundo por el que viaja la cámara siguiendo al paquete de luz. */
  | { tipo: 'recorrido'; pasos: ItemVisual[]; regreso?: { texto: string; clave?: string }; final?: ItemVisual }
  /** Un centro que manda señales a varios nodos; con `falla`, el centro cae y se cortan las conexiones. */
  | { tipo: 'red'; centro: ItemVisual; nodos: ItemVisual[]; falla?: { texto: string; clave?: string } }
  /** Fichas de dominó: cada una cae, choca con la anterior y la sacude (efecto en cadena). */
  | { tipo: 'cascada'; fichas: ItemVisual[]; final?: ItemVisual }
  /** Hechos contra rumores: cada afirmación recibe un sello (confirmado, sin pruebas, falso). */
  | { tipo: 'verificar'; items: ItemVerificar[] };

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
export type GuionCodigo = Comun & {
  canal: 'codigo';
  lenguaje: 'javascript';
  gancho: Bloque & { visual?: Visual };
  /** Texto sobre el título del gancho. Por defecto: "JavaScript desde cero". */
  etiqueta?: string;
  escenas: EscenaCodigo[];
  /** Opcional: por defecto la portada usa el título del gancho. */
  portada?: { titulo?: string; frase?: string };
};
export type Guion = GuionFiestas | GuionCodigo;

/** Duración en segundos de cada bloque de audio, en orden: gancho, escenas..., cierre */
export type Timing = {
  duraciones: number[];
  conAudio: boolean;
  /** Tiempos reales de cada palabra por bloque, si el proveedor de voz los da. */
  palabras?: Palabra[][];
};

export type Palabra = { texto: string; inicio: number; fin: number };

/** Coordenadas en píxeles sobre la imagen original del personaje. */
export type ConfigPersonaje = {
  imagen: string;
  ancho: number;
  alto: number;
  cara: { x: number; y: number; radio: number };
  boca: { x: number; y: number; ancho: number; alto: number };
};

export type Marca = {
  handle: string;
  ctaSecundario: string;
  colores: string[];
  personaje?: ConfigPersonaje;
  /** Tecleo y sonido de resultado en el editor. */
  sonidos?: boolean;
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
