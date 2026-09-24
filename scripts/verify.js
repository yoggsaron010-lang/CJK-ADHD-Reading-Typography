/**
 * 部署后验证脚本：确认部署目录内容 + 注册表条目一致。
 * 用法: node scripts/verify.js [version]（缺省取 package.json 的 version）
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let pkg;
let extPkg;
try {
  pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
} catch (e) {
  console.error('ERROR: failed to read/parse package.json:', String(e.message || e));
  process.exit(1);
}
const version = process.argv[2] || pkg.version;
const extId = `${pkg.publisher}.${pkg.name}`.toLowerCase();
const extDir = path.join(
  process.env.USERPROFILE || process.env.HOME,
  '.vscode', 'extensions',
  `${extId}-${version}`
);
const regPath = path.join(
  process.env.USERPROFILE || process.env.HOME,
  '.vscode', 'extensions', 'extensions.json'
);

function walk(dir, prefix, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = prefix + e.name;
    if (e.isDirectory()) {
      out.push(`${p}/`);
      walk(path.join(dir, e.name), `${p}/`, out);
    } else {
      out.push(p);
    }
  }
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`ERROR: failed to read/parse ${p}:`, String(e.message || e));
    process.exit(1);
  }
}

console.log('=== 部署目录 ===');
console.log('path:', extDir);
const tree = [];
walk(extDir, '', tree);
console.log(tree.join('\n'));

console.log('\n=== package.json ===');
extPkg = readJson(path.join(extDir, 'package.json'));
console.log('version:', extPkg.version, '| main:', extPkg.main);
const cmds = (extPkg.contributes.commands || []).map((c) => c.command);
console.log('commands:', cmds.join(', '));
const cfgKeys = Object.keys(extPkg.contributes.configuration.properties || {});
console.log('config keys:', cfgKeys.join(', '));

console.log('\n=== extensions.json 注册表 ===');
const reg = readJson(regPath);
const cjk = reg.find((e) => e.identifier.id === extId);
console.log('version:', cjk.version);
console.log('relativeLocation:', cjk.relativeLocation);
console.log('location.path:', cjk.location.path);
const versions = reg.filter((e) => e.identifier.id.includes('cjk'));
console.log('cjk entries count:', versions.length, '(should be 1)');

console.log('\n=== 关键文件 ===');
for (const f of [
  'out/extension.js',
  'out/config.js',
  'out/panel.js',
  'out/core/segmenter.js',
  'out/features/wordBoundary.js',
  'out/features/lineFocus.js',
  'out/features/typography.js',
  'out/features/types.js',
]) {
  const p = path.join(extDir, f);
  console.log(fs.existsSync(p) ? '[OK]      ' : '[MISSING] ', f);
}

console.log('\n=== segmenter.js 分词核心 ===');
const seg = fs.readFileSync(path.join(extDir, 'out/core/segmenter.js'), 'utf8');
console.log(seg.includes('@node-rs/jieba') ? '[OK] require(@node-rs/jieba) present' : '[MISSING] jieba require');
console.log(seg.includes('Jieba.withDict') ? '[OK] Jieba.withDict present' : '[MISSING] Jieba.withDict');
console.log(seg.includes('mergeParticles') ? '[OK] mergeParticles present' : '[MISSING] mergeParticles');
console.log(seg.includes('mergeGroups') ? '[OK] mergeGroups present' : '[MISSING] mergeGroups');

console.log('\n=== wordBoundary.js 引用共享模块 ===');
const wb = fs.readFileSync(path.join(extDir, 'out/features/wordBoundary.js'), 'utf8');
console.log(wb.includes('core/segmenter') ? '[OK] require(../core/segmenter) present' : '[MISSING] segmenter require');
console.log(wb.includes('Segmenter') ? '[FAIL] Intl.Segmenter present' : '[OK] Intl.Segmenter absent');

console.log('\n=== jieba 运行时依赖打包 ===');
for (const f of [
  'node_modules/@node-rs/jieba/index.js',
  'node_modules/@node-rs/jieba/dict.js',
  'node_modules/@node-rs/jieba/dict.txt',
  'node_modules/@node-rs/jieba-win32-x64-msvc/jieba.win32-x64-msvc.node',
]) {
  console.log(fs.existsSync(path.join(extDir, f)) ? '[OK]      ' : '[MISSING] ', f);
}
