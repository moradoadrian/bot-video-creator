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
- `npm run voz -- <slug>` reutiliza los bloques cuyo texto no cambió, así que corregir una frase solo cobra esa frase. Con `--forzar` genera todo otra vez. Si se corta, vuelve a correrlo: continúa donde se quedó.
- `npm run preview -- <slug>` renderiza sin voz en `out/<slug>-preview.mp4`, sin tocar el video final.
- `npm run portada -- <slug>` crea `out/<slug>-portada.png` (solo canal código).
- `npm run studio` abre Remotion Studio para ajustar las plantillas en vivo.
- `npm test` corre las pruebas de los validadores y los subtítulos, sin red ni créditos.
- `npm run sonidos` crea el tecleo y el sonido de resultado; se activan con `"sonidos": true` en `config/marca-codigo.json`.
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
- **El bot ejecuta cada código** con `node:vm`: `guion:codigo` corrige la `salida` si no coincide y `render` te avisa. Un bucle infinito a propósito se detecta y se respeta la salida que escribiste (termínala con `... nunca termina`). `vm` no es una barrera de seguridad: revisa el código de cada guion antes de correrlo.
- También avisa si el código y la consola taparían el subtítulo, o si `resaltar` apunta a una línea que no existe.
- Una escena puede no llevar `codigo` si solo explica un concepto.
- Opcional, para la portada: `"portada": { "titulo": "...", "frase": "..." }`. Sin esto usa el título del gancho.

## Personaje

La imagen y sus coordenadas están en `personaje` dentro de `config/marca-codigo.json`. Si cambias o recortas la imagen, actualiza `ancho` y `alto`, el círculo de la `cara` y la posición de la `boca`, todo en píxeles de la imagen original.

## Estructura

| Ruta | Qué es |
|---|---|
| `src/FiestaVideo.tsx` | Plantilla fiestas: gancho, tips numerados, cierre con CTA, subtítulos |
| `src/CodigoVideo.tsx` | Plantilla código: editor con resaltado de sintaxis, línea activa, consola, subtítulos |
| `src/Portada.tsx` | Portada del canal código |
| `src/medidas.ts` | Tamaño del código en pantalla, compartido con los validadores |
| `src/subtitulos.ts` | Convierte los tiempos de la voz en subtítulos palabra por palabra |
| `src/components/` | Personaje, íconos SVG, confeti y resaltado de JavaScript |
| `scripts/guion.ts` | Prompts por canal y llamada a Claude; valida con zod y verifica el código |
| `scripts/voz.ts` | TTS por bloque (ElevenLabs u OpenAI) con tono y voz por canal, reintentos y reutilización |
| `scripts/portada.ts` | Genera la portada de un video |
| `scripts/sonidos.ts` | Sintetiza los sonidos del editor |
| `scripts/pruebas.test.ts` | Pruebas sin red ni créditos |
| `scripts/render.ts` | Elige la plantilla del canal; render H.264 1080×1920 30 fps y texto para publicar |

## Para que cuente en Creator Rewards

- El video debe durar **más de 1 minuto**: `voz` y `render` te avisan si no llega.
- Activa la etiqueta **"Contenido generado por IA"** al publicar (la voz es IA).
- Edita cada guion: la originalidad pesa en el pago, y es lo que separa tu canal de uno "de relleno".
- Publica cada canal desde su propia cuenta personal y pública, sin herramientas de seguidores o vistas falsas.
- Fiestas: nunca uses fotos o videos de niños reales.

## Notas técnicas

- Si Remotion no puede descargar su navegador, define `CHROME_PATH` en `.env`.
- El código se muestra sin ligaduras tipográficas, para que `<=` y `++` se vean tal cual se escriben.
- Con ElevenLabs, los subtítulos del canal código usan los tiempos reales de cada palabra y resaltan la que se está diciendo. Con OpenAI, o con voz generada antes de esta función, se reparten por longitud de texto.
