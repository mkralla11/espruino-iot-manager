module.exports = function booter({
  modules,
  storage,
  http,
  wifi,
  random,
  cdnUrl,
  wifiUsername,
  wifiPassword,
  reset,
  load,
  retryErr=true,
  retryChgMax=Infinity,
  retryWait=5000
}){
  const S = storage()
  const H = http()
  const M = modules()
  let activeFlowId
  let atmpts = 1


  const bootLocal = require('../bootLocal')
  const delay = require('../delay')
  const smartWifi = require('../smartWifi')
  const get = require('../httpGet')({H})
  const atmptCon = require('../atmptCon')
  //  - Start Boot Process of app code
  //    - const hsh = storage().read('mnf_hsh')
  //    - const fileList = storage().read(hsh)
  //    - If fileList exists, loop over it and boot each one
  //  - Wifi connection
  //    - get creds if existing on board in storage - getWFCRD and connect
  //    - if not exists, use process.env creds and attempt to connect
  //  - Continual Fetch For Code
  //    - do a get request to cdnUrl for:
  //      - http://example.cdn.com/a/path/manifest_hash
  //    - which returns a hash of the current build manifest:
  //      - "sdfdw4rfjefsfsdlkfsflkj"
  //    - compare local storage().read('mnf_hsh') with the result returned
  //      by the endpoint
  //    - If they are the same, setTimeout and hit the endpoint again for compare
  //    - If different, that means there is new code/build available:
  //      - store new manifest hash storage().write('mnf_hsh', "sdfdlfsek3rf")
  //      - Fetch the actual manifest:
  //        - http://example.cdn.com/a/path/manifest.json
  //      - which returns:
  //        const data = {
  //          fileList: [
  //            "sdfeffqw",
  //            "sdfseffj",
  //            "vjgigvoi"
  //          ]
  //        }

  //      - store the manifest storage().write('sdfdlfsek3rf', data) 
  //      - reset(),load() (which will Start The Boot process)
  let failedAtmpts = 0

  function run(){

      activeFlowId = random()
      return bootFlow(activeFlowId)
        .then(()=>delay(retryWait))
        .catch((e)=>{
          if(retryErr && failedAtmpts < 5){
            failedAtmpts++;
            console.log('dead error occurred!', e)
            setTimeout(()=>{
              run()
            }, retryWait)
          }
        })
  }

  function bootFlow(flowId){
    return atmptCon({
          S,
          connect: smartWifi({wifi, random}).connect,
          wifiPassword,
          wifiUsername
      })
      .then(()=>{
        // console.log('first')
        return bootLocal({S, M, get, cdnUrl})
      }).then(()=>{
        // console.log('second')
        return fetchFlow(flowId)
      }).catch((e)=>{
        console.log('bootflow man!', e)
      })
  }




  function fetchFlow(flowId){
    /// 'fff3'

    return new Promise((resolve, reject)=>{
      function retry(){
        function hasWifi(){
          return require('../smartWifi')().hasWifi()
        }

        if(global.PREVENT_CODE_UPDATE){
          retryAgain()
          return
        }
        if(require('Wifi').getStatus().mode === 'AP' || !hasWifi()){
          // console.log('in AP mode...')
          retryAgain()
          return
        }

        get(cdnUrl + '/manifest_hash')
        .then((hsh)=>{
          try{
            // ['fff1', 'fff2']
            let hshs = S.readJSON('mnf_hsh') || []
            // 'fff2'
            // console.log('ex mnf', hshs)
            const cHsh = hshs[hshs.length - 1]
            // console.log('cHsh', cHsh)
            // console.log('ob hsh', hsh)
            if(hsh !== cHsh && hasWifi()){
              get(cdnUrl + '/' + hsh + '-manifest.json').then((data)=>{
                try{
                  // ['fff1', 'fff2', 'fff3']
                  hshs.push(hsh)
                  console.log('n hshs', hshs)
                  // 
                  return S.writeRetry('mnf_hsh', JSON.stringify(hshs)).then(()=>{
                    return S.writeRetry(hsh, JSON.stringify(data))
                  }).then(()=>{
                    // restart everything so that the boot process
                    // starts fresh!
                    reset()
                    return load()
                  }).catch((e)=>{
                    // console.log('error', e)
                    retryAgain(e)
                  })
                }
                catch(e){
                  // console.log('inner fail!', e)
                  retryAgain(e)
                }
              }).catch((e)=>{
                // console.log('fetchFlow fail!', e)
                retryAgain(e)
              })
            }
            else{
              retryAgain()
            }
          }
          catch(e){
            // console.log('fetch fail!', e)
            retryAgain(e)
          }
        }).catch((e)=>{
          // console.log('fetchFlow fail outer!', e)
          retryAgain({errorType: 'INTERNET'})
        })
      }

      function retryAgain(e){
        if(atmpts < retryChgMax){
          delay(retryWait).then(()=>{
            // only increment atmpts if 
            // there was an error and it doesn't
            // have to do with no internet connection 
            if(e && e.errorType !== 'INTERNET'){
              atmpts += 1
              console.log('retrying on bad error', e)
            }
            // console.log('trying again')
            return flowId === activeFlowId ? retry() : undefined
          })
        }
      }



      retry()
    })
  }

  return run().then(()=>{
    return {
      checkUpdates: fetchFlow
    }
  })
}

