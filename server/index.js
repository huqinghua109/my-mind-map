const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const http = require('http')
const errorHandler = require('./middleware/error')
const db = require('./db')

const app = express()
const PORT = process.env.PORT || 3000

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'uploads')
const avatarsDir = path.join(uploadsDir, 'avatars')
const imagesDir = path.join(uploadsDir, 'images')
;[uploadsDir, avatarsDir, imagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
})

app.use(cors())
app.use(express.json({ limit: '20mb' }))
app.use(express.urlencoded({ extended: true, limit: '20mb' }))

// 静态文件：头像与节点图片
app.use('/static', express.static(uploadsDir))

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { time: new Date().toISOString() } })
})

// 路由（在 db 就绪后挂载）
function mountRoutes() {
  app.use('/api/auth', require('./routes/auth'))
  app.use('/api/user', require('./routes/user'))
  app.use('/api/teams', require('./routes/teams'))
  app.use('/api/files', require('./routes/files'))
  app.use('/api/upload', require('./routes/upload'))
  app.use('/api/ai', require('./routes/ai'))
  // 404
  app.use((req, res) => {
    res.status(404).json({ code: 404, message: '接口不存在' })
  })
  // 错误处理
  app.use(errorHandler)
}

const server = http.createServer(app)

// WebSocket 协同服务
const { setupWebSocket } = require('./ws')
setupWebSocket(server)

;(async () => {
  await db.ready
  mountRoutes()
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Mind map server running at http://localhost:${PORT}`)
  })
})().catch(e => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', e)
  process.exit(1)
})

module.exports = { app, server }
