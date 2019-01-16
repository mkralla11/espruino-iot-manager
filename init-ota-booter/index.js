const path = require('path')
const argOrDefault = require('../src/argOrDefault')
const { exec } = require('child_process')
const fetchLocalIp = require('../src/fetchLocalIp')
const setEspConfigOptions = require('../src/setEspConfigOptions')
const transform = require('../src/babelTransformResolveRequires')
const getBabelOptions = require('../src/getBabelOptions')
const sortCompiledScriptConfig = require('../src/sortCompiledScriptConfig')
const loadAndMinify = require('../dev-babel-pusher/loadAndMinify')
const generateFileListFromSortedConfig = require('../src/generateFileListFromSortedConfig')
const {pluck} = require('ramda')
const UglifyJS = require("uglify-js")

// const fsUnlinkFuncStr = `require('fs').unlinkSync`
// const fsWriteFileFuncStr = `require('fs').writeFile`


const fsUnlinkFuncStr = `require('Storage').erase`
const fsWriteFileFuncStr = `require('Storage').write`

function initOtaBooter({
  esp,
  port,
  clientBooterPath,
  WIFI_USERNAME,
  WIFI_PASSWORD='',
  CDN_URL,
  CDN_URL_PORT
}){

  if(!WIFI_USERNAME){
    throw new Error("WIFI_USERNAME is required for init-ota-booter!")
  }

  let ESP
  const babelOptions = getBabelOptions({src: clientBooterPath})
  const bootcdeFileListKeyName = "bootFL"

  async function setup(){
    await setupEsp()
    const config = await compileOtaBooter()
    const sortedFileListConfig = pluck(1)(config.sortedConfig)
    await initializeDefaultWifiUsernameAndPassword(WIFI_USERNAME, WIFI_PASSWORD, CDN_URL)
    await initializeFsArea()
    // await smartDelBootLoader(sortedFileListConfig)
    await storeBooterFileListFromConfigOnDevice(sortedFileListConfig)
    await storeBooterScriptsFromConfigOnDevice(sortedFileListConfig)
    await storeBootCdeForBooterToLoadOnDevice()

  }

  async function smartDelBootLoader(config){
    const newBootLoaderFileList = generateFileListFromSortedConfig(config)
    const smartDelBootLoaderPath = __dirname + '/smartDelBootLoader'
    console.log('newBootLoaderFileList', newBootLoaderFileList)
    const smartDelScriptsConfig = await transform(
      smartDelBootLoaderPath, 
      {
        babel: getBabelOptions({src: smartDelBootLoaderPath}), 
        throwIfCodeOverTotalAllowedBytes: 4000,
        replace: [
          {
            rgx: /process.env.NEW_BOOTLOADER_FILE_LIST/,
            replaceWith: JSON.stringify(newBootLoaderFileList),
          },
          {
            rgx: /process.env.BL_FILE_LIST_KEY_NAME/,
            replaceWith: `"${bootcdeFileListKeyName}"`
          }
        ]
      }
    )
    let sortedSmartDelScriptsConfig = sortCompiledScriptConfig(smartDelScriptsConfig)
    sortedSmartDelScriptsConfig = JSON.stringify(pluck(1)(sortedSmartDelScriptsConfig))

    console.log('running smartDelBootLoader:', sortedSmartDelScriptsConfig)

    let expr = `
      (function(){
        for(var config of ${sortedSmartDelScriptsConfig}){
          console.log('adding smbl script', config.filenameId);
          Modules.addCached(config.filenameId, config.code);
        }
      })()
    `;


     
     console.log('running expr:', expr);

    await runExpression(port, expr)
  }

  async function initializeFsArea(){
    const expr = `
      (function(){try {
        var fs = require('fs')
        fs.readdirSync();
       } catch (e) { //'Uncaught Error: Unable to mount media : NO_FILESYSTEM'
        console.log('Formatting FS - only need to do once');
        E.flashFatFS({ format: true });
      }})()
    `
    await runExpression(port, expr)
  }


  async function initializeDefaultWifiUsernameAndPassword(u, p, cdnUrl){
    if(u && p){
      const expr = `
        (function(){
          try {
            var s = require('Storage');
            s.write('D_WU', '${u}');
            s.write('D_WP', '${p}');
            s.write('D_CDN', '${cdnUrl}');
         } catch (e) {
          console.log('Could not store default wifi u/p and CDN_URL');
        }})()
      `
      await runExpression(port, expr)
    }
  }


  async function storeBooterFileListFromConfigOnDevice(config){
    const fileList = generateFileListFromSortedConfig(config)
    const expr = `(function(){
      reset();
      try{
        ${fsUnlinkFuncStr}('${bootcdeFileListKeyName}');
      }
      catch(e){
        console.log("'${bootcdeFileListKeyName}' file not exist")
      }
      ${fsWriteFileFuncStr}('${bootcdeFileListKeyName}', '${JSON.stringify({fileList})}');
    })()
    `

    console.log('the fileList run expression', expr)
    await runExpression(port, expr)
  }


  async function storeBooterScriptsFromConfigOnDevice(config){
    for (const data of config){
      let {code, filenameId, entryPoint} = data
      if(entryPoint){
        console.log('found entry point!', filenameId)
      }

      async function store(){
        const expr = `
          
          (function(){
            reset();
            var a = 0;
            function store(){
              
              var r = ${fsWriteFileFuncStr}("${filenameId}", ` + JSON.stringify(code) + `);
              
              if(!r && a < 10){
                a++;
                console.log('could not open file! ${filenameId}, trying again...');
                setTimeout(function(){
                  store();
                }, 50);
              }
              else if(a >= 10){
                console.log('giving up!!!');
              }
            }
            store();

          })()
        `
        console.log('the run expression', expr)
        const res = await runExpression(port, expr)
        if(/FILE_STORE_ERROR/.test(res)){
          console.log(`ERROR STORING FILE!!! RETRYING ${filenameId}`)
          await store()
        }
      }
      await store()
    }
  }



  async function storeBootCdeForBooterToLoadOnDevice(){
    const flashLoaderRuntime = await loadAndMinify(
      __dirname + '/../src/FlashLoader/index.js', 
      {
        babelOptions, 
        replace: [{
          rgx: /process.env.FILE_LIST_KEY_NAME/,
          replaceWith: `"${bootcdeFileListKeyName}"`
        }]
      }
    )

    console.log('flashing FlashLoader runtime:', flashLoaderRuntime)
    expr = "require('Storage').write('.bootcde', " + JSON.stringify(flashLoaderRuntime) + "),reset(),load()"


    await runExpression(port, expr)
  }



  async function compileOtaBooter(){
    return await genConfigFromPath(clientBooterPath)
  }

  async function genConfigFromPath(src){
    let ip = await fetchLocalIp()
    ip = `http://${ip}`
    const cdnUrlPort = CDN_URL_PORT ? `:${CDN_URL_PORT}` : ''

    const config = await transform(
      src, 
      {
        babel: babelOptions, 
        throwIfCodeOverTotalAllowedBytes: 4000,
        replace: [
          {
            rgx: /process.env.CDN_URL/,
            replaceWith: `"${CDN_URL || ip}${cdnUrlPort}"`
          },
          {
            rgx: /process.env.WIFI_USERNAME/,
            replaceWith: `"${WIFI_USERNAME}"`
          },
          {
            rgx: /process.env.WIFI_PASSWORD/,
            replaceWith: `"${WIFI_PASSWORD}"`
          }
        ]
      }
    )

    const sortedConfig = sortCompiledScriptConfig(config)
    const data = {config, sortedConfig}
    // debugger
    return data
  }


  async function setupEsp(){
    ESP = await espInit()
    setEspConfigOptions(ESP)
  }

  function espInit(){
    return new Promise((resolve, reject)=>{
      esp.init(()=>{
        resolve(Espruino)
      })
    })
  }


  function runExpression(port, expr){
    return new Promise((resolve)=>{
      esp.expr(port, expr, (res)=>
        resolve(res)
      )
    }) 
  }



  return {
    setup
  }
}

module.exports = initOtaBooter