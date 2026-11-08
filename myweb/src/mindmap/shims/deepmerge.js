// simple-mind-map 使用 deepmerge 合并构造参数，而 deepmerge 4.x 会把 DOM 元素
// 当成普通对象进行克隆，导致 getBoundingClientRect 等方法丢失。
// 这里提供一个最小实现：只对纯对象做深合并，DOM 元素、类实例按引用保留，
// 数组行为与 deepmerge 默认的 concatenate 保持一致。

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue)
  }
  if (isPlainObject(value)) {
    const res = {}
    Object.keys(value).forEach(key => {
      res[key] = cloneValue(value[key])
    })
    return res
  }
  return value
}

function mergeValue(target, source, depth = 0) {
  if (depth > 40) {
    return source
  }
  if (Array.isArray(target) && Array.isArray(source)) {
    return target.map(cloneValue).concat(source.map(cloneValue))
  }
  if (isPlainObject(target) && isPlainObject(source)) {
    const res = {}
    Object.keys(target).forEach(key => {
      res[key] = cloneValue(target[key])
    })
    Object.keys(source).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        res[key] = mergeValue(target[key], source[key], depth + 1)
      } else {
        res[key] = cloneValue(source[key])
      }
    })
    return res
  }
  return source === undefined ? cloneValue(target) : cloneValue(source)
}

export default function merge(target, source) {
  return mergeValue(target, source)
}

merge.all = list => {
  return list.reduce((acc, item) => mergeValue(acc, item), {})
}
