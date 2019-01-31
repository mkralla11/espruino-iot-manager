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
  const w = require("Wifi")
  // always reconnect manually
  // to ensure our callbacks are called
  w.save('clear')
  w.disconnect()

  let files
  try{
    let f = S.read(process.env.FILE_LIST_KEY_NAME)
    files = JSON.parse(f)
  }
  catch(e){
    files = {fileList: []}
  }


  let val, name, atmpt=0
  let fileList = files.fileList

  function addModule(){
    if(!name){
      name = fileList.shift()
      atmpt = 0
    }
    if(!name){
      console.log('main boot complete')
      return
    }

    if(atmpt > 5){
      throw new Error(`Too Many attempts loading ${name}`)
    }

      // console.log('adding', name)
      digitalWrite(D12,  !val)
      let data
      try{
        data = S.read(name)
        Modules.addCached(name, data)
        // console.log(`success! ${name}`)
        // nullify name so the next name will be
        // processed
        name = null
        setTimeout(addModule, 100)
      }
      catch(e){
        console.log('error!, trying again', name, data, e)
        console.log(process.memory())
        atmpt += 1
        setTimeout(addModule, 200)
      }
  }

  console.log('starting main boot')
  addModule()
})
