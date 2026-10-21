import { loadChannels, loadLiveIds, groupByCategory } from './data.js';
import { renderPlayer } from './player.js';
import { initTabs } from './tabs.js';

const KIND_LABELS = {
  web: 'Sitio oficial, se abre en una pestaña nueva',
  live: 'En vivo, se ve aquí en la app',
  latest: 'Últimos videos, se ven aquí en la app',
};

// La app abre en En Vivo porque es la pestaña con contenido.
initTabs(document.getElementById('barra-pestanas'), 'en-vivo');

const list = document.getElementById('lista-canales');
const playerBox = document.getElementById('reproductor-contenido');
let selectedButton = null;
let liveIds = {};

// Aviso cuando no hay internet: la lista se ve (viene guardada), pero los videos no.
const offlineNotice = document.getElementById('aviso-sin-conexion');

function updateOnlineStatus() {
  offlineNotice.hidden = navigator.onLine;
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

function isHttps(url) {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function showMessage(text) {
  const message = document.createElement('p');
  message.className = 'message';
  message.textContent = text;
  list.replaceChildren(message);
}

function buildLabels(channel, kindText) {
  const name = document.createElement('span');
  name.className = 'channel-name';
  name.textContent = channel.name;

  const kind = document.createElement('span');
  kind.className = 'channel-kind';
  kind.textContent = kindText;
  return [name, kind];
}

// Canal web: enlace al sitio oficial en una pestaña nueva.
function buildWebChannel(channel) {
  const link = document.createElement('a');
  link.className = 'channel';
  link.href = channel.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.append(...buildLabels(channel, KIND_LABELS.web));
  return link;
}

// Canal de YouTube: botón que reproduce dentro de la app. El reproductor está fijo arriba,
// así que el video aparece sin tener que bajar.
function buildYouTubeChannel(channel) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'channel';
  button.setAttribute('aria-pressed', 'false');
  button.append(...buildLabels(channel, KIND_LABELS[channel.mode] ?? KIND_LABELS.live));

  button.addEventListener('click', () => {
    if (selectedButton) selectedButton.setAttribute('aria-pressed', 'false');
    selectedButton = button;
    button.setAttribute('aria-pressed', 'true');
    renderPlayer(playerBox, channel, liveIds);
  });
  return button;
}

// Los textos se ponen con textContent (nunca innerHTML) para que ningún dato pueda inyectar código.
function buildChannel(channel) {
  const item = document.createElement('li');
  item.append(channel.type === 'youtube' ? buildYouTubeChannel(channel) : buildWebChannel(channel));
  return item;
}

// El título de cada categoría es un botón que pliega y despliega su lista.
function buildCategory(category, items, index) {
  const section = document.createElement('section');
  section.className = 'category';

  const channelList = document.createElement('ul');
  channelList.className = 'channels';
  channelList.id = `categoria-${index}`;
  for (const channel of items) {
    if (isHttps(channel.url)) {
      channelList.append(buildChannel(channel));
    }
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'category-toggle';
  toggle.setAttribute('aria-expanded', 'true');
  toggle.setAttribute('aria-controls', channelList.id);
  toggle.textContent = category;
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    channelList.hidden = open;
  });

  const title = document.createElement('h3');
  title.append(toggle);

  section.append(title, channelList);
  return section;
}

function render(channels) {
  const fragment = document.createDocumentFragment();
  let index = 0;
  for (const [category, items] of groupByCategory(channels)) {
    fragment.append(buildCategory(category, items, index++));
  }
  list.replaceChildren(fragment);
}

async function start() {
  try {
    const [channels, ids] = await Promise.all([loadChannels(), loadLiveIds()]);
    liveIds = ids;
    if (channels.length === 0) {
      showMessage('Todavía no hay canales en la lista.');
      return;
    }
    render(channels);
  } catch {
    showMessage('No se pudo cargar la lista de canales. Revisa que el servidor local esté abierto y recarga la página.');
  }
}

start();
