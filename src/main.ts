import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

import { registerSW } from 'virtual:pwa-register';
import { registerWheels } from './lib/bootstrap';

registerSW({ immediate: true });
registerWheels();

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
