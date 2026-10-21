const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');

const YOUTUBE_FRAME = 'https://www.youtube-nocookie.com';
const ALLOWED_SOURCES = new Set(["'self'", "'none'", YOUTUBE_FRAME]);

// Lee la política de seguridad del <meta> y la devuelve como { directiva: [fuentes] }.
function readCsp() {
  const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(match, 'index.html debe tener la política de seguridad (CSP) en un <meta>');
  const policy = {};
  for (const part of match[1].split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) policy[name] = sources;
  }
  return policy;
}

// Quita comentarios para buscar solo en el código real.
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const ownCode = ['js/app.js', 'js/data.js', 'js/favorites.js', 'js/player.js', 'js/tabs.js', 'js/register-sw.js', 'sw.js'];
const ownFiles = [...ownCode, 'index.html', 'instalar.html', 'css/styles.css', 'css/instalar.css', 'design/tokens.css', 'manifest.webmanifest', 'channels.json'];

test('CSP: bloquea todo por defecto y solo permite lo propio', () => {
  const csp = readCsp();
  assert.deepStrictEqual(csp['default-src'], ["'none'"]);
  assert.deepStrictEqual(csp['script-src'], ["'self'"]);
  assert.deepStrictEqual(csp['style-src'], ["'self'"]);
  for (const directive of ['img-src', 'font-src', 'connect-src', 'manifest-src', 'worker-src']) {
    assert.deepStrictEqual(csp[directive], ["'self'"], `${directive} debe ser solo 'self'`);
  }
  for (const directive of ['object-src', 'base-uri', 'form-action']) {
    assert.deepStrictEqual(csp[directive], ["'none'"], `${directive} debe ser 'none'`);
  }
});

test('CSP: el único sitio externo permitido es youtube-nocookie.com, y solo para marcos', () => {
  const csp = readCsp();
  assert.deepStrictEqual(csp['frame-src'], [YOUTUBE_FRAME]);
  for (const [directive, sources] of Object.entries(csp)) {
    for (const source of sources) {
      assert.ok(ALLOWED_SOURCES.has(source), `${directive}: la fuente ${source} no está permitida`);
      if (source === YOUTUBE_FRAME) assert.strictEqual(directive, 'frame-src', 'YouTube solo puede ir en frame-src');
    }
  }
  const text = JSON.stringify(csp);
  for (const bad of ['unsafe-inline', 'unsafe-eval', 'data:', 'blob:', 'http:', '*']) {
    assert.ok(!text.includes(bad), `la CSP no puede contener ${bad}`);
  }
});

test('etiquetas de seguridad: referrer estricto y nosniff', () => {
  const referrer = html.match(/<meta name="referrer" content="([^"]+)">/);
  assert.ok(referrer, 'falta <meta name="referrer">');
  assert.ok(['no-referrer', 'same-origin', 'strict-origin'].includes(referrer[1]), `referrer demasiado permisivo: ${referrer[1]}`);
  assert.match(html, /<meta http-equiv="X-Content-Type-Options" content="nosniff">/);
});

test('el reproductor de YouTube mantiene su propia política de referrer y sus permisos mínimos', () => {
  const player = read('js/player.js');
  assert.match(player, /iframe\.referrerPolicy = 'strict-origin-when-cross-origin'/, 'YouTube necesita saber el origen para reproducir');
  assert.match(player, /iframe\.allow = 'encrypted-media'/);
  assert.match(player, /iframe\.allowFullscreen = true/);
});

test('index.html: sin scripts ni estilos en línea, sin manejadores on... y sin recursos externos', () => {
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), 'hay un <script> en línea');
  assert.ok(!/<style[\s>]/i.test(html), 'hay un <style> en línea');
  assert.ok(!/\sstyle="/i.test(html), 'hay un atributo style en línea');
  assert.ok(!/\son[a-z]+\s*=/i.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'hay un manejador on... en línea');
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
  assert.ok(!/(src|href)="(https?:)?\/\//.test(withoutComments), 'index.html carga un recurso externo');
});

test('CSS: sin llamadas externas y con tipografías propias', () => {
  for (const file of ['css/styles.css', 'css/instalar.css', 'design/tokens.css']) {
    const css = stripComments(read(file));
    assert.ok(!/https?:\/\//.test(css), `${file} apunta a una dirección externa`);
    assert.ok(!/@import\s+url\(\s*["']?(https?:)?\/\//.test(css), `${file} importa algo externo`);
    for (const [, url] of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      const target = path.join(root, path.dirname(file), url);
      assert.ok(fs.existsSync(target), `${file}: ${url} no existe`);
    }
  }
  const tokens = read('design/tokens.css');
  assert.match(tokens, /@font-face\{font-family:"Barlow Condensed"/);
  assert.match(tokens, /@font-face\{font-family:"Noto Sans JP"/);
});

test('fonts/: son woff2 de verdad y traen su licencia', () => {
  for (const file of fs.readdirSync(path.join(root, 'fonts')).filter((f) => f.endsWith('.woff2'))) {
    assert.strictEqual(fs.readFileSync(path.join(root, 'fonts', file)).subarray(0, 4).toString('ascii'), 'wOF2', `${file} no es woff2`);
  }
  for (const license of ['OFL-barlow-condensed.txt', 'OFL-noto-sans-jp.txt']) {
    assert.match(read(`fonts/${license}`), /SIL OPEN FONT LICENSE/i);
  }
});

test('sw.js guarda las tipografías propias para el modo sin conexión', () => {
  const block = read('sw.js').match(/const ASSETS = \[([\s\S]*?)\];/)[1];
  for (const font of fs.readdirSync(path.join(root, 'fonts')).filter((f) => f.endsWith('.woff2'))) {
    assert.ok(block.includes(`'fonts/${font}'`), `sw.js no guarda fonts/${font}`);
  }
});

test('código propio: sin eval, sin innerHTML, sin rastreo ni claves', () => {
  for (const file of ownCode) {
    const code = stripComments(read(file));
    assert.ok(!/\beval\s*\(|new Function\s*\(|document\.write|\binnerHTML\b|\binsertAdjacentHTML\b/.test(code), `${file}: usa una función insegura`);
    assert.ok(!/importScripts\s*\(/.test(code), `${file}: carga scripts de afuera`);
  }
  for (const file of ownFiles) {
    const text = stripComments(read(file));
    assert.ok(!/google-analytics|googletagmanager|gtag\(|fbq\(|hotjar|mixpanel|segment\.com|sentry/i.test(text), `${file}: parece tener rastreo`);
    assert.ok(!/api[_-]?key|secret|password|bearer\s|AIza[0-9A-Za-z_-]{35}/i.test(text), `${file}: parece tener una clave`);
  }
});

// --- instalar.html: página de ayuda con enlaces oficiales (sin recursos externos) ---
const installHtml = read('instalar.html');
const installBody = installHtml.replace(/<!--[\s\S]*?-->/g, '');

test('instalar.html: usa exactamente la misma CSP que index.html', () => {
  const match = installHtml.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(match, 'instalar.html debe tener la política de seguridad (CSP) en un <meta>');
  const index = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.strictEqual(match[1], index[1]);
  assert.match(installHtml, /<meta name="referrer" content="no-referrer">/);
  assert.match(installHtml, /<meta http-equiv="X-Content-Type-Options" content="nosniff">/);
});

test('instalar.html: sin scripts, estilos en línea ni manejadores on..., y solo carga recursos propios', () => {
  assert.ok(!/<script[\s>]/i.test(installBody), 'la página no necesita scripts');
  assert.ok(!/<style[\s>]/i.test(installBody), 'hay un <style> en línea');
  assert.ok(!/\sstyle="/i.test(installBody), 'hay un atributo style en línea');
  assert.ok(!/\son[a-z]+\s*=/i.test(installBody), 'hay un manejador on... en línea');
  assert.ok(!/<(iframe|img|video|audio|source|embed|object)[\s>]/i.test(installBody), 'no debe incrustar contenido');
  for (const [, tag] of installBody.matchAll(/<link\b([^>]*)>/gi)) {
    const href = tag.match(/href="([^"]+)"/)[1];
    assert.ok(!/^(https?:)?\/\//.test(href), `<link> externo: ${href}`);
  }
});

test('instalar.html: los únicos enlaces de afuera son los oficiales y abren con noopener', () => {
  const allowed = new Set([
    'https://play.google.com/store/apps/details?id=com.brave.browser',
    'https://brave.com/download',
    'https://apps.apple.com/app/id1052879175',
    'https://haru-chan-cl.github.io/mobile-tv/',
  ]);
  const anchors = [...installBody.matchAll(/<a\b([^>]*)>/gi)].map(([, attrs]) => attrs);
  assert.ok(anchors.length >= 6);
  for (const attrs of anchors) {
    const href = attrs.match(/href="([^"]+)"/)[1];
    if (/^https?:\/\//.test(href)) {
      assert.ok(allowed.has(href), `enlace externo no permitido: ${href}`);
      if (new URL(href).hostname !== 'haru-chan-cl.github.io') {
        assert.match(attrs, /rel="noopener noreferrer"/, `${href} debe abrir con rel="noopener noreferrer"`);
      }
    } else if (!href.startsWith('intent://')) {
      assert.ok(!/^[a-z][a-z0-9+.-]*:/i.test(href), `esquema no permitido: ${href}`);
    }
  }
});

test('instalar.html: el enlace tipo intent apunta a Brave y a la app, con enlace normal de respaldo', () => {
  const intent = installBody.match(/href="(intent:\/\/[^"]+)"/);
  assert.ok(intent, 'falta el enlace intent');
  assert.match(intent[1], /^intent:\/\/haru-chan-cl\.github\.io\/mobile-tv\/#Intent;/);
  assert.match(intent[1], /;scheme=https;/);
  assert.match(intent[1], /;package=com\.brave\.browser;/);
  assert.match(intent[1], /S\.browser_fallback_url=https%3A%2F%2Fharu-chan-cl\.github\.io%2Fmobile-tv%2F;end$/);
  assert.match(installBody, /href="https:\/\/haru-chan-cl\.github\.io\/mobile-tv\/"/, 'falta el enlace normal');
});

test('instalar.html: sin correos, datos personales, rastreo ni claves; sin signos de exclamación (regla del tema)', () => {
  const text = installBody.replace(/<[^>]*>/g, ' ');
  assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(installHtml), 'no debe haber correos');
  assert.ok(!/!/.test(text), 'el tema no usa signos de exclamación');
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(installHtml), 'el tema no usa emoji');
  assert.ok(!/google-analytics|googletagmanager|gtag\(|fbq\(|hotjar|mixpanel|segment\.com|sentry/i.test(installHtml));
});

test('README: la sección "Cómo instalar" enlaza a instalar.html y no hay instaladores en el repo', () => {
  const readme = read('README.md');
  assert.match(readme, /## Cómo instalar/);
  assert.match(readme, /https:\/\/haru-chan-cl\.github\.io\/mobile-tv\/instalar\.html/);
  assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(readme), 'no debe haber correos');
  const installers = fs.readdirSync(root, { recursive: true })
    .map(String)
    .filter((file) => !/node_modules|\.git[\\/]/.test(file) && /\.(apk|aab|ipa|exe|msi|dmg)$/i.test(file));
  assert.deepStrictEqual(installers, [], 'no se suben instaladores ni APK');
});
