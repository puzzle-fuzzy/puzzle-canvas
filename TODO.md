# 前端架构审查 TODO

> 审查时间：2026-06-06
> 本项目处于初始阶段，所有修改不保留兼容代码，直接替换。

---

## 🔴 高优先级

### 1. `useCanvasActions.ts` 430 行，职责过多

**问题**：单个 hook 承载 URL 创建、文件上传编排、粘贴/拖拽、AI 生图、下载、视口持久化等 8 个功能。

**方案**：拆分为 3 个 hook：
- `useNodeActions.ts` — URL + 文件 + AI（需要 ReactFlow 桥接）
- `useCanvasEvents.ts` — handlePaste + handleDrop + handleDragOver
- `useDownload.ts` — handleDownloadSelected（纯 fetch）

`handleMoveEnd` / `handleNodeDragStop` 保留在主 hook 中（只有几行且依赖 getViewport）。

---

### 2. `utils.ts` 426 行，7+ 个关注点混合

**问题**：布局算法、媒体高度计算、文件验证、URL 工具、上传逻辑、持久化 API 全在一个文件。

**方案**：拆分为 `utils/` 目录：
```
utils/
  layout.ts       — 瀑布流布局 (localWaterfallLayout, selectionWaterfallLayout)
  media.ts        — 图片/视频高度预计算
  upload.ts       — 分片上传 + 控制器 (uploadFileChunked, fingerprint, controllers)
  api.ts          — 持久化 API (persistNode, persistNodeDelete, loadNodes, getApiUrl)
  validation.ts   — 文件/URL 验证 (isDangerousFile, isValidUrl, getDomain)
  constants.ts    — 共享常量 (NODE_WIDTH, DANGEROUS_EXTENSIONS)
```

---

### 3. 暗色模式双重同步

**问题**：`uiStore.toggleDarkMode` 调用 `syncDarkModeToDOM()` 写 DOM+localStorage，`useDarkModeSync.ts` 通过 subscribe 再次写 DOM+localStorage。每次切换写两次。

**方案**：删掉 `useDarkModeSync.ts`，保留 store 侧同步。`useInputListeners` 中系统主题监听保留（只在用户未手动设置时生效）。

---

### 4. `showError` 定时器泄漏

**问题**：连续调用 `showError` 时，前一个 setTimeout 会提前清除后一个错误。

**方案**：在 store 闭包内追踪 timer ID，调用前 clearTimeout。
```ts
let errorTimer: ReturnType<typeof setTimeout> | null = null
showError: (msg, durationMs = 3000) => {
  if (errorTimer) clearTimeout(errorTimer)
  set({ error: msg })
  errorTimer = setTimeout(() => { set({ error: null }); errorTimer = null }, durationMs)
}
```

---

### 5. `loadNodes` 失败静默

**问题**：加载失败后只 console.error，用户看到空画布无任何提示。

**方案**：catch 中调用 `useUIStore.getState().showError('节点加载失败')`。

---

## 🟡 中优先级

### 6. `SettingsModal` 通过 props 接收 `darkMode`

**问题**：与 ModeToolbar、AIModal、SelectionToolbar 不一致（它们都直接从 store 读）。App.tsx 为此多订阅了 darkMode。

**方案**：SettingsModal 内部用 `useUIStore` 读取 darkMode，删除 props。

---

### 7. `App.css` 1382 行单文件

**问题**：所有组件样式堆在一起，难维护。

**方案**：拆分为 `src/styles/` 目录：
```
styles/
  variables.css   — :root CSS 变量
  canvas.css      — 容器 + ReactFlow 覆盖 + loading/error/empty
  nodes.css       — UrlNode + MediaNode + DocNode + upload progress
  toolbar.css     — ModeToolbar + SelectionToolbar
  modal.css       — AIModal + SettingsModal + ModelSelect
```

---

### 8. 节点 ID 碰撞风险

**问题**：`Date.now()` 毫秒精度，多文件上传循环中可能重复。虽然有随机后缀但不保险。

**方案**：全部替换为 `crypto.randomUUID()`。

---

## 🟢 低优先级

### 9. 死代码

**问题**：`uploadFile`（旧上传接口）和 `getImageRenderHeight`（已不被使用）仍然 export。

**方案**：直接删除。当前项目处于初始阶段不需要兼容。

---

### 10. `addNodeFromFiles` 上传链可读性

**问题**：180 行 `.then()` 链嵌套，难读难调试。

**方案**：用 `for...of` + `async/await` 重写。逻辑不变（先创建所有进度节点，再串行上传），但代码更清晰。

---

### 11. `handleOrganize` 允许单节点整理

**问题**：`selected.length < 1` 应为 `< 2`。UI 层已限制，但 store 层 guard 也应一致。

**方案**：改为 `< 2`。
