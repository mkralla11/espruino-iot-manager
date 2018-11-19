const fs = require('fs')
const delay = require('../delay')

function logFree(){
  console.log('free', process.memory().free)
}

const comp = {
  write(name, data){
    let f
    try{
      logFree()
      f = E.openFile(name, 'w')
      f.write(data)
      f.close()
      return true
    }
    catch(e){
      console.log(`could not write ${name}!`, e)
      if(f){
        f.close()
      }
      return false
    }
  },
  read(name){
    let f
    try{
      logFree()
      const s = fs.statSync(name).size
      f = E.openFile(name, 'r')
      const data = f.read(s)
      f.close()
      return data
    }
    catch(e){
      console.log(`could not read ${name}!`, e)
      if(f){
        f.close()
      }
      return
    }
  },
  readRetry(name){
    return new Promise((resolve, reject)=>{
      let a = 0
      function readNow(){
        logFree()
        let data = comp.read(name)
        
        if(!data && data !== '' && a < 10){
          a++;
          console.log(`err file read ${name}! retry...`)
          setTimeout(readNow, 50)
        }
        else if(a >= 10){
          console.log('giving up!!!')
          reject(new Error(`could not read ${name}!`))
        }
        else{
          resolve(data)
        }
      }
      readNow()
    })
  },
  erase(name){
    logFree()
    return fs.unlinkSync(name)
  },
  readJSON(name){
    try{
      logFree()
      return JSON.parse(comp.read(name))
    }
    catch(e){
      return undefined
    }
  },
  writeRetry(name, data){
    return new Promise((resolve, reject)=>{
      let a = 0
      function store(){
      
        logFree()
        const r = comp.write(name, data)
        
        if(!r && a < 10){
          a++;
          console.log(`err file write ${name}! retry...`)
          setTimeout(store, 50)
        }
        else if(a >= 10){
          console.log('giving up!!!')
          reject(new Error(`could not store ${name}!`))
        }
        else{
          resolve(true)
        }
      }
      store()
    })
  }
}

module.exports = comp