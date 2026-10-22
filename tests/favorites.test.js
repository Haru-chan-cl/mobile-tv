const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
// Los archivos pueden venir con saltos de línea de Windows (CRLF); se normalizan para que las pruebas no dependan de eso.
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const app = read('js/app.js');
const css = read('css/styles.css');

// favorites.js es un módulo de navegador (import/export), por eso se carga con import().
const load = () => import(pathToFileURL(path.join(root, 'js', 'favorites.js')).href);

// Almacenamiento falso con la misma interfaz que localStorage.
function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
  };
}

const brokenStorage = {
  getItem() {
    throw new Error('bloqueado');
  },
  setItem() {
    throw new Error('lleno');
  },
};

test('addRecent: el más reciente va primero y solo quedan los últimos 3', async () => {
  const { addRecent } = await load();
  let recents = [];
  for (const id of ['a', 'b', 'c', 'd']) recents = addRecent(recents, id);
  assert.deepStrictEqual(recents, ['d', 'c', 'b']);
});

test('addRecent: volver a abrir un canal lo sube al principio sin repetirlo', async () => {
  const { addRecent } = await load();
  assert.deepStrictEqual(addRecent(['c', 'b', 'a'], 'a'), ['a', 'c', 'b']);
  assert.deepStrictEqual(addRecent(['a'], 'a'), ['a']);
});

test('addRecent: no modifica la lista original', async () => {
  const { addRecent } = await load();
  const original = ['b', 'a'];
  addRecent(original, 'c');
  assert.deepStrictEqual(original, ['b', 'a']);
});

test('toggleFavorite: agrega si no estaba y quita si ya estaba', async () => {
  const { toggleFavorite, isFavorite } = await load();
  let favorites = toggleFavorite([], 'tvn');
  assert.deepStrictEqual(favorites, ['tvn']);
  assert.ok(isFavorite(favorites, 'tvn'));
  favorites = toggleFavorite(favorites, 'mega');
  assert.deepStrictEqual(favorites, ['tvn', 'mega']);
  favorites = toggleFavorite(favorites, 'tvn');
  assert.deepStrictEqual(favorites, ['mega']);
  assert.ok(!isFavorite(favorites, 'tvn'));
});

test('pickChannels: respeta el orden y se salta los id que ya no existen', async () => {
  const { pickChannels } = await load();
  const channels = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepStrictEqual(pickChannels(['c', 'borrado', 'a'], channels), [{ id: 'c' }, { id: 'a' }]);
  assert.deepStrictEqual(pickChannels([], channels), []);
});

test('writeList y readList: guardan y recuperan la lista', async () => {
  const { writeList, readList, FAVORITES_KEY } = await load();
  const storage = fakeStorage();
  assert.strictEqual(writeList(storage, FAVORITES_KEY, ['a', 'b']), true);
  assert.deepStrictEqual(readList(storage, FAVORITES_KEY), ['a', 'b']);
});

test('readList: sin datos, con datos rotos o de otro tipo devuelve lista vacía', async () => {
  const { readList } = await load();
  assert.deepStrictEqual(readList(fakeStorage(), 'k'), []);
  assert.deepStrictEqual(readList(fakeStorage({ k: 'esto no es json' }), 'k'), []);
  assert.deepStrictEqual(readList(fakeStorage({ k: '{"a":1}' }), 'k'), []);
  assert.deepStrictEqual(readList(fakeStorage({ k: '"texto"' }), 'k'), []);
});

test('readList: ignora lo que no sea texto y quita repetidos', async () => {
  const { readList } = await load();
  const storage = fakeStorage({ k: JSON.stringify(['a', 3, null, '', 'b', 'a', { x: 1 }]) });
  assert.deepStrictEqual(readList(storage, 'k'), ['a', 'b']);
});

test('si el navegador bloquea el almacenamiento, no se cae: lee [] y escribir devuelve false', async () => {
  const { readList, writeList } = await load();
  assert.deepStrictEqual(readList(brokenStorage, 'k'), []);
  assert.strictEqual(writeList(brokenStorage, 'k', ['a']), false);
});

test('las claves guardadas son propias de la app y el límite de recientes es 3', async () => {
  const { RECENT_KEY, FAVORITES_KEY, RECENT_LIMIT } = await load();
  assert.notStrictEqual(RECENT_KEY, FAVORITES_KEY);
  assert.match(RECENT_KEY, /^canales\./);
  assert.match(FAVORITES_KEY, /^canales\./);
  assert.strictEqual(RECENT_LIMIT, 3);
});

test('favorites.js: no envía nada ni carga recursos externos', () => {
  const code = read('js/favorites.js').replace(/\/\/.*$/gm, '');
  assert.ok(!/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|import\s*\(|eval)\b/.test(code), 'solo debe usar el almacenamiento local');
  assert.ok(!/https?:\/\//.test(code), 'no debe tener direcciones externas');
});

test('pantalla En Vivo: "Últimos vistos" y "Favoritos" van arriba de las categorías', () => {
  assert.match(app, /buildShelf\('Últimos vistos'/);
  assert.match(app, /buildShelf\('Favoritos'/);
  const shelves = app.indexOf('fragment.append(recentsSection, favoriteShelf.section)');
  const categories = app.indexOf('fragment.append(buildCategory(');
  assert.ok(shelves !== -1 && categories !== -1 && shelves < categories, 'las repisas deben ir antes que las categorías');
});

test('pantalla En Vivo: "Últimos vistos" se oculta sin historial y Favoritos invita a marcar uno', () => {
  assert.match(app, /recentsSection\.hidden = seen\.length === 0/);
  assert.match(app, /Aún no tienes favoritos\. Toca la estrella/);
});

test('pantalla En Vivo: cada canal tiene su estrella accesible y las categorías siguen plegadas', () => {
  assert.match(app, /className = 'star'/);
  assert.match(app, /star\.setAttribute\('aria-pressed'/);
  assert.match(app, /aria-label', on \?/);
  assert.match(app, /toggle\.setAttribute\('aria-expanded', 'false'\)/);
  assert.match(app, /channelList\.hidden = true/);
});

test('pantalla En Vivo: usa localStorage y nunca innerHTML', () => {
  assert.match(app, /window\.localStorage/);
  assert.ok(!/innerHTML/.test(app.replace(/\/\/.*$/gm, '')), 'los textos se ponen con textContent');
});

test('estilos: la estrella tiene foco visible, tamaño táctil y usa los colores del tema', () => {
  assert.match(css, /\.star:focus-visible/);
  assert.match(css, /\.star\s*\{[^}]*min-height:\s*48px/);
  assert.match(css, /\.star\[aria-pressed="true"\]\s*\{[^}]*var\(--stripe-orange\)/);
});

test('Favoritos se pliega igual que las categorías: mismo botón, empieza plegado y Últimos vistos no cambia', () => {
  // Una sola función arma el botón plegable y la usan las categorías y Favoritos (sin código duplicado).
  assert.strictEqual(app.match(/function buildFoldTitle\(/g).length, 1);
  assert.match(app, /fragment\.append\(buildCategory\(|section\.append\(buildFoldTitle\(category, channelList\), channelList\)/);
  assert.match(app, /heading = buildFoldTitle\(title, channelList\)/, 'las repisas plegables usan el mismo botón');
  assert.strictEqual(app.match(/className = 'category-toggle'/g).length, 1, 'el botón de pliegue no debe estar repetido');
  assert.strictEqual(app.match(/aria-expanded', String\(!open\)/g).length, 1, 'la lógica de abrir y cerrar no debe estar repetida');
  // Favoritos es plegable; Últimos vistos sigue con su título fijo.
  assert.match(app, /buildShelf\('Favoritos', 'favoritos', \{ collapsible: true \}\)/);
  assert.match(app, /buildShelf\('Últimos vistos', 'ultimos-vistos'\)/);
  // Nace plegado, con aria-expanded y aria-controls ligados a la lista.
  const helper = app.slice(app.indexOf('function buildFoldTitle('), app.indexOf('function buildShelf('));
  assert.match(helper, /aria-expanded', 'false'/);
  assert.match(helper, /channelList\.hidden = true/);
  assert.match(helper, /aria-controls', channelList\.id/);
});
