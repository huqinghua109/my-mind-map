// 全屏事件检测
const getOnfullscreEnevt = () => {
  if (document.documentElement.requestFullScreen) {
    return 'onfullscreenchange'
  } else if (document.documentElement.webkitRequestFullScreen) {
    return 'onwebkitfullscreenchange'
  } else if (document.documentElement.mozRequestFullScreen) {
    return 'onmozfullscreenchange'
  } else if (document.documentElement.msRequestFullscreen) {
    return 'onmsfullscreenchange'
  }
}

export const fullscrrenEvent = getOnfullscreEnevt()

// 全屏
export const fullScreen = element => {
  if (element.requestFullScreen) {
    element.requestFullScreen()
  } else if (element.webkitRequestFullScreen) {
    element.webkitRequestFullScreen()
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen()
  }
}

// 文件转buffer
export const fileToBuffer = file => {
  return new Promise(r => {
    const reader = new FileReader()
    reader.onload = () => {
      r(reader.result)
    }
    reader.readAsArrayBuffer(file)
  })
}

// 复制文本到剪贴板
export const copy = text => {
  // 使用textarea可以保留换行
  const input = document.createElement('textarea')
  // input.setAttribute('value', text)
  input.innerHTML = text
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
}

// 跨文档复制剪贴板桥接
// 局域网 http（非安全上下文）下系统剪贴板不可读，这里用 localStorage 做同源多标签页之间的兜底
const CROSS_DOC_CLIPBOARD_KEY = 'myweb_mindmap_clipboard'

// 写入跨文档复制缓存
export const writeCrossDocClipboard = data => {
  if (!data) return false
  try {
    localStorage.setItem(
      CROSS_DOC_CLIPBOARD_KEY,
      JSON.stringify({ simpleMindMap: true, data, time: Date.now() })
    )
    return true
  } catch (error) {
    return false
  }
}

// 读取跨文档复制缓存，返回节点树数据数组
export const readCrossDocClipboard = () => {
  try {
    const raw = localStorage.getItem(CROSS_DOC_CLIPBOARD_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !parsed.simpleMindMap || !parsed.data) return null
    return Array.isArray(parsed.data) ? parsed.data : [parsed.data]
  } catch (error) {
    return null
  }
}

// 写入系统剪贴板：安全上下文优先用 navigator.clipboard，否则用 textarea + execCommand 兜底
export const writeTextToClipboard = text => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {})
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  } catch (error) {
    // 忽略，调用方会使用 localStorage 缓存
  }
}

// 复制文本到剪贴板
export const setDataToClipboard = data => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(data)
  }
}

// 复制图片到剪贴板
export const setImgToClipboard = img => {
  if (navigator.clipboard && navigator.clipboard.write) {
    const data = [new ClipboardItem({ ['image/png']: img })]
    navigator.clipboard.write(data)
  }
}

// 打印大纲
export const printOutline = el => {
  const printContent = el.outerHTML
  const iframe = document.createElement('iframe')
  iframe.setAttribute('style', 'position: absolute; width: 0; height: 0;')
  document.body.appendChild(iframe)
  const iframeDoc = iframe.contentWindow.document
  // 将当前页面的所有样式添加到iframe中
  const styleList = document.querySelectorAll('style')
  Array.from(styleList).forEach(el => {
    iframeDoc.write(el.outerHTML)
  })
  // 设置打印展示方式 - 纵向展示
  iframeDoc.write('<style media="print">@page {size: portrait;}</style>')
  // 写入内容
  iframeDoc.write('<div>' + printContent + '</div>')
  setTimeout(function() {
    iframe.contentWindow?.print()
    document.body.removeChild(iframe)
  }, 500)
}

export const getParentWithClass = (el, className) => {
  if (el.classList.contains(className)) {
    return el
  }
  if (el.parentNode && el.parentNode !== document.body) {
    return getParentWithClass(el.parentNode, className)
  }
  return null
}