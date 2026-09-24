/**
 * 重命名项目：CJK Reading Typography → CJK-ADHD-Reading-Typography
 * 用法: node scripts/rename.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const NEW_REPO = 'CJK-ADHD-Reading-Typography';
const OLD_DISPLAY = 'CJK Reading Typography';
const NEW_DISPLAY = 'CJK-ADHD-Reading-Typography';
// 版本号单一来源：package.json（不再硬编码）
const NEW_VERSION = readJson('package.json').version;

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  } catch (e) {
    console.error(`  [FAIL] read/parse ${rel}:`, String(e.message || e));
    process.exit(1);
  }
}

function writeJson(rel, obj) {
  fs.writeFileSync(path.join(root, rel), JSON.stringify(obj, null, 2) + '\n');
}

function replaceInFile(rel, replacements) {
  const p = path.join(root, rel);
  let s = fs.readFileSync(p, 'utf8');
  for (const [from, to] of replacements) {
    if (!s.includes(from)) {
      console.error(`  [MISS] ${rel}: "${from}" not found`);
      process.exit(1);
    }
    s = s.split(from).join(to);
  }
  fs.writeFileSync(p, s);
  console.log(`  [OK] ${rel}`);
}

console.log('[1/3] package.json');
const pkg = readJson('package.json');
pkg.name = NEW_REPO;
pkg.displayName = `${NEW_DISPLAY} · 中文 ADHD 阅读辅助`;
pkg.version = NEW_VERSION;
pkg.repository.url = `https://github.com/yoggsaron010-lang/${NEW_REPO}.git`;
pkg.homepage = `https://github.com/yoggsaron010-lang/${NEW_REPO}`;
pkg.bugs.url = `https://github.com/yoggsaron010-lang/${NEW_REPO}/issues`;
pkg.contributes.commands.forEach((c) => {
  c.title = c.title.replace(/CJK Reading:/g, `${NEW_DISPLAY}:`);
});
pkg.contributes.configuration.title = `${NEW_DISPLAY} · 中文 ADHD 阅读辅助`;
writeJson('package.json', pkg);
console.log('  [OK] package.json (name/displayName/version/repository/homepage/bugs/commands/config title)');

console.log('[2/3] README.md');
replaceInFile('README.md', [
  [`# ${OLD_DISPLAY} · 中文友好排版`, `# ${NEW_DISPLAY} · 中文 ADHD 阅读辅助`],
  [`| 命令面板 | \`${OLD_DISPLAY}: 切换「词界显化」/「行焦点阅读尺」/「阅读排版」\` |`,
   `| 命令面板 | \`${NEW_DISPLAY}: 切换「词界显化」/「行焦点阅读尺」/「阅读排版」\` |`],
]);

console.log('[3/3] 验证');
const check = readJson('package.json');
console.log('  name        :', check.name);
console.log('  displayName :', check.displayName);
console.log('  version     :', check.version);
console.log('  repository  :', check.repository.url);
console.log('  homepage    :', check.homepage);
console.log('  bugs        :', check.bugs.url);
console.log('\nDONE.');
