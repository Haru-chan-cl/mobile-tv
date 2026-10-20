// Herramienta manual (no forma parte de la app): busca el video en vivo actual de cada canal de YouTube
// con mode "live" y lo guarda en live-ids.json como { "<channelId>": "<videoId>" }.
// Uso: node tools/update-live-ids.js
// Solo lee la página pública https://www.youtube.com/channel/<channelId>/live. Sin claves ni cuentas.

const fs = require('node:fs');
const path = require('node:path');

const CHANNEL_ID_FORMAT = /^UC[\w-]{22}$/;
const VIDEO_ID_FORMAT = /^[A-Za-z0-9_-]{11}$/;
const DELAY_MS = 500;

function isValidChannelId(value) {
  return typeof value === 'string' && CHANNEL_ID_FORMAT.test(value);
}

function isValidVideoId(value) {
  return typeof value === 'string' && VIDEO_ID_FORMAT.test(value);
}

// Recorta el objeto { ... } que empieza en `start`, respetando comillas y llaves dentro de textos.
function sliceObject(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// Devuelve el videoId del vivo, o null si el canal no está en vivo o algo no cumple el formato.
function extractLiveVideoId(html, channelId) {
  if (typeof html !== 'string' || !isValidChannelId(channelId)) return null;
  const marker = '"videoDetails":{';
  const at = html.indexOf(marker);
  if (at === -1) return null;
  const raw = sliceObject(html, at + marker.length - 1);
  if (!raw) return null;

  let details;
  try {
    details = JSON.parse(raw);
  } catch {
    return null;
  }

  if (details.isLive !== true) return null;
  if (!isValidVideoId(details.videoId)) return null;
  // Si la página dice de qué canal es el video, tiene que ser el que pedimos.
  if (details.channelId !== undefined && details.channelId !== channelId) return null;
  return details.videoId;
}

// Recorre los canales de YouTube con mode "live" y arma { channelId: videoId }.
// `fetchPage(channelId)` devuelve el HTML (o null). Se recibe como parámetro para poder probarlo sin internet.
async function buildLiveIds(channels, fetchPage, { delayMs = 0, log = () => {} } = {}) {
  const result = {};
  for (const channel of channels) {
    if (channel.type !== 'youtube' || channel.mode !== 'live') continue;
    if (!isValidChannelId(channel.channelId)) {
      log(`ignorado (channelId inválido): ${channel.id}`);
      continue;
    }
    let videoId = null;
    try {
      videoId = extractLiveVideoId(await fetchPage(channel.channelId), channel.channelId);
    } catch (error) {
      log(`sin respuesta: ${channel.id} (${error.message})`);
      continue;
    }
    if (videoId) {
      result[channel.channelId] = videoId;
      log(`en vivo: ${channel.id} -> ${videoId}`);
    } else {
      log(`sin vivo: ${channel.id}`);
    }
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return result;
}

async function fetchLivePage(channelId) {
  const response = await fetch(`https://www.youtube.com/channel/${channelId}/live`, {
    headers: { 'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function main() {
  const root = path.join(__dirname, '..');
  const channels = JSON.parse(fs.readFileSync(path.join(root, 'channels.json'), 'utf8'));
  const ids = await buildLiveIds(channels, fetchLivePage, { delayMs: DELAY_MS, log: console.log });
  fs.writeFileSync(path.join(root, 'live-ids.json'), JSON.stringify(ids, null, 2) + '\n', 'utf8');
  console.log(`\nlive-ids.json actualizado: ${Object.keys(ids).length} canal(es) con ID de vivo.`);
}

module.exports = { isValidChannelId, isValidVideoId, extractLiveVideoId, buildLiveIds };

if (require.main === module) {
  main().catch((error) => {
    console.error('No se pudo actualizar live-ids.json:', error.message);
    process.exitCode = 1;
  });
}
