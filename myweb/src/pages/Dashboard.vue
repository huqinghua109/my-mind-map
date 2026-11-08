<template>
  <MainLayout>
    <div class="dashboard">
      <div class="page-head">
        <h2>我的工作台</h2>
      </div>
      <el-tabs v-model="activeTab" class="tabs">
        <!-- 本地文件 -->
        <el-tab-pane label="本地文件" name="local">
          <div class="actions">
            <el-button type="primary" @click="newLocal">＋ 新建空白图</el-button>
            <el-button @click="openLocalFile">打开本地 .smm</el-button>
            <el-button @click="importFile">导入文件</el-button>
          </div>
          <div v-if="localFiles.length === 0" class="empty">暂无本地文件</div>
          <div v-else class="file-grid">
            <div v-for="f in localFiles" :key="f.key" class="file-card card" @click="openLocal(f)">
              <div class="file-icon">🗺️</div>
              <div class="file-name" :title="f.name">{{ f.name }}</div>
              <div class="file-meta" :title="f.linkedFile ? '已关联：' + f.linkedFile : '修改保存在浏览器本地草稿中'">
                本地 · {{ f.linkedFile ? '已关联本地文件' : '浏览器草稿' }} · {{ formatTime(f.time) }}
              </div>
              <div class="file-actions">
                <el-button size="small" text @click.stop="removeLocal(f)">删除</el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 我的云文档 -->
        <el-tab-pane label="我的云文档" name="personal">
          <div class="actions">
            <el-button type="primary" @click="newPersonal">＋ 新建云文档</el-button>
          </div>
          <div v-if="loadingPersonal" class="empty">加载中...</div>
          <div v-else-if="personalFiles.length === 0" class="empty">暂无云文档</div>
          <div v-else class="file-grid">
            <div v-for="f in personalFiles" :key="f.id" class="file-card card" @click="openCloud(f, 'personal')">
              <div class="file-icon">☁️</div>
              <div class="file-name" :title="f.name">{{ f.name }}</div>
              <div class="file-meta">个人云 · {{ formatTime(f.updated_at) }}</div>
              <div class="file-actions">
                <el-button size="small" text @click.stop="renamePersonal(f)">重命名</el-button>
                <el-button size="small" text type="danger" @click.stop="deletePersonal(f)">删除</el-button>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- 团队文档 -->
        <el-tab-pane label="团队文档" name="team">
          <div class="team-layout">
            <div class="team-list card">
              <div class="team-list-head">
                <span>我的团队</span>
                <el-button size="small" type="primary" @click="showCreateTeam = true">＋ 新建</el-button>
              </div>
              <div v-for="t in myTeams" :key="t.id"
                   class="team-item" :class="{ active: selectedTeamId === t.id }"
                   @click="selectTeam(t.id)">
                <span class="team-name">{{ t.name }}</span>
                <el-tag v-if="t.role === 'owner'" size="small" type="warning">所有者</el-tag>
              </div>
              <div v-if="myTeams.length === 0" class="empty">暂无团队</div>
            </div>
            <div class="team-files card">
              <div v-if="!selectedTeamId" class="empty">请选择团队</div>
              <template v-else>
                <div class="actions">
                  <el-button type="primary" @click="newTeamFile">＋ 新建团队文档</el-button>
                </div>
                <div v-if="teamFiles.length === 0" class="empty">暂无文档</div>
                <div class="file-grid">
                  <div v-for="f in teamFiles" :key="f.id" class="file-card" @click="openCloud(f, 'team')">
                    <div class="file-icon">👥</div>
                    <div class="file-name" :title="f.name">{{ f.name }}</div>
                    <div class="file-meta">团队 · 可协同 · {{ formatTime(f.updated_at) }}</div>
                    <div class="file-actions">
                      <el-button size="small" text type="danger" @click.stop="deleteTeamFile(f)">删除</el-button>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 新建团队 -->
    <el-dialog v-model="showCreateTeam" title="创建团队" width="400px">
      <el-form :model="teamForm" label-width="70px">
        <el-form-item label="名称"><el-input v-model="teamForm.name" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="teamForm.description" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateTeam = false">取消</el-button>
        <el-button type="primary" :loading="creatingTeam" @click="createTeam">创建</el-button>
      </template>
    </el-dialog>

    <!-- 重命名 -->
    <el-dialog v-model="showRename" title="重命名" width="360px">
      <el-input v-model="renameName" placeholder="新名称" />
      <template #footer>
        <el-button @click="showRename = false">取消</el-button>
        <el-button type="primary" @click="confirmRename">确定</el-button>
      </template>
    </el-dialog>

    <input ref="fileInput" type="file" accept=".smm,.json,.xmind,.md" style="display:none" @change="onPickFile" />
  </MainLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import MainLayout from '@/layouts/MainLayout.vue'
import { files, teams as teamsApi } from '@/api'
import xmind from 'simple-mind-map/src/parse/xmind.js'
import markdown from 'simple-mind-map/src/parse/markdown.js'
import { isFileSystemAccessSupported, saveHandleRecord } from '@/utils/localFileHandle'

const router = useRouter()
const route = useRoute()
const activeTab = ref('local')
const fileInput = ref()
const showCreateTeam = ref(false)
const showRename = ref(false)
const renameName = ref('')
const renameId = ref(null)
const renameType = ref('')
const creatingTeam = ref(false)
const teamForm = ref({ name: '', description: '' })

const pickMode = ref('import')
const localFiles = ref([])
const personalFiles = ref([])
const loadingPersonal = ref(false)
const myTeams = ref([])
const selectedTeamId = ref(null)
const teamFiles = ref([])

const LOCAL_KEY = 'mindmap_local_files'

function loadLocal() {
  try {
    localFiles.value = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')
  } catch { localFiles.value = [] }
}
function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(localFiles.value))
}

function formatTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString()
}

function newLocal() {
  router.push('/edit?source=local&new=1')
}

function stripExt(name) {
  return name.replace(/\.(smm|json|xmind|md)$/i, '')
}

function triggerFileInput() {
  fileInput.value.value = ''
  fileInput.value.click()
}

function openLocalFile() {
  if (!isFileSystemAccessSupported()) {
    pickMode.value = 'open'
    ElMessage.warning('当前环境不支持自动写回本地文件（需要 HTTPS 或 localhost）。将以浏览器本地草稿打开，修改可通过导出下载保存。')
    triggerFileInput()
    return
  }
  pickLocalFileWithHandle()
}

// 使用 File System Access API 直接打开本地文件，并持久化文件句柄以便自动写回
async function pickLocalFileWithHandle() {
  let handle = null
  try {
    const handles = await window.showOpenFilePicker({
      types: [
        {
          description: '思维导图文件',
          accept: {
            'application/json': ['.smm', '.json']
          }
        }
      ],
      excludeAcceptAllOption: true,
      multiple: false
    })
    handle = handles && handles[0]
  } catch (error) {
    if (error && error.name === 'AbortError') return
    ElMessage.error('打开本地文件失败：' + ((error && error.message) || '请重试'))
    return
  }
  if (!handle) return
  try {
    const file = await handle.getFile()
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (ext !== 'smm' && ext !== 'json') {
      throw new Error('请选择 .smm 或 .json 思维导图文件')
    }
    const parsed = JSON.parse(await file.text())
    const data = parsed && parsed.root ? parsed.root : parsed
    if (!data || typeof data !== 'object') {
      throw new Error('文件内容为空或无法解析')
    }
    const key = 'local_' + Date.now()
    const content = JSON.stringify(data)
    sessionStorage.setItem('mindmap_open_' + key, content)
    localStorage.setItem('mindmap_snapshot_' + key, content)
    let linked = true
    try {
      await saveHandleRecord(key, handle, file.name)
    } catch (error) {
      linked = false
    }
    localFiles.value.unshift({
      key,
      name: stripExt(file.name),
      time: Date.now(),
      linkedFile: linked ? file.name : null
    })
    saveLocal()
    router.push('/edit?source=local&key=' + key)
    if (linked) ElMessage.success('已打开本地文件，编辑将自动写回')
    else ElMessage.warning('已打开文件，但浏览器无法保存文件句柄，刷新后需要重新关联')
  } catch (error) {
    ElMessage.error('打开本地文件失败：' + ((error && error.message) || '请重试'))
  }
}

function importFile() {
  pickMode.value = 'import'
  triggerFileInput()
}

function readFile(file, asBuffer) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'))
    if (asBuffer) reader.readAsArrayBuffer(file)
    else reader.readAsText(file)
  })
}

async function onPickFile(e) {
  const f = e.target.files[0]
  if (!f) return
  const ext = (f.name.split('.').pop() || '').toLowerCase()
  const mode = pickMode.value
  if (mode === 'open' && ext !== 'smm' && ext !== 'json') {
    ElMessage.warning('请选择 .smm 或 .json 思维导图文件')
    return
  }
  try {
    let data
    if (ext === 'xmind') {
      data = await xmind.parseXmindFile(await readFile(f, true), content => {
        if (Array.isArray(content) && content.length > 1) {
          ElMessage.info('该 XMind 文件包含多个画布，已取第一个导入')
        }
        return Array.isArray(content) ? content[0] : content
      })
    } else if (ext === 'md') {
      data = markdown.transformMarkdownTo(await readFile(f, false))
    } else if (ext === 'smm' || ext === 'json') {
      const parsed = JSON.parse(await readFile(f, false))
      data = parsed && parsed.root ? parsed.root : parsed
    } else {
      throw new Error('不支持的文件格式')
    }
    if (!data || typeof data !== 'object') {
      throw new Error('文件内容为空或无法解析')
    }
    const key = 'local_' + Date.now()
    const item = {
      key,
      name: stripExt(f.name),
      time: Date.now(),
      linkedFile: null
    }
    // 导入内容作为一份新的本地文档，编辑页只负责打开，不再提供导入入口
    const content = JSON.stringify(data)
    sessionStorage.setItem('mindmap_open_' + key, content)
    localStorage.setItem('mindmap_snapshot_' + key, content)
    localFiles.value.unshift(item)
    saveLocal()
    router.push('/edit?source=local&key=' + key)
    if (mode === 'open') {
      ElMessage.success('已作为浏览器本地草稿打开')
    } else {
      ElMessage.success('导入成功，可在编辑页点击「另存为本地文件」关联到真实文件')
    }
  } catch (err) {
    ElMessage.error('导入失败：' + ((err && err.message) || '文件解析失败'))
  }
}

function openLocal(f) {
  router.push('/edit?source=local&key=' + f.key)
}

function removeLocal(f) {
  localFiles.value = localFiles.value.filter(x => x.key !== f.key)
  saveLocal()
}

async function loadPersonal() {
  loadingPersonal.value = true
  try {
    const res = await files.personalList()
    personalFiles.value = res.data.files
  } finally {
    loadingPersonal.value = false
  }
}

async function newPersonal() {
  let value = ''
  try {
    const res = await ElMessageBox.prompt('请输入文档名称', '新建云文档', { inputValue: '未命名思维导图' })
    value = res.value
  } catch (e) {
    return
  }
  if (!value) {
    return
  }
  const res = await files.createPersonal({ name: value, content: '' })
  ElMessage.success('创建成功')
  personalFiles.value.unshift(res.data.file)
  router.push(`/edit?source=personal&file=${res.data.file.id}`)
}

function renamePersonal(f) {
  renameId.value = f.id
  renameType.value = 'personal'
  renameName.value = f.name
  showRename.value = true
}

async function confirmRename() {
  if (!renameName.value) return
  await files.update(renameId.value, { name: renameName.value })
  ElMessage.success('已重命名')
  showRename.value = false
  if (renameType.value === 'personal') loadPersonal()
  else loadTeamFiles()
}

async function deletePersonal(f) {
  await ElMessageBox.confirm(`确认删除「${f.name}」？`, '提示', { type: 'warning' })
  await files.remove(f.id)
  ElMessage.success('已删除')
  personalFiles.value = personalFiles.value.filter(x => x.id !== f.id)
}

function openCloud(f, source) {
  router.push(`/edit?source=${source}&file=${f.id}`)
}

async function loadTeams() {
  const res = await teamsApi.list()
  myTeams.value = res.data.teams
}

async function selectTeam(id) {
  selectedTeamId.value = id
  loadTeamFiles()
}

async function loadTeamFiles() {
  if (!selectedTeamId.value) return
  const res = await teamsApi.teamFiles(selectedTeamId.value)
  teamFiles.value = res.data.files
}

async function createTeam() {
  if (!teamForm.value.name) return ElMessage.warning('请输入团队名称')
  creatingTeam.value = true
  try {
    await teamsApi.create(teamForm.value)
    ElMessage.success('创建成功')
    showCreateTeam.value = false
    teamForm.value = { name: '', description: '' }
    loadTeams()
  } finally {
    creatingTeam.value = false
  }
}

async function newTeamFile() {
  let value = ''
  try {
    const res = await ElMessageBox.prompt('请输入文档名称', '新建团队文档', { inputValue: '未命名思维导图' })
    value = res.value
  } catch (e) {
    return
  }
  if (!value) {
    return
  }
  const res = await teamsApi.createFile(selectedTeamId.value, { name: value, content: '' })
  ElMessage.success('创建成功')
  teamFiles.value.unshift(res.data.file)
  router.push(`/edit?source=team&file=${res.data.file.id}`)
}

async function deleteTeamFile(f) {
  await ElMessageBox.confirm(`确认删除「${f.name}」？`, '提示', { type: 'warning' })
  await files.remove(f.id)
  ElMessage.success('已删除')
  teamFiles.value = teamFiles.value.filter(x => x.id !== f.id)
}

onMounted(async () => {
  loadLocal()
  loadPersonal()
  await loadTeams()
  if (route.query.tab === 'team') {
    activeTab.value = 'team'
    const tid = Number(route.query.team)
    if (tid && myTeams.value.some(t => t.id === tid)) {
      selectTeam(tid)
    }
  }
})
</script>

<style scoped>
.dashboard { max-width: 1200px; margin: 0 auto; }
.page-head h2 { margin: 0 0 16px; font-size: 22px; }
.tabs :deep(.el-tabs__content) { padding-top: 16px; }
.actions { display: flex; gap: 10px; margin-bottom: 16px; }
.empty { padding: 48px 0; text-align: center; color: var(--text-3); font-size: 14px; }
.file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.file-card { padding: 18px; cursor: pointer; transition: transform .15s, box-shadow .15s; }
.file-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.08); }
.file-icon { font-size: 32px; margin-bottom: 8px; }
.file-name { font-size: 14px; font-weight: 600; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-meta { font-size: 12px; color: var(--text-3); margin: 6px 0; }
.file-actions { display: flex; gap: 8px; margin-top: 8px; }
.team-layout { display: flex; gap: 16px; }
.team-list { width: 260px; padding: 12px; flex-shrink: 0; }
.team-list-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-weight: 600; }
.team-item { padding: 10px 12px; border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
.team-item:hover { background: var(--primary-light); }
.team-item.active { background: var(--primary-light); color: var(--primary); }
.team-files { flex: 1; padding: 16px; min-height: 400px; }
</style>
