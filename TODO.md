# 前端架构审查 TODO

> 审查时间：2026-06-06
> 本项目处于初始阶段，所有修改不保留兼容代码，直接替换。

---

## ✅ 已完成

### 1. `useCanvasActions.ts` 拆分 → `4a39d5a`
拆为 useNodeActions + useDownload + useCanvasActions（事件桥接）

### 2. `utils.ts` 拆分 → `00e29f9`
拆为 utils/ 目录：constants / layout / media / upload / api / validation

### 3. 暗色模式双重同步 → `cc61d17`
删除 useDarkModeSync.ts，保留 store 侧 syncDarkModeToDOM

### 4. `showError` 定时器泄漏 → `4a90cb9`
追踪 timer ID，调用前 clearTimeout

### 5. `loadNodes` 失败静默 → `fd677a6`
catch 中调用 showError 显示错误提示

### 6. `SettingsModal` props 重构 → `bca0aad`
改为内部 useUIStore 读取 darkMode，App.tsx 不再订阅

### 7. `App.css` 拆分 → `d73cd55`
拆为 styles/ 目录：variables / toolbar / modal / nodes / canvas

### 8. 节点 ID 生成 → `a3437dc`
Date.now() + random → crypto.randomUUID()

### 9. 死代码移除 → `4a39d5a`
删除 uploadFile + getImageRenderHeight

### 10. 上传链重写 → `1e23ed0`
.then() 链 → async/await 两阶段（先创建进度节点，再串行上传）

### 11. `handleOrganize` guard → `e55abd6`
`selected.length < 1` → `< 2`
