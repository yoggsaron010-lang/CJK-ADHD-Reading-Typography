import * as vscode from 'vscode';

/** 词界显化 */
export interface WordBoundaryConfig {
  enabled: boolean;
  /** 词块末尾间距（CSS margin-right 值） */
  spacing: string;
}

/** 行焦点/阅读尺 */
export interface LineFocusConfig {
  enabled: boolean;
  /** 阅读带高度（行） */
  bandLines: number;
  /** 阅读带锚点：光标 / 视口中心 */
  anchor: 'cursor' | 'viewport';
  /** 带外文本不透明度 */
  dimOpacity: number;
  /** 阅读带底色，空串 = 不高亮 */
  bandColor: string;
}

/** 阅读排版（修改 editor.* 设置，可恢复） */
export interface TypographyConfig {
  enabled: boolean;
  /** 黑体字体栈，空串 = 不改字体 */
  fontFamily: string;
  /** 行距倍数（1.8~2.0），0 = 不改行距 */
  lineHeightRatio: number;
  /** 单行字数（25~35），0 = 不改换行 */
  lineLength: number;
  /** 设置写入层 */
  target: 'workspace' | 'global';
}

export interface Config {
  enabled: boolean;
  wordBoundary: WordBoundaryConfig;
  lineFocus: LineFocusConfig;
  typography: TypographyConfig;
  /** 可视区上下缓冲行数 */
  paddingLines: number;
  includeLanguages: string[];
  excludeLanguages: string[];
}

export function readConfig(): Config {
  const c = vscode.workspace.getConfiguration('cjkReading');
  return {
    enabled: c.get<boolean>('enabled', true),
    wordBoundary: {
      enabled: c.get<boolean>('wordBoundary.enabled', true),
      spacing: c.get<string>('wordBoundary.spacing', '0.25em'),
    },
    lineFocus: {
      enabled: c.get<boolean>('lineFocus.enabled', true),
      bandLines: Math.max(1, Math.round(c.get<number>('lineFocus.bandLines', 3))),
      anchor: c.get<'cursor' | 'viewport'>('lineFocus.anchor', 'cursor'),
      dimOpacity: c.get<number>('lineFocus.dimOpacity', 0.28),
      bandColor: c.get<string>('lineFocus.bandColor', 'rgba(127,127,127,0.10)'),
    },
    typography: {
      enabled: c.get<boolean>('typography.enabled', true),
      fontFamily: c.get<string>('typography.fontFamily', ''),
      lineHeightRatio: c.get<number>('typography.lineHeightRatio', 1.9),
      lineLength: Math.round(c.get<number>('typography.lineLength', 30)),
      target: c.get<'workspace' | 'global'>('typography.target', 'workspace'),
    },
    paddingLines: Math.max(0, Math.round(c.get<number>('paddingLines', 30))),
    includeLanguages: c.get<string[]>('includeLanguages', []),
    excludeLanguages: c.get<string[]>('excludeLanguages', []),
  };
}
