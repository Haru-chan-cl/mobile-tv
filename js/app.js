import { loadChannels, loadLiveIds, groupByCategory } from './data.js';
import { renderPlayer } from './player.js';
import { initTabs } from './tabs.js';
import {
  RECENT_KEY,
  FAVORITES_KEY,
  readList,
  writeList,
  addRecent,
  isFavorite,
  toggleFavorite,
  pickChannels,
} from './favorites.js';

const KIND_LABELS = {
  web: 'Sitio oficial, se abre en una pestaña nueva',
  live: 'En vivo, se ve aquí en la app',
  latest: 'Últimos videos, se ven aquí en la app',
};

// La app abre en En Vivo porque es la pestaña con contenido.
initTabs(document.getElementById('barra-pestanas'), 'en-vivo');

const list = document.getElementById('lista-canales');
const playerBox = document.getElementById('reproductor-contenido');
let selectedId = null;
let liveIds = {};
let allChannels = [];

// Últimos vistos y favoritos viven solo en el teléfono. Si el navegador no deja usar localStorage, la app sigue sin guardar.
function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const storage = getStorage();
let recents = storage ? readList(storage, RECENT_KEY) : [];
let favorites = storage ? readList(storage, FAVORITES_KEY) : [];
let recentsList = null;
let recentsSection = null;
let favoritesList = null;

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
function buildWebChannel(channel, zone) {
  const link = document.createElement('a');
  link.className = 'channel';
  link.href = channel.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.dataset.focusKey = `${zone}:${channel.id}`;
  link.append(...buildLabels(channel, KIND_LABELS.web));
  link.addEventListener('click', () => markViewed(channel.id));
  return link;
}

// Canal de YouTube: botón que reproduce dentro de la app. El reproductor está fijo arriba,
// así que el video aparece sin tener que bajar.
function buildYouTubeChannel(channel, zone) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'channel';
  button.dataset.channelId = channel.id;
  button.dataset.focusKey = `${zone}:${channel.id}`;
  button.setAttribute('aria-pressed', String(selectedId === channel.id));
  button.append(...buildLabels(channel, KIND_LABELS[channel.mode] ?? KIND_LABELS.live));

  button.addEventListener('click', () => {
    selectedId = channel.id;
    syncPressed();
    renderPlayer(playerBox, channel, liveIds);
    markViewed(channel.id);
  });
  return button;
}

// Marca como abierto solo el botón del canal que se está viendo (puede estar en varias listas a la vez).
function syncPressed() {
  for (const button of list.querySelectorAll('.channel[data-channel-id]')) {
    button.setAttribute('aria-pressed', String(button.dataset.channelId === selectedId));
  }
}

const STAR_PATH = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z';

// Estrella dibujada en SVG (sin imágenes ni estilos en línea, por la política de seguridad).
function buildStarIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', STAR_PATH);
  svg.append(path);
  return svg;
}

function describeStar(star, channel) {
  const on = isFavorite(favorites, channel.id);
  star.setAttribute('aria-pressed', String(on));
  star.setAttribute('aria-label', on ? `Quitar ${channel.name} de favoritos` : `Agregar ${channel.name} a favoritos`);
}

function buildStar(channel, zone) {
  const star = document.createElement('button');
  star.type = 'button';
  star.className = 'star';
  star.dataset.starId = channel.id;
  star.dataset.focusKey = `${zone}:star:${channel.id}`;
  star.append(buildStarIcon());
  describeStar(star, channel);
  star.addEventListener('click', () => {
    favorites = toggleFavorite(favorites, channel.id);
    if (storage) writeList(storage, FAVORITES_KEY, favorites);
    refreshShelves();
  });
  return star;
}

function markViewed(id) {
  recents = addRecent(recents, id);
  if (storage) writeList(storage, RECENT_KEY, recents);
  refreshShelves();
}

// Los textos se ponen con textContent (nunca innerHTML) para que ningún dato pueda inyectar código.
// Cada fila lleva el canal y, al lado, su estrella de favoritos.
function buildChannel(channel, zone) {
  const item = document.createElement('li');
  item.className = 'channel-row';
  const main = channel.type === 'youtube' ? buildYouTubeChannel(channel, zone) : buildWebChannel(channel, zone);
  item.append(main, buildStar(channel, zone));
  return item;
}

function visibleChannels(ids) {
  return pickChannels(ids, allChannels).filter((channel) => isHttps(channel.url));
}

// Vuelve a dibujar "Últimos vistos" y "Favoritos", y deja las estrellas de las categorías al día.
// Si el foco estaba en un botón que se vuelve a dibujar, se lo devuelve al equivalente para no perder el lugar.
function refreshShelves() {
  const focusKey = document.activeElement?.dataset?.focusKey;

  const seen = visibleChannels(recents);
  recentsSection.hidden = seen.length === 0;
  recentsList.replaceChildren(...seen.map((channel) => buildChannel(channel, 'recientes')));

  const liked = visibleChannels(favorites);
  const rows = liked.map((channel) => buildChannel(channel, 'favoritos'));
  if (rows.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'message';
    empty.textContent = 'Aún no tienes favoritos. Toca la estrella de un canal para guardarlo aquí.';
    rows.push(empty);
  }
  favoritesList.replaceChildren(...rows);

  for (const star of list.querySelectorAll('.star')) {
    const channel = allChannels.find((other) => other.id === star.dataset.starId);
    if (channel) describeStar(star, channel);
  }

  if (focusKey) {
    const same = [...list.querySelectorAll('[data-focus-key]')].find((el) => el.dataset.focusKey === focusKey);
    if (same && same !== document.activeElement) same.focus();
  }
}

// Título con botón que pliega y despliega una lista. Nace plegado. Lo usan las categorías y Favoritos.
function buildFoldTitle(label, channelList) {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'category-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  channelList.hidden = true;
  toggle.setAttribute('aria-controls', channelList.id);
  toggle.textContent = label;
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    channelList.hidden = open;
  });

  const title = document.createElement('h3');
  title.append(toggle);
  return title;
}

// Una repisa es un título con su lista de canales, arriba de las categorías.
// Si es plegable, el título es el mismo botón que usan las categorías y la lista empieza oculta.
function buildShelf(title, id, { collapsible = false } = {}) {
  const section = document.createElement('section');
  section.className = 'shelf';
  const channelList = document.createElement('ul');
  channelList.className = 'channels';
  channelList.id = id;

  let heading;
  if (collapsible) {
    heading = buildFoldTitle(title, channelList);
  } else {
    heading = document.createElement('h3');
    heading.className = 'shelf-title';
    heading.textContent = title;
  }
  section.append(heading, channelList);
  return { section, channelList };
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
      channelList.append(buildChannel(channel, 'categoria'));
    }
  }

  section.append(buildFoldTitle(category, channelList), channelList);
  return section;
}

function render(channels) {
  allChannels = channels;
  const fragment = document.createDocumentFragment();

  const recentShelf = buildShelf('Últimos vistos', 'ultimos-vistos');
  recentsSection = recentShelf.section;
  recentsList = recentShelf.channelList;
  const favoriteShelf = buildShelf('Favoritos', 'favoritos', { collapsible: true });
  favoritesList = favoriteShelf.channelList;
  fragment.append(recentsSection, favoriteShelf.section);

  let index = 0;
  for (const [category, items] of groupByCategory(channels)) {
    fragment.append(buildCategory(category, items, index++));
  }
  list.replaceChildren(fragment);
  refreshShelves();
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
