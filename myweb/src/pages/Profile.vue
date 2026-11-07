<template>
  <MainLayout>
    <div class="profile-page">
      <h2>个人资料</h2>
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
    </div>
  </MainLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import MainLayout from '@/layouts/MainLayout.vue'
import { user } from '@/api'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const form = ref({ username: '', nickname: '', email: '' })
const saving = ref(false)
const avatar = computed(() => userStore.userInfo?.avatar || '')
const initial = computed(() => (userStore.userInfo?.nickname || userStore.userInfo?.username || '?').charAt(0).toUpperCase())

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

onMounted(() => {
  const u = userStore.userInfo || {}
  form.value.username = u.username || ''
  form.value.nickname = u.nickname || ''
  form.value.email = u.email || ''
})
</script>

<style scoped>
.profile-page { max-width: 640px; margin: 0 auto; }
.profile-page h2 { margin: 0 0 16px; }
.form-card { padding: 28px; }
</style>
