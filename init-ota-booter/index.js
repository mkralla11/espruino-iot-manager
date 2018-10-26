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
    await storeBooterFileListFromConfigOnDevice(sortedFileListConfig)
    await storeBooterScriptsFromConfigOnDevice(sortedFileListConfig)
    await storeBootCdeForBooterToLoadOnDevice()

  }


  async function storeBooterFileListFromConfigOnDevice(config){
    const fileList = generateFileListFromSortedConfig(config)
    const expr = `reset(),require('Storage').erase('${bootcdeFileListKeyName}'),require('Storage').write('${bootcdeFileListKeyName}', ` + JSON.stringify({fileList}) + ")"
    console.log('the fileList run expression', expr)
    await runExpression(port, expr)
  }


  async function storeBooterScriptsFromConfigOnDevice(config){
    for (const data of config){
      let {code, filenameId, entryPoint} = data
      if(entryPoint){
        console.log('found entry point!', filenameId)
      }

      const expr = "require('Storage').write(" + `"${filenameId}"` + ", " + JSON.stringify(code) + ")"
      console.log('the run expression', expr)
      await runExpression(port, expr)
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
    expr = "E.setBootCode(" + JSON.stringify(flashLoaderRuntime) + ",true),reset(),load()"
    await runExpression(port, expr)
  }



  async function compileOtaBooter(){
    return await genConfigFromPath(clientBooterPath)
  }

  async function genConfigFromPath(src){
    const ip = await fetchLocalIp()
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