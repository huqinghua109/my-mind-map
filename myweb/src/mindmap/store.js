import { reactive } from 'vue'
import { defineStore } from 'pinia'

const CONFIG_KEY = 'myweb_editor_config'

function readLocalConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}')
  } catch (e) {
    return {}
  }
}

export const defaultLocalConfig = {
  isZenMode: false,
  openNodeRichText: true,
  useLeftKeySelectionRightKeyDrag: false,
  isShowScrollbar: false,
  isDark: false,
  enableAi: true
}

export const useEditorStore = defineStore('editor', {
  state: () => ({
    localConfig: {
      ...defaultLocalConfig,
      ...readLocalConfig()
    },
    activeSidebar: '',
    isReadonly: false,
    isOutlineEdit: false,
    extraTextOnExport: '',
    extendThemeGroupList: [],
    bgList: []
  }),
  actions: {
    setLocalConfig(data) {
      Object.keys(data).forEach(key => {
        this.localConfig[key] = data[key]
      })
      localStorage.setItem(CONFIG_KEY, JSON.stringify(this.localConfig))
    },
    setActiveSidebar(data) {
      this.activeSidebar = data
    },
    setIsReadonly(data) {
      this.isReadonly = data
    },
    setIsOutlineEdit(data) {
      this.isOutlineEdit = data
    },
    setExtraTextOnExport(data) {
      this.extraTextOnExport = data
    },
    setExtendThemeGroupList(data) {
      this.extendThemeGroupList = data
    },
    setBgList(data) {
      this.bgList = data
    }
  }
})

// 供 mapState/mapMutations 在组件定义期访问
let editorStore = null

export function setEditorStore(store) {
  editorStore = store
}

function getStore() {
  if (!editorStore) {
    throw new Error('editor store 尚未初始化')
  }
  return editorStore
}

// 兼容 Vuex 的 mapState
export function mapState(obj) {
  const res = {}
  Object.keys(obj).forEach(key => {
    res[key] = function () {
      return obj[key].call(this, getStore())
    }
  })
  return res
}

// 兼容 Vuex 的 mapMutations
export function mapMutations(list) {
  const res = {}
  list.forEach(name => {
    res[name] = function (...args) {
      const store = getStore()
      if (typeof store[name] === 'function') {
        return store[name](...args)
      }
      return store.$patch(payload => {
        payload[name] = args[0]
      })
    }
  })
  return res
}

export const editorState = reactive({})
