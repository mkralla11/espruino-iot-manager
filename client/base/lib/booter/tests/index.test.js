const assert = require('assert')
const booter = require('../index.js')
const smartWifi = require('../../smartWifi')

const createWifiClassMock = function({connectError}={}){

  const WifiClassMock = {
    detailsStatus: 'off',
    connect(ssid, options, cb){
      setTimeout(function(){
        let error
        if(connectError){
          error = new Error("connection timeout")
        }
        cb(error)
      }, 100)
    },
    getDetails(cb){
      setTimeout(function(){
        cb({
          status: WifiClassMock.detailsStatus
        })
      }, 100)
    },
    _changeGetDetailsStatus(status){
      WifiClassMock.detailsStatus = status
    }
  }
  return WifiClassMock
}

const createHttpMock = function({requestGetError}={}){
  class Http {
    constructor(...args){
      // super(...args)
      this._manifestFlowIdx = 0
      this.manifestHashes = ['abcdefg', 'hijklmn']

      this.fileNamesAndContentArrays = {
        'script-1': [`
          var man = "cool";
          function sweet(){man = "reset variable"};`
        ],
        'script-2': [`
          var dude = "the dude";
          function getDude(){return dude};`
        ],
        'script-3': [`
          var last = "the last";
          function getLast(){return last};`
        ],
        'script-4': [`
          var wan = "apple";
          function orange(){wan = "reset wan variable"};`
        ],
        'script-5': [`
          var newlast = "the new last";
          function getLast(){return newlast};`
        ]
      }


      this.fileLists = {
        abcdefg: {
          fileList: [
            'script-1',
            'script-2',
            'script-3'
          ]
        },
        hijklmn: {
          fileList: [
            'script-4',
            'script-2',
            'script-5'
          ]
        }
      }
    }
    get = (url, cb)=>{
      let data
      if(/manifest_hash$/.test(url)){
        data = this._getManifestHashForStreaming()
      }
      else if(/-manifest.json$/.test(url)){
        const filename = url.match(/\/([^\/]+)\/?$/)[1]
        const hsh = filename.split(/-manifest.json$/)[0]
        data = this._getManifestJsonForStreaming(hsh)
      }
      else{
        // it must be a script file
        data = this._getScriptForStreaming(url)
      }

      setTimeout(async ()=>{
        const response = createResponseMock()
        cb(response)
        await response.streamData(data)
      }, 100)
      return {
        on: (name, cb)=>{
          // for now don't stub out
        }
      }
    }
    _getManifestHashForStreaming(){
      return [this.manifestHashes[this._manifestFlowIdx]]
    }
    _getManifestJsonForStreaming(hsh){
      return [JSON.stringify(this.fileLists[hsh])]
    }
    _getScriptForStreaming(url){
      let name = url.slice(url.lastIndexOf('/') + 1, -3)
      const data = this.fileNamesAndContentArrays[name]
      if(!data){
        throw new Error(`http._getScript for ${url} with name '${name}' does not exist!!!`)
      }
      return data
    }
    _changeToManifestFlow(idx){
      this._manifestFlowIdx = idx
    }
  }

  return new Http()
}

const createResponseMock = function(){
  class Response {
    constructor(...args){
      // super(...args)
      this._listeners = []
    }
    on(e, f){
      this._listeners.push([e, f])
    }
    off(e, f){
      this._listeners = this._listeners.filter(([ce, cf])=> ce !== e || cf !== f)
    }
    streamData = async (data)=>{
      for(const item of data){
        await this.stream('data', item)
      }
      await this.stream('close', data)
    }
    stream = (event, item)=>{
      return new Promise((resolve, reject)=>{
        setTimeout(()=>{
          this.callListeners(event, item)
          resolve()
        }, 100)
      })
    }
    callListeners(e, ...args){
      this._listeners.forEach(([ce, cf])=>
        ce === e ? cf(...args) : undefined
      )
    }
  }
  return new Response()
}

const createStorageMock = function(){
  class Storage {
    constructor(...args){
      // super(...args)
      this.cache = {}
      this._deleted = {}
    }
    read(name){
      return this.cache[name]
    }
    readJSON(name){
      try{
        return JSON.parse(this.read(name))
      }
      catch(e){
      }
    }
    write(name, data){
      this.cache[name] = data
      return true
    }
    writeRetry(name, data){
      const that = this
      let a = 0
      function store(){
        return new Promise((resolve, reject)=>{
          const r = that.write(name, data)
          
          if(!r && a < 10){
            a++;
            console.log(`err file write ${name}! retry...`)
            setTimeout(function(){
              store().resolve(resolve).reject(reject)
            }, 50);
          }
          else if(a >= 10){
            console.log('giving up!!!')
            reject(new Error(`could not store ${name}!`))
          }
          else{
            resolve(true)
          }
        })
      }
      return store()
    }
    erase(name){
      const data = this.cache[name]
      delete this.cache[name]
      this._deleted[name] = data
    }
  }
  return new Storage()
}

const createModulesMock = function(){
  class Modules {
    constructor(...args){
      // super(...args)
      this.cache = {}
    }
    addCached(name, data){
      this.cache[name] = data
    }
  }
  return new Modules()
}

const delay = (ms)=>
  new Promise((resolve)=>
    setTimeout(()=>
      resolve()
    , ms)
  )


describe('booter', function() {
  describe('factory instantiation', function() {
    function createMocks(){
      const WifiClassMock = createWifiClassMock()
      const HttpMock = createHttpMock()
      const StorageMock = createStorageMock()
      const ModulesMock = createModulesMock()
      return {
        WifiClassMock,
        HttpMock,
        StorageMock,
        ModulesMock
      }
    }

    const mocks = createMocks()

    const booterOptions = {
      storage(){
        return mocks.StorageMock
      },
      http(){
        return mocks.HttpMock
      },
      wifi(){
        return mocks.WifiClassMock
      },
      random(){
        return Math.random()
      },
      modules(){
        return mocks.ModulesMock
      },
      reset(){

      },
      load: async function(){
        await booter(booterOptions)
      },
      cdnUrl: 'http://test.com/static',
      wifiUsername: 'test-username',
      wifiPassword: 'test-password',
      retryErr: false,
      retryWait: 0,
      retryChgMax: 0
    }



    it('should run the booter correctly', async function() {
      this.timeout(10000)

      const boot = await booter(booterOptions)
      await delay(100)
      mocks.WifiClassMock._changeGetDetailsStatus('connected')
      const creds = smartWifi._getCreds()
      const didFindAccurateCreds = !!creds.find(({ssid: cSsid, options: {password: cPswrd}})=>
        cSsid === booterOptions.wifiUsername
      )
      
      assert.equal(didFindAccurateCreds, true)
      booterOptions.http()._changeToManifestFlow(1)
      await boot.checkUpdates()
      assert.equal(booterOptions.storage().cache.hijklmn, '{"fileList":["script-4","script-2","script-5"]}')
    })
  })
})