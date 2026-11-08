// 本地文件句柄工具：能力检测、IndexedDB 持久化、写入授权与串行写回。
// File System Access API 仅在安全上下文（HTTPS / localhost）可用；
// 句柄是结构化对象，必须存 IndexedDB，不能存 localStorage。

const DB_NAME = 'myweb_fs_handles'
const STORE_NAME = 'handles'
const DB_VERSION = 1

// 当前访问环境是否具备自动写回能力
export function isFileSystemAccessSupported() {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof window.showOpenFilePicker === 'function' &&
    typeof window.showSaveFilePicker === 'function'
  )
}

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB 不可用'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB 打开失败'))
  })
}

// 保存句柄记录：{ key, handle, fileName, updatedAt }
export async function saveHandleRecord(key, handle, fileName) {
  if (!key || !handle) throw new Error('缺少句柄或文档标识')
  const db = await openDB()
  return new Promise((resolve, reject) => {
    let tx
    try {
      tx = db.transaction(STORE_NAME, 'readwrite')
    } catch (error) {
      db.close()
      reject(error)
      return
    }
    tx.objectStore(STORE_NAME).put({
      key,
      handle,
      fileName: fileName || handle.name || '',
      updatedAt: Date.now()
    })
    tx.oncomplete = () => {
      db.close()
      resolve(true)
    }
    tx.onerror = () => {
      const error = tx.error
      db.close()
      reject(error || new Error('句柄保存失败'))
    }
    tx.onabort = () => {
      const error = tx.error
      db.close()
      reject(error || new Error('句柄保存被中断'))
    }
  })
}

export async function getHandleRecord(key) {
  if (!key) return null
  const db = await openDB()
  return new Promise((resolve, reject) => {
    let tx
    try {
      tx = db.transaction(STORE_NAME, 'readonly')
    } catch (error) {
      db.close()
      reject(error)
      return
    }
    const request = tx.objectStore(STORE_NAME).get(key)
    request.onsuccess = () => {
      const record = request.result || null
      db.close()
      resolve(record)
    }
    request.onerror = () => {
      const error = request.error
      db.close()
      reject(error || new Error('句柄读取失败'))
    }
  })
}

export async function removeHandleRecord(key) {
  if (!key) return
  const db = await openDB()
  return new Promise((resolve, reject) => {
    let tx
    try {
      tx = db.transaction(STORE_NAME, 'readwrite')
    } catch (error) {
      db.close()
      reject(error)
      return
    }
    tx.objectStore(STORE_NAME).delete(key)
    tx.oncomplete = () => {
      db.close()
      resolve(true)
    }
    tx.onerror = () => {
      const error = tx.error
      db.close()
      reject(error || new Error('句柄删除失败'))
    }
  })
}

// 查询句柄写权限：granted / prompt / denied / unknown / none
export async function getPermissionState(handle) {
  if (!handle) return 'none'
  if (typeof handle.queryPermission !== 'function') return 'unknown'
  try {
    return await handle.queryPermission({ mode: 'readwrite' })
  } catch (error) {
    try {
      return await handle.queryPermission({})
    } catch (e) {
      return 'unknown'
    }
  }
}

// 请求写权限。必须在用户手势（点击）内调用，浏览器才会弹出授权提示。
export async function requestWritePermission(handle) {
  if (!handle) return false
  if (typeof handle.requestPermission !== 'function') return true
  try {
    const state = await handle.requestPermission({ mode: 'readwrite' })
    return state === 'granted'
  } catch (error) {
    // 部分实现不支持 readwrite 参数，退回默认请求
    try {
      const state = await handle.requestPermission({})
      return state === 'granted'
    } catch (e) {
      return false
    }
  }
}

// 将写入异常归类，供界面给出对应提示
export function classifyWriteError(error) {
  const name = (error && error.name) || ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'need-auth'
  if (name === 'NotFoundError') return 'missing'
  return 'error'
}

// 串行写回器：同一句柄的写入不会并发打开可写流；
// 写入进行中再次触发时合并为“最新内容”，避免旧内容覆盖新内容。
export function createHandleWriter() {
  let chain = Promise.resolve()
  let pending = null
  let running = false

  function enqueue(handle, content) {
    return new Promise((resolve, reject) => {
      if (pending) {
        pending.handle = handle
        pending.content = content
        pending.resolve.push(resolve)
        pending.reject.push(reject)
      } else {
        pending = { handle, content, resolve: [resolve], reject: [reject] }
      }
      if (!running) run()
    })
  }

  function run() {
    running = true
    chain = chain.then(async () => {
      while (pending) {
        const task = pending
        pending = null
        try {
          await writeOnceWithRetry(task.handle, task.content)
          task.resolve.forEach(fn => fn())
        } catch (error) {
          task.reject.forEach(fn => fn(error))
        }
      }
      running = false
    })
  }

  async function writeOnceWithRetry(handle, content) {
    try {
      await writeOnce(handle, content)
    } catch (error) {
      // 同一文件被其他标签页/外部程序短暂占用时重试一次
      if (error && error.name === 'InvalidStateError') {
        await new Promise(resolve => setTimeout(resolve, 200))
        await writeOnce(handle, content)
        return
      }
      throw error
    }
  }

  async function writeOnce(handle, content) {
    const writable = await handle.createWritable()
    try {
      await writable.write(content)
      await writable.close()
    } catch (error) {
      try {
        await writable.abort()
      } catch (e) {
        // 忽略中断异常
      }
      throw error
    }
  }

  return {
    write: enqueue,
    get busy() {
      return running || !!pending
    }
  }
}
