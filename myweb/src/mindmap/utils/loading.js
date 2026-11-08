import { ElLoading } from 'element-plus'

let loadingInstance = null

export function showLoading() {
  if (loadingInstance) return
  loadingInstance = ElLoading.service({
    lock: true,
    text: '加载中...',
    background: 'rgba(0, 0, 0, 0.2)'
  })
}

export function hideLoading() {
  if (loadingInstance) {
    loadingInstance.close()
    loadingInstance = null
  }
}
