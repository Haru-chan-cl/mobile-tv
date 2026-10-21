const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// player.js es un módulo de navegador (import/export), por eso se carga con import().
const load = () => import(pathToFileURL(path.join(__dirname, '..', 'js', 'player.js')).href);

const CHANNEL = 'UCkccyEbqhhM3uKOI6Shm-4Q';
const LIVE_FALLBACK = `https://www.youtube-nocookie.com/embed/live_stream?channel=${CHANNEL}`;

test('buildEmbedUrl live: usa el videoId si existe y es válido', async () => {
  const { buildEmbedUrl } = await load();
  const channel = { channelId: CHANNEL, mode: 'live' };
  assert.strictEqual(buildEmbedUrl(channel, { [CHANNEL]: 'abcDEF_-123' }), 'https://www.youtube-nocookie.com/embed/abcDEF_-123');
});

test('buildEmbedUrl live: sin videoId o con uno inválido vuelve a live_stream', async () => {
  const { buildEmbedUrl } = await load();
  const channel = { channelId: CHANNEL, mode: 'live' };
  assert.strictEqual(buildEmbedUrl(channel), LIVE_FALLBACK);
  assert.strictEqual(buildEmbedUrl(channel, {}), LIVE_FALLBACK);
  for (const bad of ['corto', 'abcDEF_-12345', 'abcDEF_-12"', '../x', '', null, 12345678901]) {
    assert.strictEqual(buildEmbedUrl(channel, { [CHANNEL]: bad }), LIVE_FALLBACK, `videoId ${JSON.stringify(bad)}`);
  }
});

test('buildEmbedUrl: un videoId de otro canal o heredado del prototipo no se usa', async () => {
  const { buildEmbedUrl } = await load();
  const channel = { channelId: CHANNEL, mode: 'live' };
  assert.strictEqual(buildEmbedUrl(channel, { UCUdOoVWuWmgo1wByzcsyKDQ: 'abcDEF_-123' }), LIVE_FALLBACK);
  assert.strictEqual(buildEmbedUrl(channel, Object.create({ [CHANNEL]: 'abcDEF_-123' })), LIVE_FALLBACK);
});

test('buildEmbedUrl latest: ignora live-ids y usa la lista de videos normales, sin Shorts (UULF)', async () => {
  const { buildEmbedUrl } = await load();
  const channel = { channelId: CHANNEL, mode: 'latest' };
  const url = buildEmbedUrl(channel, { [CHANNEL]: 'abcDEF_-123' });
  assert.strictEqual(url, `https://www.youtube-nocookie.com/embed/videoseries?list=UULF${CHANNEL.slice(2)}`);
  assert.match(url, /list=UULF[\w-]{22}$/, 'UULF + los 22 caracteres del channelId sin las letras UC');
  assert.ok(!url.includes(`list=UU${CHANNEL.slice(2)}`), 'no debe usar la lista que mezcla Shorts');
});

test('buildYouTubeUrl: el botón de respaldo no cambia (live va a /live, latest va a /videos)', async () => {
  const { buildYouTubeUrl } = await load();
  assert.strictEqual(buildYouTubeUrl({ channelId: CHANNEL, mode: 'live' }), `https://www.youtube.com/channel/${CHANNEL}/live`);
  assert.strictEqual(buildYouTubeUrl({ channelId: CHANNEL, mode: 'latest' }), `https://www.youtube.com/channel/${CHANNEL}/videos`);
});

test('buildEmbedUrl live: no cambia (live_stream y videoId)', async () => {
  const { buildEmbedUrl } = await load();
  assert.strictEqual(buildEmbedUrl({ channelId: CHANNEL, mode: 'live' }), LIVE_FALLBACK);
  assert.strictEqual(buildEmbedUrl({ channelId: CHANNEL, mode: 'live' }, { [CHANNEL]: 'abcDEF_-123' }), 'https://www.youtube-nocookie.com/embed/abcDEF_-123');
});

test('buildEmbedUrl: un channelId inválido no genera dirección', async () => {
  const { buildEmbedUrl } = await load();
  assert.strictEqual(buildEmbedUrl({ channelId: 'UCmalo', mode: 'live' }, { UCmalo: 'abcDEF_-123' }), null);
});
