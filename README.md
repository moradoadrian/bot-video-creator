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
- Opcional, por escena: `"archivo": "Contador.vue"` cambia el nombre que se ve en el editor y marca el código como ilustrativo: **no se ejecuta ni se verifica su salida**, así que revísalo a mano. Sirve para JSX, Vue, Angular o código que necesita navegador.
- Opcional, por escena (o en el `gancho`): `"visual"` dibuja un diagrama animado en lugar del editor. Una escena lleva `codigo` o `visual`, no los dos. Cada elemento entra cuando la voz dice su `clave` (por defecto su `texto`); las claves se buscan en orden en la narración y `render` avisa si alguna no aparece.
  - `tarjetas`: `items` (2–6) y opcionalmente `etiquetas: { lista, clave }`, una fila de chips (tecnologías, por ejemplo).
  - `flujo`: `pasos` (2–5) en cadena con un paquete que viaja entre ellos; opcionales `regreso: { texto, clave }` y `final` (un aviso al terminar).
  - `suma`: `partes` (2–3) + … = `resultado`.
  - `versus`: `lados` con dos elementos frente a frente.
  - `recorrido`: igual que `flujo` (mismos campos), pero los pasos viven en un mundo más grande que la pantalla y la cámara viaja por él siguiendo a un paquete de luz: abre en plano general con las siluetas del mapa, se acerca a cada paso cuando la voz lo nombra y vuelve a abrir al final con toda la ruta encendida. Ideal para procesos con recorrido (una petición por Internet, un pedido, un login). Ejemplo: `content/que-pasa-cuando-escribes-una-url-y-presionas-enter/guion.json`.
  - `red`: un `centro` y sus `nodos` (2–6) alrededor; cada nodo se conecta al nombrarse y por las líneas viajan pulsos de luz. Con `falla: { texto, clave }` el centro entra en alarma y tiembla, las líneas se cortan con una X y los nodos se apagan. Mejor en escenas que en el gancho (necesita alto).
  - `cascada`: `fichas` (2–5) en escalera que caen como dominó; cada una choca con la anterior, que se sacude y queda caída. Opcional `final` (el resultado).
  - `verificar`: `items` (2–4) con `veredicto` (`confirmado`, `sin-pruebas` o `falso`) y `claveVeredicto`: la afirmación entra con su `clave` mostrando "verificando…" y el sello cae cuando la voz dice `claveVeredicto`. Ideal para separar hechos de rumores en noticias.
  - Ejemplo con los tres: `content/estados-unidos-detuvo-sus-vuelos/guion.json`.
  - Cada elemento: `{ "texto": "Backend", "detalle": "Valida y procesa", "icono": "servidor", "clave": "valida" }`. Íconos: `pantalla`, `servidor`, `base-datos`, `api`, `cursor`, `imagen`, `formulario`, `menu`, `engrane`, `escudo`, `lista`, `capas`, `check`, `carrito`, `codigo`, `rayo`, `gota`, `usuario`, `nube`, `candado`, `avion`, `torre`, `alerta`, `reloj`, `antena`. Ejemplo completo: `content/frontend-vs-backend-que-es-cada-uno/guion.json`.
- Opcional, para la portada: `"portada": { "titulo": "...", "frase": "..." }`. Sin esto usa el título del gancho.

## Animaciones por concepto

Una escena con código puede llevar `animacion`: una animación junto al editor que explica la idea y se mueve con la ejecución real del código (render.ts lo ejecuta y calcula los datos; no se escriben a mano). Es opcional: los guiones sin ella se ven igual que antes.

```json
{
  "titulo": "Contar del 1 al 5",
  "narracion": "Empezamos en uno, repetimos mientras i sea menor o igual a cinco, y en cada vuelta imprimimos i. El resultado: uno, dos, tres, cuatro, cinco.",
  "codigo": "for (let i = 1; i <= 5; i++) {\n  console.log(i);\n}",
  "salida": "1\n2\n3\n4\n5",
  "animacion": {
    "tipo": "ciclo",
    "datos": {
      "variable": "i",
      "vueltas": 5,
      "claves": { "inicio": "Empezamos", "condicion": "mientras", "cambio": "en cada vuelta", "vueltas": "El resultado" }
    }
  }
}
```

- `ciclo`: pista circular para un `for` o un `while`. Arriba se revisa la condición (dice **sí** o **no**), a la derecha corre el cuerpo (lo que imprime sale disparado a la consola), abajo a la izquierda cambia la variable y el contador del centro rebota con su valor nuevo. Al salir, la pista se pone verde; en un bucle infinito se pone roja y se acelera sin fin.
- Todo lo de `datos` es opcional. `variable` y `vueltas` (veces que entra al cuerpo) se comparan con la ejecución y `render` avisa si no coinciden.
- `claves`: cada parte entra cuando la voz dice su palabra (con los tiempos reales de ElevenLabs; sin ellos, se estima por la posición en el texto). Sin claves busca palabras como "empieza", "condición" o "en cada vuelta". `claves.vueltas` marca cuándo empiezan a correr las vueltas.
- Sin `depurar`, cada vuelta que imprime cae justo cuando su línea aparece en la consola. Con `depurar`, cada vuelta sigue los pasos reales de la ejecución y la animación ocupa el lugar del panel de variables (el contador muestra la variable del ciclo y hasta dos más).
- La animación ocupa una fila bajo el editor: el código debe tener máximo 5 líneas y cada línea de consola máximo 19 caracteres. El cuerpo del ciclo va en su propia línea.
- Ejemplos: `content/el-ciclo-for-animado/guion.json` (con y sin `depurar`, y un bucle infinito) y `content/contar-hacia-atras-animado/guion.json` (con tiempos reales de cada palabra).
- `npm run fotos -- <slug> [--sin-voz] [--en=12,30.5] [--bloque=2]` saca imágenes fijas en `out/fotos/<slug>/` para revisar sin renderizar todo.

## Depurador visual

Agrega `depurar` a una escena con código para mostrarla corriendo: la línea activa avanza, el panel enseña las variables y la consola se llena en el momento real. Los pasos salen de ejecutar el código de verdad, no se escriben a mano.

```json
{
  "titulo": "Y vuelve a aparecer",
  "narracion": "Ahora llamamos a contar. Mira: cuenta regresó.",
  "codigo": "...",
  "depurar": {
    "marcas": [
      { "frase": "Ahora llamamos", "linea": 9 },
      { "frase": "Mira: cuenta", "linea": 4, "vez": 1 }
    ]
  }
}
```

- Cada marca dice: cuando la voz diga `frase`, la ejecución llega a la vez número `vez` (1 por defecto) que corre `linea`. `"linea": 0` es el programa terminado. Sin marcas, los pasos se reparten parejo.
- Una variable que sobrevive a su función sale con la etiqueta **recordada** (un closure).
- `render` avisa si una marca no sirve, si los pasos van muy rápido o si el panel taparía el subtítulo.
- No sigue `async`, `await` ni generadores, ni código que dé más de 300 pasos: esa escena usa el editor normal y `render` te avisa.
- La animación solo se ve con `npm run preview` o `npm run render`: `npm run studio` muestra el editor normal.
- `"etiqueta": "JavaScript avanzado"` en el guion cambia el texto sobre el título del gancho.
- `npm run guion:avanzado -- "tema"` escribe guiones para este formato. Temas en `temas-codigo.md`.

## Personaje

La imagen y sus coordenadas están en `personaje` dentro de `config/marca-codigo.json`. Si cambias o recortas la imagen, actualiza `ancho` y `alto`, el círculo de la `cara` y la posición de la `boca`, todo en píxeles de la imagen original.

## Estructura

| Ruta | Qué es |
|---|---|
| `src/FiestaVideo.tsx` | Plantilla fiestas: gancho, tips numerados, cierre con CTA, subtítulos |
| `src/CodigoVideo.tsx` | Plantilla código: editor con resaltado de sintaxis, línea activa, consola, subtítulos |
| `src/components/EditorDepurador.tsx` | Editor animado del depurador visual: línea activa, variables y consola |
| `src/components/animaciones/` | Animaciones por concepto (`Ciclo.tsx`) y el selector por tipo (`index.tsx`) |
| `src/animaciones/` | Tiempos de cada animación (sin React): de la voz, de la consola o de los pasos reales |
| `scripts/animaciones.ts` | Ejecuta el código de una escena y calcula los datos de su animación; valida los datos del guion |
| `scripts/fotos.ts` | Imágenes fijas de momentos de un video (`npm run fotos`) |
| `src/depurador.ts` | Tiempos y medidas del depurador, compartidos con los validadores |
| `scripts/traza.ts` | Instrumenta el código con acorn y registra cada paso de su ejecución |
| `src/Portada.tsx` | Portada del canal código |
| `src/medidas.ts` | Tamaño del código en pantalla, compartido con los validadores |
| `src/subtitulos.ts` | Convierte los tiempos de la voz en subtítulos palabra por palabra |
| `src/components/` | Personaje, íconos SVG, confeti, resaltado de JavaScript y diagramas animados (`Visual.tsx`) |
| `src/momentos.ts` | En qué segundo aparece cada elemento de un diagrama, según la voz |
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
