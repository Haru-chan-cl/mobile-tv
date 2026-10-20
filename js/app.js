import { loadChannels, groupByCategory } from './data.js';

const TYPE_LABELS = {
  web: 'Sitio oficial',
  youtube: 'Canal de YouTube',
};

const list = document.getElementById('lista-canales');

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

// Los textos se ponen con textContent (nunca innerHTML) para que ningún dato pueda inyectar código.
function buildChannel(channel) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'channel';
  link.href = channel.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  const name = document.createElement('span');
  name.className = 'channel-name';
  name.textContent = channel.name;

  const kind = document.createElement('span');
  kind.className = 'channel-kind';
  kind.textContent = `${TYPE_LABELS[channel.type] ?? 'Sitio oficial'}, se abre en una pestaña nueva`;

  link.append(name, kind);
  item.append(link);
  return item;
}

function render(channels) {
  const fragment = document.createDocumentFragment();
  for (const [category, items] of groupByCategory(channels)) {
    const section = document.createElement('section');
    section.className = 'category';

    const title = document.createElement('h3');
    title.textContent = category;

    const channelList = document.createElement('ul');
    channelList.className = 'channels';
    for (const channel of items) {
      if (isHttps(channel.url)) {
        channelList.append(buildChannel(channel));
      }
    }

    section.append(title, channelList);
    fragment.append(section);
  }
  list.replaceChildren(fragment);
}

async function start() {
  try {
    const channels = await loadChannels();
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
