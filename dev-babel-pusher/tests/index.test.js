const assert = require('assert')
const initDevBabelPusher = require('../index.js')

const opts = {
  port: '/testport/path',
  esp: {
    expr: (port, expr, cb)=>{
      cb("a test string")
    }
  },
  src: __dirname + '/data/src',
  devServerIp: "192.168.4.1"
}


describe('initDevBabelPusher', function() {
  describe('factory instantiation', function() {
    it('should return an instance of devBabelPusher', function() {
      const devBabelPusher = initDevBabelPusher(opts)
      const watchFuncType = typeof devBabelPusher.watch
      assert.equal(watchFuncType, "function")
    })
  })
  describe('watch', function() {
    it('should build/upload/cache on first run', function(done) {
      const devBabelPusher = initDevBabelPusher(opts)
      devBabelPusher.watch({
        afterPush: ()=>{
          assert.equal('afterPush success', 'afterPush success')
          devBabelPusher.close()
          done()
        }
      })

      
    })
    it('should return an object with pushedModuleMetaData in the afterPush callback on first run', function(done) {
      const devBabelPusher = initDevBabelPusher(opts)
      devBabelPusher.watch({
        afterPush: ({pushedModuleMetaData})=>{
          const pushedModuleDataType = typeof pushedModuleMetaData
          assert.equal(pushedModuleDataType, 'object')
          devBabelPusher.close()
          done()
        }
      })

      
    })
  })
})