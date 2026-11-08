# myweb 集成官方 web 编辑器功能 —— 实施方案

## 一、目标与结论

在 `myweb`（Vue3 + Element Plus + Vite）中补齐官方 `web`（Vue2 + Element UI + Vuex + webpack）编辑器的全部节点级与视图级能力：

- 工具栏：前进/后退、格式刷、图片、图标、超链接、备注、标签、概要、关联线、公式、外框
- 右侧面板：节点样式、基础样式、主题、结构、大纲
- 右下角导航：回到根节点、只读、全屏、缩放、演示、搜索、小地图、深色模式
- 附带：右键菜单、快捷键说明、编辑器设置

**核心结论：不需要改引擎，只做 UI 层移植。**

`myweb/vite.config.js` 已把 `simple-mind-map` 指向仓库内 `../simple-mind-map`，且 `myweb/src/pages/Edit.vue` 使用 `import MindMap from 'simple-mind-map/full'`。`simple-mind-map/full.js` 已注册 Painter、AssociativeLine、Formula、OuterFrame、Demonstrate、MiniMap、Search、Scrollbar、Export 等全部插件。唯一未注册的是 `RichText`（官方 `web` 中也是按需 `addPlugin`）。

因此工作量集中在：把 `web/src/pages/Edit/components/*.vue`（约 45 个文件、约 9000 行）机械迁移为 Vue3/Element Plus，并按 myweb 视觉风格重排布局。

---

## 二、现状分析

### 2.1 两边技术栈差异

| 维度 | `web`（官方） | `myweb`（定制） |
| --- | --- | --- |
| 框架 | Vue 2.6（Options API） | Vue 3.4（Options API 仍可用） |
| UI 库 | element-ui 2.15 | element-plus 2.8 |
| 状态 | Vuex（`web/src/store.js`） | Pinia |
| 通信 | `Vue.prototype.$bus = new Vue()` | 无，需要补 |
| i18n | vue-i18n（`web/src/lang/*`） | 无，需要补 `$t` |
| 样式 | less + `/deep/` | 纯 CSS，无 less |
| 图标 | `web/src/assets/icon-font`（iconfont） | 无 |
| 构建 | vue-cli（webpack） | Vite |
| 页面结构 | 全屏固定定位，工具栏/侧栏/导航均 `position: fixed` | 顶栏 + 卡片工具栏 + 画布 flex 布局 |

### 2.2 myweb 当前实现

- [Edit.vue](file:///c:/Users/dean12600k/Desktop/my-mind-map/myweb/src/pages/Edit.vue) 单文件承担全部职责：顶栏、5 组工具按钮、画布、保存、团队协同、AI 生成、导入导出。
- 画布初始化在 `init()`（L437-L444），只传了 `layout`、`theme`、`enableFreeLine`、`enableNodeRichText`。其中 `enableNodeRichText` 并非引擎有效配置项，富文本需通过插件启用。
- 工具栏仅含 undo/redo、子节点/兄弟节点/删除、布局/主题下拉、导入导出、AI，缺失用户列出的全部节点级功能。
- 无右侧面板、无右下角导航、无右键菜单。

### 2.3 官方组件清单与用途（按阶段归类）

阶段一（节点功能）：

| 文件 | 行数 | 作用 | 依赖 |
| --- | --- | --- | --- |
| `ToolbarNodeBtnList.vue` | 395 | 节点功能按钮渲染/禁用态 | `$bus`、Vuex |
| `NodeImage.vue` | 143 | 图片弹窗 | `components/ImgUpload` |
| `NodeHyperlink.vue` | 122 | 超链接弹窗 | `$bus` |
| `NodeIcon.vue` / `NodeIconSidebar.vue` / `NodeIconToolbar.vue` | 137/257/202 | 图标选择/侧栏 | `$bus` |
| `NodeNote.vue` / `NodeNoteContentShow.vue` / `NodeNoteSidebar.vue` | 121/134/87 | 备注编辑/悬浮展示 | `$bus` |
| `NodeTag.vue` / `NodeTagStyle.vue` | 144/227 | 标签编辑/样式 | `$bus` |
| `FormulaSidebar.vue` | 190 | 公式（katex） | `$bus`、RichText |
| `NodeOuterFrame.vue` | 642 | 外框设置 | `config/zh.js` |
| `AssociativeLineStyle.vue` | 389 | 关联线样式 | `config/zh.js` |
| `RichTextToolbar.vue` | 311 | 富文本浮动工具条 | RichText 插件 |
| `NodeImgPlacementToolbar.vue` / `NodeImgPreview.vue` | 152/39 | 图片摆放/预览 | `$bus` |
| `components/ImgUpload/index.vue` + `style.less` | 100 | 图片上传 | 无 |

阶段二（右侧面板）：

| 文件 | 行数 | 作用 |
| --- | --- | --- |
| `Sidebar.vue` / `SidebarTrigger.vue` | 116/182 | 通用抽屉容器 + 右边缘入口 |
| `Style.vue` | 884 | 节点样式 |
| `BaseStyle.vue` | 1282 | 基础样式（画布/连线/主题配置） |
| `Color.vue` | 96 | 颜色选择 |
| `Theme.vue` | 254 | 主题（依赖 `simple-mind-map-plugin-themes`） |
| `Structure.vue` | 137 | 结构（布局） |
| `OutlineSidebar.vue` / `Outline.vue` / `OutlineEdit.vue` | 104/333/341 | 大纲面板/大纲/大纲编辑 |

阶段三（导航与附属）：

| 文件 | 行数 | 作用 |
| --- | --- | --- |
| `NavigatorToolbar.vue` | 290 | 右下一排控制 |
| `Scale.vue` / `Fullscreen.vue` / `Demonstrate.vue` / `MouseAction.vue` | 135/74/180/76 | 缩放/全屏/演示/鼠标行为 |
| `Navigator.vue` | 213 | 小地图 |
| `Search.vue` | 343 | 搜索 |
| `Count.vue` | 103 | 节点计数 |
| `Contextmenu.vue` | 588 | 右键菜单 |
| `Setting.vue` | 620 | 编辑器设置 |
| `ShortcutKey.vue` | 106 | 快捷键说明 |

不移植：`Import.vue`、`Export.vue`、`Toolbar.vue`（文件树/本地文件 API）、`AiCreate.vue`、`AiChat.vue`、`AiConfigDialog.vue`、`Edit.vue`（由新的宿主组件替代）——myweb 已有对应能力。

### 2.4 关键兼容差异（决定移植成本）

1. **Vue 3 仍支持 Options API**，因此 `<script>` 主体可保留，只需机械替换生命周期与导入。
2. **Vuex 可 shim**：`mapState({ isDark: state => state.localConfig.isDark })` 返回的就是普通 getter 对象，Vue3 `computed` 可直接接受。写一个兼容模块即可让组件**一行不改**地继续用 `mapState`/`mapMutations`。
3. **`$bus` 可 shim**：用 `eventemitter3`（myweb 已依赖）封装出 `$on/$off/$emit` 同名 API，挂到 `globalProperties`。
4. **`$t` 可 shim**：复制 `web/src/lang/zh_cn.js`，实现按 `'toolbar.painter'` 路径取值的 `$t`。
5. **Element UI → Element Plus 必须改模板**：`:visible.sync`、`slot`、`.native`、`/deep/`、`el-radio :label`。
6. **生命周期必须改**：`beforeDestroy` → `beforeUnmount`，`destroyed` → `unmounted`。
7. **less 支持**：给 myweb 加 `less` devDependency 即可原样保留 9000 行 `lang="less"`，避免重写样式。
8. **定位方式必须改**：官方全屏 `fixed`，要改为画布容器内的 `absolute`，否则会盖住 myweb 顶栏。

---

## 三、总体方案

### 3.1 目录规划

新增 `myweb/src/mindmap/`：

```
myweb/src/mindmap/
├── MindMapEditor.vue        # 宿主：创建引擎实例、转发事件、渲染所有覆盖层
├── bus.js                   # 事件总线（eventemitter3，兼容 $on/$off/$emit）
├── store.js                 # Pinia useEditorStore + mapState/mapMutations 兼容层
├── i18n.js                  # $t 兼容层（基于 zh_cn.js）
├── api-adapter.js           # storeData/storeConfig/getConfig 等本地持久化替代
├── element-compat.js        # $message/$notify/$confirm/$loading 兼容层
├── config/                  # 复制 web/src/config（index/zh/en/zhtw/vi/icon/image/constant）
├── utils/                   # 复制 web/src/utils 中被用到的纯函数
├── components/              # 移植后的 Vue3 组件（按官方文件名一一对应）
│   ├── ImgUpload/index.vue
│   ├── ToolbarNodeBtnList.vue
│   ├── NodeImage.vue ... （阶段一）
│   ├── Sidebar.vue ...     （阶段二）
│   └── NavigatorToolbar.vue ...（阶段三）
└── style/
    ├── icon-font/           # 复制 web/src/assets/icon-font 四个文件
    └── mindmap.less         # 全局覆盖：暗色、滚动条、myweb 视觉适配
```

组件文件名与官方保持一致，便于后续从上游同步更新。

### 3.2 阶段 0：基础设施（必须先做）

**1. 依赖与静态资源**

- `myweb/package.json`：
  - devDependencies 增加 `"less": "^4.2.0"`
  - dependencies 增加 `"simple-mind-map-plugin-themes": "^1.0.0"`（阶段二主题面板需要）
- 复制 `web/src/assets/icon-font/{iconfont.css,iconfont.ttf,iconfont.woff,iconfont.woff2}` → `myweb/src/mindmap/style/icon-font/`。`iconfont.css` 内为相对路径引用，无需改写。
- 在 `myweb/src/main.js` 中 `import '@/mindmap/style/icon-font/iconfont.css'`。

**2. `bus.js`**

用 `eventemitter3` 封装，保持 `$on/$off/$emit` 签名，兼容官方源码：

```js
import EventEmitter from 'eventemitter3'
class Bus {
  constructor() { this.e = new EventEmitter() }
  $on(n, f) { this.e.on(n, f) }
  $off(n, f) { this.e.off(n, f) }
  $emit(...a) { this.e.emit(...a) }
}
export default new Bus()
```

`main.js` 中：`app.config.globalProperties.$bus = bus`。

**3. `store.js`**

新建 Pinia store `useEditorStore`，字段对齐 `web/src/store.js` 的 `localConfig` 与顶层状态：

```
localConfig: { isDark, openNodeRichText, useLeftKeySelectionRightKeyDrag, isShowScrollbar, isZenMode, enableAi }
activeSidebar: ''
isReadonly: false
isOutlineEdit: false
extraTextOnExport: ''
extendThemeGroupList: []
```

同时导出 Vuex 兼容函数：

```js
export function mapState(obj) {
  const res = {}
  for (const key in obj) res[key] = function () { return obj[key](store.stateLike) }
  return res
}
export function mapMutations(list) {
  const res = {}
  list.forEach(name => { res[name] = payload => store[name](payload) })
  return res
}
```

其中 `store.stateLike` 为 `{ localConfig, activeSidebar, isReadonly, isOutlineEdit, extraTextOnExport, extendThemeGroupList }` 的响应式代理。Pinia 实例在 `main.js` 中创建后通过 `setEditorStore(useEditorStore())` 注入模块级变量，保证 `mapState` 在组件定义期即可读取。

移植组件只需把 `import { mapState, mapMutations } from 'vuex'` 改为 `from '@/mindmap/store'`，其余不动。

配置持久化：`localConfig` 变更时写入 `localStorage['myweb_editor_config']`，初始化时回读。

**4. `i18n.js`**

- 复制 `web/src/lang/zh_cn.js` → `myweb/src/mindmap/i18n.js`（仅保留中文，删除多语言切换）。
- 导出 `t(path)`：按 `.` 拆分逐层取值，缺失时回退为 path 字符串。
- `main.js` 注册 `app.config.globalProperties.$t = t`。

**5. `element-compat.js`**

```js
import { ElMessage, ElNotification, ElMessageBox, ElLoading } from 'element-plus'
app.config.globalProperties.$message = ElMessage
app.config.globalProperties.$notify = ElNotification
app.config.globalProperties.$confirm = ElMessageBox.confirm
app.config.globalProperties.$msgbox = ElMessageBox
app.config.globalProperties.$loading = ElLoading.service
```

`$createElement` 仅出现在不移植的官方 `Edit.vue` 中，无需兼容。

**6. `api-adapter.js`**

官方组件在 `BaseStyle.vue`、`Theme.vue`、`Structure.vue`、`OutlineEdit.vue`、`Setting.vue` 中调用 `storeData` / `storeConfig`。按以下规则实现，不改组件：

- `storeData({ root })`：不改数据，myweb 的 `data_change` 自动保存已在工作。
- `storeData({ view })`：写入 `localStorage['myweb_mindmap_view']`。
- `storeConfig(data)`：合并写入 `localStorage['myweb_mindmap_config']`。
- `getData()` / `getConfig()`：读取上述 key，缺省返回 `{}`。
- `storeLocalConfig` / `getLocalConfig`：读写 `localStorage['myweb_editor_config']`。
- `getLang()` 固定返回 `'zh'`，`storeLang` 空实现。

**7. `config/` 与 `utils/`**

- 直接复制 `web/src/config/index.js`、`zh.js`、`en.js`、`zhtw.js`、`vi.js`、`icon.js`、`image.js`、`constant.js` 到 `myweb/src/mindmap/config/`。`image.js` 中的 `/static/` 图片路径保留（myweb `vite.config.js` 已将 `/static` 代理到 3000 端口）。
- 从 `web/src/utils/index.js` 抽出实际被引用的函数：`printOutline`、`fullScreen`、`fullscrrenEvent`、`getParentWithClass`、`copy`、`setDataToClipboard`、`setImgToClipboard`，放入 `myweb/src/mindmap/utils/index.js`。
- 复制 `web/src/utils/handleClipboardText.js`。
- `loading` 改用 `ElLoading.service` 封装。

**8. `style/mindmap.less`**

- 定义 `.customScrollbar`（官方组件大量使用）。
- 暗色模式：把官方的 `&.isDark` 规则统一改为读取 myweb 变量，或保留原值（`#262a2e`）作为编辑器内暗色皮肤，与 myweb 浅色界面并存。
- 覆盖所有 `position: fixed` → `position: absolute`，作用域限定在 `.myweb-canvas-wrap`。

### 3.3 阶段 0.5：宿主组件与页面改造

**新增 `myweb/src/mindmap/MindMapEditor.vue`**

职责（对标官方 `Edit.vue`，去掉文件/API/多语言/AI 部分）：

- props：`data`（根节点）、`config`、`layout`、`theme`、`readonly`
- 创建实例（沿用官方参数子集）：

```js
this.mindMap = new MindMap({
  el: this.$refs.container,
  data: this.data,
  layout: this.layout,
  theme: this.theme,
  ...this.config,
  nodeTextEditZIndex: 1000,
  nodeNoteTooltipZIndex: 1000,
  openRealtimeRenderOnNodeTextEdit: true,
  enableAutoEnterTextEditWhenKeydown: true,
  customNoteContentShow: {
    show: (content, left, top, node) => this.$bus.$emit('showNoteContent', content, left, top, node),
    hide: () => {}
  },
  defaultNodeImage: new URL('@/assets/...', import.meta.url).href,
  iconList: [...icon],
  initRootNodePosition: ['center', 'center']
})
```

- 富文本：默认 `this.mindMap.addPlugin(RichText)`；`openNodeRichText` 为 false 时 `removePlugin(RichText)`，与官方 `loadPlugins` 一致。
- 滚动条：`isShowScrollbar` 时 `addPlugin(ScrollbarPlugin)`。
- 事件转发：把官方 `Edit.vue` L454-L485 的事件清单原样 `mindMap.on(event, (...args) => $bus.$emit(event, ...args))`。
- `window resize` → `mindMap.resize()`。
- 渲染所有覆盖层组件（阶段一至三逐步补入），统一 `:mindMap="mindMap"`。
- `beforeUnmount` → `mindMap.destroy()`。
- `mounted` 后 `$emit('ready', this.mindMap)`。

**改造 `myweb/src/pages/Edit.vue`**

- 删除 `import MindMap from 'simple-mind-map/full'` 与 `new MindMap(...)`（L437-L444），改为：

```html
<div class="canvas-wrap myweb-canvas-wrap">
  <MindMapEditor
    :data="initialData"
    :layout="layout"
    :theme="theme"
    @ready="onMindMapReady"
  />
</div>
```

- `onMindMapReady(mindMap)`：保存实例引用，挂接 `data_change → markUnsaved`、`node_tree_render_end` 首渲染激活根节点、团队协同 `Cooperate` 初始化（现有 L446-L494 逻辑整体平移）。
- `exec()` 中的 `this.mindMap` 改为 `mindMap.value`。
- 工具栏改造：保留现有撤销/重做、子节点/兄弟节点/删除、布局/主题下拉、导入导出、AI；在「撤销/重做」组后插入节点功能组：

```html
<div class="tool-group">
  <ToolbarNodeBtnList :list="nodeBtnList" />
</div>
```

`nodeBtnList = ['painter', 'image', 'icon', 'link', 'note', 'tag', 'summary', 'associativeLine', 'formula', 'outerFrame']`（不含 back/forward/sibling/child/delete，避免与现有按钮重复；不含 annotation/ai）。

- `.canvas-wrap` 增加 `position: relative`，作为所有覆盖层的定位上下文；`.mind-map-container` 改为 `position: absolute; inset: 0`。

### 3.4 阶段一：节点级功能

移植顺序（由低耦合到高耦合）：

1. `ImgUpload` → `NodeImage`（图片）
2. `NodeHyperlink`（超链接）
3. `NodeTag` + `NodeTagStyle`（标签）
4. `NodeNote` + `NodeNoteContentShow` + `NodeNoteSidebar`（备注）
5. `NodeIcon` + `NodeIconToolbar` + `NodeIconSidebar`（图标）
6. `FormulaSidebar`（公式，需 RichText）
7. `NodeOuterFrame`（外框）
8. `AssociativeLineStyle`（关联线）
9. `NodeImgPreview` + `NodeImgPlacementToolbar`（图片预览/摆放）
10. `RichTextToolbar`（富文本工具条）
11. `ToolbarNodeBtnList`（最后接入工具栏，因为它引用所有入口）

行为说明（无组件，仅命令绑定）：

- 前进/后退：`execCommand('BACK')` / `execCommand('FORWARD')`（myweb 已有）
- 格式刷：`mindMap.painter.startPainter()`
- 概要：`execCommand('ADD_GENERALIZATION')`
- 外框：`execCommand('ADD_OUTER_FRAME')`
- 关联线：`mindMap.associativeLine.createLineFromActiveNode()`

`ToolbarNodeBtnList` 中的按钮 `@click` 改为直接操作 props 传入的 `mindMap` 或 `$bus.$emit`，与官方一致。

### 3.5 阶段二：右侧面板

1. `Sidebar.vue`：`position: fixed` → `absolute`；`top: 0; bottom: 0` 相对 `.myweb-canvas-wrap`；保留 `store.sidebarZIndex` 层级逻辑。
2. `Style.vue`、`Color.vue`（节点样式）
3. `BaseStyle.vue`（基础样式）
4. `Structure.vue`（结构，直接 `setLayout`）
5. `Theme.vue`：需要 `import Themes from 'simple-mind-map-plugin-themes'` 并在 `MindMapEditor.vue` 中 `Themes.init(MindMap)`；若安装失败，降级为仅内置 `default` 主题并隐藏主题面板。
6. `OutlineSidebar.vue` + `Outline.vue` + `OutlineEdit.vue`
7. `SidebarTrigger.vue`：改为画布右边缘悬浮的窄条卡片（沿用 myweb 卡片阴影与圆角），点击 `setActiveSidebar(xxx)` 打开对应面板。

入口交互：在 myweb 工具栏最右侧增加「样式 / 基础样式 / 主题 / 结构 / 大纲」下拉按钮，或直接使用右边缘 `SidebarTrigger`。**决定：使用 SidebarTrigger 边缘入口 + 工具栏保留布局/主题两个快捷下拉**，两者互不冲突。

### 3.6 阶段三：右下角导航与附属

1. `Scale.vue`、`Fullscreen.vue`、`Demonstrate.vue`、`MouseAction.vue`
2. `NavigatorToolbar.vue`：去掉语言下拉、Github/官网/客户端/版本号；保留回到根节点、搜索、小地图、只读、全屏、缩放、深色、演示；样式改为 myweb 右下角悬浮卡片。
3. `Navigator.vue`（小地图，MiniMap 插件已注册）
4. `Search.vue`
5. `Count.vue`：放在画布左下角小卡片
6. `Contextmenu.vue` + 剪贴板工具（右键菜单，覆盖复制/粘贴/插入/样式等原生操作）
7. `Setting.vue`（富文本开关、滚动条、拖拽导入、鼠标行为）
8. `ShortcutKey.vue`（快捷键说明弹窗）

深色模式：只作用于编辑器覆盖层（`isDark` 写 `useEditorStore.localConfig.isDark`），不改变 myweb 主界面配色。

---

## 四、组件级机械改造规则

每个移植文件按以下顺序处理，可作为执行清单逐项打勾：

1. `<script>` 导入：
   - `from 'vuex'` → `from '@/mindmap/store'`
   - `from '@/config'` → `from '@/mindmap/config'`
   - `from '@/api'` → `from '@/mindmap/api-adapter'`
   - `from '@/utils'` / `@/utils/...` → `from '@/mindmap/utils'`
   - `from '@/components/ImgUpload/index.vue'` → `from './ImgUpload/index.vue'`
   - `from 'simple-mind-map/src/utils/index'` 保持不变（Vite alias 可解析）
2. 生命周期：`beforeDestroy` → `beforeUnmount`，`destroyed` → `unmounted`。
3. 弹窗：`:visible.sync="visible"` → `v-model="visible"`；`<span slot="footer">` → `<template #footer>`。
4. 下拉/气泡：`slot="dropdown"` → `#dropdown`，`slot="reference"` → `#reference`。
5. 表格树：`slot-scope="{ node, data }"` → `#default="{ node, data }"`。
6. 事件修饰：`@keyup.native` / `@keydown.native` / `@click.native` → 去掉 `.native`。
7. 深度选择器：`/deep/ .x` → `:deep(.x)`，`::v-deep` → `:deep()`。
8. Element Plus 适配：
   - `size="mini"` → `size="small"`
   - `el-radio :label` → `:value`（EP ≥ 2.6）
   - `el-dialog` 增加 `append-to-body`（避免被画布 `overflow: hidden` 裁剪）
9. `require('...')` → `new URL('...', import.meta.url).href` 或静态 `import`。
10. 定位样式：`position: fixed` → `position: absolute`，并确认父级 `.myweb-canvas-wrap` 为 `position: relative`。
11. 颜色/圆角：覆盖为 myweb 变量（`var(--card)` / `var(--border)` / `var(--radius)` / `var(--shadow)`），保留 `isDark` 分支。
12. 自检：组件内 `this.$bus`、`this.$t`、`this.$message`、`mapState` 均通过兼容层工作，无需改写。

---

## 五、视觉规范

- 工具栏按钮：沿用 myweb `el-button size="small"` 的外观，节点功能按钮使用 iconfont 图标 + 文字（与现有按钮同高）。
- 右侧面板：白底卡片、`border-left: 1px solid var(--border)`、宽度 300px、圆角/阴影使用 myweb 变量。
- 右下导航：`position: absolute; right: 20px; bottom: 20px;`，白底 0.9 透明 + `var(--shadow)` + `var(--radius)`。
- 弹窗统一 `ElDialog`，`width` 移动端 90%。
- 暗色模式只影响编辑器覆盖层与节点画布，不影响顶栏。

---

## 六、假设与决策

| 项 | 决策 |
| --- | --- |
| 引擎 | 不修改 `simple-mind-map`，仅注册 `RichText` 与 `Scrollbar` 插件 |
| i18n | 仅中文，复制 `zh_cn.js`，删除语言切换入口 |
| 数据保存 | 沿用 myweb 现有 `data_change → 自动保存`；`api-adapter` 只做本地配置持久化 |
| 团队协同 | `Cooperate` 初始化逻辑保留在 myweb `Edit.vue`，通过 `ready` 事件拿到实例 |
| 导入导出 | 不移植官方 `Import.vue` / `Export.vue`，沿用 myweb 现有下拉 |
| AI | 不移植官方 AI 组件，保留 myweb 的 AI 生成弹窗 |
| 主题扩展 | 新增 `simple-mind-map-plugin-themes` 依赖；不可用则主题面板降级为内置主题 |
| 本地文件 API | 不移植 `showOpenFilePicker`/文件树（`Toolbar.vue` 不迁移） |
| 视觉 | 沿用 myweb 现有设计语言，不 1:1 复刻官方悬浮工具栏 |

---

## 七、风险与规避

| 风险 | 影响 | 规避 |
| --- | --- | --- |
| `BaseStyle.vue`(1282)、`Style.vue`(884)、`NodeOuterFrame.vue`(642)、`Toolbar.vue` 行数大 | 单文件移植易漏改 | 按第四节 12 条规则逐条过；每完成一个组件立即在页面验证 |
| Element Plus 表单/弹窗 API 差异 | 对话框不显示或参数丢失 | 优先处理 `:visible.sync`、`slot`、`.native`；用 `ElDialog` 的 `v-model` 统一 |
| 覆盖层定位 | 盖住 myweb 顶栏/工具栏 | 所有 `fixed` 改 `absolute`，父容器 `position: relative` |
| 主题包安装失败/版本不匹配 | 主题面板空白 | `Themes.init` 包 try/catch，失败时隐藏主题面板，保留布局下拉 |
| RichText 未注册 | 公式、富文本工具条报错 | `MindMapEditor` 中显式 `addPlugin(RichText)`，并移除无效的 `enableNodeRichText` 选项 |
| myweb 无 `node_modules` | 无法启动验证 | 阶段 0 先执行 `npm install`（myweb 与 simple-mind-map 各自需要） |
| team 模式重复保存 | 协同数据被覆盖 | `data_change` 监听只在 myweb 层保留一份，宿主组件不重复监听 |

---

## 八、验证方案

### 8.1 环境

```bash
cd myweb && npm install
cd ../simple-mind-map && npm install
cd ../myweb && npm run dev     # 5173
```

### 8.2 阶段验收

**阶段 0/0.5**
- 编辑页正常渲染，控制台无报错。
- 选中节点后，现有按钮仍可用；撤销/重做正常。
- 本地/个人云/团队三种来源的打开与保存行为不变。

**阶段一**
- 格式刷：点按钮后图标高亮，点击另一节点完成样式复制，再次点击退出。
- 图片：支持本地上传与 URL 两种方式，可填写标题，节点显示图片。
- 图标：侧栏选图标后节点出现图标，可删除。
- 超链接：设置后节点显示链接图标，点击可打开。
- 备注：编辑后节点出现备注图标，悬浮显示内容，双击可打开编辑。
- 标签：最多 5 个，颜色随内容生成，可删除。
- 概要：选中非根节点后生成概要，可编辑。
- 关联线：从选中节点创建连线，样式面板可调。
- 公式：插入 katex 公式并在节点渲染。
- 外框：选中多个节点后添加外框，可调样式。

**阶段二**
- 右边缘入口可展开/收起 5 个面板，同一时刻只保留一个。
- 节点样式修改立即生效；基础样式修改画布背景/连线。
- 主题切换覆盖到所有节点，暗色主题生效。
- 结构切换（逻辑结构/思维导图/组织结构/时间轴/鱼骨图等）正确重排。
- 大纲与画布双向同步；大纲编辑模式可编辑并回写。

**阶段三**
- 缩放百分比与画布同步，支持手动输入。
- 回到根节点居中；全屏进入/退出；只读模式禁用编辑；演示模式可逐节点跳转。
- 搜索可定位并高亮；小地图可开关并拖动定位。
- 深色模式切换只影响编辑器。
- 右键菜单中的复制/粘贴/插入/删除可用。

**回归**
- 团队模式：WebSocket 连接、在线人数、协同同步、渲染后同步逻辑正常。
- AI 生成、导入（smm/json/xmind/md）、导出（smm/json/png/svg/md/xmind）正常。
- `npm run build` 通过，无未解析导入。
