import { App } from './app';

new App();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // offline support is progressive enhancement — the app works without it
    });
  });
}
