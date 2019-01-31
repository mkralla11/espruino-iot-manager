const path = require('path')
const fs = require('fs-extra')
const babel = require("@babel/core")
// const shortid = require('shortid')
const {promisify} = require('util')
const rp = require('request-promise-native')
const Terser = require("terser")
const {mapObjIndexed, find, propEq, map} = require('ramda')
const tranformFileAsync = promisify(babel.transformFile.bind(babel))
const transformCode = babel.transform.bind(babel)
const sortCompiledScriptConfig = require('../sortCompiledScriptConfig')

const fnv = require('fnv-plus')

const alpha = 'abcdefghijklmnopqrstuvwxyz'
const digits = /(\d)/g

function genId(src){
  let res = fnv.hash(src, 64).str().slice(0,8)
  // console.log('fnv hash', res)
  res = res.replace(digits, (match)=>{
    // debugger
    return alpha[parseInt(match)]
  })
  return res
}

function generateContentHash(content){
  // return fnv.hash(content, 64).str()
  return
}

module.exports = async (src, options={}) => {
  src = path.resolve(src)
  



  let config = await transformAndFollow(src, options)
  return config
}



const moduleRgx = /require\(['|"](.+?)['|"]\)/g
// const espModRgx = /require\(['|"]espruino_module_(.+?)['|"]\)/g
// const nodeModulesRgx = /require\(['|"](?!(\.|\/))(.+?)['|"]\)/g
// const nodeModulesRgx = normalModRgx
// const espModRgx = nodeModulesRgx


async function transformAndFollow(src, options){
  const entryPoint = src
  const babelOpts = options.babel
  const devServerIp = options.devServerIp
  let inc = 0
  const positionCache = {}
  const cache = {}
  // cache = {
  //   [filename]: {
  //     filenameId: shortid.generate(),
  //     isLoaded: true, // undefined
  //     code: String
  //   }
  // }

  async function transform(curSrc, requiredFrom){
    await loadModules(curSrc, requiredFrom)
  }

  async function loadModules(curSrc, requiredFrom){

    if(isInEspruinoCoreWhitelist(curSrc)){
      src = curSrc

      cache[src] = cache[src] || {required: []}
      cache[src].src = src
      cache[requiredFrom].required.push(src) 
      cache[src].espruinoModule = true

      if(cache[src].isLoading){
        return
      }
      cache[src].isLoading = true





      await loadEspModule(src)
    }
    else{


      let {found, src} = await getFilepath(curSrc, requiredFrom)



      if(found){
        cache[src] = cache[src] || {required: []}
        if(requiredFrom === entryPoint){
          cache[src].entryPoint = true
        }
        else{
          cache[requiredFrom].required.push(src) 
        }

        if(cache[src].isLoading){
          return
        }
        cache[src].isLoading = true
        cache[src].src = src


        await loadNormalModule(src)
      }
      else{
        throw new Error(`Module not found and is not esp module: ${curSrc}`)
      }
    }
  }

  async function loadNormalModule(src){
    // let rawCode = (await fs.readFile(src)).toString()
    let {code: rawCode} = await tranformFileAsync(src, {...babelOpts})
    
    rawCode = replaceDevIp(rawCode)
    rawCode = replaceEnvVars(rawCode)

    cache[src].rawCode = rawCode

    await parseModuleAndFollow(rawCode, src)
  }


  async function loadEspModule(src){
    try{
      let rawCode = await getOrFetchEspruinoCodeFor(src)
      // do not babelify crypto!!!
      if(src !== 'crypto'){
        let {code} = transformCode(rawCode, {...babelOpts})
        rawCode = code
      }
      cache[src].rawCode = rawCode
      await parseModuleAndFollow(rawCode, src)

    }
    catch(e){
      if(e.statusCode === 404){
        console.log('No module on espruino site, must be native:', src)
        cache[src].native = true
        let rawCode = `module.exports = require('${src}');`;
        cache[src].rawCode = rawCode
      }
    }
  }


  async function parseModuleAndFollow(rawCode, src){
    const proms = []
    rawCode.replace(moduleRgx, (match, ...captures)=>{
      const moduleName = captures[0]
      proms.push(transform(moduleName, src))
    })
    await Promise.all(proms)
  }


  function replaceEnvVars(code){
    if(options.replace){
      for(replaceConfig of options.replace){
        // {
        //   rgx: /process.env.FILE_LIST_KEY_NAME/,
        //   replaceWith: `"${fileListKeyName}"`
        // }
        code = code.replace(replaceConfig.rgx, replaceConfig.replaceWith)
      }
    }
    return code
  }



  const espWhitelist = ['http', 'Storage', 'fs', 'Wifi', 'crypto', 'net', 'ws']
  function isInEspruinoCoreWhitelist(moduleName){
    for(curMod of espWhitelist){
      if(moduleName === curMod){
        return true
      }
    }
  }


  function replaceDevIp(code){
    return code.replace(/process.env.DEV_SERVER_IP/, `"${devServerIp}"`)
  }

  const minOpts = {
    module: true,
    mangle: {
      toplevel: true,
    },
    nameCache: {}
  }



  async function addFilenameIdsToCacheConfigsAndUpdate(){
    addPositions(cache)
    const entries = sortCompiledScriptConfig(cache)
    // debugger
    // for(const [moduleName, config] of entries){
    //   if(config.code){
    //     config.filenameId = genId(config.code)
    //   }
    //   else{
    //     throw new Error(`Code does not existing for ${moduleName}!`)
    //   }
    // }

    // replaceForCaptureIdx0 = createGetFilenameIdRequireViaModNameFromCache({captureIdx: 0})
    // replaceForCaptureIdx1 = createGetFilenameIdRequireViaModNameFromCache({captureIdx: 1})
    for(const [moduleName, config] of entries){
      if(config.native){
        config.filenameId = moduleName
        config.code = config.rawCode
      }
      else{

        let rawCode = config.rawCode
        if(!rawCode){
          throw new Error(`rawCode not created for config: ${JSON.stringify(config)}`)
        }
        let code = rawCode
        // don't minify crypto :( it breaks shit
        if(moduleName !== 'crypto'){
          const res = Terser.minify({
            [moduleName]: rawCode
          }, minOpts)
          code = res.code
        }
        code = code.replace(moduleRgx, createGetFilenameIdRequireViaModNameFromCache({moduleName, captureIdx: 0}))
        config.filenameId = genId(code)

        config.code = code
      }
      config.totalBytes = getBytesTotal(config.code)
    }

    for(const [moduleName, config] of entries){
      if(config.native){
        delete cache[moduleName]
      }
    }
  }

  function createGetFilenameIdRequireViaModNameFromCache({moduleName: parentModuleName, captureIdx}){
    return (match, ...captures)=>{
      let moduleName = captures[captureIdx]

      if(!cache[moduleName]){
        let moduleNameDir = parentModuleName
        let turnIntoDir
        try{
          turnIntoDir = !fs.lstatSync(parentModuleName).isDirectory() && fs.lstatSync(parentModuleName).isFile()
        }
        catch(e){
          turnIntoDir = false
        }


        if(turnIntoDir){
          try{
            moduleNameDir = path.dirname(parentModuleName)
          }catch(e){
            console.log('error in createGetFilenameIdRequireViaModNameFromCache', e)
          }
        }
        try{
          moduleName = require.resolve(moduleName, {paths: [moduleNameDir]})
        }
        catch(e){
          console.log('error in createGetFilenameIdRequireViaModNameFromCache', e)
        }
      }

      try{
        if(moduleName !== parentModuleName){
          return `require('${cache[moduleName].filenameId}')`
        }
        else{
          return `require('${moduleName}')`
        }
      }
      catch(e){
        console.log('error in createGetFilenameIdRequireViaModNameFromCache', e)
        throw e
      }
    }
  }

  function throwIfCodeOverTotalAllowedBytes(){
    if(options.throwIfCodeOverTotalAllowedBytes){
      const entries = Object.entries(cache)
      for(const [moduleName, config] of entries){
        if(config.totalBytes > options.throwIfCodeOverTotalAllowedBytes){
          console.log(cache)
          throw new Error(`Module '${ moduleName}' is ${config.totalBytes} bytes! Over the allowed ${options.throwIfCodeOverTotalAllowedBytes} byte amount.`)
        }
      }
    }
  }

  function logStats(){
    const cacheEntries = Object.entries(cache)
    const totalBytes = cacheEntries.reduce((acc, [k, config])=>{
      acc += config.totalBytes
      return acc
    }, 0)
    const totalModules = cacheEntries.length

    console.log('All modules total bytes:', totalBytes)
    console.log('Modules count:', totalModules)
  }


  
  await transform(src, src)
  await addFilenameIdsToCacheConfigsAndUpdate()
  throwIfCodeOverTotalAllowedBytes()
  logStats()


  // console.log(cache)
  // cache[src].entryPoint = true
  console.log('completed transform!', cache)
  return cache
}

async function getFilepath(src, requiredFrom){
  try{
    requiredFrom = requiredFrom.replace(/\/index\.js$/, "")
    src = require.resolve(src, {paths: [requiredFrom]})
    return {found: true, src}
  }
  catch(e){
    return {found: false}
  }
}


const fromEntry = (obj, [k, v]) => ({ ...obj, [k]: v })


const espUrl = 'https://www.espruino.com/modules/'

async function getOrFetchEspruinoCodeFor(moduleName){
  console.log('fetching:', espUrl + moduleName + '.js')
  const js = await rp(espUrl + moduleName + '.js')
  return js
}



function getBytesTotal(str){
  return Buffer.byteLength(str, 'utf8')
}


function addPositions(cache){
  const entrySrc = find(propEq('entryPoint', true), Object.values(cache)).src
  let position = 0
  const processed = {}
  addPositionAndFollow(entrySrc)
  

  function addPositionAndFollow(curSrc, curTree){
    cache[curSrc].position = position
    console.log(curSrc, position)
    // if(processed[curSrc]){
    //   return
    // }
    processed[curSrc] = true
    if(cache[curSrc].required && cache[curSrc].required.length){
      // console.log('requiring:', cache[curSrc].required)
      map((item)=>{
        position += 1
        addPositionAndFollow(item)
      }, cache[curSrc].required)
    }
  }
}


