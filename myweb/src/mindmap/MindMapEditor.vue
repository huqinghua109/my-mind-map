<template>
  <div
    class="mindmap-editor"
    @dragover.stop.prevent
    @drop.stop.prevent
  >
    <div ref="containerRef" class="mind-map-container"></div>

    <template v-if="mindMap">
      <Count :mindMap="mindMap" v-if="!isZenMode"></Count>
      <Navigator :mindMap="mindMap"></Navigator>
      <NavigatorToolbar :mindMap="mindMap" v-if="!isZenMode"></NavigatorToolbar>
      <OutlineSidebar :mindMap="mindMap"></OutlineSidebar>
      <Style v-if="!isZenMode" :mindMap="mindMap"></Style>
      <BaseStyle :data="mindMapData" :configData="mindMapConfig" :mindMap="mindMap"></BaseStyle>
      <AssociativeLineStyle :mindMap="mindMap"></AssociativeLineStyle>
      <Theme :data="mindMapData" :mindMap="mindMap"></Theme>
      <Structure :mindMap="mindMap"></Structure>
      <ShortcutKey></ShortcutKey>
      <Contextmenu :mindMap="mindMap"></Contextmenu>
      <RichTextToolbar :mindMap="mindMap"></RichTextToolbar>
      <NodeNoteContentShow :mindMap="mindMap"></NodeNoteContentShow>
      <NodeImgPreview :mindMap="mindMap"></NodeImgPreview>
      <SidebarTrigger v-if="!isZenMode"></SidebarTrigger>
      <Search :mindMap="mindMap"></Search>
      <NodeIconSidebar :mindMap="mindMap"></NodeIconSidebar>
      <NodeIconToolbar :mindMap="mindMap"></NodeIconToolbar>
      <OutlineEdit :mindMap="mindMap"></OutlineEdit>
      <Scrollbar v-if="isShowScrollbar" :mindMap="mindMap"></Scrollbar>
      <FormulaSidebar :mindMap="mindMap"></FormulaSidebar>
      <NodeOuterFrame :mindMap="mindMap"></NodeOuterFrame>
      <NodeTagStyle :mindMap="mindMap"></NodeTagStyle>
      <Setting :configData="mindMapConfig" :mindMap="mindMap"></Setting>
      <NodeImgPlacementToolbar :mindMap="mindMap"></NodeImgPlacementToolbar>
      <NodeNoteSidebar :mindMap="mindMap"></NodeNoteSidebar>
      <NodeImage :mindMap="mindMap"></NodeImage>
      <NodeHyperlink :mindMap="mindMap"></NodeHyperlink>
      <NodeIcon :mindMap="mindMap"></NodeIcon>
      <NodeNote :mindMap="mindMap"></NodeNote>
      <NodeTag :mindMap="mindMap"></NodeTag>
    </template>
  </div>
</template>

<script>
import MindMap from 'simple-mind-map/full'
import RichText from 'simple-mind-map/src/plugins/RichText.js'
import ScrollbarPlugin from 'simple-mind-map/src/plugins/Scrollbar.js'
import Themes from 'simple-mind-map-plugin-themes'
import { mapState } from '@/mindmap/store'
import { getConfig, getData, storeData } from '@/mindmap/api-adapter'
import { showLoading, hideLoading } from '@/mindmap/utils/loading'
import handleClipboardText from '@/mindmap/utils/handleClipboardText'
import {
  writeCrossDocClipboard,
  readCrossDocClipboard,
  writeTextToClipboard
} from '@/mindmap/utils'
import {
  checkClipboardReadEnable,
  getDataFromClipboard,
  createSmmFormatData
} from 'simple-mind-map/src/utils/index'
import defaultNodeImage from '@/mindmap/style/text-to-image-failed.svg'

import OutlineSidebar from './components/OutlineSidebar.vue'
import Style from './components/Style.vue'
import BaseStyle from './components/BaseStyle.vue'
import Theme from './components/Theme.vue'
import Structure from './components/Structure.vue'
import Count from './components/Count.vue'
import NavigatorToolbar from './components/NavigatorToolbar.vue'
import ShortcutKey from './components/ShortcutKey.vue'
import Contextmenu from './components/Contextmenu.vue'
import RichTextToolbar from './components/RichTextToolbar.vue'
import NodeNoteContentShow from './components/NodeNoteContentShow.vue'
import Navigator from './components/Navigator.vue'
import NodeImgPreview from './components/NodeImgPreview.vue'
import SidebarTrigger from './components/SidebarTrigger.vue'
import Search from './components/Search.vue'
import NodeIconSidebar from './components/NodeIconSidebar.vue'
import NodeIconToolbar from './components/NodeIconToolbar.vue'
import OutlineEdit from './components/OutlineEdit.vue'
import Scrollbar from './components/Scrollbar.vue'
import FormulaSidebar from './components/FormulaSidebar.vue'
import NodeOuterFrame from './components/NodeOuterFrame.vue'
import NodeTagStyle from './components/NodeTagStyle.vue'
import Setting from './components/Setting.vue'
import AssociativeLineStyle from './components/AssociativeLineStyle.vue'
import NodeImgPlacementToolbar from './components/NodeImgPlacementToolbar.vue'
import NodeNoteSidebar from './components/NodeNoteSidebar.vue'
import NodeImage from './components/NodeImage.vue'
import NodeHyperlink from './components/NodeHyperlink.vue'
import NodeIcon from './components/NodeIcon.vue'
import NodeNote from './components/NodeNote.vue'
import NodeTag from './components/NodeTag.vue'

// 扩展主题列表
try {
  Themes.init(MindMap)
} catch (e) {
  console.warn('主题插件初始化失败', e)
}

const forwardEventList = [
  'node_active',
  'data_change',
  'view_data_change',
  'back_forward',
  'node_contextmenu',
  'node_click',
  'draw_click',
  'expand_btn_click',
  'svg_mousedown',
  'mouseup',
  'mode_change',
  'node_tree_render_end',
  'rich_text_selection_change',
  'transforming-dom-to-images',
  'generalization_node_contextmenu',
  'painter_start',
  'painter_end',
  'scrollbar_change',
  'scale',
  'translate',
  'node_attachmentClick',
  'node_attachmentContextmenu',
  'demonstrate_jump',
  'exit_demonstrate',
  'node_note_dblclick',
  'node_mousedown'
]

export default {
  name: 'MindMapEditor',
  components: {
    OutlineSidebar,
    Style,
    BaseStyle,
    Theme,
    Structure,
    Count,
    NavigatorToolbar,
    ShortcutKey,
    Contextmenu,
    RichTextToolbar,
    NodeNoteContentShow,
    Navigator,
    NodeImgPreview,
    SidebarTrigger,
    Search,
    NodeIconSidebar,
    NodeIconToolbar,
    OutlineEdit,
    Scrollbar,
    FormulaSidebar,
    NodeOuterFrame,
    NodeTagStyle,
    Setting,
    AssociativeLineStyle,
    NodeImgPlacementToolbar,
    NodeNoteSidebar,
    NodeImage,
    NodeHyperlink,
    NodeIcon,
    NodeNote,
    NodeTag
  },
  props: {
    data: {
      type: Object,
      required: true
    },
    layout: {
      type: String,
      default: 'logicalStructure'
    },
    theme: {
      type: String,
      default: 'default'
    },
    config: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      mindMap: null,
      mindMapData: null,
      mindMapConfig: {},
      enableShowLoading: true,
      storeConfigTimer: null
    }
  },
  computed: {
    ...mapState({
      isZenMode: state => state.localConfig.isZenMode,
      openNodeRichText: state => state.localConfig.openNodeRichText,
      isShowScrollbar: state => state.localConfig.isShowScrollbar,
      useLeftKeySelectionRightKeyDrag: state =>
        state.localConfig.useLeftKeySelectionRightKeyDrag,
      extraTextOnExport: state => state.extraTextOnExport
    })
  },
  watch: {
    openNodeRichText(val) {
      if (!this.mindMap) return
      if (val) {
        this.mindMap.addPlugin(RichText)
      } else {
        this.mindMap.removePlugin(RichText)
      }
    },
    isShowScrollbar(val) {
      if (!this.mindMap) return
      if (val) {
        this.mindMap.addPlugin(ScrollbarPlugin)
      } else {
        this.mindMap.removePlugin(ScrollbarPlugin)
      }
    }
  },
  mounted() {
    this.getData()
    this.waitContainerReady()
    this.$bus.$on('execCommand', this.execCommand)
    this.$bus.$on('paddingChange', this.onPaddingChange)
    this.$bus.$on('export', this.export)
    this.$bus.$on('setData', this.setData)
    this.$bus.$on('startTextEdit', this.handleStartTextEdit)
    this.$bus.$on('endTextEdit', this.handleEndTextEdit)
    this.$bus.$on('createAssociativeLine', this.handleCreateLineFromActiveNode)
    this.$bus.$on('startPainter', this.handleStartPainter)
    this.$bus.$on('node_tree_render_end', this.handleHideLoading)
    this.$bus.$on('showLoading', this.handleShowLoading)
    this.$bus.$on('localStorageExceeded', this.onLocalStorageExceeded)
    window.addEventListener('resize', this.handleResize)
  },
  beforeUnmount() {
    this.$bus.$off('execCommand', this.execCommand)
    this.$bus.$off('paddingChange', this.onPaddingChange)
    this.$bus.$off('export', this.export)
    this.$bus.$off('setData', this.setData)
    this.$bus.$off('startTextEdit', this.handleStartTextEdit)
    this.$bus.$off('endTextEdit', this.handleEndTextEdit)
    this.$bus.$off('createAssociativeLine', this.handleCreateLineFromActiveNode)
    this.$bus.$off('startPainter', this.handleStartPainter)
    this.$bus.$off('node_tree_render_end', this.handleHideLoading)
    this.$bus.$off('showLoading', this.handleShowLoading)
    this.$bus.$off('localStorageExceeded', this.onLocalStorageExceeded)
    window.removeEventListener('resize', this.handleResize)
    if (this.initTimer) {
      clearTimeout(this.initTimer)
      this.initTimer = null
    }
    if (this.mindMap) {
      this.mindMap.destroy()
      this.mindMap = null
    }
  },
  methods: {
    onLocalStorageExceeded() {
      this.$notify({
        type: 'warning',
        title: this.$t('edit.tip'),
        message: this.$t('edit.localStorageExceededTip'),
        duration: 0
      })
    },

    handleStartTextEdit() {
      this.mindMap && this.mindMap.renderer.startTextEdit()
    },

    handleEndTextEdit() {
      this.mindMap && this.mindMap.renderer.endTextEdit()
    },

    handleCreateLineFromActiveNode() {
      this.mindMap && this.mindMap.associativeLine.createLineFromActiveNode()
    },

    handleStartPainter() {
      this.mindMap && this.mindMap.painter.startPainter()
    },

    handleResize() {
      this.mindMap && this.mindMap.resize()
    },

    handleShowLoading() {
      this.enableShowLoading = true
      showLoading()
    },

    handleHideLoading() {
      if (this.enableShowLoading) {
        this.enableShowLoading = false
        hideLoading()
      }
    },

    waitContainerReady() {
      const el = this.$refs.containerRef
      const rect = el && el.getBoundingClientRect()
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        this.initTimer = setTimeout(() => {
          this.waitContainerReady()
        }, 50)
        return
      }
      this.init()
    },

    getData() {
      const saved = getData()
      this.mindMapConfig = getConfig() || {}
      this.mindMapData = {
        root: this.data,
        layout: this.layout,
        theme: {
          template: this.theme,
          config: (saved && saved.theme && saved.theme.config) || {}
        },
        view: (saved && saved.view) || null
      }
    },

    bindSaveEvent() {
      this.$bus.$on('data_change', data => {
        storeData({ root: data })
      })
      this.$bus.$on('view_data_change', data => {
        clearTimeout(this.storeConfigTimer)
        this.storeConfigTimer = setTimeout(() => {
          storeData({ view: data })
        }, 300)
      })
    },

    // 跨文档复制粘贴：内置逻辑走系统剪贴板，局域网 http 下不可读，
    // 这里在复制/剪切时镜像一份数据到 localStorage，粘贴时作为兜底
    bindCrossDocumentClipboard() {
      const mindMap = this.mindMap
      const renderer = mindMap.renderer
      if (!renderer || renderer.__crossDocClipboardPatched) return
      renderer.__crossDocClipboardPatched = true

      const originalCopy = renderer.copy.bind(renderer)
      const originalCut = renderer.cut.bind(renderer)
      const originalPaste = renderer.paste.bind(renderer)

      const mirrorToClipboard = () => {
        const data = renderer.beingCopyData
        if (!data) return
        writeCrossDocClipboard(data)
        if (!mindMap.opt.disabledClipboard) {
          writeTextToClipboard(JSON.stringify(createSmmFormatData(data)))
        }
      }

      renderer.copy = () => {
        originalCopy()
        mirrorToClipboard()
      }

      renderer.cut = () => {
        originalCut()
        mirrorToClipboard()
      }

      renderer.paste = async () => {
        // 安全上下文且系统剪贴板可读时，交给内置逻辑处理（保留外部文本/图片粘贴能力）
        if (checkClipboardReadEnable()) {
          try {
            const res = await getDataFromClipboard()
            if ((res && res.text && res.text.trim()) || (res && res.img)) {
              return originalPaste()
            }
          } catch (error) {
            // 无权限或读取失败，走跨文档缓存
          }
        }
        const data = readCrossDocClipboard()
        if (data && data.length > 0) {
          if (renderer.activeNodeList.length <= 0 && renderer.root) {
            renderer.root.active()
          }
          mindMap.execCommand('INSERT_MULTI_CHILD_NODE', [], data)
          return
        }
        return originalPaste()
      }
    },

    checkEnableShortcut(e) {
      const target = e.target
      if (!target) return false
      if (target === document.body) return true
      // 节点文本编辑框需要响应 Enter/Tab 来结束编辑
      const editClassList =
        (this.mindMap && this.mindMap.editNodeClassList) || []
      const isNodeTextEditor = editClassList.some(
        name => target.classList && target.classList.contains(name)
      )
      if (isNodeTextEditor) return true
      const container = this.$refs.containerRef
      if (!container || !container.contains(target)) return false
      // 画布内的普通输入框不响应快捷键
      const tag = (target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea') return false
      return true
    },

    init() {
      const { root, layout, theme, view } = this.mindMapData
      const config = this.mindMapConfig
      this.mindMap = new MindMap({
        el: this.$refs.containerRef,
        data: root,
        fit: false,
        layout: layout,
        theme: theme.template,
        themeConfig: theme.config,
        viewData: view,
        nodeTextEditZIndex: 1000,
        nodeNoteTooltipZIndex: 1000,
        customNoteContentShow: {
          show: (content, left, top, node) => {
            this.$bus.$emit('showNoteContent', content, left, top, node)
          },
          hide: () => {}
        },
        openRealtimeRenderOnNodeTextEdit: true,
        enableAutoEnterTextEditWhenKeydown: true,
        demonstrateConfig: {
          openBlankMode: false
        },
        // myweb 是窗口化编辑器，不要求鼠标悬停在画布内才响应快捷键；
        // 具体是否响应由 checkEnableShortcut 判断，输入框和文本编辑态会被排除
        enableShortcutOnlyWhenMouseInSvg: false,
        customCheckEnableShortcut: e => this.checkEnableShortcut(e),
        ...(config || {}),
        useLeftKeySelectionRightKeyDrag: this.useLeftKeySelectionRightKeyDrag,
        customInnerElsAppendTo: null,
        customHandleClipboardText: handleClipboardText,
        defaultNodeImage: defaultNodeImage,
        initRootNodePosition: ['center', 'center'],
        handleIsSplitByWrapOnPasteCreateNewNode: () => {
          return this.$confirm(this.$t('edit.splitByWrap'), this.$t('edit.tip'), {
            confirmButtonText: this.$t('edit.yes'),
            cancelButtonText: this.$t('edit.no'),
            type: 'warning'
          })
        },
        errorHandler: (code, err) => {
          console.error(err)
          if (code === 'export_error') {
            this.$message.error(this.$t('edit.exportError'))
          }
        },
        addContentToFooter: () => {
          const text = (this.extraTextOnExport || '').trim()
          if (!text) return null
          const el = document.createElement('div')
          el.className = 'footer'
          el.innerHTML = text
          const cssText = `
            .footer {
              width: 100%;
              height: 30px;
              display: flex;
              justify-content: center;
              align-items: center;
              font-size: 12px;
              color: #979797;
            }
          `
          return { el, cssText, height: 30 }
        },
        expandBtnNumHandler: num => {
          return num >= 100 ? '…' : num
        },
        beforeDeleteNodeImg: () => {
          return new Promise(resolve => {
            this.$confirm(
              this.$t('edit.deleteNodeImgTip'),
              this.$t('edit.tip'),
              {
                confirmButtonText: this.$t('edit.yes'),
                cancelButtonText: this.$t('edit.no'),
                type: 'warning'
              }
            )
              .then(() => resolve(false))
              .catch(() => resolve(true))
          })
        }
      })

      this.mindMap.keyCommand.addShortcut('Control+s', () => {
        this.$emit('save')
      })

      forwardEventList.forEach(event => {
        this.mindMap.on(event, (...args) => {
          this.$bus.$emit(event, ...args)
        })
      })

      this.bindCrossDocumentClipboard()
      this.bindSaveEvent()
      this.loadPlugins()
      this.$emit('ready', this.mindMap)
    },

    loadPlugins() {
      if (this.openNodeRichText) {
        this.mindMap.addPlugin(RichText)
      } else {
        this.mindMap.removePlugin(RichText)
      }
      if (this.isShowScrollbar) {
        this.mindMap.addPlugin(ScrollbarPlugin)
      }
    },

    setData(data) {
      this.handleShowLoading()
      let rootNodeData = null
      if (data.root) {
        this.mindMap.setFullData(data)
        rootNodeData = data.root
      } else {
        this.mindMap.setData(data)
        rootNodeData = data
      }
      this.mindMap.view.reset()
      if (rootNodeData.data.richText && !this.openNodeRichText) {
        this.$bus.$emit('toggleOpenNodeRichText', true)
        this.$notify.info({
          title: this.$t('edit.tip'),
          message: this.$t('edit.autoOpenNodeRichTextTip')
        })
      }
    },

    execCommand(...args) {
      this.mindMap && this.mindMap.execCommand(...args)
    },

    async export(...args) {
      try {
        showLoading()
        await this.mindMap.export(...args)
        hideLoading()
      } catch (error) {
        console.log(error)
        hideLoading()
      }
    },

    onPaddingChange(data) {
      this.mindMap.updateConfig(data)
    }
  }
}
</script>

<style lang="less" scoped>
.mindmap-editor {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;

  .mind-map-container {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
  }
}
</style>
