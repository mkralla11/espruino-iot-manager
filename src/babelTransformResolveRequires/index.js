const path = require('path')
const fs = require('fs-extra')
const babel = require("babel-core")
// const shortid = require('shortid')
const {promisify} = require('util')
const rp = require('request-promise-native')
const UglifyJS = require("uglify-js")
const {mapObjIndexed} = require('ramda')
const tranformFileAsync = promisify(babel.transformFile.bind(babel))

// shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@')
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
  

  // function t (file) {
  //   return transform(file, src, dest, {
  //     filename:file,
  //     ...options
  //   })
  // }

  let config = await transformAndFollow(src, options)
  return config
}

// async function addEspruinoModuleCode(config){
//   const configNestedArray = Object.entries(config)

//   let proms = configNestedArray.map(([k, data])=>{
//     if(data.espruinoModuleName){
//       return getOrFetchEspruinoCodeFor(data.espruinoModuleName)
//     }
//   })

//   proms = proms.filter((prom)=>
//     !!prom
//   )

//   const espruinoModules = await Promise.all(proms)

//   return configNestedArray.map(([k, data])=>{
//     if(data.espruinoModuleName){
//       data.code = espruinoModules.shift()
//     }
//     return [k, data]
//   }).reduce(fromEntry, {})
// }

const normalModRgx = /require\(['|"](\^\^\^)?(\..+?)(\^\^\^)?(\^\^\^)?['|"]\)/g
// const espModRgx = /require\(['|"]espruino_module_(.+?)['|"]\)/g
const nodeModulesRgx = /require\(['|"](?!(\.|\/))(.+?)['|"]\)/g
const espModRgx = nodeModulesRgx


async function transformAndFollow(src, options){
  const babelOpts = options.babel
  const devServerIp = options.devServerIp
  let inc = 0
  const cache = {}
  // cache = {
  //   [filename]: {
  //     filenameId: shortid.generate(),
  //     isLoaded: true, // undefined
  //     code: String
  //   }
  // }

  async function transform(curSrc){
    try{
      if(cache[curSrc] && cache[curSrc].isLoaded){
        return
      }
      else if(cache[curSrc] && cache[curSrc].espruinoModuleName){
        await loadAndParseEspruinoModule(curSrc)
      }
      else if(cache[curSrc] && cache[curSrc].nodeModuleName){
        await loadAndParseNodeModule(curSrc)
      }
      else{
        await loadAndParse(curSrc) 
      }
    }
    catch(e){
      console.log('error in transform', e)
    }
  }



  async function loadAndParse(curSrc){
    // console.log('the src', curSrc)
    let promises = []
    let newPromises
    let code
    const filepath = await getFilepath(curSrc);

    // const dir = curSrc.replace(/\/(.+)(\.js)?$/, "")
    let alreadyLoaded

    Object.values(cache).map(({targetSrc, isLoaded})=>{
      if(targetSrc === curSrc && isLoaded){
        alreadyLoaded = true
      }
    })  

    if(alreadyLoaded){
      return 'file already loaded! ' + curSrc 
    }

    try{
      ({code} = await tranformFileAsync(filepath, {...babelOpts}));
    }catch(e){
      console.log('error tranformFileAsync', e)
    }
    code = replaceDevIp(code);
    code = replaceEnvVars(code);

    cache[curSrc] = cache[curSrc] || {position: inc}
    cache[curSrc].isLoaded = true;
    // 

    ({promises: newPromises} = replaceAndCacheNormalRequires(curSrc, code));

    await Promise.all(newPromises);

    ({promises: newPromises} = replaceAndCacheEspruinoRequires(curSrc, code));

    await Promise.all(newPromises);

    ({promises: newPromises} = replaceAndCacheNodeModulesRequires(curSrc, code));
    await Promise.all(newPromises);

    let {code: res} = UglifyJS.minify(code);

    cache[curSrc].code = res

    cache[curSrc].totalBytes = getBytesTotal(res)
    cache[curSrc].contentHash = generateContentHash(res)
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

  async function loadAndParseNodeModule(moduleName){
    try{
      // console.log('trying loadAndParseNodeModule')
      let promises = []
      let newPromises
      let code
      

      const fullpath = require.resolve(moduleName, {paths: [src]});
      if(fullpath[0] !== '/'){
        throw new Error(`Not a node module: ${fullpath}`)
      }

      if(moduleName === 'es6-symbol/polyfill'){
        
      }
      cache[fullpath].isLoaded = true
      try{
        ({code} = await tranformFileAsync(fullpath, {...babelOpts}));
      }catch(e){
        console.log('error tranformFileAsync', e)
      }

      // since we KNOW we are within a node module,
      // just assume all required modules from here on out is 
      // a node module as well
      ({code, promises: newPromises} = replaceAndCacheNormalRequires(fullpath, code));
      await Promise.all(newPromises);

      ({code, promises: newPromises} = replaceAndCacheEspruinoRequires(fullpath, code));
      await Promise.all(newPromises);

      ({code, promises: newPromises} = replaceAndCacheNodeModulesRequires(fullpath, code));
      await Promise.all(newPromises);


      promises = promises.concat(newPromises);
      ({code} = UglifyJS.minify(code));

      cache[moduleName].code = code
      cache[moduleName].totalBytes = getBytesTotal(code)
      cache[moduleName].contentHash = generateContentHash(code)

      // await Promise.all(promises)
    }
    catch(e){
      // console.log('error!', e)
      console.log('node_module code not found!', moduleName)
    }
  }


  async function loadAndParseEspruinoModule(moduleName){
    try{
      let promises = []
      let newPromises
      let code

      
      code = await getOrFetchEspruinoCodeFor(moduleName);
      if(cache[moduleName].isLoaded){
        return
      }
      cache[moduleName].isLoaded = true;
      
      
      ({code} = babel.transform(code, babelOpts));

      console.log('espruino code found!', moduleName);

      // since we KNOW we are within an espruino module,
      // just assume all required modules from here on out is 
      // an espruino module as well
      ({promises: newPromises} = replaceAndCacheEspruinoRequires(moduleName, code));
      await Promise.all(newPromises);

      ({code} = UglifyJS.minify(code));
      console.log('uglified', code);
      cache[moduleName].code = code
      // console.log('the code', moduleName, code)
      cache[moduleName].totalBytes = getBytesTotal(code)
      cache[moduleName].contentHash = generateContentHash(code)

      // await Promise.all(promises)
    }
    catch(e){
      if(e.statusCode === 404){
        console.log('No module on espruino site, must be native:', moduleName)
        

        cache[moduleName].native = true
        cache[moduleName].isLoaded = true

        let code = `
          module.exports = require('${moduleName}');
        `;
        ({code} = UglifyJS.minify(code));

        cache[moduleName].code = code
        // console.log('the code', moduleName, code)
        cache[moduleName].totalBytes = getBytesTotal(code)
        cache[moduleName].contentHash = generateContentHash(code)
      }
      else{
        console.log('error loadAndParseEspruinoModule', e)
      }
    }
  }

  const espWhitelist = ['http', 'Storage', 'fs', 'Wifi', 'crypto', 'net']
  function isInEspruinoCoreWhitelist(moduleName){
    for(curMod of espWhitelist){
      if(moduleName === curMod){
        return true
      }
    }
  }

  function replaceAndCacheEspruinoRequires(moduleName, code, opts={}){
    const promises = []
    const rgx = opts.regex || espModRgx

    code.replace(rgx, (match, ...captures)=>{

      const moduleName = captures[1]
      inc += 1

      // console.log('the espruino_module capture', moduleName)
      let prom
      if(!cache[moduleName] || !cache[moduleName].isLoaded){
        prom = new Promise(async (resolve, reject)=>{
          try{
            if(isInEspruinoCoreWhitelist(moduleName) || (await getOrFetchEspruinoCodeFor(moduleName))){
              cache[moduleName] = {
                position: inc,
                isLoaded: false,
                // filenameId: genId(moduleName),
                espruinoModuleName: moduleName
              }
              
              await transform(moduleName)
              resolve()
            }else{
              throw new Error(`not an espruino module ${moduleName}`)
            }
          }
          catch(e){
            await transform(moduleName)
            resolve(e)
          }
        })
      }
      else{
        cache[moduleName].position = inc
      }

      if(prom){
        promises.push(prom)
      }

      // const req = `require('${cache[moduleName].filenameId}')`
      // return match
    })

    // cache[moduleName].filenameId = genId(code)
    return {code, promises}
  }


  function replaceAndCacheNodeModulesRequires(newSrc, code){
    const promises = []
    code.replace(nodeModulesRgx, (match, ...captures)=>{

      let moduleName = captures[1]

      inc += 1

      let prom 
      try{
        moduleName = require.resolve(moduleName, {paths: [newSrc]});
        
        if(!cache[moduleName] || !cache[moduleName].isLoaded){
          cache[moduleName] = {
            position: inc,
            isLoaded: false,
            nodeModuleName: moduleName
          }
          prom = transform(moduleName)
        }

      }
      catch(e){
        cache[moduleName] = {
          position: inc,
          isLoaded: false,
          espruinoModuleName: moduleName
        }
        prom = transform(moduleName)
      }
      

      if(prom){
        promises.push(prom)
      }

      // const req = `require('${cache[newSrc].filenameId}')`
      // return match
    })
    // cache[moduleName].filenameId = genId(code)
    return {code, promises}
  }




  function replaceAndCacheNormalRequires(newSrc, code){
    let newSrcDir = newSrc
    if(!fs.lstatSync(newSrcDir).isDirectory()){
      newSrcDir = path.dirname(newSrcDir)
    }

    const promises = []
    code.replace(normalModRgx, (match, ...captures)=>{
      let targetSrc = captures[1]

      inc += 1

      let targetSrcFullPath = targetSrc
      try{
        targetSrcFullPath = require.resolve(targetSrc, {paths: [newSrcDir]})
      
        // console.log('the normal module capture', targetSrc)
        let prom 
        if(!cache[targetSrcFullPath] || !cache[targetSrcFullPath].isLoaded){
          cache[targetSrcFullPath] = {
            targetSrc,
            position: inc,
            isLoaded: false
          }
          prom = transform(targetSrcFullPath)
        }
        else{
          cache[targetSrcFullPath].position = inc
        }
      

      if(prom){
        promises.push(prom)
      }

      }
      catch(e){
        return {code, promises}
      }


      

      // const req = `require('${cache[newSrc].filenameId}')`
      // return match
    })
    // cache[moduleName].filenameId = genId(code)
    return {code, promises}
  }

  function replaceDevIp(code){
    return code.replace(/process.env.DEV_SERVER_IP/, `"${devServerIp}"`)
  }





  async function addFilenameIdsToCacheConfigsAndUpdate(){
    const entries = Object.entries(cache)
    for(const [moduleName, config] of entries){
      if(config.code){
        config.filenameId = genId(config.code)
      }
      else{
        throw new Error(`Code does not existing for ${moduleName}!`)
      }
    }

    // replaceForCaptureIdx0 = createGetFilenameIdRequireViaModNameFromCache({captureIdx: 0})
    // replaceForCaptureIdx1 = createGetFilenameIdRequireViaModNameFromCache({captureIdx: 1})

    for(const [moduleName, config] of entries){
      let code = config.code
      code = code.replace(nodeModulesRgx, createGetFilenameIdRequireViaModNameFromCache({moduleName, captureIdx: 1}))
      code = code.replace(normalModRgx, createGetFilenameIdRequireViaModNameFromCache({moduleName, captureIdx: 1}))
      // code = code.replace(espModRgx, replaceForCaptureIdx1)
      
      config.code = code
    }
  }

  function createGetFilenameIdRequireViaModNameFromCache({moduleName: parentModuleName, captureIdx}){
    return (match, ...captures)=>{
      let moduleName = captures[captureIdx]
      if(moduleName === 'es6-symbol/polyfill'){
        
      }
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


  
  await transform(src)
  await addFilenameIdsToCacheConfigsAndUpdate()
  throwIfCodeOverTotalAllowedBytes()
  logStats()



  cache[src].entryPoint = true
  console.log('completed transform!', cache)
  return cache
}

async function getFilepath(src){
  // console.log('trying to get file', src)
  try{
    await fs.readFile(src)
    // console.log('found file from path', src)
    return src
  }
  catch(e){
    try{
      await fs.readFile(src + "/index.js")
      // console.log('refound file from path', src + "/index.js")
      return src + "/index.js"
    }
    catch(e){
      // console.log('falling back to node_modules', src)
      return src
    }
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


