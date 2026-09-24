/**
 * 部署后验证脚本：确认部署目录内容 + 注册表条目一致。
 * 用法: node scripts/verify.js [version]
 */
const fs = require('fs');
const path = require('path');

const version = process.argv[2] || '0.13.0';
const extDir = path.join(
  process.env.USERPROFILE || process.env.HOME,
  '.vscode', 'extensions',
  `local.cjk-reading-typography-${version}`
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
const pkg = readJson(path.join(extDir, 'package.json'));
console.log('version:', pkg.version, '| main:', pkg.main);
const cmds = (pkg.contributes.commands || []).map((c) => c.command);
console.log('commands:', cmds.join(', '));
const cfgKeys = Object.keys(pkg.contributes.configuration.properties || {});
console.log('config keys:', cfgKeys.join(', '));

console.log('\n=== extensions.json 注册表 ===');
const reg = readJson(regPath);
const cjk = reg.find((e) => e.identifier.id === 'local.cjk-reading-typography');
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
  'out/features/wordBoundary.js',
  'out/features/lineFocus.js',
  'out/features/typography.js',
  'out/features/types.js',
]) {
  const p = path.join(extDir, f);
  console.log(fs.existsSync(p) ? '[OK]      ' : '[MISSING] ', f);
}

console.log('\n=== wordBoundary.js 含 jieba ===');
const wb = fs.readFileSync(path.join(extDir, 'out/features/wordBoundary.js'), 'utf8');
console.log(wb.includes('@node-rs/jieba') ? '[OK] require(@node-rs/jieba) present' : '[MISSING] jieba require');
console.log(wb.includes('Jieba.withDict') ? '[OK] Jieba.withDict present' : '[MISSING] Jieba.withDict');
console.log(!wb.includes('Segmenter') ? '[OK] Intl.Segmenter removed' : '[FAIL] Intl.Segmenter still present');
console.log(wb.includes('mergeParticles') ? '[OK] mergeParticles present' : '[MISSING] mergeParticles');
console.log(wb.includes('mergeGroups') ? '[OK] mergeGroups present' : '[MISSING] mergeGroups');

console.log('\n=== jieba 运行时依赖打包 ===');
for (const f of [
  'node_modules/@node-rs/jieba/index.js',
  'node_modules/@node-rs/jieba/dict.js',
  'node_modules/@node-rs/jieba/dict.txt',
  'node_modules/@node-rs/jieba-win32-x64-msvc/jieba.win32-x64-msvc.node',
]) {
  console.log(fs.existsSync(path.join(extDir, f)) ? '[OK]      ' : '[MISSING] ', f);
}
