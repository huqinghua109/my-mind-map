<template>
  <div class="imgUploadContainer">
    <div class="imgUploadPanel">
      <div class="upBtn" v-if="!modelValue">
        <label
          for="imgUploadInput"
          class="imgUploadInputArea"
          @dragenter.stop.prevent
          @dragover.stop.prevent
          @drop.stop.prevent="onDrop"
          >点击此处选择图片、或拖动图片到此</label
        >
        <input
          type="file"
          accept="image/*"
          id="imgUploadInput"
          @change="onImgUploadInputChange"
        />
      </div>
      <div v-if="modelValue" class="uploadInfoBox">
        <div
          class="previewBox"
          :style="{ backgroundImage: `url('${modelValue}')` }"
        ></div>
        <span class="delBtn el-icon-close" @click="deleteImg"></span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    modelValue: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue'],
  data() {
    return {
      file: null
    }
  },
  methods: {
    // 图片选择事件
    onImgUploadInputChange(e) {
      let file = e.target.files[0]
      this.selectImg(file)
    },

    // 拖动上传图片
    onDrop(e) {
      let dt = e.dataTransfer
      let file = dt.files && dt.files[0]
      this.selectImg(file)
    },

    // 选择图片
    selectImg(file) {
      this.file = file
      let fr = new FileReader()
      fr.readAsDataURL(file)
      fr.onload = e => {
        this.$emit('update:modelValue', e.target.result)
      }
    },

    // 获取图片大小
    getSize() {
      return new Promise(resolve => {
        let img = new Image()
        img.src = this.modelValue
        img.onload = () => {
          resolve({
            width: img.width,
            height: img.height
          })
        }
        img.onerror = () => {
          resolve({
            width: 0,
            height: 0
          })
        }
      })
    },

    // 删除图片
    deleteImg() {
      this.$emit('update:modelValue', '')
      this.file = null
    }
  }
}
</script>

<style lang="less" scoped>
@import './style.less';
</style>
