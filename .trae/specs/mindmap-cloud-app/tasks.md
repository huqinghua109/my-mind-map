# 定制化思维导图应用 - 实施计划

## Task 1: 后端工程骨架与数据库初始化
- **Status**: `completed`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 新建 `server/` 目录，初始化 Node.js 工程（Express + better-sqlite3 + bcrypt + jsonwebtoken + cors + multer + ws + y-websocket）。
  - 创建 `server/data/`（SQLite）与 `server/uploads/avatars`、`server/uploads/images` 目录。
  - 编写 DB 初始化脚本，建立 `users`、`teams`、`team_members`、`files`、`invitations`、`user_configs` 表。
  - 提供统一数据库访问模块、错误处理中间件、静态文件路由 `/static` 指向 `server/uploads`。
- **Acceptance Criteria Addressed**: AC-1, AC-3, AC-9
- **Test Requirements**:
  - `rule` TR-1.1: `node server/index.js` 后 3000 端口监听，`GET /api/health` 返回 200。
  - `rule` TR-1.2: `server/data/app.db` 自动创建且包含 6 张表。
  - `rule` TR-1.3: `GET /static/avatars/test.png` 等静态路由可访问（404 也算路由存在）。
- **Notes**: better-sqlite3 选用 v11.x（兼容 Node 18），其他依赖均选 Node 18 兼容版本；package.json 中 engines 声明 `node: ">=18"`。

## Task 2: 后端认证、用户与头像上传
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - `POST /api/auth/register`：校验用户名/邮箱/密码，bcrypt 哈希，返回 JWT。
  - `POST /api/auth/login`：校验密码，返回 JWT。
  - JWT 鉴权中间件。
  - `GET /api/user/profile`、`PUT /api/user/profile`（昵称、邮箱）。
  - `POST /api/user/avatar`：multer 接收图片，存 `server/uploads/avatars/`，返回 `/static/avatars/<文件名>` URL，更新用户 avatar 字段。
- **Acceptance Criteria Addressed**: AC-1, AC-9, AC-10
- **Test Requirements**:
  - `rule` TR-2.1: 注册返回 201+token；重复用户名返回 409。
  - `rule` TR-2.2: 登录正确返回 token；错误密码 401。
  - `rule` TR-2.3: 无 token 访问 profile 返回 401；带 token 返回用户信息。
  - `rule` TR-2.4: 上传头像后用户 avatar 字段为 URL 路径（非 base64），且该 URL 可访问。
- **Notes**: JWT 密钥从 `JWT_SECRET` 环境变量读取。

## Task 3: 后端团队 API
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - `POST /api/teams` 创建团队（owner 为创建者）。
  - `GET /api/teams` 列出我加入的团队。
  - `POST /api/teams/:id/invite` 生成/刷新 6 位邀请码。
  - `POST /api/teams/join` 凭邀请码加入。
  - `GET /api/teams/:id/members` 成员列表。
  - `DELETE /api/teams/:id/members/:userId` owner 移除成员。
  - `POST /api/teams/:id/leave` 成员退出。
- **Acceptance Criteria Addressed**: AC-2, AC-4
- **Test Requirements**:
  - `rule` TR-3.1: 创建团队成功，列表返回该团队。
  - `rule` TR-3.2: 邀请码可被另一用户加入，双方列表均含该团队。
  - `rule` TR-3.3: 非成员调用成员列表返回 403。
  - `rule` TR-3.4: owner 移除成员后列表不含该用户。

## Task 4: 后端云端文件与图片上传 API
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - `POST /api/files/personal` 创建个人文件（name + content）。
  - `GET /api/files/personal` 个人文件列表。
  - `GET /api/files/:id` 文件详情（含 content）。
  - `PUT /api/files/:id` 更新（name/content）。
  - `DELETE /api/files/:id` 删除。
  - `POST /api/teams/:id/files` 创建团队文件。
  - `GET /api/teams/:id/files` 团队文件列表。
  - `POST /api/upload/image`：multer 接收节点图片，存 `server/uploads/images/`，返回 URL。
  - 文件访问控制：个人文件仅本人；团队文件仅成员。
  - content 大小限制 20MB，超出返回 413。
- **Acceptance Criteria Addressed**: AC-3, AC-4, AC-9
- **Test Requirements**:
  - `rule` TR-4.1: 个人文件 CRUD 链路数据一致。
  - `rule` TR-4.2: 团队文件非成员返回 403。
  - `rule` TR-4.3: `POST /api/upload/image` 返回 URL，该 URL 可访问，文件存于 uploads/images。
  - `rule` TR-4.4: 超过 20MB 的 content 返回 413。
- **Notes**: files 表含 type(personal/team)、owner_type、owner_id、created_by、content(TEXT)。

## Task 5: 后端实时协同（Yjs WebSocket）与 AI 代理
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - 集成 `y-websocket` 服务到 Express HTTP 服务器，WebSocket 路径 `/ws`，按房间名（`file-<id>`）隔离 Yjs 文档。
  - 协同数据持久化：房间内数据变更后节流（约 3s）持久化到 files 表 content；房间空时（最后连接断开）立即落库，确保数据不丢。
  - `POST /api/ai/chat`：后端代理，从用户配置读取 baseUrl/apiKey/model，转发 OpenAI 兼容 Chat Completions（流式），支持 `AbortController` 停止。
  - `GET /api/ai/config` / `PUT /api/ai/config`：读取/保存用户 AI 配置（baseUrl、apiKey、model）。
- **Acceptance Criteria Addressed**: AC-5, AC-7.1, AC-8
- **Test Requirements**:
  - `rule` TR-5.1: 两个 WebSocket 客户端连入同一房间，一端 Yjs 变更另一端实时收到。
  - `rule` TR-5.2: 房间变更后 3s 内或最后连接断开后，files 表对应 content 被更新。
  - `rule` TR-5.3: `POST /api/ai/chat` 转发请求到配置的 baseUrl 并返回流式响应。
  - `rule` TR-5.4: `PUT /api/ai/config` 保存后 `GET` 返回一致。
- **Notes**: y-websocket 房间名需带 file id 前缀避免冲突；AI 代理用 fetch + stream pipe。

## Task 6: 新前端工程初始化（Vue 3 + Vite）
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - 新建 `myweb/`，使用 Vite + Vue 3 初始化。
  - 配置 `vite.config.js`：`/api`、`/static`、`/ws` 代理到 `http://localhost:3000`（`/ws` 走 WebSocket）。
  - 安装依赖：vue-router、pinia、element-plus、axios、`simple-mind-map`（使用本地 `../simple-mind-map`）、y-websocket。
  - 搭建基础目录：`src/pages`、`src/components`、`src/api`、`src/store`、`src/router`、`src/layouts`、`src/style`。
  - 配置 Element Plus 全局引入与全局样式变量。
- **Acceptance Criteria Addressed**: AC-10, AC-11
- **Test Requirements**:
  - `rule` TR-6.1: `cd myweb && npm run dev` 启动成功，浏览器可访问。
  - `rule` TR-6.2: 前端 `/api/health` 请求代理到后端返回 200。
  - `rule` TR-6.3: Element Plus 按钮组件正常渲染。
- **Notes**: simple-mind-map 从本地路径引入，确保其依赖（katex 等）可解析。

## Task 7: 前端登录/注册与鉴权体系
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 6
- **Description**:
  - 封装 `src/api/request.js`：axios 实例 + JWT 注入 + 401 跳转登录。
  - 封装 auth/user/team/file/ai API 模块。
  - Pinia store：`useUserStore`（token、userInfo、isLogin、login/logout/fetchProfile）。
  - 路由：`/login`、`/register`、`/dashboard`、`/edit`、`/profile`、`/teams`、`/ai-config`；全局守卫未登录跳转 `/login`。
  - 登录/注册页面：简洁现代卡片式布局，表单校验，提交 loading。
- **Acceptance Criteria Addressed**: AC-1, AC-10, AC-11
- **Test Requirements**:
  - `rule` TR-7.1: 未登录访问 `/dashboard` 跳转 `/login`。
  - `rule` TR-7.2: 登录成功跳转 dashboard，刷新保持登录态。
  - `rule` TR-7.3: 空密码提交被前端拦截。
  - `rubric` TR-7.4: 登录页视觉；scale 1-5；anchors 1=原生无样式 / 3=基础卡片粗糙 / 5=现代简洁有品牌感；threshold >= 4；evidence 截图。

## Task 8: 前端思维导图编辑器集成（移植核心库）
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 7
- **Description**:
  - 在 `myweb/` 创建编辑页 `/edit`，集成 `simple-mind-map` 核心库（注册所有插件：MiniMap、Drag、Export、Select、AssociativeLine、Formula、RainbowLines、Demonstrate、OuterFrame 等）。
  - 实现工具栏：节点操作、结构切换、主题、样式、搜索、大纲、导入（smm/json/xmind/md）、导出（png/svg/pdf/xmind/md/txt）。
  - 数据加载：根据路由 `source`（local/personal/team）+ `file`（id）从本地或后端加载 content，渲染画布。
  - 保留现有全部编辑、导入、导出能力。
- **Acceptance Criteria Addressed**: AC-12
- **Test Requirements**:
  - `rule` TR-8.1: 打开编辑页可正常渲染空白思维导图。
  - `rule` TR-8.2: 节点增删改、结构/主题切换正常。
  - `rule` TR-8.3: 导入 `.xmind`/`.md` 成功；导出 `png`/`svg`/`pdf` 成功。
  - `rule` TR-8.4: 打开云端文件时从后端获取 content 并正确渲染。
- **Notes**: 可参考原 `web/src/pages/Edit/` 组件移植到 Vue 3 组合式 API。

## Task 9: 前端工作台（文件管理）
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 8
- **Description**:
  - `/dashboard` 页面：顶部导航栏（品牌、当前用户、退出），主体三标签：本地文件 / 我的云文档 / 团队文档。
  - 本地文件：最近文件列表（localStorage 索引），按钮：新建空白图、打开本地 `.smm`、导入。
  - 我的云文档：调用列表接口，支持新建、重命名、删除、打开（跳转 `/edit?file=<id>&source=personal`）。
  - 团队文档：左侧团队列表，右侧团队文件列表，支持新建/打开/删除；标注协同标识。
- **Acceptance Criteria Addressed**: AC-3, AC-6, AC-11
- **Test Requirements**:
  - `rule` TR-9.1: 我的云文档列表与后端一致。
  - `rule` TR-9.2: 点击打开跳转 `/edit?file=<id>&source=personal`。
  - `rule` TR-9.3: 删除后列表刷新。
  - `rubric` TR-9.4: 工作台视觉；scale 1-5；anchors 1=拥挤无层次 / 3=可用但不美观 / 5=清晰现代卡片网格；threshold >= 4；evidence 截图。

## Task 10: 前端编辑页保存/另存为、实时协同与自动保存
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 9
- **Description**:
  - 编辑页顶部显示文件名与来源标签；团队文件显示在线成员数；显示保存状态指示器（保存中/已保存/保存失败）。
  - 保存按钮：personal/team 调用 `PUT /api/files/:id`。
  - "另存为"菜单：本地→个人云/团队云；个人云→本地/团队云；团队云→本地/个人云；另存为团队弹出团队选择。
  - **自动保存（防丢失）**：
    - 本地文件：`data_change` 后防抖 1.5s 写入本地文件句柄；同时写 localStorage 快照兜底；写入失败提示。
    - 云端个人文件：`data_change` 后防抖 2s 调用 `PUT /api/files/:id`；更新保存状态指示器；网络失败时入本地队列，`online` 事件后重试。
    - 团队文件：Yjs 协同实时同步，不额外前端保存（由后端节流落库）。
    - `beforeunload` 事件：存在未保存变更时返回提示字符串，触发浏览器原生确认。
  - 团队文件启用 `Cooperate` 插件：`y-websocket` WebsocketProvider 连接 `ws://<host>/ws`，房间名 `file-<id>`，设置用户信息；离开页面断连。
- **Acceptance Criteria Addressed**: AC-5, AC-6, AC-7, AC-7.1
- **Test Requirements**:
  - `rule` TR-10.1: 云端个人文件编辑后 2s 内自动调用保存接口，状态指示器显示"已保存"。
  - `rule` TR-10.2: 本地文件编辑后 1.5s 内写入文件；关闭浏览器再打开内容一致。
  - `rule` TR-10.3: 本地文件另存为个人云后工作台出现新文件。
  - `rule` TR-10.4: 两浏览器同时打开同一团队文件，一端修改另一端实时同步。
  - `rule` TR-10.5: 有未保存变更时关闭标签页弹出浏览器确认提示。
- **Notes**: 个人/本地文件不启用协同；仅团队文件启用 Cooperate 插件。保存队列与状态用独立 composable 管理。

## Task 11: 前端个人资料、团队管理、AI 配置与 AI 生成
- **Status**: `completed`
- **Priority**: medium
- **Depends On**: Task 10
- **Description**:
  - `/profile`：修改昵称、邮箱、上传头像（调用 `/api/user/avatar`）。
  - `/teams`：团队列表、创建团队、成员列表、邀请码生成与展示、退出/移除成员。
  - AI 配置页面：baseUrl、apiKey、model 输入，保存到 `/api/ai/config`。
  - 编辑页集成"AI 生成"与"AI 续写"：弹窗输入主题，调用 `/api/ai/chat`（流式），将返回的 Markdown/JSON 解析为思维导图结构并渲染。
- **Acceptance Criteria Addressed**: AC-2, AC-8, AC-9, FR-9
- **Test Requirements**:
  - `rule` TR-11.1: 修改昵称保存后再次进入显示新昵称。
  - `rule` TR-11.2: 创建团队、生成邀请码、加入流程通畅。
  - `rule` TR-11.3: AI 配置保存后可读取。
  - `rule` TR-11.4: AI 生成思维导图后端到端渲染出节点树。
- **Notes**: AI 返回内容约定为 Markdown 层级列表，前端解析为树结构。

## Task 12: UI 风格统一与易用性打磨
- **Status**: `completed`
- **Priority**: medium
- **Depends On**: Task 11
- **Description**:
  - 全局配色变量（主色、背景、卡片、文字层级），统一圆角/阴影/留白。
  - 优化编辑页工具栏视觉，与新页面风格协调。
  - 所有异步操作 loading + message 反馈。
  - Chrome/Edge 下无布局错乱。
- **Acceptance Criteria Addressed**: AC-11, FR-10
- **Test Requirements**:
  - `rubric` TR-12.1: 全局视觉一致性；scale 1-5；anchors 1=割裂 / 3=大体统一但粗糙 / 5=高度统一专业感强；threshold >= 4；evidence 多页面截图。
  - `rule` TR-12.2: 所有异步按钮有 loading，成功/失败有 message。

## Task 13: 端到端集成与构建验证
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 12
- **Description**:
  - 启动后端（3000）与前端 dev server，完成完整旅程：注册→登录→配置 AI→创建团队→邀请加入→新建个人云文件→AI 生成→另存为团队文件→双端协同编辑→导出本地。
  - 运行 `myweb` 生产构建（`npm run build`）成功。
  - 编写运行说明（前后端启动命令）。
- **Acceptance Criteria Addressed**: AC-1 ~ AC-12
- **Test Requirements**:
  - `rule` TR-13.1: 完整用户旅程无报错，各 AC 通过。
  - `rule` TR-13.2: `myweb` `npm run build` 成功。
  - `rule` TR-13.3: 运行说明清晰可执行。
