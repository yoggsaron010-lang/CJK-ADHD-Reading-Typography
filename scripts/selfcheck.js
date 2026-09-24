/**
 * 词界显化分词自检：用真实 jieba 对样例文本分词，打印语义块合并结果。
 * 自包含实现（不 require vscode），与 src/features/wordBoundary.ts 的纯函数保持一致。
 * 用法: node scripts/selfcheck.js
 */
const { Jieba } = require('@node-rs/jieba');
const { dict } = require('@node-rs/jieba/dict');

const jieba = Jieba.withDict(dict);
const CJK_RUN = /[\u4e00-\u9fa5]+/g;
const PARTICLES = new Set(['的', '地', '得', '了', '着', '过', '在', '与', '对', '和', '于', '或', '等']);

function mergeParticles(words) {
  const result = [];
  for (const w of words) {
    if (result.length > 0 && w.length === 1 && PARTICLES.has(w)) {
      result[result.length - 1] += w;
    } else {
      result.push(w);
    }
  }
  return result;
}

function mergeGroups(words) {
  const groups = [];
  let buf = '';
  for (const w of words) {
    if (buf === '') {
      buf = w;
    } else if (buf.length + w.length <= 5) {
      buf += w;
    } else {
      if (buf.length < 2) {
        buf += w;
      } else {
        groups.push(buf);
        buf = w;
      }
    }
  }
  if (buf) {
    if (buf.length < 2 && groups.length > 0) {
      groups[groups.length - 1] += buf;
    } else {
      groups.push(buf);
    }
  }
  return groups;
}

function segmentLine(text) {
  const marks = [];
  CJK_RUN.lastIndex = 0;
  let match;
  while ((match = CJK_RUN.exec(text)) !== null) {
    const blockStart = match.index;
    const block = match[0];
    const rawWords = jieba.cut(block, true);
    const words = mergeParticles(rawWords);
    const groups = mergeGroups(words);
    let offset = blockStart;
    for (const g of groups) {
      offset += g.length - 1;
      marks.push({ offset });
      offset += 1;
    }
  }
  return marks;
}

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
console.log(minGap >= 1 ? '[OK] 无重叠/异常边界' : '[FAIL] 存在异常边界');
console.log(marks.length > 0 && marks.length < [...SAMPLE].length / 2 ? '[OK] 词块数合理（非单字碎片）' : '[FAIL] 词块数异常');
