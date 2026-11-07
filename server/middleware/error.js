function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error('[ERROR]', err.message)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 400, message: '请求体 JSON 格式错误' })
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ code: 413, message: '文件过大' })
  }
  const status = err.status || 500
  res.status(status).json({ code: status, message: err.message || '服务器内部错误' })
}

module.exports = errorHandler
