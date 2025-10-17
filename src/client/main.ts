import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import * as game from './stores/game'
import * as theme from './stores/theme'
import * as timer from './stores/timer'
import * as ui from './stores/ui'

const target = document.getElementById('app')
if (!target) {
  throw new Error('App mount point not found')
}

const app = mount(App, { target })

if (import.meta.env.DEV) {
  window.stores = {
    game,
    theme,
    timer,
    ui
  }
}

export default app
