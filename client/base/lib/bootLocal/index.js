const delay = require('../delay')
const diffDel = require('../diffDel')
const readHshFileList = require('../readHshFileList')


module.exports =function bootLocal({S, M, get, cdnUrl}){
  try{
  function wrap(item){
    return !!item ? [item] : []
  }


  // ['fff1', 'fff2', 'fff3']
  const hshs = S.readJSON('mnf_hsh') || []
  console.log('booting', hshs)
  // hsh is the current hsh to load,
  // 'fff3'
  // hshs is now the others to delete
  // ['fff1', 'fff2']
  const hsh = hshs.pop()
  console.log('booting1', hsh)
  // first, delete the difference of module 
  // files from other versions of mnf_hsh array,
  // keeping any that are shared
  diffDel({
    S,
    keep: [hsh],
    rm: [...hshs]
  })

  


  // delete the other fileLists
  for(const delHsh of hshs){
    S.erase(delHsh)
  }

  // write only the kept hsh as array to storage
  S.write('mnf_hsh', JSON.stringify(wrap(hsh)))


  const fileList = readHshFileList(hsh, {S})
  console.log('the list', fileList)

  function loadFiles(idx=0){
    return new Promise((resolve, reject)=>{
      function loadNow(idx){
        // console.log('load files', fileList)
        // next load missing files from server
        if(fileList[idx]){
          const name = fileList[idx]
          console.log('adding', name)
          let data
          try{
            data = S.read(name)
          }
          catch(e){

          }
          let prom
          if(!data){
            prom = get(
              cdnUrl + '/' + name + '.js'
            )
          }
          else{
            prom = Promise.resolve(data)
          }
          prom.then((data)=>{
            console.log('writing', name)
            S.writeRetry(name, data).then(()=>{
              setTimeout(()=>
                loadNow(idx + 1)
              , 30)
            }).catch((e)=>{
              console.log('tried retry, giving up', name)
            })
          }).catch((e)=>{
            console.log('error fetch!', name, data)
          })
        }
        else{
          console.log('done loading!', fileList, idx)
          resolve()
        }
      }
      loadNow(idx)
    })
  }



  function execFiles(idx=0){
    return new Promise((resolve, reject)=>{
      function execFile(idx){
        if(fileList[idx]){
          try{
            const name = fileList[idx]
            console.log('exec', name)
            S.readRetry(name).then((data)=>{
              M.addCached(name, data)
              setTimeout(()=>
                execFile(idx + 1)
              , 30)
            })
          }
          catch(e){
            console.log('error exec!', e)
            reject(e)
          }
        }
        else{
          console.log('done exec!')
          resolve()
        }

      }
      execFile(idx)
    })
  }



  // avoid watchdog timeout
  return loadFiles().then(()=>delay(100)).then(()=>{
    // run modules from flash
    return execFiles()
  }).catch((e)=>{
    console.log('bl before crap', e)
  })
  }
  catch(e){
    console.log('bootLocal!', e)
  }
}
