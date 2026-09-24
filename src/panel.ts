/**
 * 图形控制面板（Webview）：功能开关（词界显化 / 行焦点·阅读尺 / 阅读排版）
 * + 词块间距滑动条（0.1~0.25em）。
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
          sp: readSpacingEm(cfg.get<string>('wordBoundary.spacing', '0.25em')),
        });
      } else if (m.type === 'spacing') {
        const value = `${clampEm(Number(m.value))}em`;
        const cfg = vscode.workspace.getConfiguration('cjkReading');
        try {
          await cfg.update('wordBoundary.spacing', value, vscode.ConfigurationTarget.Workspace);
        } catch {
          await cfg.update('wordBoundary.spacing', value, vscode.ConfigurationTarget.Global);
        }
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
  .slider-row { display: flex; align-items: center; gap: 8px; margin: 4px 0 8px 20px; }
  .slider-row input[type="range"] { flex: 1; }
  .slider-row input[type="number"] {
    width: 64px; padding: 2px 4px;
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
  }
  p { font-size: 12px; color: var(--vscode-descriptionForeground); }
</style>
</head>
<body>
<h3>功能开关</h3>
<div class="row"><label><input type="checkbox" id="wb"> 词界显化</label></div>
<div class="slider-row" id="spRow">
  <input type="range" id="sp" min="0.1" max="0.25" step="0.01" value="0.25" title="词块间距（0.1~0.25em）">
  <input type="number" id="spVal" step="0.01" title="直接输入 em 数值（0.1~0.25）"> em
</div>
<div class="row"><label><input type="checkbox" id="lf"> 行焦点 / 阅读尺</label></div>
<div class="row"><label><input type="checkbox" id="ty"> 阅读排版</label></div>
<p>改动即时生效；也可用状态栏的「尺 / 排版」快速切换。</p>
<script>
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const SP_MIN = 0.1, SP_MAX = 0.25;
  function fmt(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function setSp(v) {
    if (!isFinite(v)) v = 0.25;
    $('sp').value = String(Math.min(SP_MAX, Math.max(SP_MIN, v)));
    $('spVal').value = fmt(v);
  }
  function syncSpEnabled() {
    const on = $('wb').checked;
    $('sp').disabled = !on;
    $('spVal').disabled = !on;
    $('spRow').style.opacity = on ? '1' : '0.5';
  }
  let spTimer;
  function commitSp(v) {
    clearTimeout(spTimer);
    spTimer = setTimeout(() => vscode.postMessage({ type: 'spacing', value: v }), 150);
  }
  $('sp').addEventListener('input', () => {
    const v = parseFloat($('sp').value);
    $('spVal').value = fmt(v);
    commitSp(v);
  });
  $('spVal').addEventListener('change', () => {
    let v = parseFloat($('spVal').value);
    if (!isFinite(v)) v = 0.25;
    v = Math.min(SP_MAX, Math.max(SP_MIN, Math.round(v * 100) / 100));
    setSp(v);
    commitSp(v);
  });
  window.addEventListener('message', (e) => {
    const m = e.data;
    if (m.type === 'init') {
      $('wb').checked = m.wb;
      $('lf').checked = m.lf;
      $('ty').checked = m.ty;
      setSp(m.sp);
      syncSpEnabled();
    }
  });
  for (const [id, key] of [['wb', 'wordBoundary.enabled'], ['lf', 'lineFocus.enabled'], ['ty', 'typography.enabled']]) {
    $(id).addEventListener('change', () => vscode.postMessage({ type: 'toggle', key, value: $(id).checked }));
  }
  $('wb').addEventListener('change', syncSpEnabled);
  syncSpEnabled();
  vscode.postMessage({ type: 'init' });
</script>
</body>
</html>`;
}

/** 词块间距滑动条范围（em） */
const SP_MIN = 0.1;
const SP_MAX = 0.25;

function clampEm(v: number): number {
  if (!Number.isFinite(v)) {
    return 0.25;
  }
  return Math.min(SP_MAX, Math.max(SP_MIN, Math.round(v * 100) / 100));
}

/** 从配置字符串（如 "0.25em"）解析 em 数值 */
function readSpacingEm(raw: string): number {
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : 0.25;
}
