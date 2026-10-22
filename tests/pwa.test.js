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
  assert.strictEqual(manifest.name, 'mobile TV');
  assert.strictEqual(manifest.short_name, 'mobile TV');
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

test('sw.js: sin internet, una dirección no guardada cae en la raíz y no en index.html (que puede redirigir)', () => {
  assert.match(sw, /isNavigation \? caches\.match\('\.\/'\)/);
  assert.ok(!/caches\.match\('index\.html'\)/.test(sw), 'una respuesta redirigida no sirve como página');
});

test('sw.js: nunca guarda live-ids.json y deja pasar lo externo', () => {
  const block = sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1];
  assert.ok(!block.includes('live-ids'), 'live-ids.json no puede estar en la lista de caché');
  assert.match(sw, /live-ids\.json[\s\S]*no-store/, 'live-ids.json debe pedirse con cache: no-store');
  assert.match(sw, /url\.origin !== self\.location\.origin\) return/, 'lo que no es de la app debe pasar sin caché');
  assert.ok(!/youtube/i.test(block), 'YouTube no puede estar en la lista de caché');
});

// --- Nombre "mobile TV" e icono de televisor retro ---
const installHtml = read('instalar.html');
const visibleText = (page) => page.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, ' ');

test('nombre: la app se llama "mobile TV" en el título, el encabezado, la guía de instalación y el README', () => {
  assert.match(html, /<title>mobile TV<\/title>/);
  assert.match(html, /<h1><span class="brand">mobile TV<\/span><\/h1>/);
  assert.match(installHtml, /<title>Cómo instalar mobile TV<\/title>/);
  assert.match(installHtml, /<h1>Cómo instalar <span class="brand">mobile TV<\/span><\/h1>/);
  assert.match(read('README.md'), /^# mobile TV$/m);
  // Ningún texto visible usa el nombre antiguo como nombre de la app ("Canales en vivo" es la lista de canales).
  for (const page of [html, installHtml]) {
    assert.ok(!/\bCanales\b(?! en vivo)/.test(visibleText(page)), 'queda el nombre antiguo en un texto visible');
  }
});

test('nombre: el encabezado no se pasa a mayúsculas (.brand) y el repositorio y las direcciones no cambian', () => {
  for (const file of ['css/styles.css', 'css/instalar.css']) {
    assert.match(read(file), /\.brand\s*\{\s*text-transform:\s*none;?\s*\}/, `${file}: falta .brand sin mayúsculas`);
  }
  assert.match(read('README.md'), /https:\/\/haru-chan-cl\.github\.io\/mobile-tv\/instalar\.html/);
  assert.match(installHtml, /https:\/\/haru-chan-cl\.github\.io\/mobile-tv\//);
});

test('ícono: los SVG fuente son un dibujo propio, usan solo colores del tema y no cargan nada de afuera', () => {
  const palette = new Set(['#18000c', '#fc6c18', '#600084', '#f4e2e0']);
  for (const file of ['icons/icon.svg', 'icons/icon-maskable.svg', 'icons/favicon.svg']) {
    const svg = read(file);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 512 512">/, `${file}: cabecera inesperada`);
    for (const [, comment] of svg.matchAll(/<!--([\s\S]*?)-->/g)) {
      assert.ok(!comment.includes('--'), `${file}: un comentario XML no puede llevar "--" (el SVG no se vería)`);
    }
    assert.ok(!/<(script|image|use|foreignObject|style)[\s>]/i.test(svg), `${file}: usa un elemento que no hace falta`);
    assert.ok(!/(href|src)=|url\(|https?:\/\/(?!www\.w3\.org\/2000\/svg)/.test(svg), `${file}: referencia algo externo`);
    const colors = [...svg.replace(/<!--[\s\S]*?-->/g, '').matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
    assert.ok(colors.length >= 4, `${file}: debe tener colores`);
    for (const color of colors) {
      assert.ok(palette.has(color), `${file}: ${color} no es un color del tema`);
      assert.ok(tokens.toLowerCase().includes(color), `${file}: ${color} no aparece en design/tokens.css`);
    }
  }
});

test('ícono: el televisor tiene antenas, carcasa, pantalla, dos perillas, tres rayitas y dos patitas', () => {
  const svg = read('icons/icon.svg');
  assert.strictEqual((svg.match(/<circle /g) || []).length, 2, 'dos perillas');
  assert.strictEqual((svg.match(/<rect /g) || []).length, 3, 'fondo, carcasa y pantalla');
  assert.match(svg, /M256 140 172 56M256 140 340 56/, 'dos antenas en V');
  assert.match(svg, /M148 400v40M364 400v40/, 'dos patitas');
  assert.match(svg, /M354 326h56M354 346h56M354 366h56/, 'tres rayitas');
});

test('ícono: el maskable es opaco y su dibujo cabe en la zona segura', () => {
  const buffer = fs.readFileSync(path.join(root, 'icons/icon-maskable-512.png'));
  assert.strictEqual(buffer[25], 2, 'el maskable debe ser RGB sin transparencia (fondo sólido)');
  const svg = read('icons/icon-maskable.svg');
  assert.match(svg, /<rect width="512" height="512" fill="#18000c"\/>/, 'fondo sólido a pantalla completa');
  const scale = Number(svg.match(/scale\(([\d.]+)\)/)[1]);
  // Esquina más lejana del dibujo (patita inferior izquierda) respecto del centro, ya reducida.
  const [cx, cy] = [256, 251];
  const farthest = Math.max(Math.hypot(64 - cx, 140 - cy), Math.hypot(172 - cx, 56 - cy), Math.hypot(148 - cx, 440 - cy)) * scale;
  assert.ok(farthest <= 512 * 0.4, `el dibujo sale de la zona segura (${Math.round(farthest)} > ${512 * 0.4})`);
});

test('favicon: se enlaza en index.html e instalar.html (SVG y PNG de 32) y mide lo que dice', () => {
  for (const page of [html, installHtml]) {
    assert.match(page, /<link rel="icon" type="image\/svg\+xml" href="icons\/favicon\.svg">/);
    assert.match(page, /<link rel="icon" type="image\/png" sizes="32x32" href="icons\/favicon-32\.png">/);
  }
  assert.strictEqual(pngSize('icons/favicon-32.png'), '32x32');
  const block = sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1];
  for (const file of ['icons/favicon.svg', 'icons/favicon-32.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png']) {
    assert.ok(block.includes(`'${file}'`), `sw.js no guarda ${file}`);
  }
});

test('sw.js: la versión de caché subió para que el teléfono reciba el nombre y los íconos nuevos', () => {
  const version = Number(sw.match(/const CACHE = 'canales-v(\d+)'/)[1]);
  assert.ok(version >= 6, `la caché sigue en v${version}`);
});
