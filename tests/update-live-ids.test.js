const test = require('node:test');
const assert = require('node:assert');
const {
  isValidChannelId,
  isValidVideoId,
  extractLiveVideoId,
  buildLiveIds,
} = require('../tools/update-live-ids.js');

const CHANNEL = 'UCyoGb3SMlTlB8CLGVH4c8Rw';
const VIDEO = 'abcDEF_-123';

// Imita el trozo de la página de YouTube que contiene los datos del video.
function page(details) {
  return `<html><script>var ytInitialPlayerResponse = {"responseContext":{},"videoDetails":${JSON.stringify(details)},"other":{"isLive":true}};</script></html>`;
}

test('channelId: acepta UC + 22 caracteres y rechaza el resto', () => {
  assert.ok(isValidChannelId(CHANNEL));
  assert.ok(isValidChannelId('UCLA_DiR1FfKNvjuUpBHmylQ'));
  for (const bad of ['', 'UC123', CHANNEL + 'a', 'XX' + CHANNEL.slice(2), CHANNEL + '&x=1', CHANNEL + '\n', null, undefined, 42]) {
    assert.ok(!isValidChannelId(bad), `debería rechazar ${JSON.stringify(bad)}`);
  }
});

test('videoId: acepta 11 caracteres de letras, números, - y _', () => {
  for (const good of [VIDEO, 'AAAAAAAAAAA', '-----------', '___________', '0123456789a']) {
    assert.ok(isValidVideoId(good), `debería aceptar ${good}`);
  }
  for (const bad of ['', 'abc', 'abcDEF_-12', 'abcDEF_-1234', 'abcDEF_-12!', 'abc DEF_-12', 'abcDEF_-12"', '<script>aaa', 'abcDEF_-123\n', null, undefined, 12345678901]) {
    assert.ok(!isValidVideoId(bad), `debería rechazar ${JSON.stringify(bad)}`);
  }
});

test('extractLiveVideoId: devuelve el ID cuando el canal está en vivo', () => {
  assert.strictEqual(extractLiveVideoId(page({ videoId: VIDEO, isLive: true }), CHANNEL), VIDEO);
});

test('extractLiveVideoId: acepta el channelId cuando coincide y rechaza cuando es de otro canal', () => {
  assert.strictEqual(extractLiveVideoId(page({ videoId: VIDEO, isLive: true, channelId: CHANNEL }), CHANNEL), VIDEO);
  assert.strictEqual(extractLiveVideoId(page({ videoId: VIDEO, isLive: true, channelId: 'UCUdOoVWuWmgo1wByzcsyKDQ' }), CHANNEL), null);
});

test('extractLiveVideoId: ignora si no está en vivo', () => {
  assert.strictEqual(extractLiveVideoId(page({ videoId: VIDEO, isLive: false }), CHANNEL), null);
  assert.strictEqual(extractLiveVideoId(page({ videoId: VIDEO }), CHANNEL), null);
  assert.strictEqual(extractLiveVideoId(page({ videoId: VIDEO, isLive: 'true' }), CHANNEL), null);
  assert.strictEqual(extractLiveVideoId(page({ videoId: VIDEO, isLiveContent: true }), CHANNEL), null);
});

test('extractLiveVideoId: ignora videoId con formato malo', () => {
  for (const videoId of ['corto', 'demasiado_largo_123', 'abcDEF_-12!', '../../etc/x', '" onload="x', '']) {
    assert.strictEqual(extractLiveVideoId(page({ videoId, isLive: true }), CHANNEL), null, `videoId ${videoId}`);
  }
});

test('extractLiveVideoId: ignora páginas sin datos, rotas o con channelId malo', () => {
  assert.strictEqual(extractLiveVideoId('', CHANNEL), null);
  assert.strictEqual(extractLiveVideoId('<html>nada</html>', CHANNEL), null);
  assert.strictEqual(extractLiveVideoId('"videoDetails":{"videoId":"abcDEF_-123","isLive":true', CHANNEL), null);
  assert.strictEqual(extractLiveVideoId('"videoDetails":{"videoId":abc}', CHANNEL), null);
  assert.strictEqual(extractLiveVideoId(null, CHANNEL), null);
  assert.strictEqual(extractLiveVideoId(page({ videoId: VIDEO, isLive: true }), 'UCmalo'), null);
});

test('extractLiveVideoId: no se confunde con llaves o comillas dentro de los textos', () => {
  const details = { videoId: VIDEO, title: 'Vivo } con "comillas" y {llaves}', shortDescription: 'x\\y }}}', isLive: true };
  assert.strictEqual(extractLiveVideoId(page(details), CHANNEL), VIDEO);
});

test('buildLiveIds: solo guarda canales youtube con mode live que están en vivo', async () => {
  const channels = [
    { id: 'a', type: 'youtube', mode: 'live', channelId: CHANNEL },
    { id: 'b', type: 'youtube', mode: 'live', channelId: 'UCUdOoVWuWmgo1wByzcsyKDQ' },
    { id: 'c', type: 'youtube', mode: 'latest', channelId: 'UCLWiWcQEaD13TeTTe-9BAfQ' },
    { id: 'd', type: 'web', url: 'https://www.tvn.cl/en-vivo' },
    { id: 'e', type: 'youtube', mode: 'live', channelId: 'UCmalo' },
    { id: 'f', type: 'youtube', mode: 'live', channelId: 'UCSrZ3UV4jOidv8ppoVuvW9Q' },
  ];
  const asked = [];
  const fetchPage = async (channelId) => {
    asked.push(channelId);
    if (channelId === CHANNEL) return page({ videoId: VIDEO, isLive: true });
    if (channelId === 'UCUdOoVWuWmgo1wByzcsyKDQ') return page({ videoId: 'zzzzzzzzzzz', isLive: false });
    throw new Error('sin conexión');
  };
  const result = await buildLiveIds(channels, fetchPage);
  assert.deepStrictEqual(result, { [CHANNEL]: VIDEO });
  assert.deepStrictEqual(asked, [CHANNEL, 'UCUdOoVWuWmgo1wByzcsyKDQ', 'UCSrZ3UV4jOidv8ppoVuvW9Q'], 'solo se piden los de mode live con channelId válido');
});
