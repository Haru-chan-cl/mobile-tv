// Reproductor de YouTube incrustado. Las direcciones se construyen siempre a partir del channelId,
// y solo después de comprobar que tiene el formato UC + 22 caracteres. Nunca se usa un texto libre.

const CHANNEL_ID_FORMAT = /^UC[\w-]{22}$/;
const VIDEO_ID_FORMAT = /^[A-Za-z0-9_-]{11}$/;
const EMBED_BASE = 'https://www.youtube-nocookie.com/embed';
const YOUTUBE_BASE = 'https://www.youtube.com/channel';

export function isValidChannelId(channelId) {
  return typeof channelId === 'string' && CHANNEL_ID_FORMAT.test(channelId);
}

export function isValidVideoId(videoId) {
  return typeof videoId === 'string' && VIDEO_ID_FORMAT.test(videoId);
}

// live: transmisión en vivo. Si live-ids.json tiene un videoId válido para el canal se usa ese video;
// si no, se pide el vivo del canal. latest: lista "subidos" del canal (UU + el ID sin las letras UC).
export function buildEmbedUrl(channel, liveIds = {}) {
  const id = channel.channelId;
  if (!isValidChannelId(id)) return null;
  if (channel.mode === 'live') {
    const videoId = Object.hasOwn(liveIds, id) ? liveIds[id] : undefined;
    if (isValidVideoId(videoId)) return `${EMBED_BASE}/${videoId}`;
    return `${EMBED_BASE}/live_stream?channel=${id}`;
  }
  if (channel.mode === 'latest') return `${EMBED_BASE}/videoseries?list=UU${id.slice(2)}`;
  return null;
}

// Enlace de respaldo: la página oficial del canal en YouTube.
export function buildYouTubeUrl(channel) {
  const id = channel.channelId;
  if (!isValidChannelId(id)) return null;
  if (channel.mode === 'live') return `${YOUTUBE_BASE}/${id}/live`;
  if (channel.mode === 'latest') return `${YOUTUBE_BASE}/${id}/videos`;
  return null;
}

function buildMessage(text) {
  const message = document.createElement('p');
  message.className = 'message';
  message.textContent = text;
  return message;
}

function buildFrame(channel, embedUrl) {
  const frame = document.createElement('div');
  frame.className = 'player-frame';

  const iframe = document.createElement('iframe');
  iframe.src = embedUrl;
  iframe.title = `Reproductor de ${channel.name}`;
  iframe.allowFullscreen = true;
  // Permisos mínimos: solo contenido protegido (algunos vivos lo piden). Sin cámara, micrófono ni autoplay.
  iframe.allow = 'encrypted-media';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox'
  );
  frame.append(iframe);
  return frame;
}

function buildFallback(channel, youtubeUrl) {
  const box = document.createElement('div');
  box.className = 'player-fallback';

  const note = document.createElement('p');
  note.className = 'message';
  note.textContent =
    channel.mode === 'live'
      ? 'Si el video no aparece, puede que el canal no esté transmitiendo en este momento.'
      : 'Si el video no aparece, puede que el canal no permita verlo fuera de YouTube.';

  const link = document.createElement('a');
  link.className = 'open-youtube';
  link.href = youtubeUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Abrir en YouTube';

  box.append(note, link);
  return box;
}

// Dibuja en `container` el reproductor del canal, con el botón de respaldo siempre visible.
export function renderPlayer(container, channel, liveIds = {}) {
  const title = document.createElement('h3');
  title.textContent = channel.name;

  const embedUrl = buildEmbedUrl(channel, liveIds);
  const youtubeUrl = buildYouTubeUrl(channel);

  if (!embedUrl || !youtubeUrl) {
    container.replaceChildren(
      title,
      buildMessage('Este canal no se puede reproducir dentro de la app porque sus datos no son válidos.')
    );
    return;
  }

  container.replaceChildren(title, buildFrame(channel, embedUrl), buildFallback(channel, youtubeUrl));
}
