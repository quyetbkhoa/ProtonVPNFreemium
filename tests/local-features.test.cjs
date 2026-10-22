const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createLoader} = require('./helpers/local-loader.cjs');
const {JSDOM} = require('jsdom');
const loader = createLoader();
const settings = loader.load('local/localSettings');
const rule = (domain, mode = 'include', withSubDomains = false) => ({domain, mode, withSubDomains});
const rules = (value = []) => ({enabled: true, mode: 'include', value});
const normal = value => JSON.parse(JSON.stringify(value));
const user = {tier: 0, country: 'VN', location: {Lat: 0, Long: 0}};
const server = (code, tier = 0, extra = {}) => ({ID: `${code}-${tier}`, Name: code + '#1', Tier: tier, ExitCountry: code, EntryCountry: code, Features: 0, Score: 10, _up: true, ...extra});

test('Normalize domains, URL and IDN; do not guess registrable parent domains', () => {
  assert.equal(settings.normalizeDomain('https://Forum.Example.CO.UK/thread?id=1'), 'forum.example.co.uk');
  assert.match(settings.normalizeDomain('https://tênmiền.vn'), /^xn--/);
  for (const value of ['chrome://extensions', '*.example.com', 'https://user:pass@example.com', 'https://example.com:444', '<script>', 'localhost']) {
    assert.throws(() => settings.normalizeDomain(value));
  }
});
test('One-click rule enables Include and preserves both old mode lists', () => {
  const previous = {enabled: false, mode: 'exclude', value: [rule('old.example.com', 'exclude'), rule('other.example.com')]};
  const next = settings.addCurrentSite(previous, 'https://forum.xda-developers.com/thread');
  assert.equal(next.mode, 'include'); assert.equal(next.enabled, true);
  assert.equal(next.value.length, 3); assert.equal(previous.value.length, 2);
  assert.equal(next.value[2].domain, 'forum.xda-developers.com');
  assert.equal(next.value[2].withSubDomains, false);
});
test('Repeated quick-add is idempotent and preserves existing subdomain choice', () => {
  const next = settings.addCurrentSite(rules([rule('example.com', 'include', true)]), 'https://example.com');
  assert.equal(next.value.length, 1); assert.equal(next.value[0].withSubDomains, true);
});
test('Backup round trip only exports allowlisted routing and favorite fields', () => {
  const text = settings.exportSettings({...rules([rule('example.com')]), accessToken: 'SECRET'}, [
    {type: 'country', id: 'JP', label: 'Japan', password: 'SECRET'},
  ]);
  assert.equal(text.includes('SECRET'), false);
  assert.equal(settings.importSettings(text).favorites[0].id, 'JP');
});
test('Malformed backup, schema, invalid domain and oversized input are rejected', () => {
  const good = JSON.parse(settings.exportSettings(rules(), []));
  for (const value of ['{broken', JSON.stringify({...good, version: 99}),
    JSON.stringify({...good, splitTunneling: rules([rule('example.com/path')])}),
    JSON.stringify({...good, favorites: [{type: 'country', id: 'INVALID', label: 'x'}]}),
    ' '.repeat(1024 * 1024 + 1)]) assert.throws(() => settings.importSettings(value));
});
test('Import merges without changing mode, enabled state or existing rule geometry', () => {
  const previous = {enabled: false, mode: 'exclude', value: [rule('example.com', 'include', false)]};
  const next = settings.mergeRules(previous, rules([rule('example.com', 'include', true), rule('new.example.com')]));
  assert.equal(next.enabled, false); assert.equal(next.mode, 'exclude');
  assert.equal(next.value.length, 2); assert.equal(next.value[0].withSubDomains, false);
});
test('Limits apply after merge, and favorites deduplicate by type and ID', () => {
  const favorite = {type: 'country', id: 'JP', label: 'Japan'};
  assert.equal(settings.mergeFavorites([favorite], [favorite]).length, 1);
  assert.throws(() => settings.mergeFavorites(Array.from({length: 100}, (_, i) => ({type: 'server', id: `${i}`, label: 'S'})), [{type: 'server', id: 'new', label: 'S'}]));
  assert.throws(() => settings.mergeRules(rules(Array.from({length: 1000}, (_, i) => rule(`${i}.example.com`))), rules([rule('new.example.com')])));
});
test('Favorites resolve entitled/online targets and cannot connect paid/retired servers', () => {
  const list = [server('JP'), server('JP', 1, {Score: 1}), server('DE', 1)];
  assert.equal(settings.resolveFavorite({type: 'country', id: 'JP'}, list, user).Tier, 0);
  assert.equal(settings.resolveFavorite({type: 'country', id: 'DE'}, list, user), undefined);
  assert.equal(settings.resolveFavorite({type: 'server', id: 'DE-1'}, list, user), undefined);
  assert.equal(settings.resolveFavorite({type: 'server', id: 'gone'}, list, user), undefined);
  assert.equal(settings.resolveFavorite({type: 'server', id: 'JP-0'}, [server('JP', 0, {_up: false})], user), undefined);
});
test('Recents keeps 30 newest choices and deduplicates while honoring opt-out', async () => {
  const harness = createLoader();
  const history = harness.load('vpn/lastChoice');
  for (let i = 0; i < 35; i++) {history.setLastChoice({connected: true, logicalId: `${i}`}); await harness.flush();}
  const recent = await history.getLastChoices();
  assert.equal(recent.length, 30); assert.equal(recent[0].logicalId, '34'); assert.equal(recent[29].logicalId, '5');
  history.setLastChoice({connected: true, logicalId: '10'}); await harness.flush();
  assert.equal((await history.getLastChoices())[0].logicalId, '10');
  assert.equal((await history.getLastChoices()).length, 30);
  harness.memory.set('recents', {value: false});
  history.setLastChoice({connected: true, logicalId: 'disabled'}); await harness.flush();
  assert.equal((await history.getLastChoices())[0].logicalId, '10');
});
test('Auto-connect and WebRTC protection retain enabled defaults on Free', async () => {
  const auto = await loader.load('vpn/features/AutoConnect').AutoConnect.create();
  const rtc = await loader.load('vpn/features/PreventWebrtcLeak').PreventWebrtcLeak.create();
  assert.equal((await auto.getConfig()).value, true);
  assert.equal((await rtc.getConfig()).value, true);
});
test('Free location list renders enabled Recents and hides them when opted out', async () => {
  const harness = createLoader({window: {}});
  const history = harness.load('vpn/lastChoice');
  history.setLastChoice({connected: true, logicalId: 'JP-0'}); await harness.flush();
  const countryData = {JP: {name: 'Japan', englishName: 'Japan', logicals: [server('JP')], needUpgrade: false}};
  const {locationList} = harness.load('components/locationList');
  assert.match(await locationList(countryData, user, {value: false}, {config: {value: true}}), /Recents/);
  assert.doesNotMatch(await locationList(countryData, user, {value: false}, {config: {value: false}}), /recents-block/);
});

function ui({initial = rules(), tab = 'https://forum.xda-developers.com/thread', controlled = true, savedFavorites = [], saveFailure = false} = {}) {
  const dom = new JSDOM('<body><section id="site-router-tools"></section></body>', {url: 'https://extension.test'});
  const {window} = dom;
  let current = normal(initial);
  let currentTab = tab;
  const calls = [];
  const downloads = [];
  const browserUrl = class extends URL {};
  browserUrl.createObjectURL = blob => {downloads.push(blob); return 'blob:local-test';};
  browserUrl.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {calls.push({download: this.download});};
  const harness = createLoader({document: window.document, window, Blob, URL: browserUrl}, {
    'tools/getCurrentTab': {getCurrentTab: async () => ({url: currentTab})},
  });
  harness.memory.set('site-router-favorites', {value: savedFavorites});
  const tools = harness.load('components/configureLocalTools').configureLocalTools(window.document.body, {
    user, getLogicals: () => [server('JP'), server('DE', 1)],
    getServer: () => ({id: 'JP-0', name: 'JP#1'}),
    getRules: async () => current, isControllable: () => controlled,
    async save(nextRules, favorites) {
      if (saveFailure) throw new Error('Storage failed');
      calls.push({rules: nextRules, favorites});
      if (nextRules) current = normal(nextRules);
      if (favorites) harness.memory.set('site-router-favorites', {value: normal(favorites)});
    },
    async connect(logical) {calls.push({connect: logical.ID});},
  });
  const button = action => window.document.querySelector(`[data-local-action="${action}"]`);
  const settle = () => new Promise(resolve => setTimeout(resolve, 5));
  return {dom, harness, tools, calls, downloads, button, settle, getRules: () => current,
    setTab: value => {currentTab = value;}, status: () => window.document.querySelector('.local-status').textContent};
}
test('Popup quick-add applies latest config once despite duplicate click', async () => {
  const h = ui(); await h.settle();
  h.button('add-site').click(); h.button('add-site').click(); await h.settle();
  assert.equal(h.calls.length, 1); assert.equal(h.getRules().value[0].domain, 'forum.xda-developers.com');
  assert.match(h.status(), /Đã bật Include/); h.dom.window.close();
});
test('Popup explains Include switch and blocks unsupported pages and managed rules', async () => {
  const h = ui({initial: {...rules(), mode: 'exclude'}}); await h.settle();
  assert.match(h.button('add-site').textContent, /Bật Include/); h.dom.window.close();
  for (const config of [{tab: 'chrome://extensions'}, {controlled: false}]) {
    const h = ui(config); await h.settle(); assert.equal(h.button('add-site').disabled, true);
    h.button('add-site').click(); assert.equal(h.calls.length, 0); h.dom.window.close();
  }
});
test('Popup refuses a tab switch and reports save failure without claiming success', async () => {
  const h = ui(); await h.settle(); h.setTab('https://example.com');
  h.button('add-site').click(); await h.settle(); assert.equal(h.calls.length, 0); assert.match(h.status(), /Tab đã thay đổi/); h.dom.window.close();
  const failed = ui({saveFailure: true}); await failed.settle(); failed.button('add-site').click(); await failed.settle();
  assert.match(failed.status(), /Storage failed/); assert.equal(failed.button('add-site').disabled, false); failed.dom.window.close();
});
test('Popup favorites persist across reload and escape imported labels', async () => {
  const h = ui(); await h.settle(); h.button('add-country').click(); await h.settle();
  h.button('add-country').click(); await h.settle();
  assert.equal(h.harness.memory.get('site-router-favorites').value.length, 1);
  h.button('connect-favorite').click(); await h.settle(); assert.equal(h.calls.at(-1).connect, 'JP-0');
  h.button('remove-favorite').click(); await h.settle(); assert.equal(h.harness.memory.get('site-router-favorites').value.length, 0); h.dom.window.close();
  const reload = ui({savedFavorites: [{type: 'server', id: 'gone', label: '<img src=x onerror=alert(1)>'}]}); await reload.settle();
  assert.equal(reload.button('connect-favorite').disabled, true);
  assert.equal(reload.dom.window.document.querySelector('.local-favorites img'), null); reload.dom.window.close();
});
test('Popup import previews before applying and merges routing/favorites in one save', async () => {
  const h = ui({initial: {enabled: false, mode: 'exclude', value: [rule('old.example.com', 'exclude')]}}); await h.settle();
  const input = h.dom.window.document.querySelector('input[type=file]');
  const content = settings.exportSettings(rules([rule('new.example.com')]), [{type: 'country', id: 'JP', label: 'Japan'}]);
  Object.defineProperty(input, 'files', {value: [{size: content.length, text: async () => content}]});
  input.dispatchEvent(new h.dom.window.Event('change')); await h.settle();
  assert.equal(h.calls.length, 0); assert.equal(h.button('import').disabled, false);
  h.button('import').click(); await h.settle();
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].rules.mode, 'exclude'); assert.equal(h.calls[0].rules.enabled, false);
  assert.equal(h.calls[0].rules.value.length, 2); assert.equal(h.calls[0].favorites.length, 1); h.dom.window.close();
});
test('Popup invalid import cannot write settings; export contains no account fields', async () => {
  const h = ui(); await h.settle();
  const input = h.dom.window.document.querySelector('input[type=file]');
  Object.defineProperty(input, 'files', {value: [{size: 1, text: async () => '{broken'}]});
  input.dispatchEvent(new h.dom.window.Event('change')); await h.settle();
  assert.equal(h.calls.length, 0); assert.equal(h.button('import').disabled, true);
  h.button('export').click(); await h.settle();
  const exported = JSON.parse(await h.downloads[0].text());
  assert.equal(exported.app, 'VPN-Site-Router'); assert.equal(Object.hasOwn(exported, 'account'), false); h.dom.window.close();
});
test('Imported/current-site rules synchronize the existing Split tunneling editor', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dom = new JSDOM(fs.readFileSync(path.resolve(__dirname, '../source/popup.html'), 'utf8'));
  const harness = createLoader({document: dom.window.document, window: dom.window, navigator: dom.window.navigator}, {
    'tools/getCurrentTab': {getCurrentTab: async () => ({url: 'https://example.com'})},
    'tools/getBrowserSubType': {isBrave: () => false},
    'log/log': {warn: () => {}},
  });
  const cache = harness.load('tools/storage').storage.item('split-tunneling');
  harness.load('components/configureSplitTunneling').configureSplitTunneling({
    config: rules([rule('old.example.com')]),
    feature: {isControllable: () => true, getCacheItem: () => cache, getControlMessage: () => ''},
  }, undefined, dom.window.document);
  dom.window.document.dispatchEvent(new dom.window.CustomEvent('site-router-rules-updated', {
    detail: rules([rule('new.example.com')]),
  }));
  assert.match(dom.window.document.querySelector('.domains-list').textContent, /new.example.com/);
  assert.doesNotMatch(dom.window.document.querySelector('.domains-list').textContent, /old.example.com/);
  dom.window.document.querySelector('[data-st-action="toggle"]').click();
  await harness.flush();
  assert.equal(harness.memory.get('split-tunneling').value[0].domain, 'new.example.com');
  dom.window.close();
});
