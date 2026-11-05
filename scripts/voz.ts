/**
 * Genera la voz IA de cada bloque del guion y guarda las duraciones reales.
 * Uso: npm run voz -- <slug>
 * Proveedor según TTS_PROVIDER en .env: "openai" (default) o "elevenlabs".
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { Canal } from '../src/types';
import { canalDe, dirAudio, dirContenido, duracionAudio, escribirJson, leerGuion, narraciones, requiereEnv } from './lib';

const INSTRUCCIONES: Record<Canal, string> = {
  fiestas:
    'Habla en español de México, con tono cálido, alegre y cercano, como una mamá que comparte un tip con una amiga. Ritmo ágil pero claro.',
  codigo:
    'Habla en español de México, como un profesor joven y paciente que explica programación a alguien que empieza. Claro, con energía, sin prisa en los conceptos clave.',
};

/** Voz por canal: ELEVENLABS_VOICE_ID_CODIGO si existe para el canal código; si no, la voz general. */
const vozElevenLabs = (canal: Canal) =>
  (canal === 'codigo' && process.env.ELEVENLABS_VOICE_ID_CODIGO) || requiereEnv('ELEVENLABS_VOICE_ID');

async function ttsOpenAI(texto: string, canal: Canal): Promise<Buffer> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${requiereEnv('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice: process.env.OPENAI_TTS_VOICE || 'coral',
      input: texto,
      instructions: INSTRUCCIONES[canal],
      response_format: 'mp3',
    }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS (${res.status}): ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function ttsElevenLabs(texto: string, canal: Canal): Promise<Buffer> {
  const voz = vozElevenLabs(canal);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': requiereEnv('ELEVENLABS_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: texto,
      model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs (${res.status}): ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error('Uso: npm run voz -- <slug>');
  const guion = leerGuion(slug);
  const canal = canalDe(guion);
  const proveedor = (process.env.TTS_PROVIDER || 'openai').toLowerCase();
  const tts = proveedor === 'elevenlabs' ? ttsElevenLabs : ttsOpenAI;

  const dir = dirAudio(slug);
  mkdirSync(dir, { recursive: true });
  const duraciones: number[] = [];
  const textos = narraciones(guion);

  for (let i = 0; i < textos.length; i++) {
    process.stdout.write(`  Voz bloque ${i + 1}/${textos.length}… `);
    const archivo = path.join(dir, `bloque-${i}.mp3`);
    writeFileSync(archivo, await tts(textos[i], canal));
    const d = await duracionAudio(archivo);
    duraciones.push(Math.round(d * 100) / 100);
    console.log(`${d.toFixed(1)} s`);
  }

  escribirJson(path.join(dirContenido(slug), 'timing.json'), { conAudio: true, duraciones });
  const total = duraciones.reduce((a, b) => a + b, 0) + duraciones.length * 0.4;
  console.log(`✔ Voz lista (${proveedor}). Duración total ≈ ${total.toFixed(1)} s`);
  if (total < 62) {
    console.warn('⚠ El video dura menos de 62 s: no calificaría para Creator Rewards. Alarga la narración del guion.');
  }
  console.log(`  Siguiente: npm run render -- ${slug}`);
}

main().catch((e) => {
  console.error('✖', e.message);
  process.exit(1);
});
