import { Editor } from './editor.js';
import { Screensaver } from './screensaver.js';

const hash = window.location.hash.slice(1);
const params = new URLSearchParams(hash);
const seed = params.get('seed');

if (seed) {
  new Screensaver(document.getElementById('app'), seed);
} else {
  new Editor(document.getElementById('app'));
}
