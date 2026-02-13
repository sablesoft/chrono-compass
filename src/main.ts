// src/main.ts
import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

import { registerSW } from 'virtual:pwa-register';
import { bootstrap } from './lib/bootstrap';

async function main() {
  registerSW({ immediate: true });

  // важно: дождаться initLocation + registerWheels
  await bootstrap();

  mount(App, {
    target: document.getElementById('app')!,
  });
}

main().catch((err) => {
  console.error('[main] bootstrap failed', err);

  // Фолбэк: всё равно пытаемся поднять UI, чтобы не получить белый экран.
  mount(App, {
    target: document.getElementById('app')!,
  });
});
