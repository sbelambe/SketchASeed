import { Editor } from './editor.js';
import { Screensaver } from './screensaver.js';

const params = new URLSearchParams(window.location.search);
const seed = params.get('seed');

if (seed) {
  new Screensaver(document.getElementById('app'), seed);
} else {
  new Editor(document.getElementById('app'));
}
