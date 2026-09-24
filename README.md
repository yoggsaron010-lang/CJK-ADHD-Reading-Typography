# CJK-ADHD-Reading-Typography For VSCode · 中文 ADHD 阅读辅助


针对 **ADHD / 阅读障碍** 读者的 VSCode 排版增强。
适用于 VSCode 能打开并显示的**任意文本文件**（md、html、代码、纯文本……）。

**关于是否影响文档/设置（准确版）：**

- **词界显化、行焦点/阅读尺**：纯装饰器渲染（`createTextEditorDecorationType`），
  不修改文档文本——复制、保存、git 均不受影响；
- **阅读排版（Typography）**：会**修改 VSCode 编辑器设置**（`editor.fontFamily` /
  `editor.lineHeight` / `editor.wordWrap(+Column)`），默认写入工作区
  `.vscode/settings.json`——若该文件被 git 跟踪，则**可能产生 git diff**。
  停用功能或卸载扩展时自动恢复被改前的原值（快照持久化在 workspaceState）。

---
词界显化（Word-Level Spacing）
心理语言学与眼动研究（如 Yan et al. 对中文阅读的研究）表明，中文读者在阅读时是以“词”而非“字”为单位进行眼跳（Saccades）定位的。本功能使用在中文“词与词”之间添加微小空格的方式，降低视觉拥挤效应。
（#为什么不使用和bionic reading类似的加粗加黑部分字的方式？ 
：拼音文字和方块文字视觉提取机制不同，如果强行加粗词的一部分/单字，会破坏汉字的结构完整性，增加视觉噪音

```

- 纯视觉渲染：绝对不修改磁盘上的实际文本内容。用 `window.createTextEditorDecorationType` 在中文词块末字符右侧加 CSS 外边距
  （默认 `margin-right: 0.25em`，可配置 `cjkReading.wordBoundary.spacing`）；
- 实时防抖：`onDidChangeTextDocument` + 150ms 防抖，高速打字/大文件不卡顿；
- 虚词粘附：`的/地/得/了/着/过/在/与/对/和/于/或/等` 向内粘附到前一个词块末尾
  （`认真地|学习了|知识`），避免把中文切得过于碎片化；
- 字符类过滤（非语法感知）：只对连续汉字块 `/[\u4e00-\u9fa5]+/g` 提取分词，
  英文、数字、符号及 URL 中的非中文部分不参与分词。注意：它并**不理解**
  HTML/Markdown/源码结构——HTML 属性、字符串字面量、注释里的中文仍会被分词；
- 可关闭：命令面板 / 状态栏「词界」/ 设置均可。

行焦点 / 阅读尺（Line Focus / Reading Mask）

ADHD 读者容易行间跳跃、被上下文分散、无意识回读（regressions）。本功能暗化阅读带之外的全部文本，直接屏蔽外围视觉干扰：

```
░░░░░░░░░░░░░░░░░░░░░░░░░  ← 暗化（opacity 0.28）
▓▓▓▓▓ 阅读带（默认 3 行，可选底色高亮）▓▓▓▓▓
░░░░░░░░░░░░░░░░░░░░░░░░░  ← 暗化
```

- 阅读带高度 `bandLines`（1 = 只留当前行；3 = 阅读尺）；
- 锚点 `anchor`：`cursor` 跟随光标（Shift+↓ 多行选区时覆盖整个选区），或 `viewport` 锚定视口中心；
- 暗化程度 `dimOpacity`（0.05~1）；带内底色 `bandColor`（留空 = 只暗化带外）；
- **可关闭**：命令面板 / 状态栏「尺」/ 设置均可。

阅读排版（Typography）

- 字体：笔画粗细均匀、无装饰的无衬线黑体（苹方 / 思源黑体 / 雅黑），避免笔画形态复杂的宋体/楷体；
- 行距：字号 × 1.8~2.0（默认 1.9），大行距显著减少行间视觉干扰；
- 单行字数：25~35 字狭长版面（默认 30），过宽的版面会导致换行时眼跳定位失败。

实现方式：受控写入 `editor.fontFamily` / `editor.lineHeight` / `editor.wordWrap(+Column)`
（VSCode 不支持扩展级的行距/版心渲染）。写入前自动快照原值（持久化在 workspaceState，
中途崩溃也不会把扩展写入的值误当原值），关闭功能或卸载时自动恢复原值。
**注意：这是本扩展唯一会修改 VSCode 设置（而非纯装饰器）的功能**；
默认写入工作区 `.vscode/settings.json`，被 git 跟踪时会看到 git diff（停用后自动恢复）。
可关闭：命令面板 / 状态栏「排版」/ 设置均可。

---

开关方式

| 方式 | 操作 |
|---|---|
| 状态栏 | 点击「词界」「尺」「排版」三个状态项，即点即关 |
| 命令面板 | `CJK-ADHD-Reading-Typography: 切换「词界显化」/「行焦点阅读尺」/「阅读排版」` |
| 设置 | `cjkReading.*.enabled`，另有总开关 `cjkReading.enabled` |

主要配置（节选）

| 配置 | 默认 | 说明 |
|---|---|---|
| `cjkReading.wordBoundary.spacing` | `0.25em` | 词块末字符右侧 margin-right |
| `cjkReading.lineFocus.bandLines` | `3` | 阅读带高度（行） |
| `cjkReading.lineFocus.dimOpacity` | `0.28` | 带外不透明度 |
| `cjkReading.typography.fontFamily` | 苹方/思源黑体/雅黑 | 黑体字体栈，留空不改 |
| `cjkReading.typography.lineHeightRatio` | `1.9` | 行距倍数（1.8~2.0），0 不改 |
| `cjkReading.typography.lineLength` | `30` | 单行字数（25~35），0 不改 |
| `cjkReading.includeLanguages` | `[]` | 限定文件类型（装饰器功能），空 = 全部 |
| `cjkReading.excludeLanguages` | `[]` | 排除文件类型（装饰器功能） |

开发

```bash
npm install
npm run compile     # tsc 编译
npm run selfcheck   # 分词边界自检（与生产共用 src/core/segmenter.ts）
npm test            # 分词核心单元测试（node --test）
# VSCode 中 F5 启动 Extension Development Host 试用
npx @vscode/vsce package   # 打包 .vsix 安装
```

架构：分词纯逻辑在 `src/core/segmenter.ts`（无 VSCode 依赖，生产/自检/测试三方共用）；
`src/features/` 下每个功能实现 `Feature` 接口（`sync` + 可选 `updateEditor/clearEditor`），
新增功能（如语义加粗、意群分块、拼音注音）加一个模块即可挂入 `extension.ts` 的渲染管线。


## 依据

- Yan 等：中文阅读中词是眼跳定位与加工的基本单位（词切分效应的眼动证据）；
- 空格减少汉语发展性阅读障碍儿童的视觉拥挤效应（华东师大，眼动研究）；
- 字间距与拥挤效应呈 U 型关系（间距过大反而有害）；
- 行距/版心：狭行长版面（~30 字符）可减少换行眼跳定位失败，行距 1.8~2.0 减少行间干扰。
## 如何安装

仓库已附带现成的 `.vsix` 文件，直接下载安装即可（无需自行打包）：

1. 从 GitHub 仓库下载 `CJK-ADHD-Reading-Typography-<版本>.vsix`
   （文件列表里最新的即是当前版本，旧版本一并保留）

命令行安装：

```bash
code --install-extension CJK-ADHD-Reading-Typography-<版本>.vsix
```

或 VS Code 界面：
1. 打开 VS Code
2. 扩展面板（Ctrl+Shift+X）
3. 右上角 ··· 菜单 → 从 VSIX 安装...（Install from VSIX...）
4. 选择下载的 .vsix 文件

> 仅开发者需要重新打包时才用 `npx @vscode/vsce package`；普通安装直接用仓库里的现成 vsix。
