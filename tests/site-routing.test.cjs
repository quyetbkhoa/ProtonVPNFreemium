const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
const config = require('../config.js');
const allowed = new Set([
  'vpn/getSplitTunnelingConfig', 'vpn/getDomainFilterList',
  'vpn/SplitTunnelingDomainManager', 'vpn/WebsiteFilter',
  'vpn/getIncludeOnlyList', 'vpn/getBypassList', 'vpn/needUpgrade', 'tools/proxy',
]);

// Execute the real production routing functions. Browser lifecycle imports are
// deliberately stubbed: this suite does not claim Chrome/network integration.
function load(name) {
  if (cache.has(name)) return cache.get(name);
  assert(allowed.has(name), `Unexpected module: ${name}`);
  const file = path.join(root, 'source/js', `${name}.ts`);
  const module = {exports: {}};
  cache.set(name, module.exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
  }).outputText;
  const localRequire = (spec) => {
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(name), spec));
    if (resolved === 'config') return {
      ...config, excludeApiFromProxy: true,
      apiDomainsExclusion: [new URL(config.baseDomainURL).hostname],
    };
    if (allowed.has(resolved)) return load(resolved);
    assert.equal(name, 'tools/proxy', `Unexpected dependency: ${resolved}`);
    return {};
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, {filename: file})(localRequire, module, module.exports);
  cache.set(name, module.exports);
  return module.exports;
}

const {getSplitTunnelingConfig} = load('vpn/getSplitTunnelingConfig');
const {SplitTunnelingDomainManager} = load('vpn/SplitTunnelingDomainManager');
const {getFixedServerConfig, getPacScript} = load('tools/proxy');
const {needUpgrade} = load('vpn/needUpgrade');
const website = (domain, withSubDomains = true, mode = 'include') => ({domain, withSubDomains, mode});
const selection = (value = [website('xda-developers.com')]) => ({enabled: true, mode: 'include', value});
function route(list, tier = 0) {
  const split = getSplitTunnelingConfig(tier, list);
  const proxy = getFixedServerConfig('test.protonvpn.net', 4443, split);
  const pac = getPacScript(proxy);
  const context = {
    isPlainHostName: host => !host.includes('.'),
    isInNet: () => false,
  };
  vm.createContext(context);
  vm.runInContext(pac.pacScript.data, context);
  return host => context.FindProxyForURL(`https://${host}/file.zip`, host);
}

test('Free: selected XDA and subdomains use Proton; unrelated downloads are direct', () => {
  const lookup = route(selection());
  assert.equal(lookup('xda-developers.com'), 'HTTPS test.protonvpn.net:4443');
  assert.equal(lookup('forum.xda-developers.com'), 'HTTPS test.protonvpn.net:4443');
  assert.equal(lookup('downloads.example.org'), 'DIRECT');
});
test('Domain boundary cannot match lookalikes', () => {
  const lookup = route(selection());
  for (const host of ['evilxda-developers.com', 'xda-developers.com.evil.org']) {
    assert.equal(lookup(host), 'DIRECT');
  }
});
test('Exact host can exclude its subdomains', () => {
  const lookup = route(selection([website('forum.xda-developers.com', false)]));
  assert.match(lookup('forum.xda-developers.com'), /^HTTPS /);
  assert.equal(lookup('cdn.forum.xda-developers.com'), 'DIRECT');
});
test('Selected-host downloads also use VPN (domain routing, not tab routing)', () => {
  assert.match(route(selection())('xda-developers.com'), /^HTTPS /);
});
test('Empty include list leaves unrelated browsing direct', () => {
  assert.equal(route(selection([]))('example.com'), 'DIRECT');
});
test('Proton service domains retain upstream include-mode exceptions', () => {
  assert.match(route(selection([]))('node.protonvpn.net'), /^HTTPS /);
});
test('Account API and local network stay direct', () => {
  const lookup = route(selection([website('account.proton.me'), website('localhost'), website('192.168.1.2')]));
  for (const host of ['account.proton.me', 'localhost', '192.168.1.2']) {
    assert.equal(lookup(host), 'DIRECT');
  }
});
test('Disabling split tunneling restores whole-browser VPN routing', () => {
  assert.match(route({...selection(), enabled: false})('example.com'), /^HTTPS /);
});
test('Exclude mode bypasses selected domains for Free', () => {
  const lookup = route({enabled: true, mode: 'exclude', value: [website('example.org', true, 'exclude')]});
  assert.equal(lookup('example.org'), 'DIRECT');
  assert.match(lookup('xda-developers.com'), /^HTTPS /);
});
test('Changing mode preserves separate domain lists', () => {
  const manager = new SplitTunnelingDomainManager(selection());
  manager.switchMode('exclude');
  manager.addDomain('example.org', true);
  manager.switchMode('include');
  assert.equal(manager.getDomainsForCurrentMode().length, 1);
  assert.equal(manager.getDomainsForCurrentMode()[0].domain, 'xda-developers.com');
  assert.equal(route(manager.getRawList())('example.org'), 'DIRECT');
});
test('Paid account keeps the same routing behavior', () => {
  assert.match(route(selection(), 2)('xda-developers.com'), /^HTTPS /);
  assert.equal(route(selection(), 2)('example.org'), 'DIRECT');
});
test('Free account still needs upgrade for paid servers', () => {
  assert.equal(needUpgrade(0, [{Tier: 1}]), true);
  assert.equal(needUpgrade(0, [{Tier: 0}]), false);
});
