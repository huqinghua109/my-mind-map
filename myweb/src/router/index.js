import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/store/user'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: () => import('@/pages/Login.vue'), meta: { public: true } },
  { path: '/register', component: () => import('@/pages/Register.vue'), meta: { public: true } },
  { path: '/dashboard', component: () => import('@/pages/Dashboard.vue') },
  { path: '/edit', component: () => import('@/pages/Edit.vue') },
  { path: '/profile', component: () => import('@/pages/Profile.vue') },
  { path: '/teams', component: () => import('@/pages/Teams.vue') },
  // 旧地址兼容：AI 配置已并入个人中心
  { path: '/ai-config', redirect: () => ({ path: '/profile', query: { tab: 'ai' } }) }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  if (to.meta.public || userStore.isLogin) return next()
  next('/login')
})

export default router
