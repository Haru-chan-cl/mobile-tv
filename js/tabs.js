// Barra de pestañas inferior. Sigue el patrón de pestañas accesibles: una sola pestaña activa a la vez,
// flechas para moverse, Inicio y Fin para ir a los extremos, y solo la activa entra en el orden de Tab.

// A qué pestaña se mueve el foco según la tecla. Devuelve null si la tecla no es de navegación.
export function nextIndex(current, key, count) {
  switch (key) {
    case 'ArrowRight':
      return (current + 1) % count;
    case 'ArrowLeft':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

// Pestaña con la que abre la app: la de la dirección (#en-vivo) si existe, y si no la de respaldo.
export function initialTabId(hash, ids, fallback) {
  const id = typeof hash === 'string' ? hash.replace(/^#/, '') : '';
  return ids.includes(id) ? id : fallback;
}

export function initTabs(tablist, fallbackId) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const ids = tabs.map((tab) => tab.dataset.tab);

  function select(tab, { focus = false } = {}) {
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute('aria-selected', String(selected));
      other.tabIndex = selected ? 0 : -1;
      document.getElementById(other.getAttribute('aria-controls')).hidden = !selected;
    }
    if (focus) tab.focus();
    try {
      history.replaceState(null, '', `#${tab.dataset.tab}`);
    } catch {
      // Sin historial disponible la app funciona igual, solo que no recuerda la pestaña al recargar.
    }
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab));
  }

  tablist.addEventListener('keydown', (event) => {
    const current = tabs.indexOf(document.activeElement);
    if (current === -1) return;
    const target = nextIndex(current, event.key, tabs.length);
    if (target === null) return;
    event.preventDefault();
    select(tabs[target], { focus: true });
  });

  // Si cambia la dirección (por ejemplo un enlace a #perfil), se abre esa pestaña. Un valor inválido se ignora.
  window.addEventListener('hashchange', () => {
    const tab = tabs[ids.indexOf(initialTabId(window.location.hash, ids, null))];
    if (tab) select(tab);
  });

  const start = initialTabId(window.location.hash, ids, fallbackId);
  select(tabs[ids.indexOf(start)] ?? tabs[0]);
}
