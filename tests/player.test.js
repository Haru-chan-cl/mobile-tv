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

test('buildEmbedUrl latest: ignora live-ids y usa la lista de subidos', async () => {
  const { buildEmbedUrl } = await load();
  const channel = { channelId: CHANNEL, mode: 'latest' };
  assert.strictEqual(
    buildEmbedUrl(channel, { [CHANNEL]: 'abcDEF_-123' }),
    `https://www.youtube-nocookie.com/embed/videoseries?list=UU${CHANNEL.slice(2)}`
  );
});

test('buildEmbedUrl: un channelId inválido no genera dirección', async () => {
  const { buildEmbedUrl } = await load();
  assert.strictEqual(buildEmbedUrl({ channelId: 'UCmalo', mode: 'live' }, { UCmalo: 'abcDEF_-123' }), null);
});
