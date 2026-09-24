/**
 * 词界显化分词自检：用真实 jieba 对样例文本分词，打印语义块合并结果。
 *
 * 与生产代码共用同一份实现（out/core/segmenter.js，编译自 src/core/segmenter.ts），
 * 不再复制 mergeParticles/mergeGroups/segmentLine——改了生产逻辑这里立即生效。
 *
 * 用法: npm run selfcheck（内部先执行 npm run compile）
 */
const { segmentLine } = require('../out/core/segmenter.js');

const SAMPLE = '我爹走到了城里，城里人见了都叫他先生。我爹是很有身份的人，可他拉屎时就像个穷人了。他不爱在屋里床边的马桶上拉屎，跟牲畜似的喜欢到野地里去拉屎。每天到了傍晚的时候，我爹打着饱嗝，那声响和青蛙叫唤差不多，走出屋去，慢吞吞地朝村口的粪缸走去。';

function renderWithMarks(text, marks) {
  const chars = [...text];
  const markSet = new Set(marks.map((m) => m.offset));
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    out += chars[i];
    if (markSet.has(i)) {
      out += ' ';
    }
  }
  return out;
}

console.log('=== 原文 ===');
console.log(SAMPLE);
console.log();

const marks = segmentLine(SAMPLE);
console.log(`=== 词界显化后（jieba 分词 + 2~5 字语义块，${marks.length} 个词块边界）===`);
console.log(renderWithMarks(SAMPLE, marks));
console.log();

const offsets = marks.map((m) => m.offset);
let minGap = Infinity;
for (let i = 1; i < offsets.length; i++) {
  minGap = Math.min(minGap, offsets[i] - offsets[i - 1]);
}
console.log('=== 自检 ===');
console.log(`词块数: ${marks.length}`);
console.log(`最小词块间隔: ${minGap} 字符`);
const checks = [
  [minGap >= 1, '无重叠/异常边界'],
  [marks.length > 0 && marks.length < [...SAMPLE].length / 2, '词块数合理（非单字碎片）'],
];
let failed = 0;
for (const [ok, label] of checks) {
  console.log(ok ? `[OK]   ${label}` : `[FAIL] ${label}`);
  if (!ok) failed++;
}
process.exit(failed === 0 ? 0 : 1);
