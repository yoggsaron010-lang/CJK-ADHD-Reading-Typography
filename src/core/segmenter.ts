/**
 * 分词核心（纯逻辑，无 VS Code 依赖）。
 *
 * 生产代码（src/features/wordBoundary.ts）与测试（tests/segmenter.test.js）、
 * 自检（scripts/selfcheck.js）共用这一份实现，避免"改了生产没改测试、
 * 测试测的是复制实现"的经典问题。
 */
import { Jieba } from '@node-rs/jieba';
import { dict } from '@node-rs/jieba/dict';

/**
 * 连续汉字块。
 *
 * 注意：这只是字符类过滤，**不是语法感知**——HTML 属性、字符串字面量、
 * 代码注释里的中文同样会被分词。它保证的仅仅是：英文、数字、符号、
 * URL 的非中文部分不会被处理。
 */
const CJK_RUN = /[\u4e00-\u9fa5]+/g;

/** 虚词：粘附到前一词块末尾 */
export const PARTICLES = new Set([
  '的', '地', '得', '了', '着', '过', '在', '与', '对', '和', '于', '或', '等',
]);

/** 词块边界：offset = 词块末字符在行内的 0-based 偏移 */
export interface BoundaryMark {
  offset: number;
}

/** jieba 单例（Rust 原生绑定，启动时加载一次词典） */
const jieba: Jieba = Jieba.withDict(dict);

/**
 * 对一行文本做 jieba 词界分词，返回每个词块末尾的字符偏移。
 *
 * 算法（jieba 风格）：
 * 1. jieba 精确模式分词（HMM 开启）
 * 2. 虚词粘附到前一词块
 * 3. 合并为 2~5 字语义块（贪心合并，避免单字块）
 */
export function segmentLine(text: string): BoundaryMark[] {
  const marks: BoundaryMark[] = [];
  CJK_RUN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CJK_RUN.exec(text)) !== null) {
    const blockStart = match.index;
    const block = match[0];

    // 1. jieba 精确模式分词（HMM 开启）
    const rawWords = jieba.cut(block, true);

    // 2. 虚词粘附
    const words = mergeParticles(rawWords);

    // 3. 合并 2~5 字语义块
    const groups = mergeGroups(words);

    // 4. 计算每组末字符的行内偏移
    let offset = blockStart;
    for (const g of groups) {
      offset += g.length - 1;
      marks.push({ offset });
      offset += 1;
    }
  }

  return marks;
}

/** 虚词粘附：单字虚词合并到前一词块末尾 */
export function mergeParticles(words: string[]): string[] {
  const result: string[] = [];
  for (const w of words) {
    if (result.length > 0 && w.length === 1 && PARTICLES.has(w)) {
      result[result.length - 1] += w;
    } else {
      result.push(w);
    }
  }
  return result;
}

/** 合并为 2~5 字语义块（jieba 风格贪心合并） */
export function mergeGroups(words: string[]): string[] {
  const groups: string[] = [];
  let buf = '';
  for (const w of words) {
    if (buf === '') {
      buf = w;
    } else if (buf.length + w.length <= 5) {
      buf += w;
    } else {
      // 不足 2 字时继续合并，避免单字块
      if (buf.length < 2) {
        buf += w;
      } else {
        groups.push(buf);
        buf = w;
      }
    }
  }
  if (buf) {
    // 尾部不足 2 字：回填到前一组
    if (buf.length < 2 && groups.length > 0) {
      groups[groups.length - 1] += buf;
    } else {
      groups.push(buf);
    }
  }
  return groups;
}
