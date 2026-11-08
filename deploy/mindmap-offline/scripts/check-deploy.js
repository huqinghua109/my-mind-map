// 部署自检脚本：检查入口页、静态资源、API 健康检查和 WebSocket 握手。
// 用法：node scripts/check-deploy.js [http://部署机地址:端口 | 端口]
// 不传参数时读取 logs/deploy-state.json 中的 webPort（deploy.ps1 部署成功时写入）；
// 读不到再使用 http://127.0.0.1:8080，与 deploy.ps1 的默认 Web 端口一致。

const path = require('path')
const fs = require('fs')
const WebSocket = require(path.join(__dirname, '..', 'server', 'node_modules', 'ws'))

function resolveBase() {
  const arg = process.argv[2]
  if (arg) {
    if (/^\d+$/.test(arg)) return 'http://127.0.0.1:' + arg
    return arg.replace(/\/$/, '')
  }

  const stateFile = path.join(__dirname, '..', 'logs', 'deploy-state.json')
  try {
    // 兼容手工用 PowerShell 5 写入时带的 UTF-8 BOM
    const raw = fs.readFileSync(stateFile, 'utf8').replace(/^\uFEFF/, '')
    const state = JSON.parse(raw)
    if (state && state.webPort) {
      console.log('未指定地址，使用 logs/deploy-state.json 中的 webPort=' + state.webPort)
      return 'http://127.0.0.1:' + state.webPort
    }
  } catch (e) {
    // 尚未部署或文件损坏时走默认值
  }
  console.log('未指定地址，且未读到 logs/deploy-state.json 的 webPort，使用默认 http://127.0.0.1:8080')
  return 'http://127.0.0.1:8080'
}

const base = resolveBase()
let failed = false

function pass(message) {
  console.log('  [PASS] ' + message)
}

function fail(message) {
  console.log('  [FAIL] ' + message)
  failed = true
}

async function request(url, options) {
  const response = await fetch(url, options)
  return response
}

async function checkHttp() {
  console.log('1. 后端健康检查 ' + base + '/api/health')
  try {
    const response = await request(base + '/api/health')
    const body = await response.json()
    if (response.status === 200 && body.code === 0 && body.message === 'ok') {
      pass('HTTP 200，code=0，message=ok')
    } else {
      fail('返回异常：HTTP ' + response.status + '，body=' + JSON.stringify(body))
    }
  } catch (e) {
    fail('请求失败：' + e.message)
  }

  console.log('2. 前端入口页 ' + base + '/')
  let html = ''
  try {
    const response = await request(base + '/')
    html = await response.text()
    const type = response.headers.get('content-type') || ''
    if (response.status === 200 && type.includes('text/html') && html.includes('id="app"')) {
      pass('HTTP 200，返回 HTML 且包含 #app')
    } else {
      fail('HTTP ' + response.status + '，content-type=' + type)
    }
  } catch (e) {
    fail('请求失败：' + e.message)
  }

  console.log('3. 前端 JS 资源')
  const match = html.match(/src="([^"]+\.js)"/)
  if (!match) {
    fail('未能从入口页解析出 JS 资源地址')
    return
  }
  const assetUrl = base + match[1]
  try {
    const response = await request(assetUrl)
    const type = response.headers.get('content-type') || ''
    // module script 必须是 JS MIME，text/plain 会被浏览器拒绝执行。
    if (response.status === 200 && type.includes('javascript')) {
      pass(match[1] + ' 可访问，content-type=' + type)
    } else {
      fail(assetUrl + ' 返回 HTTP ' + response.status + '，content-type=' + type +
        '（module 脚本需要 application/javascript 或 text/javascript）')
    }
  } catch (e) {
    fail('请求失败：' + e.message)
  }
}

function checkWebSocket() {
  console.log('4. 协同 WebSocket ' + base.replace(/^http/, 'ws') + '/ws/check-deploy')
  return new Promise(resolve => {
    const wsUrl = base.replace(/^http/, 'ws') + '/ws/check-deploy'
    const socket = new WebSocket(wsUrl)
    const timer = setTimeout(() => {
      fail('5 秒内未完成 WebSocket 握手')
      socket.terminate()
      resolve()
    }, 5000)

    socket.on('open', () => {
      clearTimeout(timer)
      pass('WebSocket 握手成功')
      socket.close()
      resolve()
    })

    socket.on('error', error => {
      clearTimeout(timer)
      fail('WebSocket 连接失败：' + error.message)
      resolve()
    })
  })
}

(async () => {
  console.log('部署自检目标：' + base)
  await checkHttp()
  await checkWebSocket()
  if (failed) {
    console.log('结果：存在失败项，请按 docs/离线部署说明.md 的故障排查章节检查。')
    process.exit(1)
  }
  console.log('结果：全部通过。')
})().catch(error => {
  console.error('自检脚本异常：', error)
  process.exit(1)
})
