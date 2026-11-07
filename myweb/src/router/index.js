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
  { path: '/ai-config', component: () => import('@/pages/AiConfig.vue') }
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
