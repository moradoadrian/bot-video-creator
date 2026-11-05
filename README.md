# fiestas-bot

Fábrica de videos verticales para TikTok con **dos canales**:

- **fiestas**: ideas de fiestas infantiles para papás (plantilla con íconos y confeti).
- **codigo**: programación desde cero en JavaScript (plantilla de editor con código, línea resaltada y consola).

Claude escribe el guion → voz IA lo narra → Remotion arma el video 9:16 con subtítulos y animaciones.
El canal sale del campo `canal` del guion; `voz` y `render` lo detectan solos.

```
tema ──► npm run guion (o guion:codigo) ──► content/<slug>/guion.json   (revisas y editas)
                           npm run voz ──► public/audio/<slug>/*.mp3 + timing.json
                        npm run render ──► out/<slug>.mp4 + out/<slug>.txt (descripción, hashtags, checklist)
```

## Instalación

```bash
npm install
cp .env.example .env      # solo la primera vez: sobrescribe tu .env si ya existe
```

Llena en `.env` tu `ANTHROPIC_API_KEY` y la voz (`TTS_PROVIDER=elevenlabs` + `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`).
Para usar otra voz en el canal de programación, agrega `ELEVENLABS_VOICE_ID_CODIGO`.

Edita tu marca por canal: `config/marca.json` (fiestas) y `config/marca-codigo.json` (programación).

## Uso diario

Fiestas:

```bash
npm run guion -- "fiesta de dinosaurios"
npm run voz -- fiesta-de-dinosaurios
npm run render -- fiesta-de-dinosaurios
```

Programación:

```bash
npm run guion:codigo -- "diferencia entre while y do while"
npm run voz -- diferencia-entre-while-y-do-while
npm run render -- diferencia-entre-while-y-do-while
```

- `npm run todo -- "tema"` (o `npm run todo -- --canal=codigo "tema"`) hace los tres pasos seguidos.
- `npm run preview` y `npm run preview:codigo` renderizan los ejemplos sin voz.
- `npm run studio` abre Remotion Studio para ajustar las plantillas en vivo.
- Temas listos: `temas.md` (fiestas) y `temas-codigo.md` (ruta de aprendizaje de programación).

## Guion del canal código

```json
{
  "canal": "codigo",
  "lenguaje": "javascript",
  "escenas": [
    {
      "titulo": "Contar del 1 al 5",
      "narracion": "Lo que dice la voz, sin símbolos: 'menor o igual', 'i aumenta en uno'.",
      "codigo": "for (let i = 1; i <= 5; i++) {\n  console.log(i);\n}",
      "resaltar": [2],
      "salida": "1\n2\n3\n4\n5"
    }
  ]
}
```

- Máximo 10 líneas de 35 caracteres por escena para que el código se lea en el teléfono.
- `resaltar` marca las líneas que explica la narración.
- **El bot ejecuta cada código** en una caja aislada: `guion:codigo` corrige la `salida` si no coincide y `render` te avisa. Un bucle infinito a propósito se detecta y se respeta la salida que escribiste (termínala con `... nunca termina`).
- Una escena puede no llevar `codigo` si solo explica un concepto.

## Estructura

| Ruta | Qué es |
|---|---|
| `src/FiestaVideo.tsx` | Plantilla fiestas: gancho, tips numerados, cierre con CTA, subtítulos |
| `src/CodigoVideo.tsx` | Plantilla código: editor con resaltado de sintaxis, línea activa, consola, subtítulos |
| `src/components/` | Íconos SVG, confeti y resaltado de JavaScript |
| `scripts/guion.ts` | Prompts por canal y llamada a Claude; valida con zod y verifica el código |
| `scripts/voz.ts` | TTS por bloque (ElevenLabs u OpenAI) con tono y voz por canal |
| `scripts/render.ts` | Elige la plantilla del canal; render H.264 1080×1920 30 fps y texto para publicar |
| `content/ejemplo*/guion.json` | Guiones de ejemplo de cada canal |

## Para que cuente en Creator Rewards

- El video debe durar **más de 1 minuto**: `voz` y `render` te avisan si no llega.
- Activa la etiqueta **"Contenido generado por IA"** al publicar (la voz es IA).
- Edita cada guion: la originalidad pesa en el pago, y es lo que separa tu canal de uno "de relleno".
- Publica cada canal desde su propia cuenta personal y pública, sin herramientas de seguidores o vistas falsas.
- Fiestas: nunca uses fotos o videos de niños reales.

## Notas técnicas

- Si Remotion no puede descargar su navegador, define `CHROME_PATH` en `.env`.
- El código se muestra sin ligaduras tipográficas, para que `<=` y `++` se vean tal cual se escriben.
- Los subtítulos se reparten por longitud de texto dentro de cada bloque; para sincronía palabra por palabra, el siguiente paso es transcribir el audio con timestamps.
