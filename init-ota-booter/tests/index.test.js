const assert = require('assert')
const initOtaBooter = require('../index.js')
const path = require('path')

class Espruino {
  constructor(){
    this.Config = {}
  }
}


class esp {
  constructor(){
    this._ranCache = []
  }
  expr(port, expr, cb){
    this._ranCache.push(expr)
    cb("a test string")
  }
  init(cb){
    global.Espruino = new Espruino()
    cb()
  }
}


const opts = {
  esp: new esp(),
  port: '/testport/path',
  clientBooterPath: path.join(__dirname, '../../client/base'),
  CDN_URL_PORT: "5858",
  WIFI_USERNAME: "test-wifi-username"
}


describe('initOtaBooter', function() {
  describe('factory instantiation', function() {
    it('should return an instance of otaBooter', function() {
      const otaBooter = initOtaBooter(opts)
      const setupFuncType = typeof otaBooter.setup
      assert.equal(setupFuncType, "function")
    })
  })
  describe('setup', function() {
    it('should build/upload/cache on first run', async function() {
      this.timeout(10000)
      
      const otaBooter = initOtaBooter(opts)
      await otaBooter.setup()
      debugger
      assert.equal(opts.esp._ranCache.length > 10, true)
      
    })
  })
})