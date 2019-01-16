const assert = require('assert')
const Pulser = require('../index.js')
const path = require('path')


describe('Pulser', function() {
  this.timeout(10000)
  describe('Action Type Pulse', function() {
    it('should add new pulse opt to queue and pulse', function(done){
      let attempt = 0
      Pulser('PULSE', {pin: 'D12', total: 3, write})
      
      function write(pin, val){
        // console.log('writing:', pin, val)
        if(attempt < 6){
          assert.equal(val, !(attempt % 2))
        }
        if(attempt === 6){
          assert.equal(val, false)
        }
        
        if(attempt >= 6){
          done()
          return
        }
        attempt++
      }
    })


    it('should handle multi pulse adds', function(done){
      let attempt = 0
      Pulser('PULSE', {pin: 'D12', total: 2, write})
      Pulser('PULSE', {pin: 'D14', total: 3, onDur: 400, write})

      function write(pin, val){
        // console.log('writing:', pin, val)
        if(attempt < 4){
          assert.equal(val, !(attempt % 2))
        }
        else if(attempt === 4){
          assert.equal(val, false)
        }
        else if(attempt < 10){
          assert.equal(val, attempt % 2)
        }
        else if(attempt === 10){
          assert.equal(val, false)
        }


        if(attempt > 10){
          console.log('calling done')
          done()
          return
        }
        attempt++
      }
    })


    it('should handle multi pulse adds and cancel prev if over waitPrevMax', function(done){
      let attempt = 0
      Pulser('PULSE', {pin: 'D12', total: 5, write})
      Pulser('PULSE', {pin: 'D14', total: 3, onDur: 400, waitPrevMax: 300, write})

      function write(pin, val){
        // console.log('writing:', pin, val)
        if(attempt < 3){
          assert.equal(val, !(attempt % 2))
        }
        else if(attempt < 8){
          assert.equal(val, !(attempt % 2))
        }
        else if(attempt === 8){
          assert.equal(val, false)
        }


        if(attempt === 8){
          console.log('calling done')
          done()
          return
        }
        attempt++
      }
    })


  })
})