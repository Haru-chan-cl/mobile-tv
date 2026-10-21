const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Dominios permitidos (regla 1: solo fuentes oficiales). Para agregar uno nuevo, se hace a mano aquí.
const ALLOWED_DOMAINS = ['youtube.com', 'chilevision.cl', 'mega.cl', 'tvn.cl', '13.cl'];
const REQUIRED_FIELDS = ['id', 'name', 'category', 'type', 'url'];
const TYPES = ['web', 'youtube'];
// Las únicas categorías permitidas, con estos nombres exactos.
const CATEGORIES = ['Nacionales', 'Noticias internacionales', 'Ciencia', 'Artes y cultura', 'Infantil', 'Cristianos'];
// live = transmisión en vivo, latest = último video del canal.
const MODES = ['live', 'latest'];

const channels = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'channels.json'), 'utf8')
);

function label(channel, index) {
  return `canal ${index + 1} (${channel && channel.id ? channel.id : 'sin id'})`;
}

function isAllowedHost(hostname) {
  return ALLOWED_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d));
}

test('channels.json es una lista con al menos un canal', () => {
  assert.ok(Array.isArray(channels), 'debe ser una lista');
  assert.ok(channels.length > 0, 'no puede estar vacía');
});

test('cada canal tiene todos los campos y tipos válidos', () => {
  channels.forEach((c, i) => {
    for (const field of REQUIRED_FIELDS) {
      assert.ok(
        typeof c[field] === 'string' && c[field].trim() !== '',
        `${label(c, i)}: falta el campo "${field}"`
      );
    }
    assert.ok(TYPES.includes(c.type), `${label(c, i)}: type debe ser "web" o "youtube", no "${c.type}"`);
    assert.ok(
      CATEGORIES.includes(c.category),
      `${label(c, i)}: la categoría "${c.category}" no es válida. Solo se permiten: ${CATEGORIES.join(', ')}`
    );
    if (c.type === 'youtube') {
      assert.match(
        c.channelId || '',
        /^UC[\w-]{22}$/,
        `${label(c, i)}: un canal youtube necesita channelId con formato UC + 22 caracteres`
      );
      assert.ok(
        MODES.includes(c.mode),
        `${label(c, i)}: un canal youtube necesita mode "live" o "latest", no "${c.mode}"`
      );
    } else if (c.mode !== undefined) {
      assert.ok(MODES.includes(c.mode), `${label(c, i)}: mode solo puede ser "live" o "latest", no "${c.mode}"`);
    }
  });
});

test('no hay id repetidos', () => {
  const seen = new Set();
  channels.forEach((c, i) => {
    assert.ok(!seen.has(c.id), `${label(c, i)}: el id "${c.id}" está repetido`);
    seen.add(c.id);
  });
});

test('todos los enlaces son https y no son señales directas', () => {
  channels.forEach((c, i) => {
    const url = new URL(c.url);
    assert.strictEqual(url.protocol, 'https:', `${label(c, i)}: el enlace debe ser https`);
    const text = c.url.toLowerCase();
    assert.ok(!text.includes('.m3u8'), `${label(c, i)}: prohibido .m3u8`);
    assert.ok(!text.includes('rtmp'), `${label(c, i)}: prohibido rtmp`);
    assert.ok(!/\.ts(\?|#|$)/.test(url.pathname.toLowerCase() + url.search + url.hash), `${label(c, i)}: prohibido .ts`);
  });
});

test('todos los dominios están en la lista permitida', () => {
  channels.forEach((c, i) => {
    const host = new URL(c.url).hostname.toLowerCase();
    assert.ok(
      isAllowedHost(host),
      `${label(c, i)}: el dominio "${host}" no está permitido. Si es oficial, agrégalo a ALLOWED_DOMAINS a mano`
    );
  });
});
