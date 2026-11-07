const express = require('express')
const multer = require('multer')
const path = require('path')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()
router.use(authMiddleware)

const imagesDir = path.join(__dirname, '..', 'uploads', 'images')
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imagesDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png'
    cb(null, `img_${req.user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true)
    else cb(new Error('仅支持图片文件'))
  }
})

// 上传思维导图节点图片
router.post('/image', (req, res, next) => {
  upload.single('file')(req, res, err => {
    if (err) return next(err)
    if (!req.file) return res.status(400).json({ code: 400, message: '未上传文件' })
    const url = `/static/images/${req.file.filename}`
    res.json({ code: 0, data: { url } })
  })
})

module.exports = router
