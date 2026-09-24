import * as vscode from 'vscode';
import { Config, WordBoundaryConfig } from '../config';
import { BoundaryMark, segmentLine } from '../core/segmenter';
import { Feature, visibleLineSpan } from './types';

/**
 * 功能 1：词界显化（Word-Level Spacing）—— jieba 分词
 *
 * 中文读者按"词"而非"字"组织眼跳（Yan 等的中文阅读眼动研究）。
 * 把词界显式化可以降低词切分负担，改善 ADHD 读者的中文阅读体验。
 *
 * - 纯视觉渲染（无侵入）：用 TextEditorDecorationType 在词块末字符右侧
 *   加 CSS margin-right（默认 0.25em），不修改文档文本，也不写任何设置。
 * - 分词逻辑在 src/core/segmenter.ts（jieba 精确模式 + 虚词粘附 + 2~5 字语义块），
 *   与 tests/、scripts/selfcheck.js 共用同一份实现。
 * - 能力边界：只对连续汉字块分词，英文/数字/符号/URL 的非中文部分不处理；
 *   但这**不是语法感知**——HTML 属性、字符串字面量、注释里的中文同样会被分词。
 */

/** 分词缓存上限（LRU，条目=行）。防止长期会话无界增长。 */
const CACHE_MAX = 4000;

interface CacheEntry {
  text: string;
  marks: BoundaryMark[];
}

export class WordBoundaryFeature implements Feature {
  readonly id = 'wordBoundary';

  private decoType: vscode.TextEditorDecorationType | undefined;
  private wb: WordBoundaryConfig | undefined;
  /**
   * 分词缓存（LRU）：`uri:行号` -> { 该行文本, 边界 }。
   *
   * - 行文本参与命中校验：编辑过的行自动失效重算，不会读到过期结果；
   *   且 key 不含行文本，旧版本条目被原地覆盖而非累积。
   * - Map 保持插入顺序，命中时重插、超限时淘汰最旧条目（LRU）。
   */
  private readonly cache = new Map<string, CacheEntry>();

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
    const uri = doc.uri.toString();
    const [start, end] = visibleLineSpan(editor, cfg);
    const spacing = this.wb.spacing;
    const deco: vscode.DecorationOptions[] = [];

    for (let ln = start; ln <= end; ln++) {
      const lineText = doc.lineAt(ln).text;
      const marks = this.getOrCompute(`${uri}:${ln}`, lineText);
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

  private getOrCompute(key: string, lineText: string): BoundaryMark[] {
    const hit = this.cache.get(key);
    if (hit && hit.text === lineText) {
      // 刷新 LRU 位置
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit.marks;
    }
    const marks = segmentLine(lineText);
    if (this.cache.size >= CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, { text: lineText, marks });
    return marks;
  }
}
