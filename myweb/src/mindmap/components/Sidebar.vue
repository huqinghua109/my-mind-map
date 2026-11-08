<template>
  <div
    class="sidebarContainer"
    @click.stop
    :class="{ show: show, isDark: isDark }"
    :style="{ zIndex: zIndex }"
  >
    <span class="closeBtn iconfont iconguanbi" title="关闭" @click="close"></span>
    <div class="sidebarHeader" v-if="title">
      {{ title }}
    </div>
    <div class="sidebarContent customScrollbar" ref="sidebarContent">
      <slot></slot>
    </div>
  </div>
</template>

<script>
import { store } from '@/mindmap/config'
import { mapState, mapMutations } from '@/mindmap/store'

// 侧边栏容器
export default {
  props: {
    title: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      show: false,
      zIndex: 0
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark
    })
  },
  watch: {
    show(val, oldVal) {
      if (val && !oldVal) {
        this.zIndex = store.sidebarZIndex++
      }
    }
  },
  created() {
    this.$bus.$on('closeSideBar', this.handleCloseSidebar)
  },
  beforeUnmount() {
    this.$bus.$off('closeSideBar', this.handleCloseSidebar)
  },
  methods: {
    ...mapMutations(['setActiveSidebar']),

    handleCloseSidebar() {
      this.close()
    },

    close() {
      this.show = false
      this.setActiveSidebar(null)
    },

    getEl() {
      return this.$refs.sidebarContent
    }
  }
}
</script>

<style lang="less" scoped>
.sidebarContainer {
  position: absolute;
  right: -300px;
  top: 0;
  bottom: 0;
  width: 300px;
  background-color: #fff;
  border-left: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  transition: all 0.3s;

  &.isDark {
    background-color: #262a2e;
    border-left-color: hsla(0, 0%, 100%, 0.1);

    .sidebarHeader {
      border-bottom-color: hsla(0, 0%, 100%, 0.1);
      color: #fff;
    }

    .closeBtn {
      color: #fff;
    }
  }

  &.show {
    right: 0;
  }

  .closeBtn {
    position: absolute;
    right: 20px;
    top: 12px;
    font-size: 20px;
    cursor: pointer;
  }

  .sidebarHeader {
    width: 100%;
    height: 44px;
    border-bottom: 1px solid #e8e8e8;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-grow: 0;
    flex-shrink: 0;
  }

  .sidebarContent {
    width: 100%;
    height: 100%;
    overflow: auto;
  }
}
</style>
