<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="brand">
        <div class="logo">🧠</div>
        <h1>注册账号</h1>
        <p class="subtitle">创建你的思维导图空间</p>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="onSubmit">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="email">
          <el-input v-model="form.email" placeholder="邮箱" :prefix-icon="Message" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码（至少6位）" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-button type="primary" class="submit-btn" :loading="loading" @click="onSubmit">注 册</el-button>
      </el-form>
      <div class="footer">
        已有账号？<router-link to="/login">去登录</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, Message } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'

const router = useRouter()
const userStore = useUserStore()
const formRef = ref()
const loading = ref(false)
const form = reactive({ username: '', email: '', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  email: [{ required: true, type: 'email', message: '请输入有效邮箱', trigger: 'blur' }],
  password: [{ required: true, min: 6, message: '密码至少 6 位', trigger: 'blur' }]
}

async function onSubmit() {
  await formRef.value.validate()
  loading.value = true
  try {
    await userStore.register(form)
    ElMessage.success('注册成功')
    router.push('/dashboard')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eef3ff 0%, #f5f7fb 100%);
}
.auth-card {
  width: 400px;
  padding: 40px 36px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(79, 124, 255, 0.12);
}
.brand { text-align: center; margin-bottom: 28px; }
.logo { font-size: 44px; }
.brand h1 { margin: 8px 0 4px; font-size: 22px; }
.subtitle { margin: 0; color: #9ca3af; font-size: 13px; }
.submit-btn { width: 100%; height: 44px; font-size: 15px; }
.footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 13px; }
.footer a { color: #4f7cff; text-decoration: none; }
</style>
