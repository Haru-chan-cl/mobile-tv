// Carga channels.json y lo agrupa por categoría. Es el único módulo que sabe de dónde vienen los datos.

export async function loadChannels() {
  const response = await fetch('channels.json');
  if (!response.ok) {
    throw new Error(`No se pudo leer channels.json (${response.status})`);
  }
  return response.json();
}

// Lee live-ids.json ({ channelId: videoId }). Si falta o está roto, devuelve {} y la app usa el vivo del canal.
export async function loadLiveIds() {
  try {
    const response = await fetch('live-ids.json');
    if (!response.ok) return {};
    const data = await response.json();
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

// Devuelve un Map { categoría -> [canales] } respetando el orden en que aparecen en el archivo.
export function groupByCategory(channels) {
  const groups = new Map();
  for (const channel of channels) {
    if (!groups.has(channel.category)) {
      groups.set(channel.category, []);
    }
    groups.get(channel.category).push(channel);
  }
  return groups;
}
