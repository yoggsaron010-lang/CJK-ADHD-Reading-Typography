/**
 * 通过 GitHub Git Data API 上传文件（git push 走不通时的备选方案）。
 * 用法: node scripts/push-via-api.js <owner/repo> <branch>
 * 示例: node scripts/push-via-api.js yoggsaron010-lang/CJK-ADHD-Reading-Typography main
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [owner, name] = (process.argv[2] || 'yoggsaron010-lang/CJK-ADHD-Reading-Typography').split('/');
const branch = process.argv[3] || 'main';
const root = path.resolve(__dirname, '..');

function ghApi(endpoint, method = 'GET', body) {
  const args = ['api', endpoint, '--method', method];
  if (body !== undefined) {
    args.push('--input', '-');
    args.push('--jq', '.');
  }
  const opts = { input: body !== undefined ? JSON.stringify(body) : undefined, encoding: 'utf8' };
  try {
    return JSON.parse(execSync(`gh ${args.join(' ')}`, opts));
  } catch (e) {
    // 不要 process.exit：让调用方决定（409 = empty repo 是预期情况）
    throw new Error(`gh api ${endpoint} ${method} failed: ${e.message}`);
  }
}

function gitLsFiles() {
  try {
    return execSync('git ls-files', { cwd: root, encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (e) {
    console.error('git ls-files failed:', e.message);
    process.exit(1);
  }
}

// 1. 获取当前 ref（如果有）
console.log(`[1/5] 读取 ${owner}/${name}@${branch} ...`);
let refSha = null;
try {
  const ref = ghApi(`repos/${owner}/${name}/git/ref/heads/${branch}`);
  refSha = ref.object.sha;
  console.log(`  当前 HEAD: ${refSha}`);
} catch {
  console.log('  仓库为空，将创建首个 commit');
}

// 2. 用 Contents API 上传每个文件（Git Data API 在空仓库上 tree POST 会 409）
const files = gitLsFiles();
console.log(`[2/5] 上传 ${files.length} 个文件（Contents API）...`);
let lastCommitSha = null;
for (let i = 0; i < files.length; i++) {
  const p = files[i];
  const content = fs.readFileSync(path.join(root, p));
  const isBinary = content.includes(0);
  const body = {
    message: `feat: add ${p}`,
    content: content.toString('base64'),
    ...(isBinary ? { encoding: 'base64' } : {}),
  };
  const resp = ghApi(`repos/${owner}/${name}/contents/${p}`, 'PUT', body);
  lastCommitSha = resp.commit?.sha || lastCommitSha;
  process.stdout.write(`  [${i + 1}/${files.length}] ${p}\n`);
}
console.log(`  最后 commit: ${lastCommitSha}`);

// 3. 验证
console.log('[3/5] 验证...');
const verify = ghApi(`repos/${owner}/${name}/commits/${branch}`);
console.log(`  最新 commit: ${verify.sha.slice(0, 7)} ${verify.commit.message.split('\n')[0]}`);
console.log(`  文件数: ${verify.files?.length ?? '(n/a)'}`);

console.log('\nDONE. https://github.com/' + owner + '/' + name);
