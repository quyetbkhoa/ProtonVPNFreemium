// Generates offline UI fixtures with production popup HTML/CSS and real tool
// renderer. No extension is installed and no account/network call is performed.
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {JSDOM} = require('jsdom');
const {createLoader} = require('../tests/helpers/local-loader.cjs');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'logs/ui-rc3');
fs.mkdirSync(out, {recursive: true});
(async () => {
  for (const [name, theme, scale] of [['light', 'light-theme', 1], ['dark', 'dark-theme', 1], ['large', 'light-theme', 2]]) {
    const dom = new JSDOM(fs.readFileSync(path.join(root, 'source/popup.html'), 'utf8'));
    const {document} = dom.window;
    document.querySelectorAll('script').forEach(element => element.remove());
    const base = document.createElement('base');
    base.href = pathToFileURL(path.join(root, 'distribution') + path.sep).href;
    document.head.prepend(base);
    document.documentElement.style.fontSize = `${16 * scale}px`;
    document.body.className = `main-modal ${theme}`;
    document.querySelector('#spinner').style.display = 'none';
    document.querySelector('#logged-view').style.display = 'block';
    document.querySelector('#status').style.display = 'block';
    document.querySelector('.connection-status').textContent = 'rc3 — bản xem trước offline';
    document.querySelector('.quick-connect-button').textContent = 'Connect';
    document.querySelector('.disconnection-button').style.display = 'none';
    document.querySelector('#menu').style.display = 'block';
    document.querySelector('#servers').innerHTML = '<p>Danh sách quốc gia (dữ liệu thử)</p>';
    const harness = createLoader({document, window: dom.window}, {
      'tools/getCurrentTab': {getCurrentTab: async () => ({url: 'https://' + 'long-domain-'.repeat(4) + 'example.com/thread'})},
    });
    harness.memory.set('site-router-favorites', {value: [
      {type: 'country', id: 'JP', label: 'Japan'},
      {type: 'server', id: 'retired', label: 'LongLabelWithoutAnySpaces'.repeat(7)},
    ]});
    const list = [{ID: 'jp1', Name: 'JP#FREE1', Tier: 0, ExitCountry: 'JP', EntryCountry: 'JP', Features: 0, Score: 1}];
    harness.load('components/configureLocalTools').configureLocalTools(document.body, {
      user: {tier: 0, country: 'VN'}, getLogicals: () => list, getServer: () => undefined,
      getRules: async () => ({enabled: true, mode: 'include', value: []}), isControllable: () => true,
      save: async () => {}, connect: async () => {},
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    document.querySelector('#site-router-tools details').open = true;
    const script = document.createElement('script');
    script.textContent = `window.addEventListener('load', () => setTimeout(() => {
      const root = document.querySelector('#site-router-tools');
      document.documentElement.dataset.qa = JSON.stringify({
        overflow: root.scrollWidth > root.clientWidth,
        clippedButtons: [...root.querySelectorAll('button')].filter(b => b.scrollHeight > b.clientHeight + 2).length,
        horizontalButtonOverflow: [...root.querySelectorAll('button')].some(b => b.getBoundingClientRect().right > root.getBoundingClientRect().right + 1),
        pageScrollable: document.querySelector('.page-view').scrollHeight > document.querySelector('.page-view').clientHeight
      });
    }, 100));`;
    document.body.append(script);
    fs.writeFileSync(path.join(out, `${name}.html`), dom.serialize());
    dom.window.close();
  }
  console.log(out);
})().catch(error => {console.error(error); process.exitCode = 1;});
