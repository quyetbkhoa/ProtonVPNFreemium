const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const {parse} = require('node-html-parser');
const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'source/js');
const cache = new Map();
const window = {};
const interpolate = (parts, ...values) => parts.reduce((s, p, i) => s + p + (values[i] ?? ''), '');
const translated = {
  c: () => ({t: interpolate, plural: (n, one, many) => n === 1 ? one : many}),
  msgid: interpolate,
  getCountryName: code => code,
  getCountryNameOrCode: code => code,
};
let inventory = [];
// Only external browser/server availability and translations are stubbed.
// Rendering, grouping, config, feature filtering and click target selection use
// the real production modules. This is offline DOM QA, not Chrome/VPN QA.
function load(name) {
  if (name === 'tools/translate') return translated;
  if (name === 'vpn/getLogicals') return {
    isLogicalUp: l => l._up !== false,
    getLogicalById: id => inventory.find(l => `${l.ID}` === id),
  };
  if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(sourceRoot, `${name}.ts`);
  assert(filename.startsWith(sourceRoot + path.sep));
  const module = {exports: {}};
  cache.set(name, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
  }).outputText;
  const localRequire = spec => {
    if (name === 'config' && spec === '../../config') return require('../config.js');
    assert(spec.startsWith('.'), `Unexpected external dependency: ${name}: ${spec}`);
    return load(path.posix.normalize(path.posix.join(path.posix.dirname(name), spec)));
  };
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {window, console, URL}, {filename})(localRequire, module, module.exports);
  return module.exports;
}
const {countryList} = load('components/countryList');
const {getLogicalFromButton} = load('components/getLogicalFromButton');
const {attachLogicalIntoCountryList} = load('vpn/attachLogicalIntoCountryList');
const {serverList} = load('components/serverList');
const {serverGroup} = load('components/serverGroup');
const freeUser = {tier: 0, country: 'VN', location: {Lat: 0, Long: 0}};
const features = {secureCore: {config: {value: false}}};
function server(code, tier = 0, extra = {}) {
  return {
    ID: `${code}-${tier}`, Name: `${code}#${tier ? '' : 'FREE'}1`,
    EntryCountry: code, ExitCountry: code, Tier: tier, Features: 0,
    Score: 10, Load: 20, AutoConnectable: true, _up: true, ...extra,
  };
}
function fixture(list, user = freeUser) {
  inventory = list;
  const countries = {};
  for (const logical of list) attachLogicalIntoCountryList(user.tier, logical, countries);
  return {countries, doc: parse(countryList(countries, user))};
}
function buttonFrom(node) {
  return {getAttribute: key => node.getAttribute(key), hasAttribute: key => node.hasAttribute(key)};
}
function selected(node, countries, user = freeUser) {
  return getLogicalFromButton(buttonFrom(node), countries, features, user, inventory, () => {}).getLogical();
}

test('Every country with an entitled Free server has a real connection action', () => {
  // Synthetic inventory tests behavior; it is not a claim of live availability.
  const codes = ['US', 'NL', 'JP', 'PL', 'RO', 'CA', 'NO', 'MX', 'SG', 'CH'];
  const {countries, doc} = fixture(codes.map(code => server(code)));
  const buttons = doc.querySelectorAll('button.connect-option');
  assert.equal(buttons.length, codes.length);
  for (const code of codes) {
    const button = buttons.find(b => b.getAttribute('data-exitCountry') === code);
    assert(button, `${code} must be selectable`);
    assert.equal(button.hasAttribute('data-upgrade'), false);
    assert.equal(selected(button, countries).ExitCountry, code);
  }
});
test('Mixed country selects an entitled server even if paid server has better score', () => {
  const {countries, doc} = fixture([server('JP', 1, {Score: 1}), server('JP', 0, {Score: 50})]);
  const button = doc.querySelector('button.connect-option');
  assert.equal(selected(button, countries).Tier, 0);
});
test('Paid-only country remains visible and requests upgrade for Free', () => {
  const {doc} = fixture([server('DE', 1)]);
  const button = doc.querySelector('button.connect-option');
  assert.equal(button.getAttribute('data-upgrade'), '1');
  assert.equal(button.hasAttribute('data-exitCountry'), false);
  assert.match(doc.text, /DE/);
});
test('Maintenance country has no connect action', () => {
  const {doc} = fixture([server('JP', 0, {_up: false})]);
  const button = doc.querySelector('button.connect-option');
  assert.equal(button.hasAttribute('data-exitCountry'), false);
  assert.equal(button.hasAttribute('data-upgrade'), false);
});
test('Paid account can select a paid-only country', () => {
  const user = {...freeUser, tier: 2};
  const {countries, doc} = fixture([server('DE', 1)], user);
  assert.equal(selected(doc.querySelector('button.connect-option'), countries, user).ExitCountry, 'DE');
});
test('Specific Free server row carries its real server ID', () => {
  const item = server('JP');
  const {countries} = fixture([item]);
  const doc = parse(serverList(freeUser, [item], 'Servers', false));
  assert.equal(selected(doc.querySelector('.server'), countries).ID, item.ID);
  assert.equal(doc.querySelector('.server').hasAttribute('data-upgrade'), false);
});
test('Paid server row stays locked for Free', () => {
  const doc = parse(serverList(freeUser, [server('DE', 1)], 'Servers', false));
  assert.equal(doc.querySelector('.server').getAttribute('data-upgrade'), '1');
  assert.equal(doc.querySelector('.server').hasAttribute('data-id'), false);
});
test('Expanding a country allows selecting its Free city', () => {
  const {countries} = fixture([server('JP', 0, {City: 'Tokyo'})]);
  const doc = parse(serverGroup(freeUser, 'JP', countries.JP, list => list, false));
  const button = doc.querySelector('button.connect-option');
  assert.equal(button.getAttribute('data-subGroup'), 'Tokyo');
  assert.equal(selected(button, countries).City, 'Tokyo');
});
test('Paid city remains locked when another city in the same country has Free servers', () => {
  const {countries} = fixture([
    server('JP', 0, {City: 'Tokyo'}),
    server('JP', 1, {City: 'Osaka'}),
  ]);
  const doc = parse(serverGroup(freeUser, 'JP', countries.JP, list => list, false));
  const button = doc.querySelectorAll('button.connect-option').find(b => b.text.includes('Osaka'));
  assert.equal(button.getAttribute('data-upgrade'), '1');
  assert.equal(button.hasAttribute('data-subGroup'), false);
});
test('Countries without any available entitled server fail selection instead of using a different country', () => {
  const {countries} = fixture([server('DE', 1), server('JP')]);
  const node = parse('<button data-exitCountry="DE"></button>').querySelector('button');
  assert.throws(() => selected(node, countries), /Cannot find the best one/);
});
