const path = require('path')
const fs = require('fs-extra')
const babel = require("babel-core")
// const shortid = require('shortid')
const {promisify} = require('util')
const rp = require('request-promise-native')
const UglifyJS = require('uglify-js')

const tranformFileAsync = promisify(babel.transformFile.bind(babel))

// shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@')
const fnv = require('fnv-plus')

function genId(src){
  return fnv.hash(src, 64).str().slice(0,8)
}

function generateContentHash(content){
  return fnv.hash(content, 64).str()
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

const normalModRgx = /require\(['|"]\^\^\^(.+?)\^\^\^['|"]\)/g
const espModRgx = /require\(['|"]espruino_module_(.+?)['|"]\)/g




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
    if(cache[curSrc] && cache[curSrc].isLoaded){
      return
    }
    else if(cache[curSrc] && cache[curSrc].espruinoModuleName){
      await loadAndParseEspruinoModule(curSrc)
    }
    else{
      await loadAndParse(curSrc) 
    }
  }



  async function loadAndParse(curSrc){
    console.log('the src', curSrc)
    let promises = []
    let newPromises
    let code
    const filepath = await getFilepath(curSrc);

    // const dir = curSrc.replace(/\/(.+)(\.js)?$/, "")
  

    ({code} = await tranformFileAsync(filepath, {...babelOpts}));
    code = replaceDevIp(code);

    cache[curSrc] = cache[curSrc] || {position: inc}
    cache[curSrc].isLoaded = true;

    ({code, promises: newPromises} = replaceAndCacheNormalRequires(curSrc, code));
    promises = promises.concat(newPromises);

    ({code, promises: newPromises} = replaceAndCacheEspruinoRequires(curSrc, code));
    promises = promises.concat(newPromises);

    ({code} = UglifyJS.minify(code));
    cache[curSrc].code = code
    cache[curSrc].totalBytes = getBytesTotal(code)
    cache[curSrc].contentHash = generateContentHash(code)


    // console.log('final code', out)
    // console.log('all proms', promises)
    await Promise.all(promises)
  }


  async function loadAndParseEspruinoModule(moduleName){
    try{
      let promises = []
      let newPromises
      let code
      cache[moduleName].isLoaded = true
      code = await getOrFetchEspruinoCodeFor(moduleName);
      
      ({code} = babel.transform(code, babelOpts));

      console.log('espruino code found!', moduleName);

      // since we KNOW we are within an espruino module,
      // just assume all required modules from here on out is 
      // an espruino module as well
      ({code, promises: newPromises} = replaceAndCacheEspruinoRequires(moduleName, code, {regex: /require\(['|"](.+?)['|"]\)/g}));

      promises = promises.concat(newPromises);
      ({code} = UglifyJS.minify(code));

      cache[moduleName].code = code
      cache[moduleName].totalBytes = getBytesTotal(code)
      cache[moduleName].contentHash = generateContentHash(code)

      await Promise.all(promises)
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
        cache[moduleName].totalBytes = getBytesTotal(code)
        cache[moduleName].contentHash = generateContentHash(code)
      }
    }
  }




  function replaceAndCacheEspruinoRequires(moduleName, code, opts={}){
    const promises = []
    const rgx = opts.regex || espModRgx
    code.replace(rgx, (match, ...captures)=>{
      // const offset = captures.pop()
      // const string = captures.pop()
      const moduleName = captures[0]
      inc += 1

      console.log('the espruino_module capture', moduleName)
      let prom
      if(!cache[moduleName] || !cache[moduleName].isLoaded){
        cache[moduleName] = {
          position: inc,
          isLoaded: false,
          // filenameId: genId(moduleName),
          espruinoModuleName: moduleName
        }
        prom = transform(moduleName)
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


  function replaceAndCacheNormalRequires(newSrc, code){
    const promises = []

    code.replace(normalModRgx, (match, ...captures)=>{
      // const offset = captures.pop()
      // const string = captures.pop()
      const newSrc = captures[0]
      inc += 1

      console.log('the normal module capture', newSrc)
      let prom 
      if(!cache[newSrc] || !cache[newSrc].isLoaded){
        cache[newSrc] = {
          position: inc,
          isLoaded: false
        }
        prom = transform(newSrc)
      }
      else{
        cache[newSrc].position = inc
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

  function replaceDevIp(code){
    return code.replace(/process.env.DEV_SERVER_IP/, `"${devServerIp}"`)
  }



  async function addFilenameIdsToCacheConfigsAndUpdate(){
    const entries = Object.entries(cache)
    for(const [moduleName, config] of entries){
      config.filenameId = genId(config.code)
    }
    for(const [moduleName, config] of entries){
      let code = config.code
      code = code.replace(normalModRgx, getFilenameIdRequireViaModNameFromCache)
      code = code.replace(espModRgx, getFilenameIdRequireViaModNameFromCache)
      config.code = code
    }
  }

  function getFilenameIdRequireViaModNameFromCache(match, ...captures){
    const moduleName = captures[0]
    cache[moduleName].filenameId
    return `require('${cache[moduleName].filenameId}')`
  }



  
  await transform(src)
  await addFilenameIdsToCacheConfigsAndUpdate()




  cache[src].entryPoint = true
  console.log('complete in transformAndFollow!')
  return cache
}

async function getFilepath(src){
  try{
    await fs.readFile(src)
    console.log('found file from path', src)
    return src
  }
  catch(e){
    try{
      await fs.readFile(src + "/index.js")
      console.log('refound file from path', src + "/index.js")
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
  // console.log('the str', str)
  return Buffer.byteLength(str, 'utf8')
}


