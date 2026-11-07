const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

const avatarsDir = path.join(__dirname, '..', 'uploads', 'avatars')
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png'
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true)
    else cb(new Error('仅支持图片文件'))
  }
})

// 获取当前用户资料
router.get('/profile', authMiddleware, (req, res) => {
  res.json({ code: 0, data: { user: req.user } })
})

// 更新当前用户资料（昵称、邮箱）
router.put('/profile', authMiddleware, (req, res, next) => {
  try {
    const { nickname, email } = req.body || {}
    const fields = []
    const values = []
    if (nickname !== undefined) {
      fields.push('nickname = ?')
      values.push(nickname)
    }
    if (email !== undefined) {
      // 邮箱唯一性校验
      const dup = db
        .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
        .get(email, req.user.id)
      if (dup) return res.status(409).json({ code: 409, message: '邮箱已被使用' })
      fields.push('email = ?')
      values.push(email)
    }
    if (fields.length === 0) {
      return res.json({ code: 0, data: { user: req.user } })
    }
    fields.push("updated_at = datetime('now')")
    values.push(req.user.id)
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    const user = db
      .prepare('SELECT id, username, email, nickname, avatar FROM users WHERE id = ?')
      .get(req.user.id)
    res.json({ code: 0, data: { user } })
  } catch (e) {
    next(e)
  }
})

// 上传头像
router.post('/avatar', authMiddleware, (req, res, next) => {
  upload.single('file')(req, res, err => {
    if (err) return next(err)
    if (!req.file) return res.status(400).json({ code: 400, message: '未上传文件' })
    const avatarUrl = `/static/avatars/${req.file.filename}`
    // 删除旧头像文件
    if (req.user.avatar && req.user.avatar.startsWith('/static/avatars/')) {
      const oldPath = path.join(avatarsDir, path.basename(req.user.avatar))
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath) } catch (e) { /* ignore */ }
      }
    }
    db.prepare("UPDATE users SET avatar = ?, updated_at = datetime('now') WHERE id = ?").run(
      avatarUrl,
      req.user.id
    )
    res.json({ code: 0, message: '上传成功', data: { avatar: avatarUrl } })
  })
})

module.exports = router
