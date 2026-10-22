const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
exports.createLoader = function (globals = {}, overrides = {}) {
  const cache = new Map();
  const memory = new Map();
  const pending = [];
  const clone = value => value === undefined ? value : structuredClone(value);
  const storage = {item: key => ({
    key,
    async get(fallback) { return clone(memory.get(key) ?? fallback); },
    async set(value) { memory.set(key, clone(value)); },
    async setValue(value, extra = {}) { memory.set(key, clone({value, ...extra, time: Date.now()})); },
    async remove() { memory.delete(key); },
    async transactionValue(fn, fallback) {
      const next = fn(clone(memory.get(key)?.value ?? fallback));
      memory.set(key, clone({value: next, time: Date.now()}));
    },
  })};
  const interpolate = (parts, ...values) => parts.reduce((s, p, i) => s + p + (values[i] ?? ''), '');
  const mocks = {
    'tools/translate': {c: () => ({t: interpolate, plural: (n, a, b) => n === 1 ? a : b}),
      msgid: interpolate, getCountryNameOrCode: x => x, getCountryName: x => x,
      translateToggleButtonTitle: () => {}},
    'tools/storage': {storage, Storage: {LOCAL: 'local'}, storagePrefix: 'bex-'},
    'tools/triggerPromise': {triggerPromise: p => {pending.push(Promise.resolve(p));}},
    'vpn/features/getFeatureConfig': {getFeatureConfig: async () => ({controllable: true})},
    'vpn/getLogicals': {isLogicalUp: l => l._up !== false},
    ...overrides,
  };
  function load(name) {
    if (mocks[name]) return mocks[name];
    if (cache.has(name)) return cache.get(name).exports;
    const file = path.join(root, 'source/js', `${name}.ts`);
    if (!file.startsWith(path.join(root, 'source/js') + path.sep)) throw new Error('Out of source: ' + name);
    const module = {exports: {}};
    cache.set(name, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020},
    }).outputText;
    const requireLocal = spec => {
      if (name === 'config' && spec === '../../config') return require('../../config.js');
      if (!spec.startsWith('.')) throw new Error('Unexpected external import ' + spec);
      return load(path.posix.normalize(path.posix.join(path.posix.dirname(name), spec)));
    };
    vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
      console, URL, TextEncoder, setTimeout, clearTimeout, ...globals,
    }, {filename: file})(requireLocal, module, module.exports);
    return module.exports;
  }
  return {load, memory, async flush() {
    for (let i = 0; i < 8; i++) {await Promise.resolve(); await Promise.all(pending.splice(0));}
  }};
};
