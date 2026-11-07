<template>
  <div class="layout">
    <header class="nav">
      <div class="nav-left">
        <router-link to="/dashboard" class="brand">🧠 思维导图</router-link>
        <nav class="nav-links">
          <router-link to="/dashboard" class="nav-link">工作台</router-link>
          <router-link to="/teams" class="nav-link">团队</router-link>
          <router-link to="/ai-config" class="nav-link">AI 配置</router-link>
        </nav>
      </div>
      <div class="nav-right">
        <el-dropdown @command="onCommand">
          <div class="user-info">
            <el-avatar :size="32" :src="avatar">{{ initial }}</el-avatar>
            <span class="username">{{ userStore.userInfo?.nickname || userStore.userInfo?.username }}</span>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">个人资料</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>
    <main class="content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const router = useRouter()
const initial = computed(() => (userStore.userInfo?.nickname || userStore.userInfo?.username || '?').charAt(0).toUpperCase())
const avatar = computed(() => {
  const a = userStore.userInfo?.avatar
  return a || ''
})

function onCommand(cmd) {
  if (cmd === 'profile') router.push('/profile')
  else if (cmd === 'logout') {
    userStore.logout()
    router.push('/login')
  }
}
</script>

<style scoped>
.layout { min-height: 100vh; display: flex; flex-direction: column; }
.nav {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.03);
}
.nav-left { display: flex; align-items: center; gap: 32px; }
.brand { font-size: 18px; font-weight: 600; color: var(--primary); text-decoration: none; }
.nav-links { display: flex; gap: 24px; }
.nav-link { color: var(--text-2); text-decoration: none; font-size: 14px; padding: 6px 2px; }
.nav-link.router-link-active { color: var(--primary); border-bottom: 2px solid var(--primary); }
.user-info { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.username { font-size: 14px; color: var(--text-1); }
.content { flex: 1; padding: 24px; }
</style>
