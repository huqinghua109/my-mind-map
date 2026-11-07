<template>
  <MainLayout>
    <div class="teams-page">
      <div class="page-head">
        <h2>团队管理</h2>
        <el-button type="primary" @click="showCreate = true">＋ 创建团队</el-button>
      </div>
      <div v-if="teams.length === 0" class="empty card">暂无团队，点击右上角创建</div>
      <div v-else class="team-grid">
        <div v-for="t in teams" :key="t.id" class="team-card card">
          <div class="team-head">
            <span class="team-name">{{ t.name }}</span>
            <el-tag v-if="t.role === 'owner'" size="small" type="warning">所有者</el-tag>
            <el-tag v-else size="small">成员</el-tag>
          </div>
          <p class="team-desc">{{ t.description || '暂无描述' }}</p>
          <div class="team-actions">
            <el-button size="small" type="primary" @click="enterTeam(t)">文件</el-button>
            <el-button size="small" @click="viewMembers(t)">成员</el-button>
            <el-button size="small" @click="genInvite(t)">邀请码</el-button>
            <el-button v-if="t.role !== 'owner'" size="small" type="danger" @click="leaveTeam(t)">退出</el-button>
          </div>
        </div>
      </div>
      <div class="join-section card">
        <h3>加入团队</h3>
        <div class="join-row">
          <el-input v-model="joinCode" placeholder="输入 6 位邀请码" maxlength="6" style="width:200px" />
          <el-button type="primary" @click="joinTeam">加入</el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="showCreate" title="创建团队" width="420px">
      <el-form :model="createForm" label-width="70px">
        <el-form-item label="名称"><el-input v-model="createForm.name" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="createForm.description" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="createTeam">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showMembers" :title="currentTeam?.name + ' - 成员'" width="520px">
      <el-table :data="members" size="small">
        <el-table-column prop="nickname" label="昵称" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.role === 'owner'" type="warning" size="small">所有者</el-tag>
            <el-tag v-else size="small">成员</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="currentTeam?.role === 'owner'" label="操作" width="80">
          <template #default="{ row }">
            <el-button v-if="row.role !== 'owner'" size="small" text type="danger" @click="removeMember(row)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </MainLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import MainLayout from '@/layouts/MainLayout.vue'
import { teams as teamsApi } from '@/api'

const router = useRouter()

const teams = ref([])
const showCreate = ref(false)
const creating = ref(false)
const createForm = ref({ name: '', description: '' })
const joinCode = ref('')
const showMembers = ref(false)
const currentTeam = ref(null)
const members = ref([])

async function load() {
  const res = await teamsApi.list()
  teams.value = res.data.teams
}

async function createTeam() {
  if (!createForm.value.name) return ElMessage.warning('请输入团队名称')
  creating.value = true
  try {
    await teamsApi.create(createForm.value)
    ElMessage.success('创建成功')
    showCreate.value = false
    createForm.value = { name: '', description: '' }
    load()
  } finally {
    creating.value = false
  }
}

async function joinTeam() {
  if (!joinCode.value) return ElMessage.warning('请输入邀请码')
  await teamsApi.join(joinCode.value.toUpperCase())
  ElMessage.success('加入成功')
  joinCode.value = ''
  load()
}

async function viewMembers(t) {
  currentTeam.value = t
  const res = await teamsApi.members(t.id)
  members.value = res.data.members
  showMembers.value = true
}

async function removeMember(m) {
  await ElMessageBox.confirm(`移除成员「${m.nickname || m.username}」？`, '提示', { type: 'warning' })
  await teamsApi.removeMember(currentTeam.value.id, m.id)
  ElMessage.success('已移除')
  viewMembers(currentTeam.value)
}

async function genInvite(t) {
  const res = await teamsApi.invite(t.id)
  ElMessageBox.alert(`邀请码：<b style="font-size:18px;color:#4f7cff;letter-spacing:4px">${res.data.inviteCode}</b>`, '团队邀请码', {
    dangerouslyUseHTMLString: true,
    confirmButtonText: '复制并关闭'
  }).then(() => {
    navigator.clipboard?.writeText(res.data.inviteCode)
    ElMessage.success('已复制邀请码')
  })
}

async function leaveTeam(t) {
  await ElMessageBox.confirm(`确认退出团队「${t.name}」？`, '提示', { type: 'warning' })
  await teamsApi.leave(t.id)
  ElMessage.success('已退出')
  load()
}

function enterTeam(t) {
  router.push(`/dashboard?tab=team&team=${t.id}`)
}

onMounted(load)
</script>

<style scoped>
.teams-page { max-width: 1100px; margin: 0 auto; }
.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-head h2 { margin: 0; }
.empty { padding: 48px; text-align: center; color: var(--text-3); }
.team-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
.team-card { padding: 18px; }
.team-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.team-name { font-size: 16px; font-weight: 600; flex: 1; }
.team-desc { color: var(--text-2); font-size: 13px; margin: 0 0 12px; min-height: 18px; }
.team-actions { display: flex; gap: 8px; }
.join-section { padding: 20px; }
.join-section h3 { margin: 0 0 12px; }
.join-row { display: flex; gap: 10px; }
</style>
