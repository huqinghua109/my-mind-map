<template>
  <MainLayout>
    <div class="ai-config-page">
      <h2>AI 配置</h2>
      <p class="desc">配置大模型接口以使用 AI 生成思维导图功能。兼容 OpenAI Chat Completions 格式。</p>
      <div class="card form-card">
        <el-form :model="form" label-width="100px" size="large">
          <el-form-item label="Base URL">
            <el-input v-model="form.baseUrl" placeholder="例如：https://api.openai.com/v1" />
          </el-form-item>
          <el-form-item label="API Key">
            <el-input v-model="form.apiKey" type="password" show-password placeholder="sk-..." />
            <div v-if="hasKey" class="tip">已配置 API Key（留空则保留原配置）</div>
          </el-form-item>
          <el-form-item label="模型名称">
            <el-input v-model="form.model" placeholder="例如：gpt-4o" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </MainLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import MainLayout from '@/layouts/MainLayout.vue'
import { ai } from '@/api'

const form = ref({ baseUrl: '', apiKey: '', model: '' })
const saving = ref(false)
const hasKey = ref(false)

async function load() {
  const res = await ai.getConfig()
  form.value.baseUrl = res.data.baseUrl || ''
  form.value.model = res.data.model || ''
  hasKey.value = res.data.hasApiKey
}

async function save() {
  saving.value = true
  try {
    await ai.saveConfig({
      baseUrl: form.value.baseUrl,
      apiKey: form.value.apiKey,
      model: form.value.model
    })
    ElMessage.success('保存成功')
    load()
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.ai-config-page { max-width: 640px; margin: 0 auto; }
.ai-config-page h2 { margin: 0 0 8px; }
.desc { color: var(--text-2); margin: 0 0 16px; font-size: 13px; }
.form-card { padding: 28px; }
.tip { color: var(--text-3); font-size: 12px; margin-top: 4px; }
</style>
