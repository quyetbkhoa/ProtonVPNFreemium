const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const archiver = require('archiver');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'distribution');
const out = path.join(root, 'artifacts', 'rc3');
const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
const expected = JSON.parse(fs.readFileSync(path.join(root, 'source/manifest.json'), 'utf8'));
assert.equal(manifest.version_name, '1.3.6-site-router-rc3');
assert.equal(manifest.name, expected.name);
assert.equal(manifest.key, expected.key);
const id = crypto.createHash('sha256').update(Buffer.from(manifest.key, 'base64'))
  .digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
assert.equal(id, require('../config.js').appId, 'Manifest ID must match the account callback ID');
for (const file of [manifest.background.service_worker, manifest.action.default_popup, ...Object.values(manifest.icons)]) {
  assert(fs.existsSync(path.join(dist, file)), `Missing manifest resource: ${file}`);
}
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
for (const file of walk(path.join(dist, 'js')).filter(f => f.endsWith('.js'))) {
  new vm.Script(fs.readFileSync(file, 'utf8'), {filename: file});
}
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(dist, 'LICENSE'));
fs.copyFileSync(path.join(root, 'README-CUSTOM-VI.md'), path.join(dist, 'README-CUSTOM-VI.md'));
assert.equal(fs.readFileSync(path.join(dist, 'NOTICE-CUSTOM.txt'), 'utf8'),
  fs.readFileSync(path.join(root, 'source/NOTICE-CUSTOM.txt'), 'utf8'), 'Rebuild after changing notice');
fs.mkdirSync(out, {recursive: true});
function zip(destination, add) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destination);
    const archive = archiver('zip', {zlib: {level: 9}});
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', reject);
    archive.pipe(output);
    add(archive);
    archive.finalize().catch(reject);
  });
}
(async () => {
  const binary = path.join(out, 'VPN-Site-Router-rc3.zip');
  const source = path.join(out, 'VPN-Site-Router-rc3-source.zip');
  await zip(binary, a => a.directory(dist, false));
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {cwd: root, encoding: 'utf8'}).split('\0').filter(Boolean).sort();
  const sourceFiles = Object.fromEntries(files.map(file => [file,
    crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
  const sourceSnapshotSha256 = crypto.createHash('sha256').update(JSON.stringify(sourceFiles)).digest('hex');
  fs.writeFileSync(path.join(out, 'SOURCE-FILES-SHA256.json'), JSON.stringify(sourceFiles, null, 2) + '\n');
  await zip(source, a => files.forEach(file => a.file(path.join(root, file), {name: file})));
  const checksums = Object.fromEntries([binary, source].map(file => [path.basename(file), {
    bytes: fs.statSync(file).size,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  }]));
  const report = {
    candidate: manifest.version_name, extensionId: id,
    baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
    sourceSnapshotSha256,
    workingTreeStatus: execFileSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8'}).trim(),
    checks: 'manifest resources, callback ID, bundled JS syntax, license and notice',
    liveBrowserValidation: 'NOT RUN', artifacts: checksums,
  };
  fs.writeFileSync(path.join(out, 'CHECKSUMS.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
})().catch(error => {console.error(error); process.exitCode = 1;});
