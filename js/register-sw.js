// Registra el service worker (sw.js) para que la app se pueda instalar y abra sin internet.
// Va en un archivo aparte y no dentro de index.html para poder usar una política de seguridad estricta.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Si no se puede registrar, la app sigue funcionando igual, solo que sin instalación ni modo sin conexión.
    });
  });
}
