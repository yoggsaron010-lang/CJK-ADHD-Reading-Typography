import * as vscode from 'vscode';
import { Config, TypographyConfig } from '../config';
import { Feature } from './types';

/**
 * 功能 3：阅读排版（Typography）
 *
 * - 字体：笔画粗细均匀、无装饰的无衬线黑体（苹方 / 思源黑体 / 雅黑）；
 * - 行距：字号 × 1.8~2.0（换算为 editor.lineHeight 的 px 值）；
 * - 单行字数：25~35 字的狭长版面（editor.wordWrap=bounded + wordWrapColumn）。
 *
 * 实现方式是受控地写入 editor.* 设置（VSCode 无法按扩展做行距/版心渲染）。
 * 关闭功能或卸载扩展时，自动恢复写入前的原值——原值快照持久化在
 * workspaceState 中，即使中途崩溃/重启也不会把扩展写入的值误当作用户原值。
 */
interface SettingSnapshot {
  workspaceValue?: unknown;
  globalValue?: unknown;
}

type SnapshotMap = Record<string, SettingSnapshot>;

/** 可写入 editor.* 设置的标量值类型 */
type EditorSettingValue = string | number;

interface ManagedSetting {
  name: string; // editor.<name>
  active(cfg: TypographyConfig): boolean;
  value(cfg: TypographyConfig, fontSize: number): EditorSettingValue;
}

const MANAGED: ManagedSetting[] = [
  {
    name: 'fontFamily',
    active: (c) => c.fontFamily.trim().length > 0,
    value: (c) => c.fontFamily,
  },
  {
    name: 'lineHeight',
    active: (c) => c.lineHeightRatio > 0,
    value: (c, fontSize) => Math.max(0, Math.round(fontSize * c.lineHeightRatio)),
  },
  {
    name: 'wordWrap',
    active: (c) => c.lineLength > 0,
    value: () => 'bounded',
  },
  {
    name: 'wordWrapColumn',
    active: (c) => c.lineLength > 0,
    value: (c) => c.lineLength,
  },
];

const SNAPSHOT_KEY = 'typography.snapshot';

export class TypographyFeature implements Feature {
  readonly id = 'typography';
  private snapshot: SnapshotMap | undefined;

  constructor(memento: vscode.Memento) {
    this.snapshot = memento.get<SnapshotMap>(SNAPSHOT_KEY);
    // 注入 memento 引用（构造参数保持简洁）
    this.memento = memento;
  }

  private memento: vscode.Memento;

  isEnabled(cfg: Config): boolean {
    return cfg.typography.enabled;
  }

  async sync(cfg: Config): Promise<void> {
    if (cfg.enabled && cfg.typography.enabled) {
      await this.apply(cfg.typography);
    } else {
      await this.restore();
    }
  }

  private async apply(typo: TypographyConfig): Promise<void> {
    const editorCfg = vscode.workspace.getConfiguration('editor');
    const fontSize = Number(editorCfg.get('fontSize')) || 14;
    let target = vscode.ConfigurationTarget.Global;
    if (typo.target !== 'global' && vscode.workspace.workspaceFolders) {
      target = vscode.ConfigurationTarget.Workspace;
    }

    // 首次写入前保存原值快照（已在则沿用，防止把扩展写入的值当作原值）
    if (!this.snapshot) {
      const snap: SnapshotMap = {};
      for (const s of MANAGED) {
        const ins = editorCfg.inspect(s.name);
        snap[s.name] = {
          workspaceValue: ins?.workspaceValue,
          globalValue: ins?.globalValue,
        };
      }
      this.snapshot = snap;
      await this.memento.update(SNAPSHOT_KEY, snap);
    }

    for (const s of MANAGED) {
      if (s.active(typo)) {
        await editorCfg.update(s.name, s.value(typo, fontSize), target);
      }
    }
  }

  private async restore(): Promise<void> {
    const snap = this.snapshot;
    if (!snap) {
      return;
    }
    const editorCfg = vscode.workspace.getConfiguration('editor');
    for (const [name, value] of Object.entries(snap)) {
      await editorCfg.update(name, value.workspaceValue, vscode.ConfigurationTarget.Workspace);
      await editorCfg.update(name, value.globalValue, vscode.ConfigurationTarget.Global);
    }
    this.snapshot = undefined;
    await this.memento.update(SNAPSHOT_KEY, undefined);
  }

  dispose(): void {
    void this.restore();
  }
}
