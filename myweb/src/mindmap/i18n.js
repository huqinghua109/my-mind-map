import zhCN from './lang/zh_cn'

function getValue(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc && typeof acc === 'object') return acc[key]
    return undefined
  }, obj)
}

// 仅中文，兼容官方组件中的 $t('xxx.yyy') 调用
export function t(path, ...args) {
  const value = getValue(zhCN, path)
  if (typeof value === 'function') {
    return value(...args)
  }
  if (value === undefined || value === null) {
    return path
  }
  if (typeof value === 'string' && args.length > 0) {
    return value.replace(/\{(\d+)\}/g, (m, i) => {
      return args[Number(i)] === undefined ? m : args[Number(i)]
    })
  }
  return value
}

export default t
