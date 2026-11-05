/**
 * Genera la voz IA de cada bloque del guion y guarda las duraciones reales.
 * Uso: npm run voz -- <slug>            (reutiliza los bloques cuyo texto no cambió)
 *      npm run voz -- <slug> --forzar   (genera todo otra vez)
 * Proveedor según TTS_PROVIDER en .env: "openai" (default) o "elevenlabs".
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Alineacion, palabrasDeAlineacion } from '../src/subtitulos';
import { Canal, Palabra } from '../src/types';
import { canalDe, conReintentos, dirAudio, dirContenido, duracionAudio, escribirJson, leerGuion, narraciones, requiereEnv } from './lib';

const INSTRUCCIONES: Record<Canal, string> = {
  fiestas:
    'Habla en español de México, con tono cálido, alegre y cercano, como una mamá que comparte un tip con una amiga. Ritmo ágil pero claro.',
  codigo:
    'Habla en español de México, como un profesor joven y paciente que explica programación a alguien que empieza. Claro, con energía, sin prisa en los conceptos clave.',
};

const AJUSTES_ELEVENLABS = { stability: 0.45, similarity_boost: 0.8, style: 0.35 };

type Resultado = { audio: Buffer; palabras?: Palabra[] };
type EntradaManifiesto = { huella: string; palabras?: Palabra[] };

/** Error de la API con su código, para decidir si vale la pena reintentar. */
class ErrorApi extends Error {
  constructor(
    public estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

// Sin estado es un fallo de red; 429 y 5xx son temporales. Nada de esto generó audio cobrable.
const esTemporal = (e: any) => !(e instanceof ErrorApi) || e.estado === 429 || e.estado >= 500;

/** Voz por canal: ELEVENLABS_VOICE_ID_CODIGO si existe para el canal código; si no, la voz general. */
const vozElevenLabs = (canal: Canal) =>
  (canal === 'codigo' && process.env.ELEVENLABS_VOICE_ID_CODIGO) || requiereEnv('ELEVENLABS_VOICE_ID');

const modeloOpenAI = () => process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const vozOpenAI = () => process.env.OPENAI_TTS_VOICE || 'coral';
const modeloElevenLabs = () => process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

async function ttsOpenAI(texto: string, canal: Canal): Promise<Resultado> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${requiereEnv('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modeloOpenAI(),
      voice: vozOpenAI(),
      input: texto,
      instructions: INSTRUCCIONES[canal],
      response_format: 'mp3',
    }),
  });
  if (!res.ok) throw new ErrorApi(res.status, `OpenAI TTS (${res.status}): ${await res.text()}`);
  return { audio: Buffer.from(await res.arrayBuffer()) };
}

const pedirElevenLabs = (ruta: string, texto: string, canal: Canal) =>
  fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vozElevenLabs(canal)}${ruta}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': requiereEnv('ELEVENLABS_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texto, model_id: modeloElevenLabs(), voice_settings: AJUSTES_ELEVENLABS }),
  });

async function ttsElevenLabs(texto: string, canal: Canal): Promise<Resultado> {
  const res = await pedirElevenLabs('/with-timestamps', texto, canal);
  if (res.ok) {
    const datos: { audio_base64: string; alignment?: Alineacion } = await res.json();
    return {
      audio: Buffer.from(datos.audio_base64, 'base64'),
      palabras: datos.alignment ? palabrasDeAlineacion(datos.alignment) : undefined,
    };
  }
  if (res.status === 401 || res.status === 403 || esTemporal(new ErrorApi(res.status, ''))) {
    throw new ErrorApi(res.status, `ElevenLabs (${res.status}): ${await res.text()}`);
  }
  // Si el modelo no da tiempos por palabra, se genera normal y el subtítulo se reparte por longitud.
  const simple = await pedirElevenLabs('', texto, canal);
  if (!simple.ok) throw new ErrorApi(simple.status, `ElevenLabs (${simple.status}): ${await simple.text()}`);
  return { audio: Buffer.from(await simple.arrayBuffer()) };
}

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith('--'));
  if (!slug) throw new Error('Uso: npm run voz -- <slug> [--forzar]');
  const forzar = args.includes('--forzar');
  const guion = leerGuion(slug);
  const canal = canalDe(guion);
  const proveedor = (process.env.TTS_PROVIDER || 'openai').toLowerCase();
  const esEleven = proveedor === 'elevenlabs';
  const tts = esEleven ? ttsElevenLabs : ttsOpenAI;
  const firma = esEleven
    ? [proveedor, vozElevenLabs(canal), modeloElevenLabs(), AJUSTES_ELEVENLABS]
    : [proveedor, vozOpenAI(), modeloOpenAI(), INSTRUCCIONES[canal]];
  const huellaDe = (texto: string) => createHash('sha256').update(JSON.stringify([...firma, texto])).digest('hex');

  const dir = dirAudio(slug);
  mkdirSync(dir, { recursive: true });
  const fManifiesto = path.join(dir, 'manifiesto.json');

  // Se cargan en memoria antes de escribir: un bloque pudo cambiar de posición en el guion.
  const anteriores: (EntradaManifiesto & { audio: Buffer })[] = [];
  if (!forzar && existsSync(fManifiesto)) {
    const manifiesto: EntradaManifiesto[] = JSON.parse(readFileSync(fManifiesto, 'utf8'));
    manifiesto.forEach((m, i) => {
      const f = path.join(dir, `bloque-${i}.mp3`);
      if (m && existsSync(f)) anteriores.push({ ...m, audio: readFileSync(f) });
    });
  }

  const textos = narraciones(guion);
  const manifiesto: EntradaManifiesto[] = [];
  const duraciones: number[] = [];
  let ahorrados = 0;

  for (let i = 0; i < textos.length; i++) {
    process.stdout.write(`  Voz bloque ${i + 1}/${textos.length}… `);
    const archivo = path.join(dir, `bloque-${i}.mp3`);
    const huella = huellaDe(textos[i]);
    const previo = anteriores.find((a) => a.huella === huella);
    let palabras: Palabra[] | undefined;
    if (previo) {
      writeFileSync(archivo, previo.audio);
      palabras = previo.palabras;
      ahorrados += textos[i].length;
    } else {
      const r = await conReintentos(() => tts(textos[i], canal), esTemporal);
      writeFileSync(archivo, r.audio);
      palabras = r.palabras;
    }
    manifiesto[i] = { huella, palabras };
    // Se guarda en cada bloque: si algo falla, lo ya pagado no se vuelve a generar.
    writeFileSync(fManifiesto, JSON.stringify(manifiesto));
    const d = await duracionAudio(archivo);
    duraciones.push(Math.round(d * 100) / 100);
    console.log(`${d.toFixed(1)} s${previo ? ' (reutilizada)' : ''}`);
  }

  const conPalabras = manifiesto.every((m) => m.palabras?.length);
  escribirJson(path.join(dirContenido(slug), 'timing.json'), {
    conAudio: true,
    duraciones,
    ...(conPalabras ? { palabras: manifiesto.map((m) => m.palabras) } : {}),
  });
  const total = duraciones.reduce((a, b) => a + b, 0) + duraciones.length * 0.4;
  console.log(`✔ Voz lista (${proveedor}). Duración total ≈ ${total.toFixed(1)} s`);
  if (ahorrados) console.log(`  Reutilizados ${ahorrados} caracteres que no cambiaron.`);
  console.log(conPalabras ? '  Subtítulos: palabra por palabra.' : '  Subtítulos: repartidos por longitud (sin tiempos por palabra).');
  if (total < 62) {
    console.warn('⚠ El video dura menos de 62 s: no calificaría para Creator Rewards. Alarga la narración del guion.');
  }
  console.log(`  Siguiente: npm run render -- ${slug}`);
}

main().catch((e) => {
  console.error('✖', e.message);
  process.exit(1);
});
