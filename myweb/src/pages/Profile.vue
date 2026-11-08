<template>
  <MainLayout>
    <div class="profile-page">
      <h2>个人中心</h2>
      <el-tabs v-model="activeTab" class="profile-tabs">
        <el-tab-pane label="个人资料" name="profile">
          <div class="card form-card">
            <el-form :model="form" label-width="80px" size="large">
              <el-form-item label="头像">
                <el-avatar :size="72" :src="avatar">{{ initial }}</el-avatar>
                <el-upload
                  :show-file-list="false"
                  :before-upload="beforeUpload"
                  :http-request="uploadAvatar"
                  accept="image/*"
                  style="margin-left: 16px"
                >
                  <el-button>更换头像</el-button>
                </el-upload>
              </el-form-item>
              <el-form-item label="用户名">
                <el-input v-model="form.username" disabled />
              </el-form-item>
              <el-form-item label="昵称">
                <el-input v-model="form.nickname" />
              </el-form-item>
              <el-form-item label="邮箱">
                <el-input v-model="form.email" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="saving" @click="save">保存</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="AI 配置" name="ai">
          <div class="card form-card">
            <p class="desc">
              配置大模型接口以使用 AI 生成思维导图功能，兼容 OpenAI Chat Completions 格式。
              配置仅保存到当前登录账号，其他用户无法查看或使用你的 Key。
            </p>
            <el-alert
              v-if="aiLoaded && aiInfo.source === 'none'"
              type="warning"
              :closable="false"
              show-icon
              title="你还未配置 AI"
              description="请填写并保存你自己的 Base URL、API Key 和模型名称，否则 AI 生成功能不可用。"
              class="ai-alert"
            />
            <el-alert
              v-else-if="aiLoaded && aiInfo.source === 'system'"
              type="info"
              :closable="false"
              show-icon
              title="当前使用系统全局默认配置"
              description="你还没有保存个人配置，AI 调用会使用系统默认参数。保存下面的配置后将只对你的账号生效。"
              class="ai-alert"
            />
            <el-alert
              v-else-if="aiLoaded && aiInfo.source === 'user' && !aiInfo.configured"
              type="warning"
              :closable="false"
              show-icon
              title="个人 AI 配置不完整"
              description="请补齐 Base URL、API Key 和模型名称后再使用 AI 生成功能。"
              class="ai-alert"
            />
            <el-form :model="aiForm" label-width="100px" size="large">
              <el-form-item label="Base URL">
                <el-input v-model="aiForm.baseUrl" placeholder="例如：https://api.openai.com/v1" />
              </el-form-item>
              <el-form-item label="API Key">
                <el-input v-model="aiForm.apiKey" type="password" show-password placeholder="sk-..." />
                <div v-if="aiInfo.hasApiKey" class="tip">
                  {{
                    aiInfo.hasOwnApiKey
                      ? '已保存你的 API Key（留空则保留原配置）'
                      : '当前使用系统默认 API Key，填写并保存后将改为你的个人 Key'
                  }}
                </div>
              </el-form-item>
              <el-form-item label="模型名称">
                <el-input v-model="aiForm.model" placeholder="例如：gpt-4o" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="aiSaving" @click="saveAi">保存 AI 配置</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </MainLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import MainLayout from '@/layouts/MainLayout.vue'
import { user, ai } from '@/api'
import { useUserStore } from '@/store/user'

const route = useRoute()
const userStore = useUserStore()
const form = ref({ username: '', nickname: '', email: '' })
const saving = ref(false)
const activeTab = ref(route.query.tab === 'ai' ? 'ai' : 'profile')
const avatar = computed(() => userStore.userInfo?.avatar || '')
const initial = computed(() => (userStore.userInfo?.nickname || userStore.userInfo?.username || '?').charAt(0).toUpperCase())

const aiForm = ref({ baseUrl: '', apiKey: '', model: '' })
const aiSaving = ref(false)
const aiLoaded = ref(false)
const aiInfo = ref({ hasApiKey: false, hasOwnApiKey: false, configured: false, source: 'none' })

function beforeUpload(file) {
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('头像不能超过 2MB')
    return false
  }
  return true
}

async function uploadAvatar({ file }) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await user.uploadAvatar(fd)
  userStore.userInfo.avatar = res.data.avatar
  localStorage.setItem('userInfo', JSON.stringify(userStore.userInfo))
  ElMessage.success('头像更新成功')
}

async function save() {
  saving.value = true
  try {
    const res = await user.updateProfile({ nickname: form.value.nickname, email: form.value.email })
    userStore.userInfo = res.data.user
    localStorage.setItem('userInfo', JSON.stringify(res.data.user))
    ElMessage.success('保存成功')
  } finally {
    saving.value = false
  }
}

async function loadAi() {
  const res = await ai.getConfig()
  const data = res.data || {}
  aiForm.value.baseUrl = data.baseUrl || ''
  aiForm.value.model = data.model || ''
  aiInfo.value = {
    hasApiKey: !!data.hasApiKey,
    hasOwnApiKey: !!data.hasOwnApiKey,
    configured: !!data.configured,
    source: data.source || 'none'
  }
  aiLoaded.value = true
}

async function saveAi() {
  aiSaving.value = true
  try {
    await ai.saveConfig({
      baseUrl: aiForm.value.baseUrl,
      apiKey: aiForm.value.apiKey,
      model: aiForm.value.model
    })
    aiForm.value.apiKey = ''
    ElMessage.success('AI 配置已保存，仅对你的账号生效')
    await loadAi()
  } finally {
    aiSaving.value = false
  }
}

watch(
  () => route.query.tab,
  tab => {
    activeTab.value = tab === 'ai' ? 'ai' : 'profile'
  }
)

onMounted(() => {
  const u = userStore.userInfo || {}
  form.value.username = u.username || ''
  form.value.nickname = u.nickname || ''
  form.value.email = u.email || ''
  loadAi()
})
</script>

<style scoped>
.profile-page { max-width: 640px; margin: 0 auto; }
.profile-page h2 { margin: 0 0 16px; }
.form-card { padding: 28px; }
.desc { color: var(--text-2); margin: 0 0 16px; font-size: 13px; line-height: 1.6; }
.tip { color: var(--text-3); font-size: 12px; margin-top: 4px; }
.ai-alert { margin-bottom: 20px; }
</style>
