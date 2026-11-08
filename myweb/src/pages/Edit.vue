<template>
  <div class="edit-page">
    <!-- 顶部栏：状态信息 + 工具栏合并为一行 -->
    <header class="topbar" ref="topbarRef">
      <div class="topbar-left">
        <el-button text class="btn-back" @click="$router.push('/dashboard')">← 返回</el-button>
        <el-input
          v-if="editingName"
          ref="nameInputRef"
          v-model="nameDraft"
          class="name-input"
          size="small"
          maxlength="50"
          :disabled="nameSaving"
          @keyup.enter="commitRename"
          @keyup.esc="cancelRename"
          @blur="commitRename"
        />
        <template v-else>
          <span class="file-name" :title="fileName">{{ fileName }}</span>
          <el-button class="name-edit-btn" text title="重命名" @click="startEditName">✎</el-button>
        </template>
        <el-tag class="source-tag" :type="sourceTagType" size="small">{{ sourceLabel }}</el-tag>
        <span v-if="source === 'team'" class="online-users">
          <el-icon><Connection /></el-icon> {{ onlineCount }} 人在线
        </span>
        <span class="save-status" :class="saveStatusClass" :title="saveStatusHint">{{ saveStatusText }}</span>
        <el-button v-if="localActionText" class="local-action" link type="primary" @click="onLocalAction">{{ localActionText }}</el-button>
      </div>

      <div class="toolbar">
        <div class="tool-group grp-history" data-group="history" v-show="!collapsed.has('history')">
          <el-button @click="exec('undo')"><el-icon><RefreshLeft /></el-icon>撤销</el-button>
          <el-button @click="exec('redo')"><el-icon><RefreshRight /></el-icon>前进</el-button>
        </div>
        <div class="tool-group grp-nodes" data-group="nodes" v-show="!collapsed.has('nodes')">
          <ToolbarNodeBtnList :list="nodeBtnList" />
        </div>
        <div class="tool-group grp-nodeops" data-group="nodeops" v-show="!collapsed.has('nodeops')">
          <el-button @click="exec('insertChild')"><el-icon><Plus /></el-icon>子节点</el-button>
          <el-button @click="exec('insertBrother')"><el-icon><DocumentAdd /></el-icon>兄弟节点</el-button>
          <el-button @click="exec('removeNode')"><el-icon><Delete /></el-icon>删除</el-button>
        </div>
        <div class="tool-group grp-export" data-group="export" v-show="!collapsed.has('export')">
          <el-dropdown @command="onExport" trigger="click">
            <el-button><el-icon><Download /></el-icon>导出 ▾</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="smm">.smm (JSON)</el-dropdown-item>
                <el-dropdown-item command="json">.json</el-dropdown-item>
                <el-dropdown-item command="png">.png 图片</el-dropdown-item>
                <el-dropdown-item command="svg">.svg</el-dropdown-item>
                <el-dropdown-item command="md">.md</el-dropdown-item>
                <el-dropdown-item command="txt">.txt</el-dropdown-item>
                <el-dropdown-item command="pdf">.pdf</el-dropdown-item>
                <el-dropdown-item command="xmind">.xmind</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div class="tool-group grp-ai" data-group="ai" v-show="!collapsed.has('ai')">
          <el-button @click="openAi"><el-icon><MagicStick /></el-icon>AI 生成</el-button>
        </div>
      </div>

      <div class="topbar-right">
        <el-dropdown class="grp-saveas" v-show="!collapsed.has('saveas')" @command="onSaveAs" trigger="click">
          <el-button><el-icon><DocumentCopy /></el-icon>另存为 ▾</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="local">本地文件</el-dropdown-item>
              <el-dropdown-item command="personal">我的云文档</el-dropdown-item>
              <el-dropdown-item command="team">团队文档</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button v-if="source !== 'local'" class="btn-save" :loading="saving" @click="saveNow"><el-icon><Check /></el-icon>保存</el-button>
        <el-popover v-model:visible="showMore" placement="bottom-end" :width="272" trigger="click" popper-class="edit-more-pop">
          <template #reference>
            <el-button class="more-btn" v-show="toolbarCollapsed"><el-icon><MoreFilled /></el-icon>更多 ▾</el-button>
          </template>
          <div class="more-panel">
            <div class="more-section">
              <div class="more-title">编辑</div>
              <div class="more-row">
                <el-button @click="exec('undo')"><el-icon><RefreshLeft /></el-icon>撤销</el-button>
                <el-button @click="exec('redo')"><el-icon><RefreshRight /></el-icon>前进</el-button>
              </div>
              <div class="more-row">
                <el-button @click="exec('insertChild')"><el-icon><Plus /></el-icon>子节点</el-button>
                <el-button @click="exec('insertBrother')"><el-icon><DocumentAdd /></el-icon>兄弟节点</el-button>
                <el-button @click="exec('removeNode')"><el-icon><Delete /></el-icon>删除</el-button>
              </div>
            </div>
            <div class="more-section">
              <div class="more-title">节点样式</div>
              <ToolbarNodeBtnList dir="v" :list="nodeBtnList" />
            </div>
            <div class="more-section">
              <div class="more-title">文件</div>
              <div class="more-row">
                <el-dropdown @command="onExport" trigger="click">
                  <el-button><el-icon><Download /></el-icon>导出 ▾</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="smm">.smm (JSON)</el-dropdown-item>
                      <el-dropdown-item command="json">.json</el-dropdown-item>
                      <el-dropdown-item command="png">.png 图片</el-dropdown-item>
                      <el-dropdown-item command="svg">.svg</el-dropdown-item>
                      <el-dropdown-item command="md">.md</el-dropdown-item>
                      <el-dropdown-item command="txt">.txt</el-dropdown-item>
                      <el-dropdown-item command="pdf">.pdf</el-dropdown-item>
                      <el-dropdown-item command="xmind">.xmind</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <el-dropdown @command="onSaveAs" trigger="click">
                  <el-button><el-icon><DocumentCopy /></el-icon>另存为 ▾</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="local">本地文件</el-dropdown-item>
                      <el-dropdown-item command="personal">我的云文档</el-dropdown-item>
                      <el-dropdown-item command="team">团队文档</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
            <div class="more-section">
              <el-button class="more-ai" @click="showMore = false; openAi()"><el-icon><MagicStick /></el-icon>AI 生成</el-button>
            </div>
          </div>
        </el-popover>
      </div>
    </header>

    <el-alert
      v-if="source === 'local' && !fsSupported"
      class="local-file-alert"
      type="warning"
      :closable="false"
      show-icon
      title="当前环境不支持自动写回本地文件"
      description="自动写回需要 HTTPS 或 localhost，并使用支持 File System Access API 的浏览器（Chrome / Edge 等）。修改会自动保存在浏览器本地草稿，可通过工具栏「导出」下载 .smm 文件保存到本地。"
    />

    <!-- 画布 -->
    <div class="canvas-wrap myweb-canvas-wrap">
      <MindMapEditor
        v-if="initialData"
        :data="initialData"
        @ready="onMindMapReady"
        @save="saveNow"
      />
    </div>

    <!-- 选择目标团队 -->
    <el-dialog v-model="showTeamSelect" title="选择目标团队" width="420px">
      <el-select v-model="selectedTeamId" placeholder="选择团队" style="width:100%">
        <el-option v-for="t in myTeams" :key="t.id" :label="t.name" :value="t.id" />
      </el-select>
      <template #footer>
        <el-button @click="showTeamSelect = false">取消</el-button>
        <el-button type="primary" @click="confirmSaveAsTeam">确定</el-button>
      </template>
    </el-dialog>

    <!-- AI 生成 -->
    <el-dialog v-model="showAi" title="AI 生成思维导图" width="560px">
      <el-input v-model="aiTopic" placeholder="请输入主题，例如：人工智能的发展历程" />
      <el-radio-group v-model="aiMode" style="margin-top: 14px">
        <el-radio label="append">追加到当前文档（默认）</el-radio>
        <el-radio label="overwrite">覆盖当前文档</el-radio>
      </el-radio-group>
      <div class="ai-mode-tip">
        追加：有选中节点时挂到该节点下，否则挂到根节点下；覆盖会清空当前画布内容。
      </div>
      <template #footer>
        <el-button @click="showAi = false">取消</el-button>
        <el-button type="primary" :loading="aiLoading" @click="aiGenerate">生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Connection, RefreshLeft, RefreshRight, Plus, DocumentAdd, Delete, Download,
  MagicStick, DocumentCopy, Check, MoreFilled
} from '@element-plus/icons-vue'
import MindMapEditor from '@/mindmap/MindMapEditor.vue'
import ToolbarNodeBtnList from '@/mindmap/components/ToolbarNodeBtnList.vue'
import { WebsocketProvider } from 'y-websocket'
import DEFAULT_DATA from '@/utils/defaultData'
import { files, teams as teamsApi, ai } from '@/api'
import { useUserStore } from '@/store/user'
import {
  isFileSystemAccessSupported,
  saveHandleRecord,
  getHandleRecord,
  getPermissionState,
  requestWritePermission,
  createHandleWriter,
  classifyWriteError
} from '@/utils/localFileHandle'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const source = route.query.source || 'local'
const fileId = route.query.file ? Number(route.query.file) : null
const localKey = ref(route.query.key || '')

const fsSupported = isFileSystemAccessSupported()
const localHandle = ref(null)
const handleWriter = createHandleWriter()
// 已成功写入本地文件的内容（区别于浏览器快照的 lastSavedContent）
let lastFileContent = ''
let needAuthNotified = false
let fileLostNotified = false
let writeErrorNotified = false

const mindMap = ref(null)
const initialData = ref(null)
const fileName = ref('未命名思维导图')
const editingName = ref(false)
const nameDraft = ref('')
const nameSaving = ref(false)
const nameInputRef = ref()
const MAX_NAME_LENGTH = 50
const saving = ref(false)
const saveStatus = ref('saved') // saved | saving | unsaved | error
const showTeamSelect = ref(false)
const saveAsTarget = ref('')
const selectedTeamId = ref(null)
const myTeams = ref([])
const onlineCount = ref(1)

const showAi = ref(false)
const aiTopic = ref('')
const aiMode = ref('append')
const aiLoading = ref(false)
const showMore = ref(false)

// 顶栏自适应收起：按真实可用宽度决定哪些工具进入「更多」
const topbarRef = ref(null)
const collapsedGroups = ref([])
const collapsed = computed(() => new Set(collapsedGroups.value))
const toolbarCollapsed = computed(() => collapsed.value.size > 0)
// 收起顺序：从右往左，优先级由低到高
const COLLAPSE_ORDER = ['saveas', 'ai', 'export', 'nodes', 'nodeops', 'history']
let measureRaf = 0
let topbarObserver = null

function scheduleMeasure() {
  if (measureRaf) return
  measureRaf = requestAnimationFrame(() => {
    measureRaf = 0
    applyToolbarLayout()
  })
}

function applyToolbarLayout() {
  const topbar = topbarRef.value
  if (!topbar) return
  const toolbar = topbar.querySelector('.toolbar')
  const left = topbar.querySelector('.topbar-left')
  if (!toolbar || !left) return

  const cs = getComputedStyle(topbar)
  const inner = topbar.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
  const topGap = parseFloat(cs.columnGap) || 0
  // 左侧信息按自然宽度计算，避免被压缩后误判「放得下」
  const leftWidth = Math.max(left.clientWidth, left.scrollWidth)

  const groups = [...toolbar.querySelectorAll('.tool-group')]
  const toolGap = parseFloat(getComputedStyle(toolbar).columnGap) || 0
  // 用绝对定位 + visibility:hidden 量取各分组在完全展开时的自然宽度
  groups.forEach(el => el.classList.add('tb-measure'))
  const widths = new Map(groups.map(el => [el.dataset.group, el.offsetWidth]))
  groups.forEach(el => el.classList.remove('tb-measure'))

  const saveas = topbar.querySelector('.grp-saveas')
  const save = topbar.querySelector('.btn-save')
  const more = topbar.querySelector('.more-btn')
  const rightEls = [saveas, save, more].filter(Boolean)
  rightEls.forEach(el => el.classList.add('tb-measure'))
  const rightWidth = {
    saveas: saveas ? saveas.offsetWidth : 0,
    save: save ? save.offsetWidth : 0,
    more: more ? more.offsetWidth : 0
  }
  rightEls.forEach(el => el.classList.remove('tb-measure'))

  const hidden = new Set()
  for (let i = 0; i <= COLLAPSE_ORDER.length; i++) {
    const moreVisible = hidden.size > 0
    const saveasVisible = !hidden.has('saveas')
    let right = 0
    let rightCount = 0
    if (saveasVisible && saveas) { right += rightWidth.saveas; rightCount++ }
    if (save) { right += rightWidth.save; rightCount++ }
    if (moreVisible) { right += rightWidth.more; rightCount++ }
    if (rightCount > 1) right += topGap * (rightCount - 1)

    const available = inner - leftWidth - topGap * 2 - right
    const visibleGroups = groups.filter(el => !hidden.has(el.dataset.group))
    const required = visibleGroups.reduce((sum, el) => sum + (widths.get(el.dataset.group) || 0), 0) +
      toolGap * Math.max(0, visibleGroups.length - 1)

    if (required <= available + 0.5) break
    const next = COLLAPSE_ORDER.find(k => !hidden.has(k))
    if (!next) break
    hidden.add(next)
  }

  const nextValue = [...hidden]
  if (nextValue.join(',') !== collapsedGroups.value.join(',')) {
    collapsedGroups.value = nextValue
    if (!nextValue.length) showMore.value = false
  }
}

let cooperateProvider = null
let saveTimer = null
let lastSavedContent = ''
// 个人云文档上次关闭前未来得及上传的本地草稿内容
let pendingContent = ''

const nodeBtnList = [
  'painter',
  'image',
  'icon',
  'link',
  'note',
  'tag',
  'summary',
  'associativeLine',
  'formula',
  'outerFrame'
]

const sourceLabel = computed(() => ({ local: '本地', personal: '个人云', team: '团队云' }[source]))
const sourceTagType = computed(() => ({ local: 'info', personal: 'primary', team: 'success' }[source]))
const saveStatusText = computed(() => {
  if (source === 'local') {
    switch (saveStatus.value) {
      case 'saved':
        return '已保存到本地文件'
      case 'saving':
        return '正在保存到本地文件…'
      case 'unsaved':
        return '未保存'
      case 'need-auth':
        return '需要重新授权'
      case 'no-handle':
        return '未关联文件'
      case 'missing':
        return '保存失败：文件不存在'
      case 'unsupported':
        return '当前环境不支持自动写回'
      default:
        return '保存失败'
    }
  }
  return { saved: '已保存', saving: '保存中...', unsaved: '未保存', error: '保存失败' }[saveStatus.value]
})
const saveStatusClass = computed(() => `status-${saveStatus.value}`)
const saveStatusHint = computed(() => {
  if (source !== 'local') return ''
  if (saveStatus.value === 'no-handle') {
    return '修改会自动保存在浏览器本地草稿中；点击「另存为本地文件」可关联真实文件并自动写回'
  }
  if (saveStatus.value === 'unsupported') {
    return '当前环境不支持自动写回，修改保存在浏览器本地草稿中，可通过「导出」下载保存'
  }
  if (saveStatus.value === 'need-auth') {
    return '浏览器要求重新授权后才能写回原文件，修改已保存在浏览器草稿中'
  }
  if (saveStatus.value === 'missing') {
    return '原文件已被移动或删除，修改已保存在浏览器草稿中，可「另存为本地文件」重新关联'
  }
  return ''
})
const localActionText = computed(() => {
  if (source !== 'local' || !fsSupported) return ''
  if (saveStatus.value === 'need-auth') return '重新授权'
  if (saveStatus.value === 'no-handle' || saveStatus.value === 'missing' || saveStatus.value === 'error') {
    return '另存为本地文件'
  }
  return ''
})

function markUnsaved() {
  if (source === 'team') return // 团队协同实时同步，不由前端保存
  saveStatus.value = 'unsaved'
  scheduleSave()
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  const delay = source === 'local' ? 1500 : 2000
  saveTimer = setTimeout(() => doSave(), delay)
}

async function doSave() {
  if (source === 'team') return
  let content
  try {
    content = JSON.stringify(getMindMapData())
  } catch (e) {
    saveStatus.value = 'error'
    return
  }
  if (source === 'local') {
    if (!localKey.value) return
    if (content !== lastSavedContent) {
      try {
        saveLocalSnapshot(content)
      } catch (e) {
        // 浏览器快照失败时仍继续尝试写回文件
      }
      lastSavedContent = content
    }
    await syncLocalFile(content)
    return
  }
  if (content === lastSavedContent) {
    saveStatus.value = 'saved'
    return
  }
  saveStatus.value = 'saving'
  try {
    if (source === 'personal') {
      await files.update(fileId, { content })
      // 服务端已保存，清除可能残留的关闭前草稿
      localStorage.removeItem('mindmap_pending_' + fileId)
      saveStatus.value = 'saved'
      lastSavedContent = content
    }
  } catch (e) {
    saveStatus.value = 'error'
  }
}

function getLocalFileList() {
  try {
    return JSON.parse(localStorage.getItem('mindmap_local_files') || '[]')
  } catch (e) {
    return []
  }
}

function updateLocalFileItem(patch) {
  if (!localKey.value) return
  const list = getLocalFileList()
  const item = list.find(x => x.key === localKey.value)
  if (item) {
    Object.assign(item, patch)
  } else {
    list.unshift({ key: localKey.value, name: fileName.value, time: Date.now(), ...patch })
  }
  try {
    localStorage.setItem('mindmap_local_files', JSON.stringify(list))
  } catch (e) {
    // 容量或隐私模式限制，忽略
  }
}

// 浏览器本地草稿始终先落盘，保证写文件失败时也不丢内容
function saveLocalSnapshot(content) {
  if (!localKey.value) return
  sessionStorage.setItem('mindmap_open_' + localKey.value, content)
  localStorage.setItem('mindmap_snapshot_' + localKey.value, content)
  updateLocalFileItem({ time: Date.now() })
}

// 新建或直接进入 /edit?source=local 时补齐文档标识，便于刷新后恢复句柄
function ensureLocalKey() {
  if (localKey.value) return
  const key = 'local_' + Date.now()
  localKey.value = key
  const list = getLocalFileList()
  if (!list.some(x => x.key === key)) {
    list.unshift({ key, name: fileName.value, time: Date.now() })
    try {
      localStorage.setItem('mindmap_local_files', JSON.stringify(list))
    } catch (e) {
      // 忽略
    }
  }
  try {
    router.replace({ path: route.path, query: { ...route.query, key } })
  } catch (e) {
    // 忽略
  }
}

async function syncLocalFile(content) {
  if (!fsSupported) {
    saveStatus.value = 'unsupported'
    return
  }
  if (!localHandle.value) {
    saveStatus.value = 'no-handle'
    return
  }
  if (content === lastFileContent) {
    if (!['need-auth', 'missing', 'error', 'saving'].includes(saveStatus.value)) {
      saveStatus.value = 'saved'
    }
    return
  }
  const permission = await getPermissionState(localHandle.value)
  if (permission === 'prompt' || permission === 'denied' || permission === 'none') {
    saveStatus.value = 'need-auth'
    notifyNeedAuth()
    return
  }
  await writeLocalContent(content)
}

async function writeLocalContent(content) {
  if (!localHandle.value || !fsSupported) return
  saveStatus.value = 'saving'
  try {
    await handleWriter.write(localHandle.value, content)
    lastFileContent = content
    saveStatus.value = 'saved'
    needAuthNotified = false
    fileLostNotified = false
    writeErrorNotified = false
  } catch (error) {
    handleWriteFailure(error)
  }
}

function handleWriteFailure(error) {
  const kind = classifyWriteError(error)
  if (kind === 'need-auth') {
    saveStatus.value = 'need-auth'
    notifyNeedAuth()
  } else if (kind === 'missing') {
    saveStatus.value = 'missing'
    notifyFileLost()
  } else {
    saveStatus.value = 'error'
    notifyWriteError(error)
  }
}

function notifyNeedAuth() {
  if (needAuthNotified) return
  needAuthNotified = true
  ElMessage.warning({
    message: '浏览器要求重新授权才能写回本地文件，请点击顶部「重新授权」。修改已保存在浏览器草稿中。',
    duration: 5000
  })
}

function notifyFileLost() {
  if (fileLostNotified) return
  fileLostNotified = true
  ElMessage.error({
    message: '原文件已被移动或删除，无法写回。修改已保存在浏览器草稿中，可点击「另存为本地文件」重新关联。',
    duration: 6000
  })
}

function notifyWriteError(error) {
  if (writeErrorNotified) return
  writeErrorNotified = true
  ElMessage.error('写回本地文件失败：' + ((error && error.message) || '未知错误') + '，修改已保存在浏览器草稿中')
}

// 用户点击「重新授权」：必须在点击手势内调用 requestPermission
async function requestLocalAuth() {
  if (!localHandle.value) {
    await associateLocalFile()
    return
  }
  if (!fsSupported) return
  const granted = await requestWritePermission(localHandle.value)
  if (!granted) {
    saveStatus.value = 'need-auth'
    ElMessage.warning('未能获得文件写入权限，修改仍保存在浏览器草稿中')
    return
  }
  needAuthNotified = false
  let content
  try {
    content = JSON.stringify(getMindMapData())
  } catch (e) {
    return
  }
  try {
    saveLocalSnapshot(content)
  } catch (e) {
    // 忽略快照异常
  }
  lastSavedContent = content
  await writeLocalContent(content)
  if (saveStatus.value === 'saved') {
    ElMessage.success('已重新授权，内容已写回本地文件')
  }
}

// 另存为本地文件：选择真实文件后建立句柄关联，之后自动写回
async function associateLocalFile() {
  if (!fsSupported) {
    saveAsLocal()
    ElMessage.warning('当前环境不支持自动写回，已下载本地副本')
    return
  }
  let handle
  try {
    const safeName = (fileName.value || '思维导图').replace(/[\\/:*?"<>|]/g, '_')
    handle = await window.showSaveFilePicker({
      suggestedName: safeName + '.smm',
      types: [
        {
          description: '思维导图文件',
          accept: {
            'application/json': ['.smm']
          }
        }
      ]
    })
  } catch (error) {
    if (error && error.name === 'AbortError') return
    ElMessage.error('另存为本地文件失败：' + ((error && error.message) || '请重试'))
    return
  }
  if (!handle) return
  ensureLocalKey()
  localHandle.value = handle
  let persisted = true
  try {
    await saveHandleRecord(localKey.value, handle, handle.name)
  } catch (e) {
    persisted = false
  }
  const baseName = handle.name.replace(/\.(smm|json)$/i, '')
  fileName.value = baseName
  updateLocalFileItem({ name: baseName, linkedFile: handle.name, time: Date.now() })
  needAuthNotified = false
  fileLostNotified = false
  writeErrorNotified = false
  let content
  try {
    content = JSON.stringify(getMindMapData())
  } catch (e) {
    content = ''
  }
  if (content) {
    try {
      saveLocalSnapshot(content)
    } catch (e) {
      // 忽略快照异常
    }
    lastSavedContent = content
    await writeLocalContent(content)
  }
  if (saveStatus.value === 'saved') {
    if (persisted) {
      ElMessage.success('已关联本地文件，后续修改会自动写回')
    } else {
      ElMessage.warning('已关联本地文件，但浏览器无法持久化文件句柄，刷新后需要重新关联')
    }
  }
}

function onLocalAction() {
  if (saveStatus.value === 'need-auth') requestLocalAuth()
  else associateLocalFile()
}

async function saveNow() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (source === 'local') {
    if (!fsSupported) {
      ElMessage.warning('当前环境不支持自动写回本地文件，请通过「导出」下载保存')
      return
    }
    if (!localHandle.value) {
      ElMessage.warning('当前文档未关联本地文件，请先点击「另存为本地文件」')
      return
    }
    if (saveStatus.value === 'need-auth') {
      await requestLocalAuth()
      return
    }
    await doSave()
    if (saveStatus.value === 'saved') ElMessage.success('已保存到本地文件')
    else if (saveStatus.value === 'missing') ElMessage.error('原文件不存在，无法写回')
    return
  }
  await doSave()
  if (saveStatus.value === 'saved') ElMessage.success('保存成功')
}

// 打开文档时补传上次关闭页面遗留的本地草稿
async function flushPendingDraft() {
  if (source !== 'personal' || !pendingContent) return
  const content = pendingContent
  pendingContent = ''
  try {
    await files.update(fileId, { content })
    lastSavedContent = content
    localStorage.removeItem('mindmap_pending_' + fileId)
    saveStatus.value = 'saved'
  } catch (e) {
    // 上传失败时保留草稿，下次打开继续重试
    pendingContent = content
  }
}

// 页面隐藏/关闭前的兜底保存：本地同步写 localStorage，个人云用 keepalive 请求 + 本地草稿
function flushSave() {
  if (source === 'team' || !mindMap.value) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  let content
  try {
    content = JSON.stringify(getMindMapData())
  } catch (e) {
    return
  }
  if (source !== 'local' && content === lastSavedContent) return

  if (source === 'local') {
    if (!localKey.value) return
    try {
      saveLocalSnapshot(content)
      lastSavedContent = content
    } catch (e) {
      saveStatus.value = 'error'
      return
    }
    // 页面隐藏时尽力写回；不在离开页面阶段请求授权或弹提示
    if (fsSupported && localHandle.value) {
      handleWriter.write(localHandle.value, content).then(() => {
        lastFileContent = content
        if (saveStatus.value === 'unsaved' || saveStatus.value === 'saving') {
          saveStatus.value = 'saved'
        }
      }).catch((error) => {
        // 页面隐藏阶段不弹提示，仅同步真实状态，等待下次交互重试
        const kind = classifyWriteError(error)
        if (kind === 'need-auth') {
          saveStatus.value = 'need-auth'
          needAuthNotified = false
        } else if (kind === 'missing') {
          saveStatus.value = 'missing'
          fileLostNotified = false
        } else {
          saveStatus.value = 'error'
          writeErrorNotified = false
        }
      })
    }
    return
  }

  if (source === 'personal') {
    // 先落本地草稿，保证 keepalive 请求失败时数据也不丢
    try {
      localStorage.setItem('mindmap_pending_' + fileId, JSON.stringify({ content, time: Date.now() }))
    } catch (e) { /* 忽略容量异常 */ }
    lastSavedContent = content
    saveStatus.value = 'saved'
    const token = localStorage.getItem('token')
    try {
      fetch('/api/files/' + fileId, {
        method: 'PUT',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {})
        },
        body: JSON.stringify({ content })
      }).then(res => {
        if (res.ok) localStorage.removeItem('mindmap_pending_' + fileId)
      }).catch(() => { /* 草稿已保留，下次打开自动补传 */ })
    } catch (e) { /* 忽略 */ }
  }
}

// ========== 文档重命名 ==========
function startEditName() {
  nameDraft.value = fileName.value
  editingName.value = true
  nextTick(() => nameInputRef.value && nameInputRef.value.focus())
}

function cancelRename() {
  editingName.value = false
  nameDraft.value = fileName.value
}

function renameLocalFile(name) {
  if (!localKey.value) return
  try {
    const list = JSON.parse(localStorage.getItem('mindmap_local_files') || '[]')
    const item = list.find(x => x.key === localKey.value)
    if (!item) return
    item.name = name
    item.time = Date.now()
    localStorage.setItem('mindmap_local_files', JSON.stringify(list))
  } catch (e) {
    throw new Error('本地文件名称写入失败')
  }
}

async function commitRename() {
  if (!editingName.value || nameSaving.value) return
  const name = nameDraft.value.trim()
  if (!name) {
    ElMessage.warning('文档名称不能为空')
    cancelRename()
    return
  }
  if (name.length > MAX_NAME_LENGTH) {
    ElMessage.warning(`文档名称不能超过 ${MAX_NAME_LENGTH} 个字符`)
    cancelRename()
    return
  }
  if (name === fileName.value) {
    cancelRename()
    return
  }
  nameSaving.value = true
  try {
    if (source === 'personal' || source === 'team') {
      await files.update(fileId, { name })
    } else {
      renameLocalFile(name)
    }
    fileName.value = name
    ElMessage.success('名称已更新')
  } catch (e) {
    ElMessage.error('重命名失败：' + (e && e.message ? e.message : '请稍后重试'))
    nameDraft.value = fileName.value
  } finally {
    nameSaving.value = false
    editingName.value = false
  }
}

function getMindMapData() {
  return mindMap.value.getData()
}

async function onSaveAs(cmd) {
  if (cmd === 'local') {
    if (source === 'local') {
      associateLocalFile()
    } else {
      saveAsLocal()
    }
  } else if (cmd === 'personal') {
    const { value } = await ElMessageBox.prompt('请输入文档名称', '另存为个人云文档', { inputValue: fileName.value })
    if (!value) return
    const res = await files.createPersonal({ name: value, content: JSON.stringify(getMindMapData()) })
    ElMessage.success('已保存到个人云文档')
    router.push(`/edit?source=personal&file=${res.data.file.id}`)
  } else if (cmd === 'team') {
    saveAsTarget.value = 'team'
    const res = await teamsApi.list()
    myTeams.value = res.data.teams
    showTeamSelect.value = true
  }
}

async function confirmSaveAsTeam() {
  if (!selectedTeamId.value) return ElMessage.warning('请选择团队')
  const { value } = await ElMessageBox.prompt('请输入文档名称', '另存为团队文档', { inputValue: fileName.value })
  if (!value) return
  const res = await teamsApi.createFile(selectedTeamId.value, { name: value, content: JSON.stringify(getMindMapData()) })
  ElMessage.success('已保存到团队文档')
  showTeamSelect.value = false
  router.push(`/edit?source=team&file=${res.data.file.id}`)
}

function saveAsLocal() {
  const content = JSON.stringify(getMindMapData(), null, 2)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (fileName.value || '思维导图') + '.smm'
  a.click()
  URL.revokeObjectURL(url)
}

function exec(cmd) {
  if (cmd === 'undo') mindMap.value.execCommand('BACK')
  else if (cmd === 'redo') mindMap.value.execCommand('FORWARD')
  else if (cmd === 'insertChild') mindMap.value.execCommand('INSERT_CHILD_NODE')
  else if (cmd === 'insertBrother') {
    const active = mindMap.value.renderer?.activeNodeList?.[0]
    if (!active) return ElMessage.warning('请先选中一个节点')
    if (active.isRoot) return ElMessage.warning('根节点不能添加兄弟节点，请先选中子节点')
    mindMap.value.execCommand('INSERT_NODE')
  }
  else if (cmd === 'removeNode') mindMap.value.execCommand('REMOVE_NODE')
}

async function onExport(type) {
  if (!mindMap.value) return
  try {
    // 引擎统一导出入口：export(type, isDownload, name, ...args)
    // 内部会生成文件并触发下载，出错时由 errorHandler 提示
    await mindMap.value.export(type, true, fileName.value || '思维导图')
  } catch (e) {
    ElMessage.error('导出失败：' + ((e && e.message) || '请稍后重试'))
  }
}

// ========== AI 生成 ==========
const AI_UNCONFIGURED_TIP = '未配置 AI 参数，请先配置'

function goAiConfig() {
  router.push({ path: '/profile', query: { tab: 'ai' } })
}

function promptAiConfig() {
  ElMessageBox.confirm(AI_UNCONFIGURED_TIP, 'AI 生成不可用', {
    confirmButtonText: '去配置',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(goAiConfig)
    .catch(() => {})
}

async function openAi() {
  // 每次打开都回到默认的追加模式，避免上次选择覆盖后误清空
  aiMode.value = 'append'
  // 未配置 AI 时直接引导去个人中心配置，避免填完主题才在后端失败
  try {
    const res = await ai.getConfig()
    if (!(res.data && res.data.configured)) {
      promptAiConfig()
      return
    }
  } catch (e) {
    // 配置读取失败时由请求拦截器统一提示
    return
  }
  showAi.value = true
}

async function aiGenerate() {
  if (!aiTopic.value.trim()) return ElMessage.warning('请输入主题')
  aiLoading.value = true
  try {
    const messages = [
      { role: 'system', content: '你是一个思维导图生成助手。请根据用户输入的主题，输出一个 Markdown 层级列表（使用 # 和 - 表示层级），不要输出其他文字。' },
      { role: 'user', content: aiTopic.value }
    ]
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + userStore.token },
      body: JSON.stringify({ messages, stream: false })
    })
    const json = await res.json()
    if (json.code !== 0) throw new Error(json.message || '生成失败')
    const text = json.data.choices?.[0]?.message?.content || ''
    // 解析 Markdown 为思维导图结构
    const data = parseMarkdownToMindMap(text, aiTopic.value)
    if (aiMode.value === 'append') {
      // 追加：有选中节点则挂到选中节点下，否则挂到根节点下
      const activeNodes = mindMap.value.renderer?.activeNodeList || []
      const target = activeNodes[0] || mindMap.value.renderer?.root
      if (!target) throw new Error('画布未就绪')
      // 单条命令插入整棵子树，历史记录中只占一步，可一次撤销
      mindMap.value.execCommand('INSERT_MULTI_CHILD_NODE', [target], [data.root])
    } else {
      mindMap.value.setData(data.root)
      mindMap.value.view.reset()
    }
    ElMessage.success(aiMode.value === 'append' ? '已追加到当前文档' : '已覆盖当前文档')
    showAi.value = false
  } catch (e) {
    if (e.message === AI_UNCONFIGURED_TIP) {
      showAi.value = false
      promptAiConfig()
    } else {
      ElMessage.error('AI 生成失败：' + e.message)
    }
  } finally {
    aiLoading.value = false
  }
}

function parseMarkdownToMindMap(md, topic) {
  const lines = md.split('\n').map(l => l.trim()).filter(Boolean)
  const root = { data: { text: topic }, children: [] }
  const stack = [{ node: root, level: -1 }]
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.*)$/) || line.match(/^(-|\*)\s+(.*)$/)
    if (!m) continue
    let level, text
    if (line.startsWith('#')) {
      level = (m[1].length)
      text = m[2]
    } else {
      level = 1
      text = m[2]
    }
    const node = { data: { text }, children: [] }
    while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop()
    stack[stack.length - 1].node.children.push(node)
    stack.push({ node, level })
  }
  return { root }
}

// ========== 初始化 ==========
async function init() {
  let data = DEFAULT_DATA
  if (source === 'local') {
    ensureLocalKey()
    let saved = null
    try {
      saved = sessionStorage.getItem('mindmap_open_' + localKey.value) ||
              localStorage.getItem('mindmap_snapshot_' + localKey.value)
    } catch (e) {
      saved = null
    }
    // 恢复文件名
    const item = getLocalFileList().find(x => x.key === localKey.value)
    if (item) fileName.value = item.name.replace(/\.(smm|json)$/, '')

    // 恢复文件句柄并检查权限
    if (fsSupported) {
      try {
        const record = await getHandleRecord(localKey.value)
        if (record && record.handle) {
          localHandle.value = record.handle
          // 没有浏览器快照时，直接从原文件读取内容
          if (!saved) {
            try {
              const file = await record.handle.getFile()
              saved = await file.text()
            } catch (e) {
              saved = null
            }
          }
          // 提前检测原文件是否已被移动/删除
          try {
            await record.handle.getFile()
          } catch (e) {
            if (e && e.name === 'NotFoundError') saveStatus.value = 'missing'
          }
          if (saveStatus.value !== 'missing') {
            const permission = await getPermissionState(record.handle)
            saveStatus.value =
              permission === 'prompt' || permission === 'denied' || permission === 'none'
                ? 'need-auth'
                : 'saved'
          }
        } else {
          saveStatus.value = 'no-handle'
        }
      } catch (e) {
        saveStatus.value = 'no-handle'
      }
    } else {
      saveStatus.value = 'unsupported'
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        data = parsed.root || parsed
      } catch (e) {
        data = DEFAULT_DATA
      }
    }
  } else if (source === 'personal' || source === 'team') {
    const res = await files.detail(fileId)
    const f = res.data.file
    fileName.value = f.name
    // 个人云文档：优先恢复上次关闭页面时尚未完成上传的本地草稿
    if (source === 'personal') {
      const pendingRaw = localStorage.getItem('mindmap_pending_' + fileId)
      if (pendingRaw) {
        try {
          const pending = JSON.parse(pendingRaw)
          if (pending && pending.content) {
            const parsedPending = JSON.parse(pending.content)
            data = parsedPending.root || parsedPending
            pendingContent = pending.content
          }
        } catch { pendingContent = '' }
      }
    }
    if (!pendingContent && f.content) {
      try {
        const parsed = JSON.parse(f.content)
        // getData() 返回 { root: {...} }，构造函数需要根节点本身
        data = parsed.root || parsed
      } catch { data = DEFAULT_DATA }
    }
  }

  lastSavedContent = JSON.stringify(data)
  if (source === 'local') lastFileContent = lastSavedContent
  initialData.value = data
}

// 引擎实例创建完成后的绑定
function onMindMapReady(instance) {
  mindMap.value = instance
  instance.on('data_change', markUnsaved)
  let rootActivated = false
  instance.on('node_tree_render_end', () => {
    // 首次渲染后激活根节点，否则"子节点"等按钮无效
    if (!rootActivated && instance.renderer?.root) {
      rootActivated = true
      instance.renderer.root.active()
    }
    // 团队协同：render 是异步的（setTimeout 0），data_change 触发时 renderTree 还没更新
    // 所以在渲染完成后手动同步数据到 Cooperate
    if (source === 'team' && instance.cooperate) {
      const data = instance.getData()
      if (data) {
        instance.cooperate.onDataChange(data)
      }
    }
  })
  instance.on('node_active', () => {})

  // 团队文件启用协同
  if (source === 'team') {
    const cooperate = instance.cooperate
    if (cooperate) {
      // 使用 Cooperate 内部的 ydoc 创建 provider
      const ydoc = cooperate.getDoc()
      // 同源 /ws：开发环境由 vite proxy 转发，生产环境由 nginx 反代到后端 3000 端口
      const wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws'
      cooperateProvider = new WebsocketProvider(
        wsUrl,
        'file-' + fileId,
        ydoc
      )
      const userId = String(userStore.userInfo?.id || Date.now())
      const userName = userStore.userInfo?.nickname || userStore.userInfo?.username || '用户'
      cooperate.setProvider(cooperateProvider)
      cooperate.setUserInfo({
        id: userId,
        name: userName,
        color: '#409EFF'
      })
      // 监听在线人数（通过 awareness 状态数）
      const updateOnline = () => {
        if (cooperateProvider.awareness) {
          onlineCount.value = cooperateProvider.awareness.getStates().size
        }
      }
      cooperateProvider.awareness.on('change', updateOnline)
      updateOnline()
    }
  }
}

// 页面关闭保护
function onBeforeUnload(e) {
  // 先兜底保存，避免防抖未触发就关闭导致数据丢失
  flushSave()
  if (saveStatus.value === 'unsaved' || saveStatus.value === 'saving') {
    e.preventDefault()
    e.returnValue = ''
  }
}

function onPageHide() {
  flushSave()
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') flushSave()
}

onMounted(async () => {
  window.addEventListener('beforeunload', onBeforeUnload)
  window.addEventListener('pagehide', onPageHide)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('resize', scheduleMeasure)
  if (typeof ResizeObserver !== 'undefined') {
    topbarObserver = new ResizeObserver(scheduleMeasure)
    if (topbarRef.value) topbarObserver.observe(topbarRef.value)
    const left = topbarRef.value && topbarRef.value.querySelector('.topbar-left')
    if (left) topbarObserver.observe(left)
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleMeasure)
  await nextTick()
  scheduleMeasure()
  await init()
  await flushPendingDraft()
  scheduleMeasure()
})

onBeforeUnmount(() => {
  flushSave()
  window.removeEventListener('beforeunload', onBeforeUnload)
  window.removeEventListener('pagehide', onPageHide)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('resize', scheduleMeasure)
  if (topbarObserver) {
    topbarObserver.disconnect()
    topbarObserver = null
  }
  if (measureRaf) {
    cancelAnimationFrame(measureRaf)
    measureRaf = 0
  }
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (cooperateProvider) cooperateProvider.destroy()
})
</script>

<style scoped>
.edit-page { height: 100vh; display: flex; flex-direction: column; background: var(--bg); }

/* 顶部：文档信息、保存状态、工具栏合并为一行 */
.topbar {
  height: 44px; min-height: 44px; background: #fff; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 8px; padding: 0 12px; flex-wrap: nowrap; overflow: hidden;
}
.topbar-left { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 0 1 auto; }
.btn-back { flex: none; }
.file-name { font-size: 14px; font-weight: 600; max-width: 220px; min-width: 40px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name-edit-btn { flex: none; }
.name-input { width: 180px; }
.source-tag { flex: none; }
.online-users { display: flex; align-items: center; gap: 4px; color: var(--text-2); font-size: 12px; white-space: nowrap; }
.save-status { font-size: 12px; white-space: nowrap; }
.local-action { flex: none; }

.toolbar { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex: 1 1 auto; min-width: 0; overflow: hidden; }
.tool-group { display: flex; align-items: center; gap: 6px; flex: none; }
/* 量取自然宽度：脱离文档流且不可见，避免影响当前布局 */
.tb-measure { position: absolute; visibility: hidden; pointer-events: none; display: flex !important; white-space: nowrap; }

/* 统一按钮尺寸：高度 26px、左右内边距 8px、字号 12px */
.topbar :deep(.el-button) { height: 26px; padding: 0 5px; font-size: 12px; border: none; background: transparent; border-radius: 4px; color: var(--text-1, #303133); gap: 4px; }
.topbar :deep(.el-button:hover), .topbar :deep(.el-button:focus) { background: #f5f5f5; color: var(--text-1, #303133); }
.topbar :deep(.el-button .el-icon) { font-size: 14px; margin: 0; }
.topbar :deep(.el-button + .el-button) { margin-left: 0; }
.topbar :deep(.el-button.is-text) { padding: 0 4px; }
.topbar :deep(.el-button.is-link) { height: 24px; padding: 0 2px; font-size: 12px; }
.topbar :deep(.el-tag) { height: 20px; padding: 0 6px; font-size: 11px; line-height: 18px; }
/* 节点样式图标按钮压缩，保证单行 44px 内不换行 */
.topbar :deep(.toolbarNodeBtnList) { gap: 0; }
.topbar :deep(.toolbarBtn) { flex-direction: row; align-items: center; height: 26px; margin-right: 4px; }
.topbar :deep(.toolbarBtn:last-of-type) { margin-right: 0; }
.topbar :deep(.toolbarBtn .icon) { height: 24px; padding: 0 2px; font-size: 14px; border: none; background: transparent; }
.topbar :deep(.toolbarBtn .text) { margin-top: 0; margin-left: 2px; font-size: 12px; line-height: 1; }

.topbar-right { display: flex; align-items: center; gap: 8px; margin-left: 0; flex: none; }

/* 「更多」面板（teleport 到 body，需单独定义按钮尺寸） */
.more-panel { display: flex; flex-direction: column; gap: 10px; max-height: 62vh; overflow-y: auto; }
.more-section { display: flex; flex-direction: column; gap: 6px; }
.more-title { font-size: 11px; color: var(--text-2); }
.more-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.more-row :deep(.el-button) { height: 26px; padding: 0 5px; font-size: 12px; margin-left: 0; border: none; background: transparent; border-radius: 4px; gap: 4px; }
.more-row :deep(.el-button:hover), .more-row :deep(.el-button:focus) { background: #f5f5f5; }
.more-row :deep(.el-button .el-icon) { font-size: 14px; margin: 0; }
.more-panel :deep(.toolbarBtn .icon) { border: none; background: transparent; }
.more-panel :deep(.toolbarBtn:hover:not(.disabled) .icon) { background: #f5f5f5; }
.more-panel :deep(.toolbarNodeBtnList.v) { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; width: 100%; }
.more-panel :deep(.toolbarNodeBtnList.v .toolbarBtn) { width: 100%; margin-bottom: 0; }
.more-row :deep(.el-dropdown) { flex: none; }

.status-saved { color: #10b981; }
.status-saving { color: var(--primary); }
.status-unsaved { color: #f59e0b; }
.status-error { color: #ef4444; }
.status-need-auth { color: #f59e0b; }
.status-no-handle { color: #909399; }
.status-unsupported { color: #f59e0b; }
.status-missing { color: #ef4444; }
.local-file-alert { margin: 8px 12px 0; }
.canvas-wrap { flex: 1; margin: 8px 12px 12px; overflow: hidden; border-radius: var(--radius); background: #fff; box-shadow: var(--shadow); }
.ai-mode-tip { margin-top: 6px; font-size: 12px; color: var(--text-2); line-height: 1.5; }

/* 工具栏收起由脚本按真实宽度计算（见 applyToolbarLayout），此处仅处理左侧信息在窄屏下的取舍 */
@media (max-width: 767px) {
  .source-tag, .online-users { display: none; }
  .file-name { max-width: 150px; }
  .name-input { width: 130px; }
}
@media (max-width: 599px) {
  .local-action { display: none; }
  .file-name { max-width: 110px; }
}
@media (max-width: 379px) {
  .save-status { display: none; }
}
</style>
