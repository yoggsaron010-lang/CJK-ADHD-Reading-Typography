import * as vscode from 'vscode';
import { Config, LineFocusConfig } from '../config';
import { Feature, visibleLineSpan } from './types';

/**
 * 功能 2：行焦点 / 阅读尺（Line Focus / Reading Mask）
 *
 * 暗化阅读带之外的全部文本（opacity 装饰），直接屏蔽外围视觉干扰，
 * 减少无意识回读（regressions）与跳行。阅读带内可选底色高亮。
 * 可通过命令 / 状态栏 / 设置关闭。
 */
export class LineFocusFeature implements Feature {
  readonly id = 'lineFocus';

  private dimType: vscode.TextEditorDecorationType | undefined;
  private bandType: vscode.TextEditorDecorationType | undefined;
  private lf: LineFocusConfig | undefined;

  isEnabled(cfg: Config): boolean {
    return cfg.lineFocus.enabled;
  }

  sync(cfg: Config): void {
    this.lf = cfg.lineFocus;
    this.dimType?.dispose();
    this.bandType?.dispose();
    this.dimType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      opacity: String(cfg.lineFocus.dimOpacity),
      rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
    });
    // bandColor 留空 = 只暗化带外，不高亮带内
    this.bandType = cfg.lineFocus.bandColor
      ? vscode.window.createTextEditorDecorationType({
          isWholeLine: true,
          backgroundColor: cfg.lineFocus.bandColor,
          rangeBehavior: vscode.DecorationRangeBehavior.OpenOpen,
        })
      : undefined;
  }

  updateEditor(editor: vscode.TextEditor, cfg: Config): void {
    if (!this.dimType || !this.lf) {
      return;
    }
    const doc = editor.document;
    const [start, end] = visibleLineSpan(editor, cfg);
    const [bandStart, bandEnd] = this.band(editor);
    const dim: vscode.DecorationOptions[] = [];
    const band: vscode.DecorationOptions[] = [];

    for (let ln = start; ln <= end; ln++) {
      const range = doc.lineAt(ln).range;
      if (ln < bandStart || ln > bandEnd) {
        dim.push({ range });
      } else if (this.bandType) {
        band.push({ range });
      }
    }
    editor.setDecorations(this.dimType, dim);
    if (this.bandType) {
      editor.setDecorations(this.bandType, band);
    }
  }

  clearEditor(editor: vscode.TextEditor): void {
    if (this.dimType) {
      editor.setDecorations(this.dimType, []);
    }
    if (this.bandType) {
      editor.setDecorations(this.bandType, []);
    }
  }

  /** 阅读带行区间 [含首, 含尾] */
  private band(editor: vscode.TextEditor): [number, number] {
    const lf = this.lf as LineFocusConfig;
    const doc = editor.document;
    const sel = editor.selection;

    // 多行选区（如 Shift+↓ 跟读）：阅读带覆盖整个选区
    if (!sel.isEmpty && sel.start.line !== sel.end.line) {
      return [sel.start.line, Math.min(doc.lineCount - 1, sel.end.line)];
    }

    let anchor: number;
    if (lf.anchor === 'viewport') {
      const vis = editor.visibleRanges;
      const top = vis.length ? vis[0].start.line : 0;
      const bottom = vis.length ? vis[vis.length - 1].end.line : doc.lineCount - 1;
      anchor = Math.floor((top + bottom) / 2);
    } else {
      anchor = sel.active.line;
    }

    const half = Math.floor((lf.bandLines - 1) / 2);
    const bandStart = Math.max(0, anchor - half);
    return [bandStart, Math.min(doc.lineCount - 1, bandStart + lf.bandLines - 1)];
  }

  dispose(): void {
    this.dimType?.dispose();
    this.bandType?.dispose();
    this.dimType = undefined;
    this.bandType = undefined;
  }
}
