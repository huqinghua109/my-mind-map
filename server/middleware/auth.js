const jwt = require('jsonwebtoken')
const db = require('../db')

const JWT_SECRET = process.env.JWT_SECRET || 'mindmap-dev-secret-change-me'

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录或 token 缺失' })
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const user = db
      .prepare('SELECT id, username, email, nickname, avatar FROM users WHERE id = ?')
      .get(payload.id)
    if (!user) {
      return res.status(401).json({ code: 401, message: '用户不存在' })
    }
    req.user = user
    next()
  } catch (e) {
    return res.status(401).json({ code: 401, message: 'token 无效或已过期' })
  }
}

module.exports = { signToken, authMiddleware, JWT_SECRET }
