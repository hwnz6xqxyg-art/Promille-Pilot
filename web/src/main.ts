import { App } from './app';

new App();

if ('serviceWorker' in navigator) {
  // When an updated worker takes control after a deploy, reload once so the page
  // runs the fresh bundle instead of the one cached at first paint. Guarded on an
  // existing controller so the very first visit (initial claim) doesn't reload.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // offline support is progressive enhancement — the app works without it
    });
  });
}
