import { defineStore } from 'pinia'
import { auth, user } from '@/api'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userInfo: JSON.parse(localStorage.getItem('userInfo') || 'null')
  }),
  getters: {
    isLogin: state => !!state.token,
    avatar: state => {
      if (!state.userInfo) return ''
      const a = state.userInfo.avatar
      return a ? (a.startsWith('http') ? a : a) : ''
    }
  },
  actions: {
    setAuth(token, userInfo) {
      this.token = token
      this.userInfo = userInfo
      localStorage.setItem('token', token)
      localStorage.setItem('userInfo', JSON.stringify(userInfo))
    },
    async login(form) {
      const res = await auth.login(form)
      this.setAuth(res.data.token, res.data.user)
      return res.data
    },
    async register(form) {
      const res = await auth.register(form)
      this.setAuth(res.data.token, res.data.user)
      return res.data
    },
    async fetchProfile() {
      const res = await user.profile()
      this.userInfo = res.data.user
      localStorage.setItem('userInfo', JSON.stringify(res.data.user))
      return res.data.user
    },
    logout() {
      this.token = ''
      this.userInfo = null
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
    }
  }
})
