import * as vscode from 'vscode';
import { readConfig } from './config';
import { Feature } from './features/types';
import { WordBoundaryFeature } from './features/wordBoundary';
import { LineFocusFeature } from './features/lineFocus';
import { TypographyFeature } from './features/typography';
import { registerPanel } from './panel';

export function activate(context: vscode.ExtensionContext): void {
  const controller = new Controller(context);
  context.subscriptions.push(controller);
  controller.start();
  registerPanel(context);
}

export function deactivate(): void {
  // Controller.dispose() 恢复排版设置
}

class Controller implements vscode.Disposable {
  private cfg = readConfig();
  private readonly features: Feature[];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly statusItems: vscode.StatusBarItem[] = [];
  private readonly statusDefs: Array<{
    label: string;
    command: string;
    enabled: () => boolean;
    text?: string;
  }> = [];

  constructor(context: vscode.ExtensionContext) {
    this.features = [
      new WordBoundaryFeature(),
      new LineFocusFeature(),
      new TypographyFeature(context.workspaceState),
    ];
  }

  start(): void {
    this.buildStatus();
    void this.syncFeatures().then(() => {
      this.updateAll();
      this.refreshStatus();
    });

    this.disposables.push(
      vscode.commands.registerCommand('cjkReading.toggleWordBoundary', () =>
        this.toggle('wordBoundary.enabled')
      ),
      vscode.commands.registerCommand('cjkReading.toggleLineFocus', () =>
        this.toggle('lineFocus.enabled')
      ),
      vscode.commands.registerCommand('cjkReading.toggleTypography', () =>
        this.toggle('typography.enabled')
      ),
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.updateAll();
        this.refreshStatus();
      }),
      vscode.window.onDidChangeTextEditorVisibleRanges(() => this.schedule(60)),
      vscode.window.onDidChangeTextEditorSelection(() => this.schedule(60)),
      vscode.workspace.onDidChangeTextDocument(() => this.schedule(150)),
      vscode.workspace.onDidChangeConfiguration((e: vscode.ConfigurationChangeEvent) => {
        if (e.affectsConfiguration('cjkReading') || e.affectsConfiguration('editor.fontSize')) {
          this.cfg = readConfig();
          void this.syncFeatures().then(() => {
            this.updateAll();
            this.refreshStatus();
          });
        }
      })
    );
  }

  private async syncFeatures(): Promise<void> {
    for (const f of this.features) {
      await f.sync(this.cfg);
    }
  }

  private schedule(delay: number): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.updateAll();
    }, delay);
  }

  private updateAll(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      const usable = this.cfg.enabled && this.langOk(editor.document);
      for (const f of this.features) {
        if (!f.updateEditor) {
          continue;
        }
        if (usable && f.isEnabled(this.cfg)) {
          f.updateEditor(editor, this.cfg);
        } else {
          f.clearEditor?.(editor);
        }
      }
    }
  }

  private langOk(doc: vscode.TextDocument): boolean {
    const id = doc.languageId;
    if (this.cfg.excludeLanguages.includes(id)) {
      return false;
    }
    return this.cfg.includeLanguages.length === 0 || this.cfg.includeLanguages.includes(id);
  }

  private async toggle(key: string): Promise<void> {
    const c = vscode.workspace.getConfiguration('cjkReading');
    const ins = c.inspect<boolean>(key);
    const current = c.get<boolean>(key, true);
    const target =
      ins?.workspaceValue !== undefined
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
    await c.update(key, !current, target);
  }

  private buildStatus(): void {
    const defs = [
      {
        label: '词界',
        command: 'cjkReading.toggleWordBoundary',
        enabled: () => this.cfg.enabled && this.cfg.wordBoundary.enabled,
      },
      {
        label: '尺',
        command: 'cjkReading.toggleLineFocus',
        enabled: () => this.cfg.enabled && this.cfg.lineFocus.enabled,
      },
      {
        label: '排版',
        command: 'cjkReading.toggleTypography',
        enabled: () => this.cfg.enabled && this.cfg.typography.enabled,
      },
      {
        label: '面板',
        command: 'cjkReading.openPanel',
        enabled: () => true,
        text: '$(settings-gear) 面板',
      },
    ];
    for (const d of defs) {
      const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
      item.command = d.command;
      item.tooltip = `CJK Reading · ${d.label}`;
      this.statusItems.push(item);
      this.statusDefs.push(d);
    }
  }

  private refreshStatus(): void {
    const visible = vscode.window.activeTextEditor !== undefined;
    this.statusItems.forEach((item, i) => {
      const d = this.statusDefs[i];
      item.text = d.text ?? `${d.enabled() ? '$(check)' : '$(circle-slash)'} ${d.label}`;
      if (visible) {
        item.show();
      } else {
        item.hide();
      }
    });
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    for (const f of this.features) {
      f.dispose();
    }
    for (const item of this.statusItems) {
      item.dispose();
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
