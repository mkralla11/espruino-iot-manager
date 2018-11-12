/*
 * FlashLoader.js - Load all code modules saved in flash using the FlashString module
 * Thorsten von Eicken 2016
 * MIT License
 *
 * Usage: require("FlashLoader")();
 */



// iterate through flash pages and load all modules



E.on('init', function() {
  const S = require("Storage")
  let files
  try{
    let f = S.read(process.env.FILE_LIST_KEY_NAME)
    files = JSON.parse(f)
  }
  catch(e){
    files = {fileList: []}
  }

  function addModule(name, atmpt=0){
    return new Promise((resolve, reject)=>{
      if(atmpt > 5){
        return reject(`Too Many attempts loading ${name}`)
      }
      setTimeout(()=>{
        console.log('adding', name)
        let data
        try{
          data = S.read(name)
          Modules.addCached(name, data)
          console.log(`success! ${name}`)
          resolve()
        }
        catch(e){
          console.log('error!, trying again', name, data, e)
          console.log(process.memory())
          atmpt += 1
          addModule(name, atmpt).then(resolve).catch(reject)
        }
      }, 100)
    })
  }

  let fileList = files.fileList

  function addModules(){
    const mod = fileList.shift()
    if(mod){
      addModule(mod).then(()=>{
        addModules()
      })
    }
  }
  addModules()
})
