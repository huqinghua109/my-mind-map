<template>
  <div class="navigatorContainer customScrollbar" :class="{ isDark: isDark }">
    <div class="item">
      <el-tooltip
        effect="dark"
        :content="$t('navigatorToolbar.backToRoot')"
        placement="top"
      >
        <div class="btn iconfont icondingwei" @click="backToRoot"></div>
      </el-tooltip>
    </div>
    <div class="item">
      <div class="btn iconfont iconsousuo" @click="showSearch"></div>
    </div>
    <div class="item">
      <MouseAction :isDark="isDark" :mindMap="mindMap"></MouseAction>
    </div>
    <div class="item">
      <el-tooltip
        effect="dark"
        :content="
          openMiniMap
            ? $t('navigatorToolbar.closeMiniMap')
            : $t('navigatorToolbar.openMiniMap')
        "
        placement="top"
      >
        <div class="btn iconfont icondaohang1" @click="toggleMiniMap"></div>
      </el-tooltip>
    </div>
    <div class="item">
      <!-- <el-switch
        v-model="isReadonly"
        :active-text="$t('navigatorToolbar.readonly')"
        :inactive-text="$t('navigatorToolbar.edit')"
        @change="readonlyChange"
      >
      </el-switch> -->
      <el-tooltip
        effect="dark"
        :content="
          isReadonly
            ? $t('navigatorToolbar.edit')
            : $t('navigatorToolbar.readonly')
        "
        placement="top"
      >
        <div
          class="btn iconfont"
          :class="[isReadonly ? 'iconyanjing' : 'iconbianji1']"
          @click="readonlyChange"
        ></div>
      </el-tooltip>
    </div>
    <div class="item">
      <Fullscreen :isDark="isDark" :mindMap="mindMap"></Fullscreen>
    </div>
    <div class="item">
      <Scale :isDark="isDark" :mindMap="mindMap"></Scale>
    </div>
    <div class="item">
      <div
        class="btn iconfont"
        :class="[isDark ? 'iconmoon_line' : 'iconlieri']"
        @click="toggleDark"
      ></div>
    </div>
    <!-- <div class="item">
      <el-tooltip
        effect="dark"
        :content="$t('navigatorToolbar.changeSourceCodeEdit')"
        placement="top"
      >
        <div class="btn iconfont iconyuanma" @click="openSourceCodeEdit"></div>
      </el-tooltip>
    </div> -->
    <div class="item">
      <Demonstrate :isDark="isDark" :mindMap="mindMap"></Demonstrate>
    </div>
    <div class="item">
      <el-dropdown @command="handleCommand">
        <div class="btn moreBtn" title="更多">···</div>
        <template #dropdown><el-dropdown-menu>
          <el-dropdown-item command="shortcutKey">
            <span class="iconfont iconjianpan"></span>
            {{ $t('navigatorToolbar.shortcutKeys') }}
          </el-dropdown-item>
        </el-dropdown-menu></template></el-dropdown>
    </div>
  </div>
</template>

<script>
import Scale from './Scale.vue'
import Fullscreen from './Fullscreen.vue'
import MouseAction from './MouseAction.vue'
import { mapState, mapMutations } from '@/mindmap/store'
import Demonstrate from './Demonstrate.vue'

// 导航器工具栏
export default {
  components: {
    Scale,
    Fullscreen,
    MouseAction,
    Demonstrate
  },
  props: {
    mindMap: {
      type: Object
    }
  },
  data() {
    return {
      openMiniMap: false
    }
  },
  computed: {
    ...mapState({
      isReadonly: state => state.isReadonly,
      isDark: state => state.localConfig.isDark
    })
  },
  methods: {
    ...mapMutations(['setLocalConfig', 'setIsReadonly', 'setActiveSidebar']),

    readonlyChange() {
      this.setIsReadonly(!this.isReadonly)
      this.mindMap.setMode(this.isReadonly ? 'readonly' : 'edit')
    },

    toggleMiniMap() {
      this.openMiniMap = !this.openMiniMap
      this.$bus.$emit('toggle_mini_map', this.openMiniMap)
    },

    showSearch() {
      this.$bus.$emit('show_search')
    },

    toggleDark() {
      this.setLocalConfig({
        isDark: !this.isDark
      })
    },

    handleCommand(command) {
      if (command === 'shortcutKey') {
        this.setActiveSidebar('shortcutKey')
      }
    },

    backToRoot() {
      this.mindMap.renderer.setRootNodeCenter()
    }
  }
}
</script>

<style lang="less" scoped>
.navigatorContainer {
  padding: 0 12px;
  position: absolute;
  right: 20px;
  bottom: 20px;
  background: hsla(0, 0%, 100%, 0.8);
  border-radius: 5px;
  opacity: 0.8;
  height: 44px;
  font-size: 12px;
  display: flex;
  align-items: center;

  &.isDark {
    background: #262a2e;

    .item {
      a {
        color: hsla(0, 0%, 100%, 0.6);
      }

      .btn {
        color: hsla(0, 0%, 100%, 0.6);
      }
    }
  }

  .item {
    margin-right: 20px;

    &:last-of-type {
      margin-right: 0;
    }

    a {
      color: #303133;
      text-decoration: none;
    }

    .btn {
      cursor: pointer;
      font-size: 18px;
    }

    .moreBtn {
      font-size: 18px;
      line-height: 1;
    }
  }
}

@media screen and (max-width: 700px) {
  .navigatorContainer {
    left: 20px;
    overflow-x: auto;
    overflow-y: hidden;
    height: 60px;
  }
}
</style>
