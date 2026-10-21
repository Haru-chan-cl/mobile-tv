// Últimos vistos y favoritos. Todo se guarda solo en el teléfono (localStorage): nada sale a ningún servidor.
// Se guardan los id de los canales, no los canales completos, así un canal que cambie en channels.json se ve siempre actualizado.

export const RECENT_KEY = 'canales.recientes';
export const FAVORITES_KEY = 'canales.favoritos';
export const RECENT_LIMIT = 3;

// Lee una lista de id. Si no hay nada, está rota o el navegador bloquea el almacenamiento, devuelve [].
export function readList(storage, key) {
  try {
    const data = JSON.parse(storage.getItem(key));
    if (!Array.isArray(data)) return [];
    return [...new Set(data.filter((id) => typeof id === 'string' && id !== ''))];
  } catch {
    return [];
  }
}

// Guarda la lista. Si el navegador no deja (modo privado, espacio lleno), la app sigue funcionando sin guardar.
export function writeList(storage, key, list) {
  try {
    storage.setItem(key, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// Pone el canal al principio (el más reciente primero), sin repetirlo, y deja solo los últimos `limit`.
export function addRecent(list, id, limit = RECENT_LIMIT) {
  return [id, ...list.filter((other) => other !== id)].slice(0, limit);
}

export function isFavorite(list, id) {
  return list.includes(id);
}

// Agrega el canal a favoritos si no estaba, o lo quita si ya estaba.
export function toggleFavorite(list, id) {
  return isFavorite(list, id) ? list.filter((other) => other !== id) : [...list, id];
}

// Convierte una lista de id en canales, en el mismo orden. Los id que ya no existen en la lista de canales se ignoran.
export function pickChannels(ids, channels) {
  const byId = new Map(channels.map((channel) => [channel.id, channel]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
