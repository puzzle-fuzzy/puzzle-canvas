# 前端单元测试 + 边界处理 TODO

> 审查时间：2026-06-06
> 本项目处于初始阶段，所有修改不保留兼容代码，直接替换。

---

## ✅ 已完成

### 测试基础设施
### 1. 安装 vitest + jsdom → `602a419`
新建 vitest.config.ts、src/test-setup.ts，添加 test/test:watch scripts

### 纯函数测试
### 2. validation.test.ts → `e0123d1`
isDangerousFile / isValidUrl / getDomain 共 15 个用例
### 3. layout.test.ts → `e0123d1`
localWaterfallLayout / selectionWaterfallLayout 共 10 个用例
### 4. api.test.ts → `e0123d1` → `74b4928` 扩展
getApiUrl + loadNodes 共 7 个用例

### 关键 bug 修复
### 5. getImageFileHeight naturalWidth=0 → Infinity → `2a9575c`
添加零值保护 ratio = naturalWidth ? ... : 1
### 6. media timeout → `c961b99`
添加 10s 超时防止损坏文件卡死
### 7. media.test.ts → `915d911`
4 个测试用例覆盖高度计算场景
### 8. registerUploadController 泄漏 → `481fb65`
重复注册时先 abort 旧控制器
### 9. uploadFileChunked .json() 无 try/catch → `f43edca`
init 和 complete 阶段 JSON 解析添加错误处理
### 10. upload.test.ts → `1246640`
4 个测试用例覆盖控制器注册/取消
### 11. loadNodes 无 try/catch → `dadd658`
整体包裹 try/catch，fallback 返回空数组
### 12. isValidUrl 空 hostname → `01332ff`
添加 url.hostname.length > 0 检查
### 13. useDownload 不检查 res.ok → `79960cf`
404/500 不再当作文件下载
### 14. Space 键忽略输入框焦点 → `378718a`
INPUT/TEXTAREA/isContentEditable 中不触发平移模式
### 15. localStorage.setItem try/catch → `87bc0e3`
uiStore + useCanvasActions 两处

### 中等优先级修复
### 16. 上传进度 clamp 0-1 → `20e3d83`
DocNode + MediaNode progress 范围限制
### 17. formatFileSize 负数/NaN → `c6ea228` + `4bb645d`
提取到 utils/format.ts，添加 8 个测试用例
### 18. getApiUrl 路径规范化 → `3d29ee7`
缺少前导斜杠自动补全
### 19. addNodeFromUrl URL 长度限制 → `713bc46`
超过 2048 字符拒绝

### UI fallback
### 20. UrlNode img onError → `84dd8b5`
favicon 加载失败回退 globe 图标，OG 图片失败隐藏
### 21. MediaNode img onError → `1d93681`
图片失败显示图标占位，视频失败隐藏播放器

---

## 测试覆盖

共 **45 个前端测试**，覆盖：
- `src/utils/validation.test.ts` — 15 tests
- `src/utils/layout.test.ts` — 10 tests
- `src/utils/api.test.ts` — 7 tests
- `src/utils/media.test.ts` — 4 tests
- `src/utils/upload.test.ts` — 4 tests
- `src/utils/format.test.ts` — 8 tests（含 NaN/Infinity/负数边界）
