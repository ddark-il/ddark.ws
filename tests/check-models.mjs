// Guards the AI Models wiring. The section pulls live data from
// huggingface.co/ddark-il at runtime, so this check needs no network.
// Run: node tests/check-models.mjs
import { readFile } from 'node:fs/promises';

const HF_USER = 'ddark-il';
const site = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', site), 'utf8');
const js = await readFile(new URL('assets/js/main.js', site), 'utf8');

for (const needle of [
    'data-target="modelsSection"',
    'id="models"',
    '<h2 class="amber">AI Models</h2>',
]) {
    if (!html.includes(needle)) throw new Error(`index.html is missing ${needle}`);
}

for (const needle of [`const HF_USER = '${HF_USER}'`, 'author=${HF_USER}', 'cardData=true']) {
    if (!js.includes(needle)) throw new Error(`main.js is missing ${needle}`);
}

const api = js.match(/https:\/\/huggingface\.co\/api\/models\?[^`]+/)?.[0];
if (!api) throw new Error('main.js has no Hugging Face models API call');
if (!api.includes('author=${HF_USER}')) throw new Error('Hugging Face query is not scoped to the profile');

console.log(`OK: AI Models section is wired to huggingface.co/${HF_USER}`);
