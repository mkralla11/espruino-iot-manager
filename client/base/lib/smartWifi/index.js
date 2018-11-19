const promisify = require('../promisify')

let self

function smartWifi(opts){
  //  - Wifi singleton
  try{
    if(self){
      return self
    }
    const Wifi = opts.wifi()
    
    const smartWifi = {}

    for(var prop of Object.getOwnPropertyNames(Wifi)){
      if(Wifi[prop].bind){
        smartWifi[prop] = Wifi[prop].bind(Wifi)
      }
      else{
        smartWifi[prop] = Wifi[prop]
      }
    }

    SmartWifi = Object.assign({}, smartWifi, {
      connect(ssid, options, cb){
        this.attemptId = opts.random().toString()
        
        this.updateCreds(ssid, options, cb)
        this.retryConnect(0, this.attemptId)
      },

      retryConnect: function(curCredIdx, attemptId){
        const that = this
        return this.aGetDetails().then((details)=>{
          const cred = that.creds[curCredIdx]
          // always try to connect on the first attempt,
          // all other attempts should only try connecting if 
          // the current status is NOT CONNECTED
          const {ssid, options} = cred || {}
          console.log('trying to connect...')
          if(details.status === 'connected' && ssid && ssid === details.ssid){
            console.log('already connected!', ssid)
            that.callCbs()
          }
          else if(curCredIdx === 0 || attemptId === this.attemptId && cred){
            return that.aConnect(ssid, options).then(()=>{
              attemptId === that.attemptId ? that.callCbs() : null
            }).catch((e)=>{
              if(that.creds.length === curCredIdx + 1){
                // if there are no more creds to try,
                // call callbacks with error
                attemptId === that.attemptId ? that.callCbs(e) : null
              }
              else{
                return that.retryConnect(curCredIdx + 1, attemptId)
              }
            })
          }
        })
        
      },

      callCbs(e){
        e ? e.errorType = "WIFI" : null
        // console.log('calling callbacks', this.creds)
        this.creds.forEach(({cbs})=>
          cbs.forEach((cb)=>
            cb(e)
          )
        )
      },

      updateCreds(ssid, options, cb){
        const creds = this.creds.find(({ssid: cSsid, options: {password: cPswrd}})=>
          ssid === cSsid
        )
        if(creds){
          // always update password and cb
          creds.options = options
          if(!creds.cbs.find((curCb)=> curCb === cb)){
            creds.cbs.push(cb)
          }
        }
        else{
          this.creds.push({ssid, options, cbs: [cb]})
        }
        // make sure that if a priority is given,
        // that the highest priority connects first
        // (100 is higher than 1)
        this.creds.sort(({priority: a=0, priority: b=0})=>
          b - a
        )
      }
    })



    self = SmartWifi


    self.aGetDetails = promisify(Wifi.getDetails.bind(self), {firstArgNotError: true})
    self.connect = SmartWifi.connect.bind(self)
    self.aConnect = promisify(Wifi.connect.bind(self))
    self.creds = []

    return self
  }
  catch(e){
    console.log('in smartWifi!', e)
  }
}

smartWifi._removeSingleton = function(){
  if(self){
    self.attemptId = null
    self.creds = []
    self = null
  }
}

smartWifi._getCreds = function(){
  return self && self.creds
}

module.exports = smartWifi