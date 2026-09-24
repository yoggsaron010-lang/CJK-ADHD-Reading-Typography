import * as vscode from 'vscode';
import { Config } from '../config';

/**
 * 功能模块接口：
 * - sync()：同步启用状态与配置（启动、配置变更时调用）。装饰器类功能在这里重建
 *   TextEditorDecorationType；设置类功能（排版）在这里写入/恢复 editor.* 设置。
 * - updateEditor()/clearEditor()：编辑器级渲染，只有装饰器类功能实现。
 */
export interface Feature {
  readonly id: string;
  isEnabled(cfg: Config): boolean;
  sync(cfg: Config): void | Promise<void>;
  updateEditor?(editor: vscode.TextEditor, cfg: Config): void;
  clearEditor?(editor: vscode.TextEditor): void;
  dispose(): void;
}

/** 可视行区间（含上下 padding 缓冲），无文档返回 [0, -1] */
export function visibleLineSpan(editor: vscode.TextEditor, cfg: Config): [number, number] {
  const doc = editor.document;
  const vis = editor.visibleRanges;
  if (vis.length === 0) {
    return [0, -1];
  }
  const start = Math.max(0, vis[0].start.line - cfg.paddingLines);
  const end = Math.min(doc.lineCount - 1, vis[vis.length - 1].end.line + cfg.paddingLines);
  return [start, end];
}
