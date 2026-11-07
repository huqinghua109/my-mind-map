const express = require('express')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()
router.use(authMiddleware)

function isTeamMember(teamId, userId) {
  return db
    .prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?')
    .get(teamId, userId)
}

// 创建个人文件
router.post('/personal', (req, res, next) => {
  try {
    const { name, content } = req.body || {}
    if (!name) return res.status(400).json({ code: 400, message: '文件名必填' })
    const info = db
      .prepare(
        `INSERT INTO files (name, type, owner_type, owner_id, created_by, content)
         VALUES (?, 'personal', 'user', ?, ?, ?)`
      )
      .run(name, req.user.id, req.user.id, content || '')
    const file = db.prepare('SELECT id, name, type, owner_type, owner_id, created_by, created_at, updated_at FROM files WHERE id = ?').get(info.lastInsertRowid)
    res.status(201).json({ code: 0, data: { file } })
  } catch (e) {
    next(e)
  }
})

// 个人文件列表
router.get('/personal', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, type, owner_type, owner_id, created_by, created_at, updated_at
       FROM files WHERE type = 'personal' AND owner_id = ?
       ORDER BY updated_at DESC`
    )
    .all(req.user.id)
  res.json({ code: 0, data: { files: rows } })
})

// 文件详情
router.get('/:id', (req, res) => {
  const id = Number(req.params.id)
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id)
  if (!file) return res.status(404).json({ code: 404, message: '文件不存在' })
  // 权限校验
  if (file.type === 'personal') {
    if (file.owner_id !== req.user.id) {
      return res.status(403).json({ code: 403, message: '无权访问' })
    }
  } else {
    if (!isTeamMember(file.owner_id, req.user.id)) {
      return res.status(403).json({ code: 403, message: '无权访问' })
    }
  }
  res.json({ code: 0, data: { file } })
})

// 更新文件
router.put('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id)
    if (!file) return res.status(404).json({ code: 404, message: '文件不存在' })
    if (file.type === 'personal') {
      if (file.owner_id !== req.user.id) return res.status(403).json({ code: 403, message: '无权访问' })
    } else {
      if (!isTeamMember(file.owner_id, req.user.id)) return res.status(403).json({ code: 403, message: '无权访问' })
    }
    const { name, content } = req.body || {}
    const fields = []
    const values = []
    if (name !== undefined) { fields.push('name = ?'); values.push(name) }
    if (content !== undefined) { fields.push('content = ?'); values.push(content) }
    if (fields.length === 0) return res.json({ code: 0, data: { file } })
    fields.push("updated_at = datetime('now')")
    values.push(id)
    db.prepare(`UPDATE files SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    const updated = db.prepare('SELECT * FROM files WHERE id = ?').get(id)
    res.json({ code: 0, data: { file: updated } })
  } catch (e) {
    next(e)
  }
})

// 删除文件
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id)
  if (!file) return res.status(404).json({ code: 404, message: '文件不存在' })
  if (file.type === 'personal') {
    if (file.owner_id !== req.user.id) return res.status(403).json({ code: 403, message: '无权访问' })
  } else {
    if (!isTeamMember(file.owner_id, req.user.id)) return res.status(403).json({ code: 403, message: '无权访问' })
  }
  db.prepare('DELETE FROM files WHERE id = ?').run(id)
  res.json({ code: 0, message: '已删除' })
})

module.exports = router
