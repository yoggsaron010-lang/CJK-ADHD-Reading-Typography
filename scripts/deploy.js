/**
 * 手动部署脚本：解压 vsix → 部署目录 + 更新 extensions.json 注册表。
 * 用法: node scripts/deploy.js [version]
 * 注意: 本机 code --install-extension 会挂起，故用手动部署。
 * Windows bash 的 /tmp 与 node 解析的 /tmp 不是同一目录，统一用项目内相对路径。
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const version = process.argv[2] || '0.13.0';
const root = path.resolve(__dirname, '..');
const vsix = path.join(root, `cjk-reading-typography-${version}.vsix`);
const extDir = path.join(
  process.env.USERPROFILE || process.env.HOME,
  '.vscode', 'extensions',
  `local.cjk-reading-typography-${version}`
);
const regPath = path.join(
  process.env.USERPROFILE || process.env.HOME,
  '.vscode', 'extensions', 'extensions.json'
);

console.log('version:', version);
console.log('vsix    :', vsix);
console.log('deploy  :', extDir);

if (!fs.existsSync(vsix)) {
  console.error('ERROR: vsix not found:', vsix);
  process.exit(1);
}

// 1. 解压 vsix（zip）到临时目录（项目内路径，避免 MSYS /tmp 问题）
// Expand-Archive 只认 .zip 扩展名，.vsix 会被拒绝——先把文件复制成 .zip 再解压
const tmp = path.join(root, '.vsix-tmp');
if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

const zipTmp = path.join(root, '.vsix-tmp.zip');
fs.copyFileSync(vsix, zipTmp);
const destWin = tmp.replace(/\//g, '\\');
const zipWin = zipTmp.replace(/\//g, '\\');
const psScript =
  `Expand-Archive -LiteralPath '${zipWin}' -DestinationPath '${destWin}' -Force`;
try {
  execSync(`powershell -NoProfile -Command "${psScript}"`, { stdio: 'pipe' });
  console.log('extracted to:', tmp);
} catch (e) {
  console.error('ERROR: Expand-Archive failed:', String(e.message || e));
  process.exit(1);
}
// 注意：不要在 finally 里删 zip——PowerShell 可能仍持有句柄（EPERM）。
// 统一在脚本末尾 best-effort 清理。

// 2. 把 extension/* 复制到部署目录（去掉 extension/ 前缀）
const extSrc = path.join(tmp, 'extension');
if (!fs.existsSync(extSrc)) {
  console.error('ERROR: extension/ not found inside vsix');
  process.exit(1);
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (fs.existsSync(extDir)) fs.rmSync(extDir, { recursive: true });
copyDir(extSrc, extDir);
console.log('deployed to:', extDir);

// 3. 更新 extensions.json 注册表
let reg;
try {
  reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
} catch (e) {
  console.error('ERROR: failed to read/parse extensions.json:', String(e.message || e));
  process.exit(1);
}
const filtered = reg.filter((e) => e.identifier.id !== 'local.cjk-reading-typography');
filtered.push({
  identifier: { id: 'local.cjk-reading-typography' },
  version,
  location: { scheme: 'file', path: extDir },
  relativeLocation: `local.cjk-reading-typography-${version}`,
  metadata: { source: 'vsix' },
});
fs.writeFileSync(regPath, JSON.stringify(filtered));
console.log('registry updated, entries:', filtered.length);

// 4. 清理旧版本目录
const extRoot = path.dirname(extDir);
for (const d of fs.readdirSync(extRoot)) {
  if (d.startsWith('local.cjk-reading-typography-') && d !== `local.cjk-reading-typography-${version}`) {
    fs.rmSync(path.join(extRoot, d), { recursive: true });
    console.log('removed old:', d);
  }
}

// 5. 清理临时文件（best-effort：句柄未释放时忽略 EPERM）
try {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(zipTmp, { force: true });
  console.log('cleaned up temp files');
} catch {
  console.log('warn: temp cleanup skipped (file in use)');
}

console.log('\nDONE. Reload VSCode Window to apply.');
