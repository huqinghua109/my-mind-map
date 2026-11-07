const express = require('express')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()
router.use(authMiddleware)

const DEFAULT_AI_CONFIG = {
  ai_base_url: process.env.AI_BASE_URL || '',
  ai_api_key: process.env.AI_API_KEY || '',
  ai_model: process.env.AI_MODEL || ''
}

function getAiConfig(userId) {
  const row = db.prepare('SELECT * FROM user_configs WHERE user_id = ?').get(userId)
  if (!row) {
    return {
      baseUrl: DEFAULT_AI_CONFIG.ai_base_url,
      apiKey: DEFAULT_AI_CONFIG.ai_api_key,
      model: DEFAULT_AI_CONFIG.ai_model
    }
  }
  return {
    baseUrl: row.ai_base_url || DEFAULT_AI_CONFIG.ai_base_url,
    apiKey: row.ai_api_key || DEFAULT_AI_CONFIG.ai_api_key,
    model: row.ai_model || DEFAULT_AI_CONFIG.ai_model
  }
}

// 获取 AI 配置
router.get('/config', (req, res) => {
  const cfg = getAiConfig(req.user.id)
  // 不返回 apiKey 明文，仅返回是否已配置
  res.json({
    code: 0,
    data: {
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      hasApiKey: !!cfg.apiKey
    }
  })
})

// 保存 AI 配置
router.put('/config', (req, res, next) => {
  try {
    const { baseUrl, apiKey, model } = req.body || {}
    const existing = db
      .prepare('SELECT ai_api_key FROM user_configs WHERE user_id = ?')
      .get(req.user.id)
    const finalApiKey = apiKey === undefined || apiKey === ''
      ? (existing ? existing.ai_api_key : '')
      : apiKey
    db.prepare(
      `INSERT INTO user_configs (user_id, ai_base_url, ai_api_key, ai_model, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         ai_base_url = excluded.ai_base_url,
         ai_api_key = excluded.ai_api_key,
         ai_model = excluded.ai_model,
         updated_at = excluded.updated_at`
    ).run(req.user.id, baseUrl || '', finalApiKey, model || '')
    res.json({ code: 0, message: '保存成功' })
  } catch (e) {
    next(e)
  }
})

// AI 对话代理（流式）
router.post('/chat', async (req, res) => {
  const cfg = getAiConfig(req.user.id)
  if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
    return res.status(400).json({ code: 400, message: '请先配置 AI' })
  }
  const { messages, stream = true } = req.body || {}
  if (!Array.isArray(messages)) {
    return res.status(400).json({ code: 400, message: 'messages 必填' })
  }
  const url = cfg.baseUrl.replace(/\/$/, '') + '/chat/completions'
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        stream
      })
    })
    if (!resp.ok) {
      const text = await resp.text()
      return res.status(resp.status).json({ code: resp.status, message: text || 'AI 请求失败' })
    }
    if (!stream) {
      const data = await resp.json()
      return res.json({ code: 0, data })
    }
    // 流式透传
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(decoder.decode(value, { stream: true }))
    }
    res.end()
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[ai] proxy error', e.message)
    if (!res.headersSent) {
      res.status(502).json({ code: 502, message: 'AI 服务不可达：' + e.message })
    } else {
      res.end()
    }
  }
})

module.exports = router
