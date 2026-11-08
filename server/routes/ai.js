const express = require('express')
const db = require('../db')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()
// 所有 AI 接口都要求登录，配置归属与调用一律取自 req.user.id
router.use(authMiddleware)

// 系统级兜底配置（仅用于兼容旧的全局配置方式）
// 新用户未保存个人配置时，会使用这里的默认值；若这里也未配置，则提示用户先配置
const SYSTEM_AI_CONFIG = {
  baseUrl: process.env.AI_BASE_URL || '',
  apiKey: process.env.AI_API_KEY || '',
  model: process.env.AI_MODEL || ''
}

function toText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 读取指定用户自己的 AI 配置
 * 数据存储：user_configs 表，主键 user_id，每个用户一行
 * 配置来源：
 * - user   ：用户已保存过个人配置（字段可部分缺失，缺失项用系统兜底值补齐）
 * - system ：用户未保存配置，完全使用系统环境变量兜底
 * - none   ：用户未保存配置且系统也没有兜底配置
 */
function getAiConfig(userId) {
  const row = db
    .prepare('SELECT ai_base_url, ai_api_key, ai_model FROM user_configs WHERE user_id = ?')
    .get(userId)

  const own = {
    baseUrl: toText(row && row.ai_base_url),
    apiKey: toText(row && row.ai_api_key),
    model: toText(row && row.ai_model)
  }
  const hasOwnConfig = !!(own.baseUrl || own.apiKey || own.model)

  const cfg = {
    baseUrl: own.baseUrl || SYSTEM_AI_CONFIG.baseUrl,
    apiKey: own.apiKey || SYSTEM_AI_CONFIG.apiKey,
    model: own.model || SYSTEM_AI_CONFIG.model,
    hasOwnConfig,
    hasOwnApiKey: !!own.apiKey
  }
  cfg.configured = !!(cfg.baseUrl && cfg.apiKey && cfg.model)
  cfg.source = hasOwnConfig ? 'user' : cfg.configured ? 'system' : 'none'
  return cfg
}

// 获取当前登录用户的 AI 配置
router.get('/config', (req, res) => {
  const cfg = getAiConfig(req.user.id)
  // 不返回 apiKey 明文，仅返回是否已配置
  res.json({
    code: 0,
    data: {
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      hasApiKey: !!cfg.apiKey,
      hasOwnApiKey: cfg.hasOwnApiKey,
      configured: cfg.configured,
      source: cfg.source
    }
  })
})

// 保存当前登录用户的 AI 配置（只写自己的 user_id，不接收 userId 参数）
router.put('/config', (req, res, next) => {
  try {
    const { baseUrl, apiKey, model } = req.body || {}
    const existing = db
      .prepare('SELECT ai_api_key FROM user_configs WHERE user_id = ?')
      .get(req.user.id)
    // 前端未填写 key 时保留原 key，避免只改 URL/模型时把 key 清空
    const finalApiKey =
      apiKey === undefined || toText(apiKey) === ''
        ? toText(existing && existing.ai_api_key)
        : toText(apiKey)
    db.prepare(
      `INSERT INTO user_configs (user_id, ai_base_url, ai_api_key, ai_model, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         ai_base_url = excluded.ai_base_url,
         ai_api_key = excluded.ai_api_key,
         ai_model = excluded.ai_model,
         updated_at = excluded.updated_at`
    ).run(req.user.id, toText(baseUrl), finalApiKey, toText(model))
    res.json({ code: 0, message: '保存成功' })
  } catch (e) {
    next(e)
  }
})

// AI 对话代理（流式），使用当前登录用户自己的配置
router.post('/chat', async (req, res) => {
  const cfg = getAiConfig(req.user.id)
  if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
    return res.status(400).json({
      code: 400,
      message: '未配置 AI 参数，请先配置'
    })
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
