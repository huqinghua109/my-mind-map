import {
  ElMessage,
  ElNotification,
  ElMessageBox,
  ElLoading
} from 'element-plus'

// 兼容 element-ui 的 this.$message / $notify / $confirm / $loading 调用
export default {
  install(app) {
    const global = app.config.globalProperties
    global.$message = ElMessage
    global.$notify = ElNotification
    global.$confirm = ElMessageBox.confirm
    global.$alert = ElMessageBox.alert
    global.$prompt = ElMessageBox.prompt
    global.$msgbox = ElMessageBox
    global.$loading = ElLoading.service
  }
}
