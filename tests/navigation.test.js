const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
// Los archivos pueden venir con saltos de línea de Windows (CRLF); se normalizan para que las pruebas no dependan de eso.
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const html = read('index.html');
const css = read('css/styles.css');
const app = read('js/app.js');

// tabs.js es un módulo de navegador (import/export), por eso se carga con import().
const loadTabs = () => import(pathToFileURL(path.join(root, 'js', 'tabs.js')).href);

// Las cuatro pestañas de la barra, en el orden en que aparecen.
function readTabs() {
  return [...html.matchAll(/<button[^>]*role="tab"[^>]*>[\s\S]*?<\/button>/g)].map(([button]) => ({
    key: button.match(/data-tab="([^"]+)"/)[1],
    id: button.match(/\bid="([^"]+)"/)[1],
    controls: button.match(/aria-controls="([^"]+)"/)[1],
    selected: button.match(/aria-selected="([^"]+)"/)[1],
    tabindex: button.match(/tabindex="([^"]+)"/)[1],
    label: button.match(/<span>([^<]+)<\/span>/)[1],
    iconHidden: /<svg[^>]*aria-hidden="true"/.test(button),
  }));
}

function panel(id) {
  const match = html.match(new RegExp(`<section id="${id}"[^>]*role="tabpanel"[^>]*>[\\s\\S]*?\\n        </section>\\n`));
  assert.ok(match, `no encontré el panel ${id}`);
  return match[0];
}

// Cuerpo de una regla de CSS, por su selector exacto.
function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `no encontré la regla ${selector}`);
  return match[1];
}

test('barra inferior: cuatro pestañas en orden, con ícono y texto', () => {
  const tabs = readTabs();
  assert.deepStrictEqual(tabs.map((t) => t.label), ['Inicio', 'En Vivo', 'VOD', 'Perfil']);
  assert.deepStrictEqual(tabs.map((t) => t.key), ['inicio', 'en-vivo', 'vod', 'perfil']);
  for (const tab of tabs) assert.ok(tab.iconHidden, `${tab.label}: falta el ícono (decorativo, aria-hidden)`);
  assert.match(html, /<nav class="tabbar" aria-label="[^"]+">/);
  assert.match(html, /role="tablist"/);
});

test('cada pestaña controla su panel y el panel la nombra', () => {
  for (const tab of readTabs()) {
    assert.strictEqual(tab.controls, `panel-${tab.key}`);
    assert.strictEqual(tab.id, `tab-${tab.key}`);
    assert.match(panel(tab.controls), new RegExp(`aria-labelledby="${tab.id}"`));
  }
});

test('abre en En Vivo: una sola pestaña activa, y solo ella entra en el orden de Tab', () => {
  const tabs = readTabs();
  assert.deepStrictEqual(tabs.filter((t) => t.selected === 'true').map((t) => t.key), ['en-vivo']);
  for (const tab of tabs) assert.strictEqual(tab.tabindex, tab.key === 'en-vivo' ? '0' : '-1');
  assert.ok(!/<section id="panel-en-vivo"[^>]*\shidden/.test(html), 'el panel En Vivo no debe empezar oculto');
  for (const key of ['inicio', 'vod', 'perfil']) assert.match(panel(`panel-${key}`), /\shidden>/, `panel-${key} debe empezar oculto`);
});

test('Inicio, VOD y Perfil son pantallas vacías con "Próximamente"; En Vivo no', () => {
  for (const key of ['inicio', 'vod', 'perfil']) assert.match(panel(`panel-${key}`), />Próximamente</);
  assert.ok(!panel('panel-en-vivo').includes('Próximamente'));
});

test('En Vivo: el reproductor va arriba y la lista de canales debajo', () => {
  const live = panel('panel-en-vivo');
  const player = live.indexOf('id="reproductor"');
  const list = live.indexOf('id="lista-canales"');
  assert.ok(player !== -1 && list !== -1 && player < list, 'el reproductor debe estar antes que la lista');
  assert.match(rule('.live'), /flex-direction:\s*column/);
  assert.match(rule('.player-area'), /flex:\s*none/, 'el reproductor no debe encogerse ni desplazarse');
  assert.match(rule('#lista-canales'), /overflow-y:\s*auto/, 'la lista debe tener su propio scroll');
});

test('categorías plegables: el título es un botón con aria-expanded y aria-controls', () => {
  assert.match(app, /className = 'category-toggle'/);
  assert.match(app, /toggle\.setAttribute\('aria-expanded', 'true'\)/, 'las categorías deben empezar desplegadas y declararlo');
  assert.match(app, /toggle\.setAttribute\('aria-expanded', String\(!open\)\)/, 'al tocar, aria-expanded debe cambiar');
  assert.match(app, /setAttribute\('aria-controls'/);
  assert.match(app, /channelList\.hidden = open/);
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/, 'sin esto, hidden no oculta lo que tiene display propio');
});

test('accesibilidad: todo lo que se toca mide al menos 44 px', () => {
  for (const selector of ['.tab', '.category-toggle', '.channel', '.open-youtube']) {
    const min = rule(selector).match(/min-height:\s*(\d+)px/);
    assert.ok(min && Number(min[1]) >= 44, `${selector} debe tener min-height de 44px o más`);
  }
  assert.ok(Number(rule('.tab').match(/min-width:\s*(\d+)px/)[1]) >= 44, '.tab debe medir al menos 44px de ancho');
});

test('accesibilidad: foco visible en pestañas, categorías, canales y botón de respaldo', () => {
  for (const selector of ['.tab:focus-visible', '.channel:focus-visible', '.category-toggle:focus-visible', '.open-youtube:focus-visible']) {
    assert.ok(css.includes(selector), `falta ${selector}`);
  }
  assert.match(rule('.tab:focus-visible'), /outline:\s*2px solid var\(--focus\)/);
});

test('diseño: solo colores de tokens.css, sin sombras ni degradados, bordes cuadrados', () => {
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'styles.css no debe tener colores escritos a mano');
  assert.ok(!/box-shadow|text-shadow|gradient\(/.test(css), 'sin sombras ni degradados');
  for (const [, value] of css.matchAll(/border-radius:\s*([^;]+);/g)) {
    assert.ok(['var(--radius-none)', 'var(--radius-card)'].includes(value.trim()), `border-radius no permitido: ${value}`);
  }
  assert.ok(!/[¡!]/.test(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<!doctype html>/i, '')), 'sin signos de exclamación en el texto');
  assert.ok(!/\p{Extended_Pictographic}/u.test(html), 'sin emoji');
});

test('teléfono acostado: lado a lado desde 560 px, y en pantallas bajas el título y la nota quedan para lectores de pantalla', () => {
  assert.match(css, /@media \(orientation: landscape\) and \(min-width: 560px\)/);
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\)/);
  const short = css.match(/@media \(orientation: landscape\) and \(max-height: 500px\) \{([\s\S]*?)\n\}\n/)[1];
  assert.match(short, /\.topbar h1,\s*\.player-fallback \.message \{[^}]*clip-path: inset\(50%\)/, 'se ocultan a la vista pero siguen en la página');
  assert.ok(!/display:\s*none/.test(short), 'no usar display: none, para que los lectores de pantalla los sigan leyendo');
  assert.match(css, /\.player-frame \{\s*max-width: calc\(\(100vh - \d+px\) \* 16 \/ 9\)/, 'el video no puede ser más alto que el espacio libre');
});

test('tabs.js: teclas de flecha, Inicio y Fin', async () => {
  const { nextIndex } = await loadTabs();
  assert.strictEqual(nextIndex(0, 'ArrowRight', 4), 1);
  assert.strictEqual(nextIndex(3, 'ArrowRight', 4), 0, 'da la vuelta al final');
  assert.strictEqual(nextIndex(0, 'ArrowLeft', 4), 3, 'da la vuelta al inicio');
  assert.strictEqual(nextIndex(2, 'ArrowLeft', 4), 1);
  assert.strictEqual(nextIndex(2, 'Home', 4), 0);
  assert.strictEqual(nextIndex(1, 'End', 4), 3);
  for (const key of ['Enter', ' ', 'a', 'ArrowUp', 'Tab']) assert.strictEqual(nextIndex(1, key, 4), null, `${key} no navega`);
});

test('tabs.js: reacciona a cambios de la dirección y recuerda la pestaña', () => {
  const tabs = read('js/tabs.js');
  assert.match(tabs, /addEventListener\('hashchange'/);
  assert.match(tabs, /history\.replaceState\(null, '', `#\$\{tab\.dataset\.tab\}`\)/, 'recuerda la pestaña sin llenar el historial');
});

test('tabs.js: pestaña inicial según la dirección, con respaldo', async () => {
  const { initialTabId } = await loadTabs();
  const ids = ['inicio', 'en-vivo', 'vod', 'perfil'];
  assert.strictEqual(initialTabId('#perfil', ids, 'en-vivo'), 'perfil');
  assert.strictEqual(initialTabId('vod', ids, 'en-vivo'), 'vod');
  for (const bad of ['', '#', '#nada', '#<script>', '#inicio&x=1', null, undefined]) {
    assert.strictEqual(initialTabId(bad, ids, 'en-vivo'), 'en-vivo', `hash ${JSON.stringify(bad)}`);
  }
});
