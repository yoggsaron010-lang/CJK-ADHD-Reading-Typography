import * as vscode from 'vscode';
import { Jieba } from '@node-rs/jieba';
import { dict } from '@node-rs/jieba/dict';
import { Config, WordBoundaryConfig } from '../config';
import { Feature, visibleLineSpan } from './types';

/**
 * 功能 1：词界显化（Word-Level Spacing）—— jieba 分词
 *
 * 中文读者按"词"而非"字"组织眼跳（Yan 等的中文阅读眼动研究）。
 * 把词界显式化可以降低词切分负担，改善 ADHD 读者的中文阅读体验。
 *
 * - 纯视觉渲染（无侵入）：用 TextEditorDecorationType 在词块末字符右侧
 *   加 CSS margin-right（默认 0.25em），不修改文档文本。
 * - jieba 分词：@node-rs/jieba（Rust 原生绑定，自带 jieba 词典），精确模式 + HMM。
 * - 虚词粘附：的/地/得/了/着/过 等向内粘附到前一词块末尾。
 * - 语义块合并：jieba 词块合并为 2~5 字语义块，避免单字碎片。
 * - 安全正则：只对连续汉字块提取分词，绕过 HTML 标签、代码块、URL、英文。
 */

/** 连续汉字块（安全正则） */
const CJK_RUN = /[\u4e00-\u9fa5]+/g;

/** 虚词：粘附到前一词块末尾 */
const PARTICLES = new Set([
  '的', '地', '得', '了', '着', '过', '在', '与', '对', '和', '于', '或', '等',
]);

/** 词块边界：offset = 词块末字符在行内的 0-based 偏移 */
interface BoundaryMark {
  offset: number;
}

/** jieba 单例（Rust 原生绑定，启动时加载一次词典） */
const jieba: Jieba = Jieba.withDict(dict);

export class WordBoundaryFeature implements Feature {
  readonly id = 'wordBoundary';

  private decoType: vscode.TextEditorDecorationType | undefined;
  private wb: WordBoundaryConfig | undefined;
  /** 分词缓存：lineKey -> BoundaryMark[] */
  private readonly cache = new Map<string, BoundaryMark[]>();

  isEnabled(cfg: Config): boolean {
    return cfg.wordBoundary.enabled;
  }

  sync(cfg: Config): void {
    this.wb = cfg.wordBoundary;
    this.decoType?.dispose();
    this.decoType = vscode.window.createTextEditorDecorationType({
      rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
    });
  }

  updateEditor(editor: vscode.TextEditor, cfg: Config): void {
    if (!this.decoType || !this.wb) {
      return;
    }
    const doc = editor.document;
    const [start, end] = visibleLineSpan(editor, cfg);
    const spacing = this.wb.spacing;
    const deco: vscode.DecorationOptions[] = [];

    for (let ln = start; ln <= end; ln++) {
      const lineText = doc.lineAt(ln).text;
      const key = `${doc.uri.toString()}:${ln}:${lineText}`;
      let marks = this.cache.get(key);
      if (!marks) {
        marks = segmentLine(lineText);
        this.cache.set(key, marks);
      }
      for (const mark of marks) {
        // 在词块末字符之后插入视觉间距（after 装饰器，不修改文档）
        const pos = new vscode.Position(ln, mark.offset + 1);
        deco.push({
          range: new vscode.Range(pos, pos),
          renderOptions: {
            after: {
              contentText: '',
              margin: `0 ${spacing} 0 0`,
            },
          },
        });
      }
    }
    editor.setDecorations(this.decoType, deco);
  }

  clearEditor(editor: vscode.TextEditor): void {
    if (this.decoType) {
      editor.setDecorations(this.decoType, []);
    }
  }

  dispose(): void {
    this.decoType?.dispose();
    this.decoType = undefined;
    this.cache.clear();
  }
}

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
function mergeParticles(words: string[]): string[] {
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
function mergeGroups(words: string[]): string[] {
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
