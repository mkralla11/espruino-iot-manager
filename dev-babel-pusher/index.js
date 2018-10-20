// const transform = require('../transform-dir')
const transform = require('../src/babelTransformResolveRequires')
const fs = require('fs-extra')
const {promisify} = require('util')
const loadAndMinify = require('./loadAndMinify')
const chokidar = require('chokidar')
const findCacheDir = require('find-cache-dir')
const {pluck, indexBy, identity, prop, path: rpath} = require('ramda')

function initDevBabelPusher({port, esp, src, devServerIp}){
  const outDir = src + '/../build'

  const runExpression = (port, expr)=>
    new Promise((resolve)=>{
      esp.expr(port, expr, (res)=>
        resolve(res)
      )
    }) 

  let watcher
  let afterPush

  const watch = ({afterPush: afterPushCallback}={})=>{
    close()
    afterPush = afterPushCallback
    watcher = chokidar.watch(src)
    watcher.on('ready', function(){
      console.log('Dev Babel Pusher ready and watching...')
      watcher.on('change', (path, stats) => {
        if (stats) console.log(`File ${path} changed size to ${stats.size}`);
        determineTransformPush(path)
      })
    })
    determineTransformPush(src, {firstRun: true})
  }

  async function determineTransformPush(path, opts={}){
    // First, always get or generate the fileListConfig
    // which returns the fully transpiled app code 
    // for developer, both indexed by actual filename, and 
    // sorted by dependency order.
    //
    // if firstRun, and we don't have a cached config file to use
    // for contentHash comparison,
    // get fileList on device,
    // if fileList does not exist, assign empty array,
    // Next, compare fileList that was on the device
    // with sortedFileListConfig, collecting any non-existing
    // filenameId's on the device. (The filenameId's are a fnv hash
    // OF THE FILENAME. We are comparing filenameId's instead of contentHashes 
    // if there is no cached file config because we have to be cautious about 
    // the amount of data on our IoT device, and rather than
    // just assuming that we have to sync every transpiled app file
    // on firstRun without a local cache, we can use the metadata we
    // may have already stored regarding filenameId's on the device
    // to discern the needed files to sync, for which data is required
    // to be on the device to boot the app code anyways).
    // At this point, we have determined the neededFileConfigs.
    // 
    // If it's NOT the firstRun or a cachedFileConfig DOES exist,
    // we utilize the cachedFileConfig and compare it with a FULL
    // regeneration of transpiled app code (because it is so fast anyways
    // and gaurantees accuracy) in order to find missing modules on
    // the device utilizing the contentHash of the files in the cache
    // and the newly generated modules' contentHashes. By utilizing contenthashes 
    // from here on out, we can gaurantee even if a module already exists
    // on the device, we can ensure an 'overwrite' of it if the contents
    // have changed (overwriting the module in Storage).
    // 
    // At this point, we have handle NEW modules and UPDATED modules
    // that must be synced to the device and they are stored in neededFileConfigs.
    // Now we just need to store the neededFileConfigs on to the device (storeFilesOnDevice),
    // and then store the new fileList on the device (storeFileListOnDeviceFromFileConfigs)
    // to accommodate booting from flash.
    //
    // finally, we determine if we need to store the bootcode to the device, 
    // reset, and reload, OR just reset and reload


    const cachedFileConfigExists = await hasCachedFileListConfigFile()
    const fileListConfig = await getOrGenFileListConfig()
    const sortedFileListConfig = pluck(1)(fileListConfig.sortedConfig)
    // console.log('sortedFileListConfig', sortedFileListConfig)
    let neededFileConfigs = []
    
    console.log('cache file exists?', cachedFileConfigExists)
    if(opts.firstRun && !cachedFileConfigExists){
      let fileList = await getFileListOnDevice()
      console.log('file list on device', fileList)

      const configs = sortedFileListConfig
      const indexedFileList = indexBy(identity, fileList)
      for (const config of configs){
        if(!indexedFileList[config.filenameId]){
          neededFileConfigs.push(config)
        }
      }
    }
    else{
      const newFileListConfig = await genConfigFromPath(src)
      await storeCacheFileFromData(newFileListConfig)
      const configs = pluck(1)(newFileListConfig.sortedConfig)
      // pluck second element (the config) and then index by filenameId hash
      const indexedFileList = indexBy(prop('filenameId'), sortedFileListConfig)
      console.log('new files', pluck('filenameId', configs), 'existing', pluck('filenameId', sortedFileListConfig))
      for(const config of configs){
        if(!indexedFileList[config.filenameId] || rpath(['contentHash'], indexedFileList[config.filenameId]) !== config.contentHash){
          console.log('needs', config)
          neededFileConfigs.push(config)
        }
      }
    }
    console.log('needed file configs', neededFileConfigs)
    await storeFilesOnDevice(neededFileConfigs)
    await storeFileListOnDeviceFromFileConfigs(sortedFileListConfig)

    if(opts.firstRun || opts.storeBootCode){
      await storeBootCodeToDevice()
    }
    else{
      await resetAndLoadDevice()
    }

    console.log('push complete!!!')
    afterPush && afterPush({pushedModuleMetaData: neededFileConfigs, allModuleModuleMetaData: sortedFileListConfig})
  }


  async function getFileListOnDevice(){
    try{
      let fileList = await runExpression(port, "require('Storage').read('filelist')")
      console.log('trying', fileList)
      fileList = fileList.replace(/(< <<|>> >.*)/g, "")
      console.log('after trying', fileList)
      fileList = JSON.parse(fileList)
      console.log('last trying', fileList)
      // Double parse? that's weird...
      if(!fileList.filelist){
        fileList = JSON.parse(fileList)
      }
      return fileList.fileList || JSON.stringify({fileList: []})
    }
    catch(e){
      return JSON.stringify({fileList: []})
    }
  }


  async function resetAndLoadDevice(){
    expr = "reset(),load()"
    await runExpression(port, expr)
  }

  async function storeBootCodeToDevice(){
    const flashLoaderRuntime = await loadAndMinify(__dirname + '/../src/FlashLoader/index.js', {babelOptions})

    console.log('flashing FlashLoader runtime:', flashLoaderRuntime)
    expr = "E.setBootCode(" + JSON.stringify(flashLoaderRuntime) + ",true),reset(),load()"
    await runExpression(port, expr)
  }

  async function storeFilesOnDevice(neededFileConfigs){
    for (const data of neededFileConfigs){
      let {code, filenameId, entryPoint} = data
      if(entryPoint){
        console.log('found entry point!', filenameId)
        // filenameId = 'entry'
      }

      const expr = "require('Storage').write(" + `"${filenameId}"` + ", " + JSON.stringify(code) + ")"
      console.log('the run expression', expr)
      await runExpression(port, expr)
    }
  }

  async function storeFileListOnDeviceFromFileConfigs(fileConfigs){
    const fileList = []
    for (const data of fileConfigs){
      let {filenameId, entryPoint} = data
      if(entryPoint){
        console.log('found entry point for filelist!', filenameId)
        // filenameId = 'entry'
      }
      fileList.push(filenameId)
    }
    const expr = "reset(),require('Storage').erase('filelist'),require('Storage').write('filelist', " + JSON.stringify({fileList}) + ")"
    console.log('the run expression', expr)
    await runExpression(port, expr)
  }



  function getCachePath(){
    return findCacheDir({name: 'espruino-iot-manager'}) + '/fileListConfig.json'
  }

  async function hasCachedFileListConfigFile(){
    const exists = await fs.pathExists(getCachePath())
    return exists
  }

  async function getOrGenFileListConfig(){
    const filepath = getCachePath()
    try{
      const file = await fs.readFile(filepath)
      const data = JSON.parse(file)
      return data
    }
    catch(e){
      const data = await genConfigFromPath(src)
      await storeCacheFileFromData(data)
      return data
    }
  }

  async function storeCacheFileFromData(data){
    const dataJson = JSON.stringify(data)
    await fs.outputFile(getCachePath(), dataJson)
  }

  async function genConfigFromPath(path){
    const config = await transform(path, outDir, {babel: babelOptions, devServerIp})
    const sortedConfig = sortConfig(config)
    const data = {config, sortedConfig}
    return data
  }

  function sortConfig(config){
    let configNestedArray = Object.entries(config)
    configNestedArray.sort(([k1, a], [k2, b])=>
      b.position - a.position
    )
    return configNestedArray
  }


  const babelOptions = {
    babelrc: false,
    "presets": [
      [
        require.resolve("babel-preset-env"),
        {
          "targets": {
            "node": "1"
          }
        }
      ]
    ],
    "plugins": [
      [require.resolve("babel-plugin-module-resolver"), {
        "root": [src],
      }],
      require.resolve("babel-plugin-syntax-dynamic-import"),
      [require.resolve("babel-plugin-import-redirect"),
      {
        "suppressResolveWarning": true,
        "redirect": {
          [`${src}/(.*)`]: `^^^${src}/$1^^^`,
          [`^\/node_modules/(.+)`]: `espruino_module_$1`
        }
      }]
    ]
  }

  const delay = (numb)=>
    new Promise((resolve)=>
      setTimeout(()=>
        resolve()
      , numb)
    )



  function close(){
    if(watcher){
      watcher.close()
    }
  }

  function removeLocalCachedModuleMetaData(){
    
  }

  return {
    watch,
    close,
    removeLocalCachedModuleMetaData
  }
}




module.exports = function(opts){
  return initDevBabelPusher(opts)
}