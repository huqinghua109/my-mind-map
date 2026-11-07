// 实时协同 WebSocket 服务（Task 5 完整实现）
const { WebSocketServer } = require('ws')
const Y = require('yjs')
const { setupWSConnection, getYDoc, docs } = require('y-websocket/bin/utils')
const db = require('./db')

// 房间名 -> { persistTimer, contentDirty, observerBound }
const rooms = new Map()

function getRoomNameFromReq(req) {
  const url = new URL(req.url, 'http://localhost')
  // y-websocket 客户端会把 roomname 拼接到路径后面：/ws/<roomname>
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length >= 2 && parts[0] === 'ws') {
    return parts.slice(1).join('/')
  }
  // 兼容 query param 方式
  return url.searchParams.get('room') || ''
}

function extractFileId(roomName) {
  const m = /^file-(\d+)$/.exec(roomName || '')
  return m ? Number(m[1]) : null
}

// 将平级对象结构还原为思维导图树结构
function flatToTree(flat) {
  const uids = Object.keys(flat)
  if (uids.length === 0) return null
  const rootKey = uids.find(uid => flat[uid].isRoot)
  if (!rootKey || !flat[rootKey]) return null
  const clone = obj => JSON.parse(JSON.stringify(obj))
  const map = {}
  uids.forEach(uid => {
    map[uid] = { data: clone(flat[uid].data), children: [] }
  })
  uids.forEach(uid => {
    const children = flat[uid].children || []
    children.forEach(childUid => {
      if (map[childUid]) map[uid].children.push(map[childUid])
    })
  })
  return map[rootKey]
}

// 将 Yjs 文档内容序列化为思维导图 JSON（{ root: <tree> }）
function serializeDocToMindMap(doc) {
  const ymap = doc.getMap()
  const obj = ymap.toJSON()
  const tree = flatToTree(obj)
  return JSON.stringify({ root: tree })
}

function persistRoom(roomName) {
  const room = rooms.get(roomName)
  if (!room) return
  const doc = docs.get(roomName)
  if (!doc) return
  const fileId = extractFileId(roomName)
  if (!fileId) return
  try {
    const content = serializeDocToMindMap(doc)
    db.prepare(
      "UPDATE files SET content = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(content, fileId)
    room.contentDirty = false
  } catch (e) {
    console.error('[ws] persist failed', e.message)
  }
}

function schedulePersist(roomName) {
  const room = rooms.get(roomName)
  if (!room) return
  room.contentDirty = true
  if (room.persistTimer) clearTimeout(room.persistTimer)
  room.persistTimer = setTimeout(() => persistRoom(roomName), 3000)
}

function setupWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', (conn, req) => {
    const roomName = getRoomNameFromReq(req)
    if (!roomName) {
      conn.close()
      return
    }

    // 使用 y-websocket 内部管理的 doc（关键：必须和 setupWSConnection 用同一个 doc）
    const doc = getYDoc(roomName, true)

    // 为该房间注册持久化观察器（仅注册一次）
    if (!rooms.has(roomName)) {
      rooms.set(roomName, { persistTimer: null, contentDirty: false })
      const ymap = doc.getMap()
      const onChange = () => schedulePersist(roomName)
      ymap.observe(onChange)
      // 记录观察器以便清理
      rooms.get(roomName)._observer = onChange
      rooms.get(roomName)._ymap = ymap
    }

    setupWSConnection(conn, req, { docName: roomName, gc: true })

    conn.on('close', () => {
      // 延迟检查：如果没有连接了，持久化并清理
      setTimeout(() => {
        const d = docs.get(roomName)
        if (!d || d.conns.size === 0) {
          const room = rooms.get(roomName)
          if (room) {
            if (room.persistTimer) clearTimeout(room.persistTimer)
            if (room.contentDirty) persistRoom(roomName)
            if (room._ymap && room._observer) room._ymap.unobserve(room._observer)
            rooms.delete(roomName)
          }
          // 不销毁 doc，保留在内存中供后续连接复用（y-websocket 也不会自动销毁，因为 persistence 为 null）
        }
      }, 500)
    })
  })

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://localhost')
    if (pathname === '/ws' || pathname.startsWith('/ws/')) {
      wss.handleUpgrade(req, socket, head, ws => {
        wss.emit('connection', ws, req)
      })
    } else {
      socket.destroy()
    }
  })
}

module.exports = { setupWebSocket, rooms, docs }
