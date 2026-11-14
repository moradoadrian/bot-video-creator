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
  /** Animación que explica el concepto junto al editor. Se mueve con la ejecución real del código. */
  animacion?: Animacion;
};

/** Palabras de la narración que hacen entrar cada parte del ciclo. */
export type ClavesCiclo = { inicio?: string; condicion?: string; cambio?: string; vueltas?: string };

/** Lo que el guion puede decir de un ciclo; todo es opcional porque sale del código. */
export type DatosCiclo = {
  /** Variable que cuenta las vueltas; si se escribe, debe ser la del ciclo. */
  variable?: string;
  /** Cuántas veces entra al cuerpo; si se escribe, debe coincidir con la ejecución. */
  vueltas?: number;
  claves?: ClavesCiclo;
};

/** Una vuelta tal como pasó: índices de pasos de la traza y líneas de consola que imprimió. */
export type VueltaCiclo = {
  /** Paso en que se revisa la condición. */
  revision: number;
  /** Valor de la variable en esa revisión. */
  valor: string;
  /** true si la condición dejó entrar al cuerpo. */
  entra: boolean;
  /** Último paso dentro del cuerpo (igual a revision si no entra). */
  finCuerpo: number;
  /** Índices de las líneas de consola que salieron en esta vuelta. */
  salidas: number[];
  /** Otras variables al terminar el cuerpo (máximo dos), para mostrarlas junto al contador. */
  otras: VariableTraza[];
};

/** Lo que render.ts calcula ejecutando el código; no se escribe a mano. */
export type CicloCalculado = {
  tipo: 'for' | 'while';
  variable: string;
  linea: number;
  partes: { inicio?: string; condicion: string; cambio?: string };
  vueltas: VueltaCiclo[];
  /** El ciclo no termina: se muestran las primeras vueltas y luego se acelera. */
  infinito: boolean;
};

/**
 * Un paso de la ejecución, resumido para las animaciones que no son ciclo:
 * l = línea que corre, s = líneas de consola impresas hasta ese paso.
 */
export type PasoAnimacion = { l: number; s: number };

/** Lo que comparten las animaciones calculadas paso a paso. */
type PorPasos = {
  pasos: PasoAnimacion[];
  /** Pasos importantes, en orden: cada `claves[k]` del guion ancla el evento k a la voz. */
  eventos: number[];
};

/** `claves`: palabras de la narración que anclan cada evento, en orden. */
type ConClaves = { claves?: string[] };

export type DatosVariable = ConClaves & { variables?: string[] };
export type CajaVariable = {
  nombre: string;
  declaracion: 'let' | 'const' | 'var' | 'param';
  /** Cada vez que el valor cambia (la primera es cuando entra). */
  cambios: { paso: number; valor: string }[];
  /** Paso en que la variable deja de existir (su bloque terminó). */
  sale?: number;
};
export type VariableCalculada = PorPasos & { cajas: CajaVariable[] };

export type DatosArreglo = ConClaves & { nombre?: string };
export type CeldaArreglo = { id: number; valor: string };
export type ArregloCalculado = PorPasos & {
  nombre: string;
  /** Contenido del arreglo cada vez que cambia; las celdas conservan su id para animar push, pop, shift y unshift. */
  estados: { paso: number; celdas: CeldaArreglo[]; accion: 'crea' | 'push' | 'pop' | 'shift' | 'unshift' | 'cambia' }[];
  /** Casilla que el código está leyendo en cada paso (null si no lee ninguna). */
  foco: (number | null)[];
};

export type DatosCondicion = ConClaves & { rama?: 'si' | 'no' };
export type CondicionCalculada = PorPasos & {
  condicion: string;
  /** Lo que hace cada rama (su primera línea), o null si no hay else. */
  si: string;
  no: string | null;
  evaluaciones: { paso: number; rama: 'si' | 'no'; sustituida: string }[];
};

export type DatosFuncion = ConClaves & { nombre?: string; resultado?: string };
export type FuncionCalculada = PorPasos & {
  nombre: string;
  parametros: string[];
  llamadas: { entra: number; sale: number; argumentos: string[]; resultado: string }[];
};

export type DatosObjeto = ConClaves & { nombre?: string; propiedades?: string[] };
export type ObjetoCalculado = PorPasos & {
  nombre: string;
  estados: { paso: number; props: { clave: string; valor: string }[] }[];
  /** Propiedad que el código está leyendo en cada paso. */
  accesos: (string | null)[];
};

export type Animacion =
  | { tipo: 'ciclo'; datos?: DatosCiclo; calculado?: CicloCalculado }
  | { tipo: 'variable'; datos?: DatosVariable; calculado?: VariableCalculada }
  | { tipo: 'arreglo'; datos?: DatosArreglo; calculado?: ArregloCalculado }
  | { tipo: 'condicion'; datos?: DatosCondicion; calculado?: CondicionCalculada }
  | { tipo: 'funcion'; datos?: DatosFuncion; calculado?: FuncionCalculada }
  | { tipo: 'objeto'; datos?: DatosObjeto; calculado?: ObjetoCalculado };
export const TIPOS_ANIMACION = ['ciclo', 'variable', 'arreglo', 'condicion', 'funcion', 'objeto'] as const;
export type AnimacionPorPasos = Exclude<Animacion, { tipo: 'ciclo' }>;

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
  /** true: personaje animado en SVG con poses. false o sin poner (por defecto): la foto en un círculo. La portada siempre usa la foto. */
  animado?: boolean;
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
