/**
 * Genera el guion de un video a partir de un tema.
 * Fiestas: npm run guion -- "ideas de fiesta de dinosaurios"
 * Código:  npm run guion:codigo -- "diferencia entre while y do while"
 */
import path from 'node:path';
import { Canal, ICONOS } from '../src/types';
import { MAX_COLUMNAS, MAX_LINEAS, dirContenido, escribirJson, parsearGuion, requiereEnv, slugify, verificarCodigo } from './lib';

const FORMATO = `- Video vertical narrado por voz, de 65 a 85 segundos en total (unas 180 a 220 palabras de narración en total).
- "gancho": la primera frase debe atrapar en 2 segundos (pregunta o promesa concreta). Título de máximo 6 palabras.
- "cierre": invita a guardar el video y comentar; título de máximo 5 palabras.
- Tono cálido y práctico, con modismos mexicanos ligeros. Tutea al espectador.
- Todo debe ser original: no copies frases de otros creadores ni menciones marcas registradas o personajes con derechos.
- "descripcion": 1 o 2 frases para el post. "hashtags": 4 a 6, en español, relevantes para búsqueda.`;

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
- Incluye al menos una escena con un error común de principiante y cómo evitarlo.
- Termina el cierre sugiriendo el siguiente tema relacionado como pregunta.

Responde SOLO con un objeto JSON válido, sin texto adicional:
{"canal":"codigo","lenguaje":"javascript","slug":"...","tema":"...","gancho":{"titulo":"...","narracion":"..."},"escenas":[{"titulo":"...","narracion":"...","codigo":"...","resaltar":[1],"salida":"..."}],"cierre":{"titulo":"...","narracion":"..."},"descripcion":"...","hashtags":["#..."]}`;

async function main() {
  const args = process.argv.slice(2);
  const canal: Canal = args.includes('--canal=codigo') ? 'codigo' : 'fiestas';
  const tema = args.filter((a) => !a.startsWith('--canal=')).join(' ').trim();
  if (!tema) throw new Error('Uso: npm run guion -- "tema"   o   npm run guion:codigo -- "tema"');
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
      system: canal === 'codigo' ? SISTEMA_CODIGO : SISTEMA_FIESTAS,
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
