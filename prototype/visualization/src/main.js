import { mount } from 'svelte'
// Global styles handled in App.svelte
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
