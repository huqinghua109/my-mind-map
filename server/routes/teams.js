const express = require('express')
const crypto = require('crypto')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()
router.use(authMiddleware)

function isMember(teamId, userId) {
  return db
    .prepare('SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?')
    .get(teamId, userId)
}

function isOwner(teamId, userId) {
  const m = db
    .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
    .get(teamId, userId)
  return m && m.role === 'owner'
}

// 创建团队
router.post('/', (req, res, next) => {
  try {
    const { name, description } = req.body || {}
    if (!name) return res.status(400).json({ code: 400, message: '团队名称必填' })
    const info = db
      .prepare('INSERT INTO teams (name, description, owner_id) VALUES (?, ?, ?)')
      .run(name, description || '', req.user.id)
    const teamId = info.lastInsertRowid
    db.prepare(
      "INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'owner')"
    ).run(teamId, req.user.id)
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId)
    res.status(201).json({ code: 0, data: { team } })
  } catch (e) {
    next(e)
  }
})

// 列出我加入的团队
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.*, tm.role FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = ?
       ORDER BY t.created_at DESC`
    )
    .all(req.user.id)
  res.json({ code: 0, data: { teams: rows } })
})

// 团队成员列表
router.get('/:id/members', (req, res) => {
  const teamId = Number(req.params.id)
  if (!isMember(teamId, req.user.id)) {
    return res.status(403).json({ code: 403, message: '非团队成员' })
  }
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.nickname, u.avatar, tm.role, tm.joined_at
       FROM team_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = ? ORDER BY tm.joined_at`
    )
    .all(teamId)
  res.json({ code: 0, data: { members: rows } })
})

// 生成/刷新邀请码
router.post('/:id/invite', (req, res) => {
  const teamId = Number(req.params.id)
  if (!isMember(teamId, req.user.id)) {
    return res.status(403).json({ code: 403, message: '非团队成员' })
  }
  let code
  let attempt = 0
  do {
    code = crypto.randomBytes(3).toString('hex').toUpperCase()
    attempt++
  } while (
    db.prepare('SELECT 1 FROM invitations WHERE code = ?').get(code) && attempt < 10
  )
  db.prepare('INSERT INTO invitations (team_id, code, created_by) VALUES (?, ?, ?)').run(
    teamId,
    code,
    req.user.id
  )
  res.json({ code: 0, data: { inviteCode: code } })
})

// 凭邀请码加入团队
router.post('/join', (req, res) => {
  const { code } = req.body || {}
  if (!code) return res.status(400).json({ code: 400, message: '邀请码必填' })
  const inv = db
    .prepare('SELECT team_id FROM invitations WHERE code = ?')
    .get(code.toUpperCase())
  if (!inv) return res.status(404).json({ code: 404, message: '邀请码无效' })
  if (isMember(inv.team_id, req.user.id)) {
    return res.status(409).json({ code: 409, message: '已在团队中' })
  }
  db.prepare(
    "INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')"
  ).run(inv.team_id, req.user.id)
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(inv.team_id)
  res.json({ code: 0, data: { team } })
})

// 移除成员（仅 owner）
router.delete('/:id/members/:userId', (req, res) => {
  const teamId = Number(req.params.id)
  const targetId = Number(req.params.userId)
  if (!isOwner(teamId, req.user.id)) {
    return res.status(403).json({ code: 403, message: '仅团队所有者可操作' })
  }
  if (targetId === req.user.id) {
    return res.status(400).json({ code: 400, message: '不能移除自己，请使用退出团队' })
  }
  db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(teamId, targetId)
  res.json({ code: 0, message: '已移除' })
})

// 退出团队
router.post('/:id/leave', (req, res) => {
  const teamId = Number(req.params.id)
  if (isOwner(teamId, req.user.id)) {
    return res.status(400).json({ code: 400, message: '所有者请先转让团队或解散' })
  }
  db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?').run(teamId, req.user.id)
  res.json({ code: 0, message: '已退出团队' })
})

// 创建团队文件
router.post('/:id/files', (req, res, next) => {
  try {
    const teamId = Number(req.params.id)
    if (!isMember(teamId, req.user.id)) {
      return res.status(403).json({ code: 403, message: '非团队成员' })
    }
    const { name, content } = req.body || {}
    if (!name) return res.status(400).json({ code: 400, message: '文件名必填' })
    const info = db
      .prepare(
        `INSERT INTO files (name, type, owner_type, owner_id, created_by, content)
         VALUES (?, 'team', 'team', ?, ?, ?)`
      )
      .run(name, teamId, req.user.id, content || '')
    const file = db
      .prepare(
        'SELECT id, name, type, owner_type, owner_id, created_by, created_at, updated_at FROM files WHERE id = ?'
      )
      .get(info.lastInsertRowid)
    res.status(201).json({ code: 0, data: { file } })
  } catch (e) {
    next(e)
  }
})

// 团队文件列表
router.get('/:id/files', (req, res) => {
  const teamId = Number(req.params.id)
  if (!isMember(teamId, req.user.id)) {
    return res.status(403).json({ code: 403, message: '非团队成员' })
  }
  const rows = db
    .prepare(
      `SELECT id, name, type, owner_type, owner_id, created_by, created_at, updated_at
       FROM files WHERE type = 'team' AND owner_id = ?
       ORDER BY updated_at DESC`
    )
    .all(teamId)
  res.json({ code: 0, data: { files: rows } })
})

module.exports = router
