# Plan de implementación: App de canales legales (web instalable → Android)

## Resumen

App propia para ver canales de TV abiertos, noticias, canales en español y de ciencia en vivo, usando **solo fuentes oficiales y públicas**. Etapa 1: web instalable (PWA). Etapa 2: publicarla en HTTPS. Etapa 3: convertirla en APK de Android con Capacitor.

Quien la usa: Nancy (no es informática). Cada agente debe **explicar en palabras simples** lo que hace.

## Reglas del proyecto (valen para todos los agentes)

1. **Contenido legal:** solo canales de YouTube con transmisión en vivo oficial y sitios oficiales de los canales. Prohibido: listas IPTV, enlaces `.m3u8` o `rtmp` extraídos de otras páginas, servidores de terceros, copiar código o datos de apps piratas.
2. **Seguridad:** sin claves en el código, sin analítica ni rastreo, sin permisos (salvo internet en Android), sin scripts de terceros, solo HTTPS, sin código que se descargue o se actualice por su cuenta.
3. **Simple:** HTML, CSS y JavaScript sin frameworks ni paso de compilación en la etapa web.
4. **Un cambio pequeño por vez:** cada tarea deja la app funcionando.
5. **Repositorio público = cero datos personales.** GitHub Pages gratis exige repositorio público. Por eso: ningún correo, ruta local (`D:\...`), nombre de usuario de Windows ni claves en archivos ni en mensajes de commit; los commits usan el correo `noreply` de GitHub (no el de la universidad); los mensajes de commit **sin enlaces de sesión**; `.gitignore` que cubra `.env*`, `*secrets*` y carpetas de trabajo.
6. **Nunca hacer `git push` sin que Nancy lo apruebe**, y antes de cada push, mostrar `git log` y `git status` para revisar qué se va a subir.
7. **Confirmar antes de cualquier cambio destructivo** (borrar archivos, reescribir historial, forzar un push).

## Decisiones de arquitectura

- **Sin framework, sin build.** Se abre con un servidor local simple (`npx serve`) y se publica tal cual. Menos piezas, menos que mantener, y los agentes más livianos (Flash) pueden trabajar sin enredarse.
- **Los canales viven en `channels.json`**, separado del código. Es el *contrato* entre tareas: se define primero y todas las demás lo respetan.
- **Un módulo por función** (`favorites.js`, `search.js`, `player.js`...). Así dos agentes pueden trabajar a la vez sin tocar el mismo archivo.
- **Reproductor:** YouTube incrustado con `youtube-nocookie.com` (sin cookies de rastreo) para canales tipo `youtube`; los sitios oficiales (tipo `web`) se abren en una pestaña nueva, porque no se pueden incrustar.
- **Pruebas:** `node --test` para validar `channels.json` automáticamente (incluida la regla de contenido legal) y revisión manual en navegador para lo visual.
- **Android al final:** Capacitor envuelve la web ya terminada. No se toca el código web para eso.

## Diseño visual: Analog Sunset (diseño de Nancy)

La app usa el sistema de diseño que Nancy creó: una tapa de casete nocturna ciruela con etiqueta rosa y una franja de cuatro colores. Los valores están en `design/tokens.css` y **no se reinterpretan**.

- **Dos temas:** noche (por defecto) y etiqueta rosa (`data-look="label"` en `<html>`), con un botón para cambiar.
- **Colores:** solo las variables de `tokens.css`. Franjas siempre en el orden naranja, rojo, magenta, violeta; no se agrega un quinto color.
- **Forma:** bordes cuadrados en todo; solo la tarjeta exterior lleva esquinas redondeadas (36 px). Sin sombras, degradados ni desenfoques. Líneas finas (`--rule`) para separar filas.
- **Tipografía:** títulos y etiquetas en Barlow Condensed en mayúsculas; texto en Noto Sans JP. El título grande en katakana (チャンネル) es decorativo y va oculto para lectores de pantalla.
- **Texto:** en español, etiquetas cortas, sin emoji ni signos de exclamación.
- **Accesibilidad:** foco visible de 2 px; contrastes AA según las notas de cada variable.
- **Lo que no se copia:** la ilustración de referencia del casete y el sello de esquina son material de terceros; no se usan como logotipo ni se redibujan.
- **Referencia visual de este estilo:** el panel de canales publicado como página ya lo aplica; sirve de modelo.

## Estructura de archivos

```
canales/
  index.html
  css/styles.css
  design/tokens.css  (variables de Analog Sunset; se importa desde styles.css)
  js/app.js          (pestañas y arranque)
  js/data.js         (carga channels.json)
  js/player.js       (reproductor y lista)
  js/favorites.js    (favoritos)
  js/search.js       (buscador y categorías)
  channels.json      (contrato de datos)
  manifest.webmanifest, sw.js, icons/
  tests/channels.test.js
  tasks/plan.md, tasks/todo.md
  README.md
```

## Contrato de datos: `channels.json`

```json
[
  { "id": "chv", "name": "Chilevisión (CHV)", "category": "Canales abiertos de Chile",
    "type": "web", "url": "https://www.chilevision.cl/senal-online" },
  { "id": "nasa", "name": "NASA", "category": "Ciencia",
    "type": "youtube", "channelId": "UCLA_DiR1FfKNvjuUpBHmylQ",
    "url": "https://www.youtube.com/@NASA" }
]
```
Campos: `id` (único), `name`, `category`, `type` (`web` o `youtube`), `url` (https), y `channelId` solo para `youtube`.

## Cómo repartir el trabajo entre agentes

| Agente | Qué tareas darle | Por qué |
|---|---|---|
| **Antigravity, Gemini Flash 3.8 (alto)** | Tareas S/XS con criterios claros y un solo módulo: datos, listas, favoritos, buscador, estilos, pruebas de datos | Rinde bien con instrucciones acotadas y archivos propios. Gasta menos cuota de Claude |
| **Claude Code, Sonnet** | Tareas que juntan varias piezas o tienen riesgo: reproductor, PWA, seguridad, publicación, Android, revisiones | Mejor para razonar con varios archivos y detectar errores sutiles |

**Reglas de coordinación:**
- Cada agente trabaja en una **rama de git** distinta (`git checkout -b tarea-N`) y no toca archivos de otra tarea.
- Antes de empezar una tarea, el agente lee `tasks/plan.md` y `channels.json`, y hace **solo** esa tarea.
- En cada punto de control, **el otro agente revisa** lo que hizo el primero (Sonnet revisa a Flash, y Flash puede ejecutar las pruebas).
- Nancy aprueba cada punto de control antes de pasar a la fase siguiente.
- Los modelos de Claude dentro de Antigravity dejan de estar disponibles el **2 de noviembre**: conviene dejar para antes de esa fecha las tareas que se beneficien de Sonnet allí.

---

## Fase 0: Cimientos

### Tarea 0: Esqueleto del proyecto y contrato de datos
**Descripción:** Crear la carpeta, `git init`, la estructura de archivos vacía, `channels.json` con los 6 canales iniciales, README corto y el servidor local.
**Criterios de aceptación:**
- [ ] Existe la estructura de archivos del plan.
- [ ] `channels.json` tiene Chilevisión, CHV Noticias, Mega, TVN, Canal 13 y NASA con el formato del contrato.
- [ ] El README explica en 3 pasos cómo abrir la app localmente.
- [ ] `.gitignore` creado (`.env*`, `*secrets*`, `node_modules/`, `android/local.properties`).
- [ ] `git config user.email` de este repositorio usa el correo `noreply` de GitHub, no el de la universidad (comprobar con `git config user.email`).
- [ ] Ningún archivo contiene rutas locales ni correos personales (buscar `D:\`, `@mayor.cl`, `C:\Users`).
**Verificación:**
- [ ] `npx serve .` abre una página (aunque esté casi vacía) sin errores.
- [ ] `node -e "JSON.parse(require('fs').readFileSync('channels.json'))"` no falla.
**Dependencias:** ninguna
**Archivos:** todos los nombrados arriba (vacíos), `channels.json`, `README.md`
**Tamaño:** S
**Agente:** Flash

### Tarea 1: Validación automática de `channels.json` (red de seguridad legal)
**Descripción:** Prueba con `node --test` que revisa el contrato y la regla de contenido legal.
**Criterios de aceptación:**
- [ ] Falla si falta un campo, si hay `id` repetido o si `type` no es `web` o `youtube`.
- [ ] Falla si algún enlace no es `https`, o contiene `.m3u8`, `rtmp` o `.ts`.
- [ ] Falla si el dominio no está en una lista permitida dentro del test (youtube.com, chilevision.cl, mega.cl, tvn.cl, 13.cl y los que se agreguen a mano).
**Verificación:**
- [ ] `node --test` pasa con el `channels.json` inicial.
- [ ] Al agregar un canal con `http://` o `.m3u8`, el test falla (probarlo y revertir).
**Dependencias:** Tarea 0
**Archivos:** `tests/channels.test.js`
**Tamaño:** S
**Agente:** Flash

### Punto de control 0
- [ ] `node --test` pasa. [ ] El esqueleto abre. [ ] Nancy aprueba la estructura y la lista inicial de canales.

---

## Fase 1: Primer camino completo (ver un canal)

### Tarea 2: Pestaña En vivo con lista de canales y apertura de sitios oficiales
**Descripción:** La pestaña En vivo carga `channels.json`, muestra los canales por categoría y, para los de tipo `web`, abre el sitio oficial en una pestaña nueva.
**Criterios de aceptación:**
- [ ] Los canales aparecen agrupados por categoría.
- [ ] Un canal `web` abre su enlace en pestaña nueva con `rel="noopener noreferrer"`.
- [ ] Funciona en pantalla de teléfono (400 px) sin scroll horizontal.
- [ ] Usa solo variables de `design/tokens.css`: sin colores sueltos, sin sombras ni degradados, bordes cuadrados salvo la tarjeta exterior.
- [ ] Botón para cambiar entre tema noche y tema etiqueta.
**Verificación:**
- [ ] Manual: abrir en navegador, probar 2 canales web, y revisar los dos temas.
- [ ] Buscar en `css/` y `js/` colores escritos a mano (`#`, `rgb(`): solo deben aparecer en `design/tokens.css`.
- [ ] `node --test` sigue pasando.
**Dependencias:** Tarea 0
**Archivos:** `index.html`, `css/styles.css`, `js/app.js`, `js/data.js`
**Tamaño:** M
**Agente:** Flash

### Tarea 3: Reproductor de YouTube incrustado (canal `youtube`)
**Descripción:** Al elegir un canal `youtube`, se muestra el reproductor oficial incrustado (`youtube-nocookie.com/embed/live_stream?channel=ID`) con la lista de canales al lado en horizontal y arriba en vertical. Si no hay transmisión o falla, aparece un enlace de respaldo al canal.
**Criterios de aceptación:**
- [ ] NASA se reproduce dentro de la app.
- [ ] El diseño cambia entre horizontal y vertical.
- [ ] Si el reproductor falla o no hay vivo, se ve un mensaje claro y el enlace de respaldo.
- [ ] No se carga ningún script de terceros distinto del propio iframe de YouTube.
**Verificación:**
- [ ] Manual: probar NASA, un canal sin vivo y un ID inventado.
- [ ] Revisar en la pestaña Red del navegador que solo se llama a youtube-nocookie.com.
**Dependencias:** Tarea 2
**Archivos:** `js/player.js`, `css/styles.css`, `index.html`
**Tamaño:** M
**Agente:** Sonnet

### Tarea 4 (manual, Nancy + agente): Conseguir los IDs de canal de YouTube
**Descripción:** Para cada canal de YouTube que Nancy quiera (24 Horas, T13, CNN Chile, DW, France 24, Euronews, RTVE, ESA y otros de ciencia): obtener el ID `UC...` (YouTube → canal → Acerca de → Compartir → Copiar ID del canal) y agregarlo a `channels.json`.
**Criterios de aceptación:**
- [ ] Cada canal agregado tiene `channelId` válido y abre en el reproductor.
**Verificación:**
- [ ] `node --test` pasa. [ ] Cada uno se probó en la app.
**Dependencias:** Tarea 3
**Archivos:** `channels.json`
**Tamaño:** S
**Agente:** Sonnet (ayuda con Chrome) + Nancy

### Punto de control 1
- [ ] Un canal web y uno de YouTube funcionan de punta a punta. [ ] Sonnet revisó la Tarea 2; Flash corrió las pruebas. [ ] Nancy lo probó en su teléfono (abriendo la app en red local o desde otro equipo).

---

## Fase 2: Uso diario (se puede hacer en paralelo)

Cada tarea toca un módulo distinto, por eso pueden ir a la vez en ramas separadas.

### Tarea 5: Favoritos
**Descripción:** Botón de estrella por canal y pestaña Favoritos. Se guardan en el dispositivo (`localStorage`).
**Criterios de aceptación:**
- [ ] Marcar y desmarcar funciona y se mantiene al recargar.
- [ ] La pestaña Favoritos muestra solo los marcados, o un mensaje si no hay.
- [ ] Si el almacenamiento falla, la app sigue funcionando sin guardar.
**Verificación:**
- [ ] Manual: marcar 2 canales, recargar, comprobar. [ ] Probar en ventana privada.
**Dependencias:** Tarea 2
**Archivos:** `js/favorites.js`, `index.html`, `css/styles.css`
**Tamaño:** S
**Agente:** Flash

### Tarea 6: Buscador y filtro por categoría
**Descripción:** Caja de búsqueda por nombre y chips de categoría en la pestaña En vivo.
**Criterios de aceptación:**
- [ ] Escribir "chile" muestra solo canales que lo contienen. [ ] El filtro por categoría funciona. [ ] Sin resultados muestra un mensaje.
**Verificación:**
- [ ] Manual con 3 búsquedas distintas.
**Dependencias:** Tarea 2
**Archivos:** `js/search.js`, `index.html`, `css/styles.css`
**Tamaño:** S
**Agente:** Flash

### Tarea 7: Pestaña Inicio
**Descripción:** Muestra "Seguir viendo" (último canal), tus favoritos y atajos a las categorías.
**Criterios de aceptación:**
- [ ] Recuerda el último canal visto. [ ] Muestra favoritos si existen. [ ] Los atajos llevan a la categoría correcta.
**Verificación:**
- [ ] Manual: ver un canal, volver a Inicio, comprobar.
**Dependencias:** Tareas 5 y 6
**Archivos:** `js/app.js`, `index.html`, `css/styles.css`
**Tamaño:** S
**Agente:** Flash

### Punto de control 2
- [ ] Las tres pestañas funcionan. [ ] Sonnet revisó las ramas de Flash y las fusionó sin conflictos. [ ] `node --test` pasa. [ ] Nancy aprueba.

---

## Fase 3: Instalable y segura

### Tarea 8: PWA instalable
**Descripción:** `manifest.webmanifest`, íconos y `sw.js` para instalar en teléfono y notebook y abrir rápido.
**Criterios de aceptación:**
- [ ] Chrome ofrece "Instalar app". [ ] Instalada, abre sin la barra del navegador. [ ] Si no hay internet, se ve la estructura de la app con un aviso (los videos no).
**Verificación:**
- [ ] Lighthouse (en Chrome DevTools) → PWA instalable sin errores.
**Dependencias:** Punto de control 2
**Archivos:** `manifest.webmanifest`, `sw.js`, `icons/`, `index.html`
**Tamaño:** M
**Agente:** Sonnet

### Tarea 9: Endurecimiento de seguridad
**Descripción:** Política de seguridad de contenido (CSP) estricta, sin scripts en línea riesgosos, enlaces externos con `noopener`, revisión de que no hay claves ni rastreo.
**Criterios de aceptación:**
- [ ] CSP solo permite lo propio y youtube-nocookie.com. [ ] Ninguna solicitud de red a dominios no previstos. [ ] Sin claves ni datos personales en el código.
**Verificación:**
- [ ] Consola del navegador sin errores de CSP en uso normal. [ ] Búsqueda de textos sospechosos (`key`, `token`, `api`) en el código.
**Dependencias:** Tarea 8
**Archivos:** `index.html`, `sw.js`, `js/*.js`
**Tamaño:** S
**Agente:** Sonnet

### Punto de control 3
- [ ] Instala y abre bien en teléfono y notebook. [ ] Revisión de seguridad hecha por Sonnet. [ ] Nancy aprueba.

---

## Fase 4: Publicación

### Tarea 10: Publicar en HTTPS (GitHub Pages)
**Descripción:** Subir el repositorio y publicarlo. Prueba con el reproductor real (ahora sí funciona incrustado).
**Criterios de aceptación:**
- [ ] La app abre en `https://...github.io/...`. [ ] El reproductor de YouTube funciona desde ahí. [ ] Se instala desde esa dirección.
**Verificación:**
- [ ] Probar desde el teléfono y desde el notebook de la universidad.
**Dependencias:** Punto de control 3 (y cuenta de GitHub de Nancy)
**Archivos:** configuración del repositorio
**Tamaño:** S
**Agente:** Sonnet + Nancy (necesita su cuenta)

### Punto de control 4
- [ ] Funciona publicada. [ ] Nancy la usa unos días antes de pasar a Android.

---

## Fase 5: App de Android

### Tarea 11: Envolver con Capacitor
**Descripción:** Agregar Capacitor al proyecto y generar el proyecto Android.
**Criterios de aceptación:**
- [ ] Existe la carpeta `android/`. [ ] El manifiesto de Android solo pide `INTERNET`. [ ] `usesCleartextTraffic` en `false`.
**Verificación:**
- [ ] `npx cap sync android` sin errores. [ ] Revisar `AndroidManifest.xml`.
**Dependencias:** Punto de control 4
**Archivos:** `capacitor.config.json`, `package.json`, `android/`
**Tamaño:** M
**Agente:** Sonnet

### Tarea 12: Compilar el APK y probarlo en el teléfono
**Descripción:** Con Android Studio, generar el APK de prueba (debug), instalarlo y probar los canales.
**Criterios de aceptación:**
- [ ] El APK instala. [ ] Reproduce NASA y abre los sitios oficiales. [ ] No pide ningún permiso al instalar.
**Verificación:**
- [ ] Prueba manual en el teléfono de Nancy.
**Dependencias:** Tarea 11
**Archivos:** `android/`
**Tamaño:** M
**Agente:** Sonnet + Nancy

### Tarea 13: Revisión final de seguridad y limpieza
**Descripción:** Revisión de las cinco áreas (correctitud, legibilidad, arquitectura, seguridad, rendimiento) sobre todo el proyecto, y correcciones pendientes.
**Criterios de aceptación:**
- [ ] Sin hallazgos de seguridad abiertos. [ ] Los permisos del APK son solo internet. [ ] README al día.
**Verificación:**
- [ ] `node --test` pasa. [ ] Revisión hecha por un agente distinto del que escribió el código.
**Dependencias:** Tarea 12
**Archivos:** variados
**Tamaño:** M
**Agente:** Sonnet (revisión) y Flash (aplica correcciones simples)

### Punto de control final
- [ ] Todos los criterios cumplidos. [ ] Nancy usa la app en su teléfono.

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Un canal no permite incrustar su señal | Medio | Tipo `web` o enlace de respaldo; no se intenta saltar su restricción |
| Los IDs de canal están mal o cambian | Medio | Prueba automática del formato y verificación manual en Tarea 4 |
| Flash se desvía en tareas largas | Medio | Tareas S con un solo módulo y criterios cortos; revisión de Sonnet en cada punto de control |
| Se acaba el acceso a Claude en Antigravity (2 nov) | Medio | Dejar las tareas de Sonnet para Claude Code; Antigravity solo con Flash después |
| Conflictos de git entre ramas paralelas | Bajo | Un módulo por tarea y fusión supervisada en cada punto de control |
| Un canal deja de existir o cambia de dirección | Bajo | `channels.json` se edita en una línea |

## Preguntas abiertas

- ¿Qué canales de YouTube quieres incluir además de los iniciales? (para la Tarea 4)
- ¿Tienes cuenta de GitHub? (necesaria para la Tarea 10)
- ¿Android Studio instalado o hay que instalarlo? (Tarea 12; ocupa espacio, importa por tu disco C:)
- ¿Quieres guía de programación (EPG)? Quedó fuera de este plan: las fuentes oficiales no la entregan en un formato común. Puede ser una fase posterior.
