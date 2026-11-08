import EventEmitter from 'eventemitter3'

// 事件总线：保持官方代码中的 $on/$off/$emit 调用签名
class Bus {
  constructor() {
    this.e = new EventEmitter()
  }
  $on(name, fn) {
    this.e.on(name, fn)
  }
  $off(name, fn) {
    this.e.off(name, fn)
  }
  $emit(...args) {
    this.e.emit(...args)
  }
}

export default new Bus()
