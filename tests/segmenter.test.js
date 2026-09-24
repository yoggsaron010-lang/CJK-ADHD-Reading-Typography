/**
 * 分词核心单元测试 —— 与生产代码共用 out/core/segmenter.js（编译自 src/core/segmenter.ts），
 * 测的就是线上跑的那份实现，不是复制体。
 *
 * 用法: npm test（内部先执行 npm run compile）
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { segmentLine, mergeParticles, mergeGroups, PARTICLES } = require('../out/core/segmenter.js');

/** 根据边界把一行切成词块文本（仅用于断言可读性） */
function chunks(text, marks) {
  const out = [];
  let start = 0;
  for (const m of marks) {
    out.push(text.slice(start, m.offset + 1));
    start = m.offset + 1;
  }
  if (start < text.length) {
    out.push(text.slice(start));
  }
  return out;
}

test('mergeParticles: 单字虚词粘附到前一词块', () => {
  assert.deepEqual(mergeParticles(['认真', '地', '学习', '了']), ['认真地', '学习了']);
});

test('mergeParticles: 首位虚词不丢弃、非虚词单字不粘附', () => {
  assert.deepEqual(mergeParticles(['的']), ['的']);
  assert.deepEqual(mergeParticles(['我', '吃饭']), ['我', '吃饭']);
});

test('mergeParticles: PARTICLES 集合包含常用虚词', () => {
  for (const p of ['的', '了', '着', '过', '地', '得']) {
    assert.ok(PARTICLES.has(p), `缺少虚词: ${p}`);
  }
});

test('mergeGroups: 贪心合并到 2~5 字，不产生单字块', () => {
  assert.deepEqual(mergeGroups(['我', '就', '明白了']), ['我就明白了']);
  assert.deepEqual(mergeGroups(['很多年前', '我', '就', '明白了']), ['很多年前我', '就明白了']);
  for (const words of [['一', '二'], ['真实', '地了解', '自己'], ['才能使', '自己', '置身于', '发现之中']]) {
    for (const g of mergeGroups(words)) {
      assert.ok(g.length >= 2 || words.join('').length < 2, `单字块: ${g}`);
      assert.ok(g.length <= 7, `过长块: ${g}`);
    }
  }
});

test('mergeGroups: 尾部单字回填到前一组', () => {
  const groups = mergeGroups(['一二三', '四']);
  assert.deepEqual(groups, ['一二三四']);
});

test('segmentLine: 纯非中文返回空', () => {
  assert.deepEqual(segmentLine('hello, world! https://example.com/abc'), []);
  assert.deepEqual(segmentLine('123 + 456 = 789'), []);
});

test('segmentLine: 单个汉字块的边界合法（单调递增、落在块内）', () => {
  const text = '提高患者的阅读效率';
  const marks = segmentLine(text);
  assert.ok(marks.length >= 2, '应产生多个词块');
  let prev = -1;
  for (const m of marks) {
    assert.ok(m.offset > prev, `offset 必须严格递增: ${m.offset} <= ${prev}`);
    assert.ok(m.offset >= 0 && m.offset < text.length, `offset 越界: ${m.offset}`);
    prev = m.offset;
  }
});

test('segmentLine: 非中文部分不产生边界（英文/符号/URL 穿插）', () => {
  const text = '这是中文abc这也是中文';
  const marks = segmentLine(text);
  for (const m of marks) {
    // 边界必须落在汉字上
    assert.match(text[m.offset], /[\u4e00-\u9fa5]/, `边界落在非汉字: offset=${m.offset}`);
    // 边界不能落在 abc 内部（offset 5,6,7 是 a,b,c）
    assert.ok(m.offset < 4 || m.offset > 7, `边界不应落在英文内部: ${m.offset}`);
  }
});

test('segmentLine: 分块拼接还原原文（无字符丢失/重复）', () => {
  const text = '一位真正的作家永远只为内心写作';
  const marks = segmentLine(text);
  assert.equal(chunks(text, marks).join(''), text);
});

test('segmentLine: 虚词粘附效果（真实地/了解自己）', () => {
  const text = '真实地了解自己';
  const marks = segmentLine(text);
  const got = chunks(text, marks);
  // 「地」应粘附进前一词块，而不是独立成块
  for (const c of got) {
    assert.notEqual(c, '地', '虚词不应独立成块');
  }
  assert.equal(got.join(''), text);
});
