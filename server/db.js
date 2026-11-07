const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
const dbPath = path.join(dataDir, 'app.db')

let _sql = null
let _db = null
let _dirty = false
let _saveTimer = null

// better-sqlite3 兼容的 Statement 包装
class Statement {
  constructor(sql) {
    this.sql = sql
  }
  _bind(stmt, params) {
    if (params == null) return
    if (Array.isArray(params)) {
      stmt.bind(params)
    } else if (typeof params === 'object') {
      stmt.bind(params)
    } else {
      stmt.bind([params])
    }
  }
  run(...params) {
    const stmt = _db.prepare(this.sql)
    this._bind(stmt, params)
    stmt.step()
    const info = { changes: _db.getRowsModified(), lastInsertRowid: _db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0] }
    stmt.free()
    markDirty()
    return info
  }
  get(...params) {
    const stmt = _db.prepare(this.sql)
    this._bind(stmt, params)
    let row = null
    if (stmt.step()) row = stmt.getAsObject()
    stmt.free()
    return row
  }
  all(...params) {
    const stmt = _db.prepare(this.sql)
    this._bind(stmt, params)
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
  }
}

// 数据库包装对象（导出）
const db = {
  prepare(sql) {
    return new Statement(sql)
  },
  exec(sql) {
    _db.exec(sql)
    markDirty()
  },
  pragma() { /* sql.js 无 pragma，忽略 */ },
  _save() {
    const data = _db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(dbPath, buffer)
    _dirty = false
  }
}

function markDirty() {
  _dirty = true
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => db._save(), 300)
}

// 导出初始化 Promise
const ready = (async () => {
  _sql = await initSqlJs()
  let buffer = null
  if (fs.existsSync(dbPath)) {
    buffer = fs.readFileSync(dbPath)
  }
  _db = buffer ? new _sql.Database(buffer) : new _sql.Database()
  // 建表
  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nickname TEXT,
      avatar TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (team_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      code TEXT UNIQUE NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('personal','team')),
      owner_type TEXT NOT NULL CHECK(owner_type IN ('user','team')),
      owner_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      content TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_type, owner_id);
    CREATE INDEX IF NOT EXISTS idx_files_type ON files(type);
    CREATE TABLE IF NOT EXISTS user_configs (
      user_id INTEGER PRIMARY KEY,
      ai_base_url TEXT,
      ai_api_key TEXT,
      ai_model TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)
  // 立即持久化一次
  db._save()
  return db
})()

module.exports = db
module.exports.ready = ready
