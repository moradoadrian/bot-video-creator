/**
 * Genera el guion de un video a partir de un tema.
 * Fiestas: npm run guion -- "ideas de fiesta de dinosaurios"
 * Código:  npm run guion:codigo -- "diferencia entre while y do while"
 */
import path from 'node:path';
import { MAX_COLUMNAS_CONSOLA } from '../src/depurador';
import { MAX_COLUMNAS_CONSOLA_ANIMACION } from '../src/medidas';
import { Canal, ICONOS } from '../src/types';
import { MAX_COLUMNAS, MAX_LINEAS, dirContenido, escribirJson, parsearGuion, requiereEnv, slugify, verificarCodigo } from './lib';

const FORMATO = `- Video vertical narrado por voz, de 65 a 85 segundos en total (unas 180 a 220 palabras de narración en total).
- "gancho": la primera frase debe atrapar en 2 segundos (pregunta o promesa concreta). Título de máximo 6 palabras.
- "cierre": invita a guardar el video y comentar; título de máximo 5 palabras.
- Tono cálido y práctico, con modismos mexicanos ligeros. Tutea al espectador.
- Todo debe ser original: no copies frases de otros creadores ni menciones marcas registradas o personajes con derechos.
- "descripcion": 1 o 2 frases para el post. "hashtags": 4 a 6, en español, relevantes para búsqueda.`;

const ANIMACIONES = `- "animacion" (opcional, en escenas con código): una animación que explica el concepto junto al editor y se mueve con la ejecución real del código. Úsala cuando ayude a ver la idea, no en todas las escenas.
  - "ciclo": para código con un for o un while, con el cuerpo en su propia línea, máximo 5 líneas de código y líneas de consola de máximo ${MAX_COLUMNAS_CONSOLA_ANIMACION} caracteres. Se ve una pista circular: arriba se revisa la condición, a la derecha corre el cuerpo, abajo cambia la variable y un contador avanza en cada vuelta.
    Formato: {"tipo":"ciclo","datos":{"variable":"i","vueltas":5,"claves":{"inicio":"...","condicion":"...","cambio":"...","vueltas":"..."}}}
    "variable" y "vueltas" (cuántas veces entra al cuerpo) se comprueban ejecutando el código. Cada clave es una palabra o frase corta copiada tal cual de esa narración: la parte entra cuando la voz la dice. "claves.vueltas" marca cuándo empiezan a correr las vueltas. Todo dentro de "datos" es opcional; sin claves, se buscan palabras como "empieza", "condición" o "en cada vuelta".`;

const SISTEMA_FIESTAS = `Eres guionista de un canal de TikTok en español de México sobre fiestas infantiles.
El público son mamás, papás y familiares adultos que organizan cumpleaños de niños de 2 a 10 años.

Reglas del formato:
${FORMATO}
- 4 a 6 "escenas", cada una un tip numerado, con narración de 25 a 40 palabras y un título en pantalla de máximo 4 palabras.
- Cada escena aporta algo concreto (materiales, cómo hacerlo, un truco), nada de relleno.
- Usa temáticas genéricas (dinosaurios, espacio, princesas, superhéroes inventados), nunca personajes con derechos.
- Seguridad: actividades apropiadas para la edad, nada con fuego sin supervisión adulta explícita, advierte sobre globos con menores de 3 años, nunca sugieras exponer a los niños en redes.
- "icono" de cada escena: uno de ${ICONOS.join(', ')}.

Responde SOLO con un objeto JSON válido, sin texto adicional:
{"canal":"fiestas","slug":"...","tema":"...","gancho":{"titulo":"...","narracion":"..."},"escenas":[{"titulo":"...","narracion":"...","icono":"..."}],"cierre":{"titulo":"...","narracion":"..."},"descripcion":"...","hashtags":["#..."]}`;

const SISTEMA_CODIGO = `Eres guionista de un canal de TikTok en español de México que enseña programación desde cero.
El público son principiantes totales: personas que nunca han programado o que empiezan la carrera. Los ejemplos van en JavaScript.

Reglas del formato:
${FORMATO}
- 3 a 5 "escenas", cada una un paso de la explicación, con narración de 30 a 50 palabras y un título en pantalla de máximo 4 palabras.
- Explica con palabras simples y una analogía cotidiana cuando ayude. Define cualquier término nuevo la primera vez.
- "codigo": ejemplo corto y correcto de JavaScript moderno, máximo ${MAX_LINEAS - 2} líneas y máximo ${MAX_COLUMNAS - 4} caracteres por línea, sangría de 2 espacios, sin punto y coma faltante. Una escena puede no llevar código si es solo concepto.
- Usa console.log para mostrar resultados. "salida" = exactamente lo que imprime el código, una línea por cada console.log. Si a propósito muestras un bucle infinito, escribe las primeras líneas y termina con "... nunca termina".
- "resaltar": números de línea (desde 1) que la narración está explicando en esa escena.
- La narración se lee en voz alta: NO incluyas símbolos ni código literal en la narración. Di "i aumenta en uno" en vez de "i++", "menor o igual" en vez de "<=", "igual igual igual" se dice "comparación estricta".
${ANIMACIONES}
- Incluye al menos una escena con un error común de principiante y cómo evitarlo.
- Termina el cierre sugiriendo el siguiente tema relacionado como pregunta.

Responde SOLO con un objeto JSON válido, sin texto adicional:
{"canal":"codigo","lenguaje":"javascript","slug":"...","tema":"...","gancho":{"titulo":"...","narracion":"..."},"escenas":[{"titulo":"...","narracion":"...","codigo":"...","resaltar":[1],"salida":"...","animacion":{"tipo":"ciclo","datos":{"variable":"i","vueltas":3}}}],"cierre":{"titulo":"...","narracion":"..."},"descripcion":"...","hashtags":["#..."]}`;

const SISTEMA_AVANZADO = `Eres guionista de un canal de TikTok en español de México que muestra JavaScript por dentro, con el código corriendo paso a paso.
El público ya sabe variables, ciclos y funciones, y quiere entender lo que pasa debajo. Los ejemplos van en JavaScript síncrono: el depurador no sigue async, await ni generadores.

Reglas del formato:
${FORMATO}
- 3 a 5 "escenas", cada una un paso de la explicación, con narración de 30 a 50 palabras y un título en pantalla de máximo 4 palabras.
- Ve directo al mecanismo, sin explicar lo básico. Define solo el término avanzado que estás enseñando, con una analogía cotidiana cuando ayude.
- "codigo": ejemplo corto y correcto, máximo ${MAX_LINEAS} líneas y máximo ${MAX_COLUMNAS - 4} caracteres por línea, sangría de 2 espacios. Usa pocas variables a la vez: el panel muestra unas 3 o 4.
- Usa console.log para mostrar resultados. "salida" = exactamente lo que imprime el código. Cada línea impresa debe tener máximo ${MAX_COLUMNAS_CONSOLA} caracteres.
- "depurar": en cada escena con código, para animar la ejecución real. "marcas" une la narración con la ejecución: cuando la voz dice "frase" (texto exacto de esa narración), el programa llega a la vez número "vez" que corre "linea". "linea": 0 es el programa ya terminado. Pon una marca en cada momento clave, en el orden en que suceden.
- La narración debe nombrar lo que se ve en el panel de variables. Las variables que sobreviven a su función aparecen con la etiqueta "recordada".
- La narración se lee en voz alta: NO incluyas símbolos ni código literal.
${ANIMACIONES}
- Incluye al menos una escena con un error real que comete quien ya programa, y cómo evitarlo.
- Termina el cierre sugiriendo el siguiente tema relacionado como pregunta.

Responde SOLO con un objeto JSON válido, sin texto adicional:
{"canal":"codigo","lenguaje":"javascript","etiqueta":"JavaScript avanzado","slug":"...","tema":"...","gancho":{"titulo":"...","narracion":"..."},"escenas":[{"titulo":"...","narracion":"...","codigo":"...","salida":"...","depurar":{"marcas":[{"frase":"...","linea":1,"vez":1}]}}],"cierre":{"titulo":"...","narracion":"..."},"descripcion":"...","hashtags":["#..."]}`;

async function main() {
  const args = process.argv.slice(2);
  const canal: Canal = args.includes('--canal=codigo') ? 'codigo' : 'fiestas';
  const avanzado = args.includes('--nivel=avanzado');
  const tema = args.filter((a) => !a.startsWith('--canal=') && !a.startsWith('--nivel=')).join(' ').trim();
  if (!tema) throw new Error('Uso: npm run guion -- "tema"   o   npm run guion:codigo -- "tema"   o   npm run guion:avanzado -- "tema"');
  const apiKey = requiereEnv('ANTHROPIC_API_KEY');
  const modelo = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
  const slug = slugify(tema);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      // Solo hace falta si tu llave no está ligada a un workspace
      ...(process.env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } : {}),
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 3000,
      system: canal !== 'codigo' ? SISTEMA_FIESTAS : avanzado ? SISTEMA_AVANZADO : SISTEMA_CODIGO,
      messages: [{ role: 'user', content: `Tema: ${tema}\nUsa "${slug}" como slug.` }],
    }),
  });
  if (!res.ok) throw new Error(`Error de la API (${res.status}): ${await res.text()}`);
  const data: any = await res.json();
  const texto: string = data.content?.map((c: any) => c.text ?? '').join('') ?? '';
  const json = texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1);

  const guion = parsearGuion({ ...JSON.parse(json), slug, canal });
  if (guion.canal === 'codigo') {
    const avisos = verificarCodigo(guion.escenas, true);
    for (const a of avisos) console.warn('⚠', a);
    if (!avisos.length) console.log('✔ Código verificado: cada salida coincide con lo que imprime.');
  }
  const palabras = [guion.gancho, ...guion.escenas, guion.cierre].map((b) => b.narracion).join(' ').split(/\s+/).length;

  escribirJson(path.join(dirContenido(slug), 'guion.json'), guion);
  console.log(`✔ Guion (${canal}) guardado en content/${slug}/guion.json (${palabras} palabras, ${guion.escenas.length} escenas)`);
  console.log('  Revísalo y edítalo antes de generar la voz: ahí está tu toque original.');
  console.log(`  Siguiente: npm run voz -- ${slug}`);
}

main().catch((e) => {
  console.error('✖', e.message);
  process.exit(1);
});
