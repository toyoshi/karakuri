import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { installAgentApi } from './game/agentapi';

const app = mount(App, { target: document.getElementById('app')! });

// expose the in-page operation API for browser-side AI co-solvers (window.karakuri)
installAgentApi();

export default app;
