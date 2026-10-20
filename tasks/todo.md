# Lista de tareas: App de canales legales

Leyenda de agente: **F** = Antigravity, Gemini Flash 3.8 (alto) · **S** = Claude Code, Sonnet · **N** = Nancy
El detalle y los criterios de cada tarea están en `tasks/plan.md`.

## Fase 0: Cimientos
- [ ] **T0** (F) Esqueleto del proyecto y contrato `channels.json`
- [ ] **T1** (F) Validación automática de `channels.json` (regla de contenido legal)
- [ ] **Punto de control 0** (N aprueba)

## Fase 1: Ver un canal de punta a punta
- [ ] **T2** (F) Pestaña En vivo: lista por categoría y sitios oficiales
- [ ] **T3** (S) Reproductor de YouTube incrustado
- [ ] **T4** (S + N) Conseguir los IDs de canal de YouTube
- [ ] **Punto de control 1** (S revisa a F · N prueba en el teléfono)

## Fase 2: Uso diario (T5 y T6 en paralelo)
- [ ] **T5** (F) Favoritos
- [ ] **T6** (F) Buscador y filtro por categoría
- [ ] **T7** (F) Pestaña Inicio (necesita T5 y T6)
- [ ] **Punto de control 2** (S revisa y fusiona · N aprueba)

## Fase 3: Instalable y segura
- [ ] **T8** (S) PWA instalable
- [ ] **T9** (S) Endurecimiento de seguridad
- [ ] **Punto de control 3** (N aprueba)

## Fase 4: Publicación
- [ ] **T10** (S + N) Publicar en HTTPS (GitHub Pages)
- [ ] **Punto de control 4** (N usa la app unos días)

## Fase 5: Android
- [ ] **T11** (S) Envolver con Capacitor
- [ ] **T12** (S + N) Compilar el APK y probar en el teléfono
- [ ] **T13** (S revisa · F corrige) Revisión final de seguridad y limpieza
- [ ] **Punto de control final**

## Qué se puede hacer a la vez
- T5 y T6 (módulos distintos).
- T4 puede avanzar mientras T5/T6 se hacen, si ya terminó T3.

## Cómo pedirle una tarea a un agente
> Lee `tasks/plan.md` y `channels.json`. Haz **solo** la Tarea N, en una rama nueva `tarea-N`. Respeta las reglas del proyecto. Al terminar, ejecuta la verificación de esa tarea y explícame en palabras simples qué hiciste y qué comprobaste.
