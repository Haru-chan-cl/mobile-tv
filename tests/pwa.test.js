const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('manifest.webmanifest'));
const tokens = read('design/tokens.css');
const sw = read('sw.js');
const html = read('index.html');

// Ancho y alto de un PNG, leídos de su cabecera.
function pngSize(file) {
  const buffer = fs.readFileSync(path.join(root, file));
  assert.strictEqual(buffer.subarray(1, 4).toString('ascii'), 'PNG', `${file} no es un PNG`);
  return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
}

test('manifest: nombre, modo standalone y rutas relativas', () => {
  assert.strictEqual(manifest.name, 'Canales');
  assert.strictEqual(manifest.display, 'standalone');
  assert.ok(manifest.start_url && !manifest.start_url.startsWith('/') && !manifest.start_url.startsWith('http'), 'start_url debe ser relativa');
});

test('manifest: los colores salen de design/tokens.css', () => {
  for (const key of ['background_color', 'theme_color']) {
    assert.match(manifest[key], /^#[0-9a-f]{6}$/i, `${key} debe ser un color #rrggbb`);
    assert.ok(tokens.toLowerCase().includes(manifest[key].toLowerCase()), `${key} ${manifest[key]} no aparece en tokens.css`);
  }
});

test('manifest: íconos de 192 y 512, y uno maskable, con el tamaño real que declaran', () => {
  const purposes = manifest.icons.map((icon) => `${icon.sizes}:${icon.purpose}`);
  for (const wanted of ['192x192:any', '512x512:any', '512x512:maskable']) {
    assert.ok(purposes.includes(wanted), `falta el ícono ${wanted}`);
  }
  for (const icon of manifest.icons) {
    assert.strictEqual(icon.type, 'image/png');
    assert.strictEqual(pngSize(icon.src), icon.sizes, `${icon.src} no mide ${icon.sizes}`);
  }
});

test('index.html enlaza el manifest, el ícono y el registro del service worker', () => {
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /<link rel="icon"[^>]+href="icons\/[^"]+\.png"/);
  assert.match(html, /<script src="js\/register-sw\.js"><\/script>/);
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), 'no debe haber scripts escritos dentro de index.html');
  assert.match(read('js/register-sw.js'), /register\('sw\.js'\)/);
});

test('sw.js: la lista de caché solo tiene archivos propios que existen', () => {
  const block = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(block, 'no encontré la lista ASSETS en sw.js');
  const assets = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(assets.length > 5);
  for (const asset of assets) {
    assert.ok(!/^[a-z]+:\/\//i.test(asset) && !asset.startsWith('//'), `${asset}: no puede ser una dirección externa`);
    if (asset !== './') assert.ok(fs.existsSync(path.join(root, asset)), `${asset} no existe`);
  }
});

test('sw.js: nunca guarda live-ids.json y deja pasar lo externo', () => {
  const block = sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1];
  assert.ok(!block.includes('live-ids'), 'live-ids.json no puede estar en la lista de caché');
  assert.match(sw, /live-ids\.json[\s\S]*no-store/, 'live-ids.json debe pedirse con cache: no-store');
  assert.match(sw, /url\.origin !== self\.location\.origin\) return/, 'lo que no es de la app debe pasar sin caché');
  assert.ok(!/youtube/i.test(block), 'YouTube no puede estar en la lista de caché');
});
