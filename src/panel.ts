/**
 * 图形控制面板（Webview）：功能开关（行焦点·阅读尺 / 阅读排版）。
 * API 配置界面与模型接入（LLM）均已按需求移除。
 */
import * as vscode from 'vscode';

let panel: vscode.WebviewPanel | undefined;

export function registerPanel(context: vscode.ExtensionContext): void {
  const open = (): void => {
    if (panel) {
      panel.reveal(vscode.ViewColumn.Beside);
      return;
    }
    panel = vscode.window.createWebviewPanel(
      'cjkReadingPanel',
      'CJK Reading 控制面板',
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );
    panel.webview.html = html();
    panel.onDidDispose(() => {
      panel = undefined;
    });
    panel.webview.onDidReceiveMessage(async (m: { type: string; key?: unknown; value?: unknown }) => {
      if (m.type === 'init') {
        const cfg = vscode.workspace.getConfiguration('cjkReading');
        void panel?.webview.postMessage({
          type: 'init',
          wb: cfg.get<boolean>('wordBoundary.enabled', true),
          lf: cfg.get<boolean>('lineFocus.enabled', true),
          ty: cfg.get<boolean>('typography.enabled', true),
        });
      } else if (m.type === 'toggle') {
        const cfg = vscode.workspace.getConfiguration('cjkReading');
        const key = String(m.key);
        try {
          await cfg.update(key, Boolean(m.value), vscode.ConfigurationTarget.Workspace);
        } catch {
          await cfg.update(key, Boolean(m.value), vscode.ConfigurationTarget.Global);
        }
      }
    });
    panel.webview.postMessage({ type: 'noop' });
  };
  context.subscriptions.push(vscode.commands.registerCommand('cjkReading.openPanel', open));
}

function html(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 18px; max-width: 480px; }
  h3 { margin: 8px 0 6px; font-size: 13px; }
  .row { margin: 6px 0; }
  p { font-size: 12px; color: var(--vscode-descriptionForeground); }
</style>
</head>
<body>
<h3>功能开关</h3>
<div class="row"><label><input type="checkbox" id="wb"> 词界显化</label></div>
<div class="row"><label><input type="checkbox" id="lf"> 行焦点 / 阅读尺</label></div>
<div class="row"><label><input type="checkbox" id="ty"> 阅读排版</label></div>
<p>改动即时生效；也可用状态栏的「尺 / 排版」快速切换。</p>
<script>
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  window.addEventListener('message', (e) => {
    const m = e.data;
    if (m.type === 'init') {
      $('wb').checked = m.wb;
      $('lf').checked = m.lf;
      $('ty').checked = m.ty;
    }
  });
  for (const [id, key] of [['wb', 'wordBoundary.enabled'], ['lf', 'lineFocus.enabled'], ['ty', 'typography.enabled']]) {
    $(id).addEventListener('change', () => vscode.postMessage({ type: 'toggle', key, value: $(id).checked }));
  }
  vscode.postMessage({ type: 'init' });
</script>
</body>
</html>`;
}
