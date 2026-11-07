const express = require('express')
const bcrypt = require('bcryptjs')
const db = require('../db')
const { signToken, authMiddleware } = require('../middleware/auth')

const router = express.Router()

// 注册
router.post('/register', (req, res, next) => {
  try {
    const { username, email, password } = req.body || {}
    if (!username || !email || !password) {
      return res.status(400).json({ code: 400, message: '用户名、邮箱、密码均为必填' })
    }
    if (password.length < 6) {
      return res.status(400).json({ code: 400, message: '密码至少 6 位' })
    }
    const exists = db
      .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
      .get(username, email)
    if (exists) {
      return res.status(409).json({ code: 409, message: '用户名或邮箱已存在' })
    }
    const password_hash = bcrypt.hashSync(password, 10)
    const info = db
      .prepare(
        'INSERT INTO users (username, email, password_hash, nickname) VALUES (?, ?, ?, ?)'
      )
      .run(username, email, password_hash, username)
    const user = db
      .prepare('SELECT id, username, email, nickname, avatar FROM users WHERE id = ?')
      .get(info.lastInsertRowid)
    const token = signToken(user)
    res.status(201).json({ code: 0, message: '注册成功', data: { token, user } })
  } catch (e) {
    next(e)
  }
})

// 登录
router.post('/login', (req, res, next) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码为必填' })
    }
    const user = db
      .prepare(
        'SELECT * FROM users WHERE username = ? OR email = ?'
      )
      .get(username, username)
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' })
    }
    const safe = {
      id: user.id,
      username: user.username,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar
    }
    const token = signToken(safe)
    res.json({ code: 0, message: '登录成功', data: { token, user: safe } })
  } catch (e) {
    next(e)
  }
})

// 获取当前用户信息（带 token）
router.get('/me', authMiddleware, (req, res) => {
  res.json({ code: 0, data: { user: req.user } })
})

module.exports = router
