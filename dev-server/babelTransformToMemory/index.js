const fnv = require('fnv-plus')
const {promisify} = require('util')
const transform = require('../../src/babelTransformResolveRequires')
const getBabelOptions = require('../../src/getBabelOptions')
const sortCompiledScriptConfig = require('../../src/sortCompiledScriptConfig')

function genId(text){
  return fnv.hash(text, 52).str().slice(0,8)
}


function babelTransformToMemory({src, asyncWrite}){
  const babelOptions = getBabelOptions({src})



  async function compile(){
    const {config, sortedConfig} = await genConfigFromPath(src)
    let fileList = genFileList(sortedConfig)
    let filelistText = JSON.stringify({fileList})
    const fileIdHash = genId(filelistText)
    const proms = []

    proms.push(storeToMemory(`/manifest_hash`, fileIdHash))
    proms.push(storeToMemory(`/${fileIdHash}-manifest.json`, filelistText))

    for(const data of sortedConfig){
      // console.log('sort', data)
      const {filenameId, code} = data[1]
      proms.push(storeToMemory(`/${filenameId}.js`, code))
    }

    console.log(`/${fileIdHash}-manifest.json`)
    

    await Promise.all(proms)
  }

  function storeToMemory(path, data){
    // console.log('data', data)
    return asyncWrite(path, data)
  }

  function genFileList(fileConfigs){
    const fileList = []
    for (const data of fileConfigs){
      let {filenameId, entryPoint} = data[1]
      fileList.push(filenameId)
    }
    return fileList
  }


  async function genConfigFromPath(path){
    const config = await transform(path, {babel: babelOptions})
    const sortedConfig = sortCompiledScriptConfig(config)
    const data = {config, sortedConfig}
    return data
  }



  return {
    compile
  }
}


module.exports = function(opts){
  return babelTransformToMemory(opts)
}