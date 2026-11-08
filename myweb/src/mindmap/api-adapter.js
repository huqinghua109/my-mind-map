// 官方组件中使用的本地持久化接口，在 myweb 中改为 localStorage 存储。
// 思维导图数据本身由 myweb 的自动保存流程负责，这里只保存视图与编辑器配置。

const VIEW_KEY = 'myweb_mindmap_view'
const CONFIG_KEY = 'myweb_mindmap_config'
const LOCAL_CONFIG_KEY = 'myweb_editor_config'

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch (e) {
    return fallback
  }
}

export function getData() {
  return {}
}

export function storeData(data) {
  if (!data) return
  if (data.view) {
    localStorage.setItem(VIEW_KEY, JSON.stringify(data.view))
  }
}

export function getConfig() {
  return readJSON(CONFIG_KEY, {})
}

export function storeConfig(data) {
  localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify({
      ...getConfig(),
      ...(data || {})
    })
  )
}

export function getLocalConfig() {
  return readJSON(LOCAL_CONFIG_KEY, null)
}

export function storeLocalConfig(data) {
  localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(data || {}))
}

export function getLang() {
  return 'zh'
}

export function storeLang() {}
