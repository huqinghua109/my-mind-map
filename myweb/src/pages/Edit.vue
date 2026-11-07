<template>
  <div class="edit-page">
    <!-- 顶部栏 -->
    <header class="topbar">
      <div class="topbar-left">
        <el-button text @click="$router.push('/dashboard')">← 返回</el-button>
        <span class="file-name">{{ fileName }}</span>
        <el-tag :type="sourceTagType" size="small">{{ sourceLabel }}</el-tag>
        <span v-if="source === 'team'" class="online-users">
          <el-icon><Connection /></el-icon> {{ onlineCount }} 人在线
        </span>
      </div>
      <div class="topbar-right">
        <span class="save-status" :class="saveStatusClass">{{ saveStatusText }}</span>
        <el-dropdown @command="onSaveAs" trigger="click">
          <el-button>另存为 ▾</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="local">本地文件</el-dropdown-item>
              <el-dropdown-item command="personal">我的云文档</el-dropdown-item>
              <el-dropdown-item command="team">团队文档</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button v-if="source !== 'local'" type="primary" :loading="saving" @click="saveNow">保存</el-button>
      </div>
    </header>

    <!-- 工具栏 -->
    <div class="toolbar card">
      <div class="tool-group">
        <el-button size="small" @click="exec('undo')">↶ 撤销</el-button>
        <el-button size="small" @click="exec('redo')">↷ 重做</el-button>
      </div>
      <div class="tool-group">
        <el-button size="small" type="primary" @click="exec('insertChild')">子节点</el-button>
        <el-button size="small" @click="exec('insertBrother')">兄弟节点</el-button>
        <el-button size="small" @click="exec('removeNode')">删除</el-button>
      </div>
      <div class="tool-group">
        <el-select size="small" v-model="layout" @change="setLayout" style="width:120px">
          <el-option v-for="l in layouts" :key="l.value" :label="l.label" :value="l.value" />
        </el-select>
        <el-select size="small" v-model="theme" @change="setTheme" style="width:110px">
          <el-option v-for="t in themes" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
      </div>
      <div class="tool-group">
        <el-button size="small" @click="importFile">导入</el-button>
        <el-dropdown @command="onExport" trigger="click">
          <el-button size="small">导出 ▾</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="smm">.smm (JSON)</el-dropdown-item>
              <el-dropdown-item command="json">.json</el-dropdown-item>
              <el-dropdown-item command="png">.png 图片</el-dropdown-item>
              <el-dropdown-item command="svg">.svg</el-dropdown-item>
              <el-dropdown-item command="md">.md</el-dropdown-item>
              <el-dropdown-item command="xmind">.xmind</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <div class="tool-group">
        <el-button size="small" type="success" @click="showAi = true">✨ AI 生成</el-button>
      </div>
    </div>

    <!-- 画布 -->
    <div class="canvas-wrap">
      <div ref="mindMapRef" class="mind-map-container"></div>
    </div>

    <input ref="importInput" type="file" accept=".smm,.json,.xmind,.md" style="display:none" @change="onImport" />

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
      <template #footer>
        <el-button @click="showAi = false">取消</el-button>
        <el-button type="primary" :loading="aiLoading" @click="aiGenerate">生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Connection } from '@element-plus/icons-vue'
import MindMap from 'simple-mind-map/full'
import { WebsocketProvider } from 'y-websocket'
import DEFAULT_DATA from '@/utils/defaultData'
import { files, teams as teamsApi } from '@/api'
import { useUserStore } from '@/store/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const source = route.query.source || 'local'
const fileId = route.query.file ? Number(route.query.file) : null
const localKey = route.query.key
const isNew = route.query.new === '1'

const mindMapRef = ref()
const importInput = ref()
const mindMap = ref(null)
const fileName = ref('未命名思维导图')
const saving = ref(false)
const saveStatus = ref('saved') // saved | saving | unsaved | error
const showTeamSelect = ref(false)
const saveAsTarget = ref('')
const selectedTeamId = ref(null)
const myTeams = ref([])
const onlineCount = ref(1)

const showAi = ref(false)
const aiTopic = ref('')
const aiLoading = ref(false)

let cooperateProvider = null
let saveTimer = null
let lastSavedContent = ''

const layouts = [
  { label: '逻辑结构图', value: 'logicalStructure' },
  { label: '思维导图', value: 'mindMap' },
  { label: '组织结构图', value: 'organizationStructure' },
  { label: '目录组织图', value: 'catalogOrganization' },
  { label: '时间轴', value: 'timeline' },
  { label: '鱼骨图', value: 'fishbone' }
]
const themes = [
  { label: '默认', value: 'default' },
  { label: '经典', value: 'classic' },
  { label: '经典2', value: 'classic2' },
  { label: '深色', value: 'dark' },
  { label: '天空', value: 'sky' },
  { label: '清新', value: 'fresh' },
  { label: '热情', value: 'enthusiasm' }
]
const layout = ref('logicalStructure')
const theme = ref('default')

const sourceLabel = computed(() => ({ local: '本地', personal: '个人云', team: '团队云' }[source]))
const sourceTagType = computed(() => ({ local: 'info', personal: 'primary', team: 'success' }[source]))
const saveStatusText = computed(() => ({ saved: '已保存', saving: '保存中...', unsaved: '未保存', error: '保存失败' }[saveStatus.value]))
const saveStatusClass = computed(() => `status-${saveStatus.value}`)

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
  const content = JSON.stringify(getMindMapData())
  if (content === lastSavedContent) {
    saveStatus.value = 'saved'
    return
  }
  saveStatus.value = 'saving'
  try {
    if (source === 'local') {
      // 本地：存 localStorage 快照
      if (localKey) {
        sessionStorage.setItem('mindmap_open_' + localKey, content)
        localStorage.setItem('mindmap_snapshot_' + localKey, content)
      }
      // 尝试写入本地文件句柄（如果有）
      const handle = getLocalHandle()
      if (handle && handle.createWritable) {
        try {
          const writable = await handle.createWritable()
          await writable.write(content)
          await writable.close()
        } catch (e) { /* 忽略，已存 localStorage */ }
      }
      saveStatus.value = 'saved'
      lastSavedContent = content
    } else if (source === 'personal') {
      await files.update(fileId, { content })
      saveStatus.value = 'saved'
      lastSavedContent = content
    }
  } catch (e) {
    saveStatus.value = 'error'
  }
}

function getLocalHandle() {
  try {
    const raw = localStorage.getItem('mindmap_handle_' + localKey)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

async function saveNow() {
  if (saveTimer) clearTimeout(saveTimer)
  await doSave()
  if (saveStatus.value === 'saved') ElMessage.success('保存成功')
}

function getMindMapData() {
  return mindMap.value.getData()
}

async function onSaveAs(cmd) {
  if (cmd === 'local') {
    saveAsLocal()
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

function setLayout(v) {
  mindMap.value.setLayout(v)
}
function setTheme(v) {
  mindMap.value.setTheme(v)
}

function importFile() {
  importInput.value.value = ''
  importInput.value.click()
}

function onImport(e) {
  const f = e.target.files[0]
  if (!f) return
  const reader = new FileReader()
  reader.onload = () => {
    const ext = f.name.split('.').pop().toLowerCase()
    if (ext === 'smm' || ext === 'json') {
      try {
        const parsed = JSON.parse(reader.result)
        mindMap.value.setData(parsed.root || parsed)
        fileName.value = f.name.replace(/\.(smm|json)$/, '')
      } catch { ElMessage.error('文件解析失败') }
    } else if (ext === 'xmind') {
      mindMap.value.importXmind(reader.result)
      fileName.value = f.name.replace(/\.xmind$/, '')
    } else if (ext === 'md') {
      mindMap.value.importMarkdown(reader.result)
      fileName.value = f.name.replace(/\.md$/, '')
    }
  }
  if (f.name.toLowerCase().endsWith('.xmind')) reader.readAsArrayBuffer(f)
  else reader.readAsText(f)
}

function onExport(type) {
  try {
    if (type === 'smm' || type === 'json') {
      const content = JSON.stringify(getMindMapData(), null, 2)
      downloadBlob(content, (fileName.value || '思维导图') + '.' + type, 'application/json')
    } else if (type === 'png') {
      mindMap.value.exportPNG(false, (dataUrl) => downloadDataUrl(dataUrl, fileName.value + '.png'))
    } else if (type === 'svg') {
      mindMap.value.exportSVG(false, (str) => downloadBlob(str, fileName.value + '.svg', 'image/svg+xml'))
    } else if (type === 'md') {
      mindMap.value.exportMarkdown().then(str => downloadBlob(str, fileName.value + '.md', 'text/markdown'))
    } else if (type === 'xmind') {
      mindMap.value.exportXmind().then(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = fileName.value + '.xmind'; a.click()
        URL.revokeObjectURL(url)
      })
    }
  } catch (e) {
    ElMessage.error('导出失败：' + e.message)
  }
}

function downloadBlob(content, name, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}
function downloadDataUrl(dataUrl, name) {
  const a = document.createElement('a')
  a.href = dataUrl; a.download = name; a.click()
}

// ========== AI 生成 ==========
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
    mindMap.value.setData(data.root)
    ElMessage.success('生成成功')
    showAi.value = false
  } catch (e) {
    ElMessage.error('AI 生成失败：' + e.message)
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
    if (localKey) {
      const saved = sessionStorage.getItem('mindmap_open_' + localKey) ||
                    localStorage.getItem('mindmap_snapshot_' + localKey)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          data = parsed.root || parsed
        } catch { data = DEFAULT_DATA }
      }
      // 尝试从 localStorage 恢复文件名
      const list = JSON.parse(localStorage.getItem('mindmap_local_files') || '[]')
      const item = list.find(x => x.key === localKey)
      if (item) fileName.value = item.name.replace(/\.(smm|json)$/, '')
    } else if (isNew) {
      fileName.value = '未命名思维导图'
    }
  } else if (source === 'personal' || source === 'team') {
    const res = await files.detail(fileId)
    const f = res.data.file
    fileName.value = f.name
    if (f.content) {
      try {
        const parsed = JSON.parse(f.content)
        // getData() 返回 { root: {...} }，构造函数需要根节点本身
        data = parsed.root || parsed
      } catch { data = DEFAULT_DATA }
    }
  }

  lastSavedContent = JSON.stringify(data)
  mindMap.value = new MindMap({
    el: mindMapRef.value,
    data,
    layout: layout.value,
    theme: theme.value,
    enableFreeLine: true,
    enableNodeRichText: true
  })

  mindMap.value.on('data_change', markUnsaved)
  let rootActivated = false
  mindMap.value.on('node_tree_render_end', () => {
    // 首次渲染后激活根节点，否则"子节点"等按钮无效
    if (!rootActivated && mindMap.value.renderer?.root) {
      rootActivated = true
      mindMap.value.renderer.root.active()
    }
    // 团队协同：render 是异步的（setTimeout 0），data_change 触发时 renderTree 还没更新
    // 所以在渲染完成后手动同步数据到 Cooperate
    if (source === 'team' && mindMap.value.cooperate) {
      const data = mindMap.value.getData()
      if (data) {
        mindMap.value.cooperate.onDataChange(data)
      }
    }
  })
  mindMap.value.on('node_active', () => {})

  // 团队文件启用协同
  if (source === 'team') {
    const cooperate = mindMap.value.cooperate
    if (cooperate) {
      // 使用 Cooperate 内部的 ydoc 创建 provider
      const ydoc = cooperate.getDoc()
      const wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.hostname + ':3000/ws'
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
  if (saveStatus.value === 'unsaved' || saveStatus.value === 'saving') {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(async () => {
  window.addEventListener('beforeunload', onBeforeUnload)
  await init()
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (saveTimer) clearTimeout(saveTimer)
  if (cooperateProvider) cooperateProvider.destroy()
  if (mindMap.value) mindMap.value.destroy()
})
</script>

<style scoped>
.edit-page { height: 100vh; display: flex; flex-direction: column; background: var(--bg); }
.topbar {
  height: 56px; background: #fff; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between; padding: 0 20px;
}
.topbar-left { display: flex; align-items: center; gap: 12px; }
.file-name { font-size: 15px; font-weight: 600; }
.online-users { display: flex; align-items: center; gap: 4px; color: var(--text-2); font-size: 13px; }
.topbar-right { display: flex; align-items: center; gap: 12px; }
.save-status { font-size: 13px; }
.status-saved { color: #10b981; }
.status-saving { color: var(--primary); }
.status-unsaved { color: #f59e0b; }
.status-error { color: #ef4444; }
.toolbar {
  display: flex; align-items: center; gap: 12px; padding: 10px 20px;
  margin: 12px 20px 0; flex-wrap: wrap;
}
.tool-group { display: flex; gap: 6px; align-items: center; }
.canvas-wrap { flex: 1; margin: 12px 20px 20px; overflow: hidden; border-radius: var(--radius); background: #fff; box-shadow: var(--shadow); }
.mind-map-container { width: 100%; height: 100%; }
</style>
